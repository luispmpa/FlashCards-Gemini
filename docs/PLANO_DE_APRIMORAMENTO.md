# Plano de Aprimoramento — AprovaCard (FSRS Concursos)

> Documento de instruções para o assistente de código (Google AI Studio / Gemini).
> Objetivo: corrigir os pontos críticos do sistema **sem quebrar o comportamento existente**.
> Para **cada item** abaixo há: **O que está ruim**, **Como deveria ser** e **Como corrigir** (passo a passo).

## Sobre o produto (contexto para o agente)

O **AprovaCard** é um app de **flashcards de múltipla escolha gerados por IA** com **repetição espaçada (FSRS)**, voltado para candidatos de concursos públicos. O núcleo de valor são três coisas, e é por elas que as prioridades abaixo estão ordenadas:

1. **O algoritmo de agendamento (FSRS)** — precisa ser fiel, não uma heurística.
2. **A confiabilidade da geração por IA** — JSON válido e gabarito estruturado.
3. **A fidelidade da correção das questões** — saber qual alternativa é a correta de forma robusta.

### Regras gerais (válidas para todos os itens)
- Mantenha o stack atual: **React + Vite + TypeScript**, **Firebase (Firestore + Auth Google)**, **Express (`server.ts`)** e **Gemini**.
- Não altere o modelo de dados por usuário (`/users/{uid}/decks`, `/users/{uid}/cards`) sem necessidade; quando alterar, **atualize também `firestore.rules` e `firebase-blueprint.json`**.
- **Escreva testes** para qualquer lógica pura nova ou alterada (sobretudo FSRS e parser de gabarito).
- Rode `npm run lint` (que é `tsc --noEmit`) e garanta que passa.
- Faça mudanças pequenas e revisáveis, um item por vez.

---

# 🔴 Prioridade CRÍTICA

## 1. O "FSRS" não é FSRS — é uma heurística com multiplicadores fixos

**Arquivo:** `src/lib/fsrs.ts`

### O que está ruim
- O próprio comentário admite: *"This is a simplified, simulated FSRS scheduling algorithm"*. Hoje o agendamento usa apenas multiplicadores fixos (`Good ×2.5`, `Easy ×3.5`, etc.).
- A **`difficulty` é estado morto**: é calculada e salva, mas **não influencia o intervalo** — `nextStability` não depende dela. Metade do modelo FSRS não faz nada.
- **Não há retenção-alvo nem teto de intervalo.** `nextDue = addDays(now, nextStability)` com `stability *= 2.5` a cada acerto cresce sem limite — poucos "Bom" seguidos jogam o card para meses/anos.
- **Frações de dia são truncadas.** `addDays(now, 1.2)` resulta em **+1 dia** (date-fns trunca); `stability 0.1` vira `addDays(0)` = vence agora. A granularidade fina do FSRS é perdida.
- `elapsed_days` e `scheduled_days` são gravados, mas **não entram no cálculo**.

### Como deveria ser
O agendamento deve usar o **FSRS real**: retrievability, ganho de estabilidade dependente de dificuldade/estabilidade/retrievability, retenção-alvo configurável (ex.: 0.9), fuzz de intervalo e teto máximo. Não reimplemente as fórmulas à mão.

### Como corrigir
1. Adicione a dependência canônica (MIT): `npm install ts-fsrs`.
2. Reescreva `src/lib/fsrs.ts` como um **adaptador** entre o nosso tipo `FSRSData` e a `ts-fsrs`, preservando a assinatura pública `applyFSRSRating(card, rating, now)` e `createInitialFSRSData()` para não quebrar `StudyView.tsx` nem `mockData.ts`.
3. Mapeie os ratings: `Again→Rating.Again`, `Hard→Rating.Hard`, `Good→Rating.Good`, `Easy→Rating.Easy`.
4. Exemplo de adaptador:

