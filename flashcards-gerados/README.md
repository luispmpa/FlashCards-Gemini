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

```json
{
  "atualizadoEm": "2026-06-03T03:00:00.000Z",
  "materias": [
    {
      "materia": "afo",
      "topicosCanonicos": ["Orçamento Público", "PPA", "LDO", "LOA"],
      "pdfsProcessados": [
        { "arquivo": "material-fonte/afo/xyz.pdf", "assunto": "Orçamento Público",
          "paginasCobertas": "1-73", "cards": 180 }
      ],
      "totalCards": 180
    }
  ]
}
```

- **`topicosCanonicos`**: lista de tópicos/subtópicos já usados na matéria. Antes
  de criar um `topicName` novo, a rotina consulta essa lista e **reutiliza** um
  equivalente se já existir (evita proliferação de tópicos).

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
