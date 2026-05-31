# Plano de Aprimoramento — AprovaCard (FSRS Concursos) — v2

> Documento de instruções para o assistente de código (Google AI Studio / Gemini).
> **Fluxo de trabalho oficial:** o Gemini executa **um item por vez** seguindo este documento → o dono envia ao GitHub → uma auditoria externa verifica e reporta o que precisa corrigir.
> Para cada item pendente há: **O que está ruim**, **Como deveria ser** e **Como corrigir**.

---

## ✅ Status — já concluído (NÃO refazer)

Estes itens já foram implementados e validados (lint + testes + CI passando). **Não reimplemente, não apague.**

- [x] **#1 — FSRS real** via `ts-fsrs` (`src/lib/fsrs.ts`) com retenção-alvo, teto de intervalo, fuzz e compatibilidade com cards antigos. Testes em `src/lib/fsrs.test.ts`.
- [x] **#2 — Geração só em tópicos existentes**: a IA não cria subtópicos automaticamente; cards sem correspondência ficam na matéria raiz e o `front` recebe o aviso `**[Assunto Sugerido pela IA: ...]**`. **Manter esse comportamento.**
- [x] **#3 — Endpoint de IA protegido**: `requireAuth` (Firebase Admin) + rate-limit por usuário em `server.ts`.
- [x] **#3b — Resposta estruturada**: campo `correctOption` no schema da IA, no tipo `Flashcard`, nas `firestore.rules` e no `firebase-blueprint.json`; utilitário puro `getCorrectIndex()` em `src/lib/cardUtils.ts` com fallback por regex. Testes em `src/lib/cardUtils.test.ts`.
- [x] **#4 — Testes e CI**: `vitest` + `npm test` + workflow `.github/workflows/ci.yml` (roda `npm ci`, `npm run lint`, `npm test`).
- [x] **#5 — Exclusão em cascata**: `deleteDeckCascade` em `src/db.ts` com `writeBatch`.
- [x] **#7 — Limites diários de estudo**: `newPerDay` etc. via `src/lib/settings.ts` + `SettingsView`.
- [x] **#9 — Gravação em lote** dos cards gerados.
- [x] **#12 — Remoção da migração arriscada** (botões de migração/mesclagem retirados).

> Observação: o módulo `src/lib/topicStructure.ts` foi removido e o `TARGET_STRUCTURE` voltou a ficar inline em `src/lib/migration.ts`. Está funcional; não precisa mexer.

---

## 🔒 TAREFA MANUAL DO DONO DO REPOSITÓRIO — Branch Protection

> ⚠️ **ATENÇÃO, GEMINI: este item NÃO é código e você NÃO consegue executá-lo.**
> Branch protection é uma **configuração do GitHub**, feita na interface web pelo dono do repositório.
> **Não** tente criar arquivos, scripts ou workflows para isso. Apenas ignore este bloco na implementação de código.

**Por que:** impedir que qualquer push entre direto no `main` sem revisão e sem o CI verde. Já aconteceu de uma sincronização apagar arquivos silenciosamente no `main` — branch protection evita isso.

### Passo a passo (feito pelo dono, no navegador)
1. Acesse `https://github.com/luispmpa/FlashCards-Gemini` e clique em **Settings** (precisa ser admin do repo).
2. No menu à esquerda, em *Code and automation*, clique em **Branches**.
3. Clique em **Add branch protection rule** (ou **Add rule**).
4. Em **Branch name pattern**, digite: `main`
5. Marque **Require a pull request before merging**.
   - *Required approvals* pode ficar em **0** (se você trabalha sozinho) — o importante é forçar que a mudança passe por um PR.
6. Marque **Require status checks to pass before merging** e, na busca, selecione o check **build** (o job do `ci.yml`).
   - Obs.: o check só aparece na lista **depois** que o CI rodou pelo menos uma vez (já rodou após o último push ao `main`).
   - (Opcional) Marque **Require branches to be up to date before merging**.
7. (Recomendado) Marque **Do not allow bypassing the above settings** para valer inclusive para administradores.
8. Clique em **Create** / **Save changes**.

### ⚠️ Consequência importante para o fluxo do AI Studio
Depois de ativar "Require a pull request", **o AI Studio não conseguirá mais empurrar direto no `main`** — o push será **rejeitado**. A partir daí, o fluxo correto passa a ser:

1. No AI Studio, na hora do "Sync to GitHub", **escolha/crie um branch** (ex.: `ai-studio/work`) em vez de `main`.
2. No GitHub, abra um **Pull Request** desse branch para o `main`.
3. O CI roda no PR; a auditoria externa revisa; só então faz o **merge**.

> Se o AI Studio só permitir sincronizar com `main` (sem opção de branch), avise o auditor antes de ativar a proteção — nesse caso mantemos o `main` sem o "require PR" e fazemos a auditoria a cada push, sem proteção rígida.