```ts
import { fsrs, generatorParameters, createEmptyCard, Rating as FsrsRating, State, type Card as FsrsCard } from 'ts-fsrs';
import { Flashcard, FSRSData, Rating } from '../types';

const f = fsrs(generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36500, // dias (~100 anos = sem explosão, mas com teto)
  enable_fuzz: true,
}));

const RATING_MAP: Record<Rating, FsrsRating> = {
  Again: FsrsRating.Again, Hard: FsrsRating.Hard, Good: FsrsRating.Good, Easy: FsrsRating.Easy,
};

// converte nosso FSRSData -> Card da lib
function toFsrsCard(d: FSRSData): FsrsCard { /* mapear state/due/stability/difficulty/reps/lapses/last_review */ }
// converte Card da lib -> nosso FSRSData
function fromFsrsCard(c: FsrsCard): FSRSData { /* caminho inverso */ }

export function applyFSRSRating(card: Flashcard, rating: Rating, now: Date = new Date()): Flashcard {
  const result = f.next(toFsrsCard(card.fsrsData), now, RATING_MAP[rating]);
  return { ...card, fsrsData: fromFsrsCard(result.card) };
}

export function createInitialFSRSData(): FSRSData {
  return fromFsrsCard(createEmptyCard(new Date()));
}
```

5. **Cuidado com compatibilidade dos dados existentes:** cards já salvos têm `difficulty` na escala 1–10 e `stability` em dias. A `ts-fsrs` usa as mesmas grandezas; se algum card estiver com `stability: 0` (estado "New"), trate como card novo. Não falhe ao ler cards antigos.
6. **Crie testes** `src/lib/fsrs.test.ts`: card novo → "Good" vira "Review" com intervalo ≥ 1 dia; "Again" em "Review" incrementa `lapses` e cai para "Relearning"; intervalos crescem mas respeitam `maximum_interval`; `difficulty` varia entre 1 e 10.

---

## 2. A alternativa correta é "garimpada" de texto livre por regex

**Arquivos:** `src/components/StudyView.tsx` (linha ~132), `server.ts` (schema da geração), `src/types.ts`

### O que está ruim
Toda a correção da questão depende de:
```ts
const match = activeCard.back.match(/Gabarito:\s*([A-E])/i);
```
Se o modelo escrever "Resposta: B", "Gabarito B)" ou colocar o gabarito apenas dentro da explicação, o destaque de certo/errado **quebra silenciosamente**. Num app de múltipla escolha, isso compromete a função principal.

### Como deveria ser
A alternativa correta deve ser um **dado estruturado** retornado pela IA e **persistido no card**, não extraído de prosa.

### Como corrigir
1. Em `server.ts`, adicione ao `responseSchema` um campo obrigatório `correctOption` (letra `A`–`E`):
```ts
correctOption: { type: "STRING", description: "Letra da alternativa correta: A, B, C, D ou E." }
```
   e reforce no prompt que `correctOption` deve ser coerente com o "Gabarito:" escrito em `back`.
2. Em `src/types.ts`, adicione ao `Flashcard`: `correctOption?: string;` (mantenha opcional para compatibilidade com cards antigos).
3. Em `src/App.tsx` (`handleGenerateCards`), salve `correctOption: c.correctOption` no card gerado.
4. Atualize `firestore.rules` (`isValidCard`): permitir a nova chave e ajustar o limite de `data.size()` (hoje 7–8) para acomodar o campo. Valide: `(!('correctOption' in data) || (data.correctOption is string && data.correctOption.size() == 1))`.
5. Em `StudyView.tsx`, calcule `correctIndex` a partir de `activeCard.correctOption` quando existir, e **só caia no regex como fallback** para cards antigos:
```ts
const letter = activeCard.correctOption ?? activeCard.back.match(/Gabarito:\s*([A-E])/i)?.[1];
correctIndex = letter ? letter.toUpperCase().charCodeAt(0) - 65 : -1;
```
6. Atualize `firebase-blueprint.json` com o novo campo.

---

## 3. O endpoint de IA (que custa dinheiro) é público e sem autenticação

**Arquivo:** `server.ts` (rota `POST /api/generate-cards`)

### O que está ruim
A rota não verifica nenhum token, não tem rate-limit e nem cota por usuário. Como o app é publicado numa URL pública (Cloud Run), **qualquer pessoa pode chamar a rota e queimar o `GEMINI_API_KEY`** (custo e abuso).

### Como deveria ser
Apenas usuários autenticados do próprio app podem gerar cards, com um limite de uso por usuário/janela de tempo.

