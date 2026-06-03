# flashcards-gerados

Saída da rotina **"Gerador de flashcards (PDF → import)"**.

- Cada execução cria um arquivo `AAAA-MM-DD-<tema>.json` — um **array JSON** no
  formato de importação do AprovaCard.
- O arquivo `_progresso.json` é a **memória entre execuções**: registra o que já
  foi coberto (por PDF, assuntos e páginas) e o total acumulado, para a rotina
  continuar de onde parou e **não repetir** cards.

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