---

## ♻️ Disciplina de sincronização (obrigatória, a cada sessão)

1. **Antes de começar a editar no AI Studio, puxe o `main` atual do GitHub** (pull), para a base não ficar atrasada.
2. Faça **um item por vez** (um PR por item).
3. Antes de concluir, rode `npm run lint` e `npm test` — ambos têm que passar.
4. **Nunca apague arquivos que não fazem parte do item atual.** Se achar que algo é obsoleto, **pergunte/avise** em vez de deletar (já tivemos deleções acidentais de scripts e documentação).

---

## 🟠 Itens PENDENTES (implementar a seguir)

### #6 — Carregamento de cards não escala
**Arquivo:** `src/db.ts` (`subscribeToCards`)

- **O que está ruim:** um `onSnapshot` baixa **todos** os cards do usuário a cada sessão; os filtros (ex.: "vencidos hoje") varrem tudo no cliente. Com milhares de cards fica caro (leituras do Firestore + render).
- **Como deveria ser:** carregar/consultar apenas o necessário; "vencidos" via índice no servidor.
- **Como corrigir:**
  1. Para a sessão de estudo, consultar por `where('fsrsData.due', '<=', amanhã)` em vez de baixar tudo (crie o índice composto necessário no Firestore).
  2. Paginar a listagem no `CardBrowser`.
  3. Pode ser incremental: isole a leitura de "due" numa função dedicada para escalar depois, sem quebrar a UI atual.

### #8 — `tags`/`comments`: tipo x regras inconsistentes
**Arquivos:** `src/types.ts` vs `firestore.rules` (`isValidCard`)

- **O que está ruim:** o `Flashcard` define `tags` e `comments`, mas a regra limita o card a 9 chaves; gravar um card com esses campos **seria negado**.
- **Como deveria ser:** ou os campos são suportados de ponta a ponta (tipo + regras + UI), ou são removidos do tipo.
- **Como corrigir:**
  1. **Decida o escopo.** Se for manter: atualizar `isValidCard` (ajustar `data.size()` e validar tipos de `tags`/`comments`), atualizar `firebase-blueprint.json` e expor na UI de edição.
  2. Se não for usar agora: remover de `types.ts` e de `mockData.ts` para não enganar.

### #10 — Acessibilidade e atalhos de teclado
**Arquivo:** `src/components/StudyView.tsx`

- **O que está ruim:** as alternativas são `div` com `onClick` (não focáveis, sem teclado); os botões de nota não têm atalhos.
- **Como deveria ser:** navegável por teclado, com atalhos padrão de SRS.
- **Como corrigir:**
  1. Trocar as alternativas por `<button>` (com `aria` adequado).
  2. Adicionar atalhos: `Espaço` = "Mostrar Resposta"; `1`/`2`/`3`/`4` = Errei/Difícil/Bom/Fácil. Limpar os listeners no unmount.

### #11 — Lint de verdade, não só type-check
**Arquivos:** `package.json`, `eslint.config.js`, `tsconfig.json`

- **O que está ruim:** `lint` só roda `tsc`; o ESLint existe mas não é executado, e `noUnusedLocals` está desligado → código morto se acumula.
- **Como deveria ser:** ESLint rodando no CI e o compilador barrando código não usado.
- **Como corrigir:**
  1. Adicionar `"lint:eslint": "eslint ."` ao `package.json` e incluir no `ci.yml`.
  2. Ativar `"noUnusedLocals": true` e `"noUnusedParameters": true` no `tsconfig.json` e corrigir o que aparecer.

### #13 — Retenção do usuário (produto)
**Arquivos:** `src/components/Dashboard.tsx` (e `settings.ts` se necessário)

- **O que está ruim:** sendo um app de estudo de longo prazo, faltam **meta diária** e **ofensiva (streak)**.
- **Como deveria ser:** feedback de progresso que incentive constância.
- **Como corrigir:**
  1. Calcular revisões do dia a partir dos `reviewLogs` e exibir progresso vs. meta diária no Dashboard.
  2. Calcular a sequência de dias consecutivos com pelo menos 1 revisão (streak) e exibir.

---

## Ordem sugerida
1. **Branch protection** (tarefa manual do dono — antes de tudo).
2. **#11** (ESLint + `noUnusedLocals`) — limpa a base e pega regressões.
3. **#8** (resolver tags/comments) — tirar a inconsistência latente.
4. **#10** (acessibilidade/atalhos).
5. **#6** (escalabilidade da leitura).
6. **#13** (retenção/streak).

> Regra de ouro: **um item por PR**, com testes quando fizer sentido, `npm run lint` e `npm test` verdes antes de concluir, e **sem apagar nada fora do escopo do item**.
