import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// We won't block startup if key is missing, only throw when we generate cards
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/generate-cards", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is required to generate cards." });
      }

      const { subject, topicPrompt, examBoard, count = 10, existingFronts = [], existingTopics = [] } = req.body;
      
      let existingText = "";
      if (existingFronts.length > 0) {
          existingText = `\nINSTRUÇÃO CRÍTICA PARA EVITAR DUPLICATAS: A base do usuário já possui flashcards para este assunto. As seguintes questões JÁ EXISTEM. VOCÊ ESTÁ ESTRITAMENTE PROIBIDO de gerar questões idênticas ou muito relativas a estas:\n${existingFronts.map((f: string) => `- ${f.substring(0, 100)}...`).join('\n')}\nCrie novas abordagens e faça perguntas diferentes.\n`;
      }

      let topicsText = "";
      if (existingTopics.length > 0) {
          topicsText = `\nINSTRUÇÃO CRÍTICA E PROTOCOLO DE MAPEAMENTO DE TÓPICOS EXISTENTES:
O usuário já possui os seguintes sub-tópicos/assuntos cadastrados na matéria principal "${subject}":
${existingTopics.map((t: string) => `- ${t}`).join('\n')}

Para agrupar os novos flashcards, siga estritamente estas diretrizes:
1. NÃO CRIE NENHUM TÓPICO NOVO se a questão puder ser minimamente relacionada, integrada ou contextualizada com algum dos tópicos existentes listados acima. 
2. Use EXATAMENTE a mesma grafia e acentuação do assunto existente no campo "topicName".
3. Por exemplo, se a questão for sobre as modalidades, pregão, dispensa, dispensa de licitação, inexigibilidade ou nova lei de licitações, e o tópico existente for "Licitações", você deve obrigatoriamente usar "Licitações" em "topicName". Não use "Nova Lei de Licitações (Lei 14.133)" nem "Pregão Eletrônico" a menos que "Licitações" não exista.
4. Reduza ao máximo os tópicos novos. Só crie por exceção se for um assunto 100% distinto e sem sobreposição com os existentes.
`;
      }

      const prompt = `Gere ${count} flashcards focados em um nível avançado e estilo da banca ${examBoard || 'institucional padrão'} para a matéria "${subject}". 
      Instruções sobre o que o usuário quer que você gere: "${topicPrompt}". (Se o usuário não especificou nada ou disse "decida", escolha os tópicos mais cobrados em concursos públicos para esta matéria).
      Os flashcards devem estar no formato de questões de múltipla escolha (alternativas de A até E).
      A resposta (back) deve conter apenas a alternativa correta e a explicação didática detalhada. A explicação MÁXIMA deve ser ESTRUTURADA USANDO MARKDOWN RIQUEZA DE DETALHES (use cabeçalhos '###', listas '-', e **negrito** nas palavras-chave) para que a leitura não seja cansativa. Abranja por que a certa é a certa e, brevemente, os erros das demais. CERTIFIQUE-SE DE ESCAPAR AS QUEBRAS DE LINHA (use \\n) PARA MANTER O JSON VÁLIDO.
      ${existingText}
      ${topicsText}

      Importante: Inclua também um campo "topicName" em cada item do JSON informando o nome do Sub-Tópico ao qual a questão pertence (ex: "Princípios do Orçamento", "Atos Administrativos", "Licitações", etc.). Evite criar múltiplos tópicos redundantes.

      Você DEVE retornar APENAS um array JSON puro. O formato do array gerado deve ser válido (cuidado com aspas duplas, escape corretamente com \\" e as quebras de linha com \\n na string JSON).
      `;

      let attempt = 0;
      const maxRetries = 2;
      let jsonText = "[]";

      while (attempt <= maxRetries) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      topicName: { 
                        type: "STRING", 
                        description: existingTopics.length > 0 
                          ? `Nome do Sub-Tópico. OBRIGATÓRIO: Se a questão se relacionar com algum dos seguintes tópicos existentes, escreva EXATAMENTE o nome dele: [${existingTopics.join(', ')}]. Não altere letras nem adicione detalhes. Se for um assunto totalmente novo e descorrelacionado dos anteriores, forneça um nome novo bem amplo e unificado (evite especificidades ou números de leis no nome do tópico).`
                          : "Nome do Sub-Tópico Específico bem definido, amplo e unificado (evite fragmentar ou colocar artigos de leis no nome do tópico)."
                      },
                      front: { type: "STRING", description: "Texto da questão" },
                      options: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "Alternativas de A até E"
                      },
                      back: { type: "STRING", description: "Gabarito (ex: Gabarito: B) e Explicação formatada em Markdown." }
                    },
                    required: ["topicName", "front", "options", "back"]
                  }
                }
            }
          });

          jsonText = response.text || "[]";
          break; // success
        } catch (err: any) {
          console.error(`Attempt ${attempt + 1} failed:`, err.message);
          attempt++;
          if (attempt > maxRetries) {
            throw err;
          }
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clean up markdown just in case
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

      const cards = JSON.parse(jsonText);
      res.json(cards);
    } catch (error: any) {
      console.error("Error generating cards:", error);
      res.status(500).json({ error: error.message || "Failed to generate cards." });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