### Como corrigir
1. No cliente (`src/App.tsx`, dentro de `handleGenerateCards`), envie o ID token do Firebase:
```ts
const token = await auth.currentUser?.getIdToken();
const res = await fetch("/api/generate-cards", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({ ... })
});
```
2. No servidor (`server.ts`), use o **Firebase Admin SDK** (já é dependência do projeto) para verificar o token antes de chamar o Gemini:
```ts
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
initializeApp({ credential: applicationDefault() });

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try { req.uid = (await getAuth().verifyIdToken(token)).uid; next(); }
  catch { res.status(401).json({ error: 'Token inválido.' }); }
}
app.post('/api/generate-cards', requireAuth, async (req, res) => { /* ... */ });
```
3. Adicione **rate-limit por usuário** (ex.: máximo de X gerações por hora por `uid`). Pode ser um contador em memória por enquanto (`Map<uid, { count, windowStart }>`) e, idealmente, persistido depois.
4. **Importante:** o servidor precisa de credenciais (service account) para o Admin SDK. No Cloud Run, use a service account padrão do serviço (`applicationDefault()` funciona automaticamente). Documente isso no `README.md`.

---

## 4. Não há testes nem CI — justamente na lógica de correção crítica

**Diretórios:** raiz do repositório (sem `*.test.ts`, sem `.github/workflows`)

### O que está ruim
O agendador FSRS e o parser de gabarito (as duas peças mais sensíveis) não têm nenhum teste, e nenhum pipeline impede regressões a cada alteração.

### Como deveria ser
Toda alteração deve rodar type-check + testes automaticamente, e o `main` deve ser protegido contra merge com pipeline vermelho.

### Como corrigir
1. Adicione um runner de testes leve: `npm install -D vitest`. No `package.json`, adicione `"test": "vitest run"`.
2. Crie testes para `src/lib/fsrs.ts` (item 1) e para o cálculo de `correctIndex` (item 2 — extraia a lógica para uma função pura testável, ex.: `getCorrectIndex(card): number`).
3. Crie `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test
```
4. (Recomendado no GitHub) Ative **branch protection** no `main` exigindo o check de CI verde antes do merge.

---

# 🟠 Prioridade MÉDIA

## 5. Excluir uma matéria deixa subtópicos e cards órfãos

**Arquivo:** `src/App.tsx` (`handleDeleteDeck`, linha ~110)

### O que está ruim
`handleDeleteDeck` apaga **apenas um** documento de deck. Apagar uma matéria deixa os subtópicos e os cards com `deckId` apontando para um deck inexistente: somem da interface, mas permanecem no banco (lixo e leituras pagas).

### Como deveria ser
Apagar um deck deve apagar **em cascata** todos os descendentes e seus cards, idealmente numa operação atômica.

### Como corrigir
1. Antes de apagar, colete recursivamente os IDs descendentes (reaproveite a ideia de `getChildrenIds` que já existe em `DeckManager.tsx`).
2. Junte: o deck + todos os descendentes + todos os cards cujo `deckId` esteja nesse conjunto.
3. Apague tudo com `writeBatch` do Firestore (lembre do limite de 500 operações por batch; divida em lotes se necessário).
4. Crie um helper em `src/db.ts`, ex.: `deleteDeckCascade(userId, deckIds, cardIds)`.

## 6. Todos os cards são carregados em memória de uma vez

**Arquivo:** `src/db.ts` (`subscribeToCards`, linha ~56)

### O que está ruim
Um `onSnapshot` na coleção inteira de cards a cada sessão; os filtros (ex.: "vencidos hoje") são feitos varrendo tudo no cliente. Com milhares de cards isso fica caro (custo de leitura e renderização).

### Como deveria ser
Carregar apenas o necessário e consultar "vencidos" via índice no servidor.

### Como corrigir
1. Para a sessão de estudo, consulte por `where('fsrsData.due', '<=', amanhã)` em vez de baixar tudo (crie o índice composto necessário no Firestore).
2. Considere paginar a listagem de cards no `CardBrowser`.
3. Mudança incremental: pode manter o `onSnapshot` global por enquanto, mas isole a leitura de "due" numa função dedicada para escalar depois.

## 7. A sessão de estudo não tem limites diários

**Arquivo:** `src/components/StudyView.tsx` (`startStudy`, linha ~41)

### O que está ruim
`startStudy` enfileira **todos** os vencidos + **todos** os novos, sem teto de "novos por dia" nem "revisões por dia". Isso é anti-SRS: gera sessões esmagadoras e desorganiza o espaçamento.

### Como deveria ser
Limites configuráveis (padrões sensatos, ex.: 20 novos/dia e 200 revisões/dia), com os novos entrando de forma controlada.

