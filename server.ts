import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json';

// Initialize firebase admin for token verification.
// IMPORTANT: passamos projectId explicitamente porque o servidor roda em um projeto
// (AI Studio) diferente do projeto do Firebase que emite os tokens do usuário.
// Sem isso, verifyIdToken rejeita o token por incompatibilidade de audiência ("aud").
try {
  initializeApp({
    credential: applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
} catch (e: any) {
  if (e.code !== 'app/duplicate-app') {
    console.error("Firebase admin init error:", e);
  }
}

// Extend Request type to include uid
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

// We won't block startup if key is missing, only throw when we generate cards
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Rate limit logic in memory
const rateLimitMap = new Map<string, { count: number, windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_GENERATIONS_PER_WINDOW = 20;

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  try { 
    const decodedToken = await getAuth().verifyIdToken(token);
    req.uid = decodedToken.uid;
    next(); 
  }
  catch (e) {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/generate-cards", requireAuth, async (req, res) => {
    try {
      const uid = req.uid!;
      
      // Check rate limit
      const now = Date.now();
      const userRate = rateLimitMap.get(uid) || { count: 0, windowStart: now };
      if (now - userRate.windowStart > RATE_LIMIT_WINDOW_MS) {
        userRate.count = 0;
        userRate.windowStart = now;
      }
      
      if (userRate.count >= MAX_GENERATIONS_PER_WINDOW) {
        res.status(429).json({ error: "Limite de geração excedido. Tente novamente mais tarde." });
        return;
      }
      
      // Increment only if we actually proceed to generate
      rateLimitMap.set(uid, { ...userRate, count: userRate.count + 1 });
      
      if (!ai) {
        res.status(500).json({ error: "GEMINI_API_KEY environment variable is required to generate cards." });
        return;
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

      Antes de finalizar cada questão, REVISE criticamente: confirme que a alternativa marcada como correta está de fato correta segundo a doutrina/jurisprudência majoritária e que as demais estão de fato erradas. Se houver qualquer dúvida sobre o gabarito, REFORMULE a questão para uma que você tenha certeza. O campo "correctOption" deve ser exatamente a letra da alternativa correta e DEVE ser coerente com o 'Gabarito:' escrito no campo "back".

      Importante: Inclua também um campo "topicName" em cada item do JSON informando o nome do Sub-Tópico ao qual a questão pertence (ex: "Princípios do Orçamento", "Atos Administrativos", "Licitações", etc.). Evite criar múltiplos tópicos redundantes.

      Você DEVE retornar APENAS um array JSON puro. O formato do array gerado deve ser válido (cuidado com aspas duplas, escape corretamente com \\" e as quebras de linha com \\n na string JSON).
      `;

      let attempt = 0;
      const maxRetries = 3;
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
                      back: { type: "STRING", description: "Gabarito (ex: Gabarito: B) e Explicação formatada em Markdown." },
                      correctOption: { type: "STRING", description: "Letra da alternativa correta: A, B, C, D ou E." },
                      verification: { type: "STRING", description: "Justificativa curta de por que a alternativa correta está certa (fonte ou raciocínio)." },
                      confidence: { type: "STRING", description: "Autoavaliação da certeza do gabarito. Deve ser exatamente: alta, media ou baixa." }
                    },
                    required: ["topicName", "front", "options", "back", "correctOption", "verification", "confidence"]
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
          // Backoff exponencial: 1s, 2s, 4s — dá tempo para picos de demanda (503) passarem
          const backoffMs = 1000 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }

      // Clean up markdown just in case
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

      const cards = JSON.parse(jsonText);
      const filteredCards = cards.filter((c: any) => {
        if (c.confidence === "baixa") {
          console.log(`[Double-Check] Descartando card de baixa confiança: Topic: ${c.topicName}, Question: ${c.front?.substring(0, 50)}... Reason: ${c.verification}`);
          return false;
        }
        return true;
      });

      console.log(`[Double-Check] Geração finalizada: originais=${cards.length}, válidos=${filteredCards.length}, descartados=${cards.length - filteredCards.length}`);

      const responseCards = filteredCards.map((c: any) => ({
        topicName: c.topicName,
        front: c.front,
        options: c.options,
        back: c.back,
        correctOption: c.correctOption
      }));

      res.json(responseCards);
    } catch (error: any) {
      console.error("Error generating cards:", error);
      const raw = String(error?.message || "");

      // Modelo sobrecarregado / indisponível (503)
      if (
        raw.includes("503") ||
        raw.toUpperCase().includes("UNAVAILABLE") ||
        raw.toLowerCase().includes("overloaded") ||
        raw.toLowerCase().includes("high demand")
      ) {
        res.status(503).json({
          error: "O modelo de IA está sobrecarregado no momento. Aguarde alguns instantes e tente gerar novamente.",
        });
        return;
      }

      // Cota/limite da API atingido (429)
      if (raw.includes("429") || raw.toUpperCase().includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({
          error: "Muitas requisições à IA em pouco tempo. Aguarde um momento e tente novamente.",
        });
        return;
      }

      // Falha ao interpretar o JSON retornado pela IA
      if (error instanceof SyntaxError) {
        res.status(502).json({
          error: "A IA retornou uma resposta inválida. Tente gerar novamente.",
        });
        return;
      }

      res.status(500).json({
        error: "Não foi possível gerar os flashcards agora. Tente novamente em instantes.",
      });
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
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
