# material-fonte

PDFs de conteúdo (teoria + questões + gabarito) que servem de fonte para a rotina
**"Gerador de flashcards (PDF → import)"**.

## Organização por matéria (uma pasta por matéria)

Os PDFs ficam **dentro de subpastas**, uma por matéria, para que materiais de
matérias diferentes não se misturem:

```
material-fonte/
  ├── materia-01/   ← renomeie para a matéria (ex.: afo)
  │     ├── <pdf 1>.pdf   (1 assunto/tópico)
  │     ├── <pdf 2>.pdf
  │     └── ... (~15 PDFs)
  ├── materia-02/   ← renomeie (ex.: direito-constitucional)
  └── ...
```

- **Renomeie** cada pasta `materia-XX` para o nome real da matéria. O nome da
  pasta é usado como a **matéria** (deck raiz) na organização dos flashcards.
- Uma matéria pode ser **agrupada** em mais um nível — `material-fonte/<grupo>/<sub-matéria>/`
  (ex.: `Tecnologia da Informação/Informática/`). A **sub-matéria** (pasta-folha) é a
  matéria; o **grupo** é só o agrupamento. No app, o botão **Atualizar** da
  matéria-raiz lista as sub-matérias e importa cada uma como um subtópico.
- Os **nomes dos arquivos PDF podem ser aleatórios** — a rotina identifica o
  assunto pelo **conteúdo** de cada PDF, não pelo nome.
- Cada PDF costuma ser de **um assunto/tópico específico**; a rotina marca os
  flashcards daquele PDF com esse tópico (campo `topicName`), de modo que, ao
  importar na matéria-raiz, o app cria automaticamente um sub-deck por assunto.

## Saída

A rotina grava os flashcards em `../flashcards-gerados/` (ver README de lá) e
registra o avanço em `../flashcards-gerados/_progresso.json`.