### Como corrigir
1. Adicione configurações (em "Configurações" do app, persistidas no Firestore por usuário): `newPerDay`, `reviewsPerDay`.
2. Em `startStudy`, separe a fila em "vencidos" e "novos", aplique os limites e priorize os vencidos.
3. (Opcional) Exiba na tela quantos novos/revisões restam no dia.

## 8. `tags`/`comments` existem no tipo, mas as regras barram a gravação

**Arquivos:** `src/types.ts` (linhas 24–25) vs `firestore.rules` (`isValidCard`, ~linha 65)

### O que está ruim
O `Flashcard` define `tags` e `comments`, mas a regra limita o card a 7–8 chaves; gravar um card com esses campos **seria negado** pelo Firestore. Inconsistência latente entre modelo/UI e banco.

### Como deveria ser
Ou os campos são suportados de ponta a ponta (tipo + regras + UI), ou são removidos do tipo.

### Como corrigir
1. Decida o escopo. Se forem manter `tags`/`comments`: atualize `isValidCard` para aceitá-los (ajustando `data.size()` e validando tipos), atualize `firebase-blueprint.json` e exponha na UI de edição.
2. Se não forem usar agora: remova-os de `types.ts` e de `mockData.ts` para não enganar.

## 9. Cards gerados são gravados um a um, em série

**Arquivo:** `src/App.tsx` (`handleGenerateCards`, laço com `await saveCardToDb`, ~linha 206)

### O que está ruim
Gravação serial: N idas ao servidor; se falhar no meio, fica estado parcial e o alerta de "X gerados com sucesso" fica impreciso.

### Como deveria ser
Gravação em lote, atômica, com contagem real do que foi persistido.

### Como corrigir
1. Use `writeBatch` do Firestore para gravar todos os cards de uma geração de uma vez (respeitando o limite de 500/batch).
2. Ajuste a mensagem de sucesso para refletir o que de fato foi gravado.
3. Mantenha a lógica atual de mapear card → tópico existente (não recriar tópicos automaticamente — comportamento já definido).

---

# 🟡 Polimento / dívida técnica

## 10. Acessibilidade e atalhos de teclado
**Arquivo:** `src/components/StudyView.tsx`
- **Ruim:** as alternativas são `div` com `onClick` (não focáveis/sem teclado); os botões de nota não têm atalhos.
- **Como corrigir:** transforme as alternativas em `<button>`; adicione atalhos `1–4` (Errei/Difícil/Bom/Fácil) e `Espaço` para "Mostrar Resposta" (padrão Anki).

## 11. Lint real, não só type-check
**Arquivos:** `package.json`, `eslint.config.js`, `tsconfig.json`
- **Ruim:** `lint` só roda `tsc`; o ESLint existe mas não é executado, e `noUnusedLocals` está desligado → código morto se acumula.
- **Como corrigir:** adicione `"lint:eslint": "eslint ."` ao `package.json`, rode-o no CI, e ative `"noUnusedLocals": true` / `"noUnusedParameters": true` no `tsconfig.json`.

## 12. Rotina de migração obsoleta e arriscada
**Arquivo:** `src/lib/migration.ts` (e botão em `src/App.tsx`)
- **Ruim:** casamento de cards por palavra-chave é heurístico (pode arquivar no lugar errado) e hoje é pouco necessário, já que os tópicos são geridos manualmente.
- **Como corrigir:** remova a rotina e o botão "Reorganizar Tópicos (Migração BD)", ou esconda atrás de um modo "avançado/admin" com aviso claro de que é destrutivo.

## 13. Retenção do usuário (produto)
- **Ruim:** sendo um app de estudo de longo prazo, faltam **meta diária/ofensiva (streak)** e onboarding.
- **Como corrigir:** adicione contagem de revisões do dia, meta diária e indicador de sequência no Dashboard.

---

# Ordem sugerida de execução
1. **#4** (Testes + CI) — barato e protege contra regressões.
2. **#1** (FSRS real com `ts-fsrs` + testes) — o item de maior valor.
3. **#2** (`correctOption` estruturado).
4. **#3** (autenticar e limitar o endpoint de IA).
5. **#5** e **#9** (cascata de exclusão e gravação em batch).
6. **#7** (limites diários), depois os demais.

> Faça **um item por PR**, com os testes correspondentes, rodando `npm run lint` e `npm test` antes de concluir.
