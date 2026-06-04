# flashcards-gerados

Saída da rotina **"Gerador de flashcards (PDF → import)"**.

- A saída é organizada **por matéria**, espelhando `material-fonte/`:
  `flashcards-gerados/<materia>/<assunto>.json` — cada um um **array JSON** no
  formato de importação do AprovaCard.
- O arquivo `_progresso.json` é a **memória entre execuções**: registra o que já
  foi coberto e mantém o **registro canônico de tópicos** por matéria, para a
  rotina continuar de onde parou, **não repetir** cards e **reaproveitar**
  tópicos/subtópicos já existentes (em vez de criar quase-duplicatas).

## Estrutura do `_progresso.json`

Este arquivo também **alimenta o mini-dashboard** em Configurações (ele é incluído
no build do app). A rotina deve mantê-lo com estes campos:

```json
{
  "atualizadoEm": "2026-06-03T03:00:00.000Z",
  "totalCardsGerados": 180,
  "possiveisDuplicatasEvitadas": 0,
  "materias": [
    {
      "materia": "afo",
      "pdfsDetectados": 15,
      "pdfsProcessados": 1,
      "totalCardsGerados": 180,
      "topicosCanonicos": ["Orçamento Público", "PPA", "LDO", "LOA"],
      "pdfs": [
        {
          "arquivo": "material-fonte/afo/xyz.pdf",
          "assunto": "Orçamento Público",
          "paginas": "1-73",
          "cardsGerados": 180,
          "concluido": true
        }
      ],
      "alertas": []
    }
  ]
}
```

- **`topicosCanonicos`**: tópicos/subtópicos já usados na matéria. Antes de criar
  um `topicName` novo, a rotina consulta essa lista e **reutiliza** um equivalente
  se já existir (evita proliferação de tópicos).
- **`pdfsDetectados` / `pdfsProcessados`**: total de PDFs na pasta da matéria vs.
  quantos já foram processados — é o que mede "o que falta gerar" no dashboard.
- **`pdfs[].concluido`**: marque `false` enquanto um PDF não foi 100% coberto
  (aparece como "em andamento" no painel).
- **`possiveisDuplicatasEvitadas`**: contador de cards/itens pulados por já existirem.
- **`alertas`**: mensagens livres por matéria (ex.: "questão sem gabarito clara").

> Observação: a GERAÇÃO registrada aqui vive no GitHub e **não** é afetada por
> apagar cards no app. O "no sistema" do dashboard é calculado ao vivo do banco
> (Firestore), então **reflete** o botão Apagar.

## Como importar no sistema

1. Abra o arquivo `.json` desejado aqui no GitHub.
2. Copie todo o conteúdo (ou baixe o arquivo).
3. No AprovaCard: **Matérias (Hierarquia) → Importar** → cole o JSON → confirme.

## Validar antes de importar

```bash
npm run validate:cards                 # valida todos os .json desta pasta
npm run validate:cards flashcards-gerados/2026-06-03-portugues.json
```

O validador confere o schema real do app (`front`/`back` obrigatórios,
`correctOption` dentro de `options`, duplicatas etc.).

## Formato de cada card

```json
{
  "front": "Enunciado/pergunta (obrigatório)",
  "back": "Resposta didática e objetiva, fundamentada no PDF (obrigatório)",
  "options": ["Alt A", "Alt B", "Alt C", "Alt D", "Alt E"],
  "correctOption": "C",
  "topicName": "Assunto (organiza em sub-matérias na importação)"
}
```

`options`, `correctOption` e `topicName` são opcionais (use `options`/`correctOption`
apenas em questões de múltipla escolha).
