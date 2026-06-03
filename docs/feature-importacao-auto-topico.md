# Feature: criar automaticamente o tópico (sub-deck) na importação de flashcards

## Resumo do pedido

Hoje, ao importar um lote de flashcards (JSON) **dentro de uma matéria** (deck-raiz),
o sistema só encaixa o card num sub-deck (tópico) se já existir um tópico semelhante.
Quando o tópico informado no flashcard **não existe**, o card é jogado na matéria-raiz
e o usuário recebe um aviso de "tópico não encontrado".

**O comportamento desejado é:**

> Ao importar em uma matéria, o sistema deve **criar automaticamente o tópico
> (sub-deck)** informado em cada flashcard (campo `topicName`). Se o tópico **já
> existir**, apenas inserir os cards no tópico existente.

Ou seja: o `topicName` de cada card passa a **gerar/encontrar** o sub-deck correto,
sem deixar cards soltos na raiz nem exibir aviso de "não encontrado".

---

## Contexto (de onde vem o `topicName`)

Esses flashcards são gerados por uma rotina automática a partir de PDFs de concurso
(pasta `material-fonte/<matéria>/`, saída em `flashcards-gerados/`). Convenções:

- **Matéria** = deck-raiz escolhido na importação (ex.: "AFO").
- **Tópico/assunto** = campo `topicName` de cada card (ex.: "Orçamento Público",
  "PPA"). A rotina identifica o assunto pelo conteúdo do PDF e mantém uma taxonomia
  canônica para não criar tópicos quase-duplicados.

Formato de cada card importado (já validado por `npm run validate:cards`):

```json
{
  "front": "Enunciado (obrigatório)",
  "back": "Resposta/explicação (obrigatório)",
  "options": ["A", "B", "C", "D", "E"],   // opcional (múltipla escolha)
  "correctOption": "C",                       // opcional, letra A–E
  "topicName": "Orçamento Público"            // opcional → vira o sub-deck
}
```

---

## Comportamento ATUAL (a ser alterado)

Arquivo: `src/App.tsx`, função `buildAndSaveCards` (≈ linhas 167–218).

Trecho relevante:

```ts
let finalDeckId = deckId;
if (isRoot && c.topicName) {
    const topicStr = String(c.topicName).trim() || 'Assuntos Gerais';
    const existingSub = decks.find(d => d.parentId === deckId && isSimilarTopic(d.name, topicStr, targetDeck?.name));
    if (existingSub) {
        finalDeckId = existingSub.id;
    } else {
        unmatchedTopics.add(topicStr);   // <-- NÃO cria o tópico; card fica na raiz
    }
}
```

E em `handleImportCards` há a mensagem "Sugestão de tópico não encontrada: ...".

---

## Comportamento DESEJADO

Quando `isRoot && c.topicName`:

1. Se existir sub-deck semelhante (via `isSimilarTopic`) → usar o existente
   (`finalDeckId = existingSub.id`). **(igual a hoje)**
2. Se **não** existir → **criar um novo sub-deck** filho da matéria-raiz, com
   `name = topicStr`, e usar o id dele (`finalDeckId = novoDeck.id`).
3. Persistir os novos sub-decks (Firestore) e refletir na UI.
4. Não usar mais `unmatchedTopics` para "card solto na raiz"; o aviso passa a ser
   informativo do tipo "N novos tópicos criados".

### Pontos de atenção (importantes)

- **Reuso dentro do mesmo lote:** o estado `decks` (React) **não atualiza durante o
  loop**. É preciso uma estrutura local (ex.: `Map<chaveNormalizada, deckId>`)
  inicializada com os sub-decks existentes e **acrescida a cada tópico novo criado**,
  para que vários cards com o mesmo `topicName` no mesmo import caiam **no mesmo**
  sub-deck (sem criar duplicatas).
- **Correspondência:** ao procurar tópico existente, manter `isSimilarTopic` (já trata
  variações de nome). Para os criados no próprio lote, comparar pela mesma
  normalização usada em `isSimilarTopic`/`normalizeTopic` (ver `src/lib/topicUtils.ts`).
- **Persistência:** `Deck` = `{ id, parentId?, name, description?, createdAt }`.
  Criar com `id: uuidv4()`, `parentId: deckId`, `createdAt: new Date()`. Salvar com
  `saveDeckToDb(user.uid, novoDeck)` (existe em `src/db.ts`). Os cards continuam
  indo por `saveCardsBatchToDb`.
- **Sem `topicName`:** se o card não tiver `topicName`, mantém o comportamento de ir
  para a matéria-raiz (não criar tópico).
- **Hierarquia:** criar **um nível** abaixo do deck escolhido (matéria-raiz → tópico).
- **Remover** o prefixo "[Assunto Sugerido pela IA: ...]" e a mensagem de
  "tópico não encontrado", que deixam de fazer sentido.

### Esboço da lógica (ilustrativo, adaptar ao código real)

```ts
// antes do loop:
const newDecks: Deck[] = [];
const topicMap = new Map<string, string>(); // chaveNormalizada -> deckId
decks.filter(d => d.parentId === deckId)
     .forEach(d => topicMap.set(normalizeTopic(d.name), d.id));

// dentro do loop, quando isRoot && c.topicName:
const topicStr = String(c.topicName).trim() || 'Assuntos Gerais';
const existing = decks.find(d => d.parentId === deckId && isSimilarTopic(d.name, topicStr, targetDeck?.name))
              ?? newDecks.find(d => isSimilarTopic(d.name, topicStr, targetDeck?.name));
if (existing) {
    finalDeckId = existing.id;
} else {
    const novo: Deck = { id: uuidv4(), parentId: deckId, name: topicStr, createdAt: new Date() };
    newDecks.push(novo);
    topicMap.set(normalizeTopic(topicStr), novo.id);
    finalDeckId = novo.id;
}

// depois do loop:
for (const d of newDecks) await saveDeckToDb(user.uid, d);
if (newCards.length > 0) await saveCardsBatchToDb(user.uid, newCards);
```

---

## Critérios de aceite

1. Importar um JSON com `topicName` inédito **cria** o sub-deck na matéria e coloca
   os cards nele (nada fica solto na raiz).
2. Importar com `topicName` já existente (igual ou semelhante) **reaproveita** o
   sub-deck, sem criar duplicata.
3. Vários cards com o mesmo `topicName` no mesmo import vão **todos** para o mesmo
   sub-deck (um único deck criado).
4. Cards sem `topicName` continuam na matéria-raiz.
5. A deduplicação de cards por `front` (`normalizeFront`) continua funcionando.
6. A mensagem final reflete a nova lógica (ex.: "X flashcards importados, Y tópicos
   criados") e não menciona mais "tópico não encontrado".
7. Os sub-decks criados aparecem imediatamente na árvore de Matérias após o import.

## Arquivos provavelmente envolvidos

- `src/App.tsx` — `buildAndSaveCards` e `handleImportCards`.
- `src/lib/topicUtils.ts` — `isSimilarTopic`, `normalizeTopic` (reuso/normalização).
- `src/db.ts` — `saveDeckToDb`, `saveCardsBatchToDb` (já existem).
- `src/types.ts` — tipo `Deck` (referência).
