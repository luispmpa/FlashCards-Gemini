<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e2b3c367-d251-4781-9eb5-9f83d116e294

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Seed de matérias e tópicos (direto no banco)

As matérias e seus assuntos/tópicos padrão estão definidos em
[`src/lib/topicStructure.ts`](src/lib/topicStructure.ts) (Direito Administrativo,
Direito Constitucional e AFO, cada uma com seus subtópicos).

Há duas formas de criá-los no Firestore:

- **Pelo app:** logado, acesse as configurações e clique em
  **"Reorganizar Tópicos (Migração BD)"**. Isso cria a estrutura na conta do
  usuário logado e reposiciona os cards.

- **Direto no banco (Firebase Admin SDK):** use o script de seed. Como os dados
  são por usuário (`/users/{uid}/decks`), é preciso uma service account do
  projeto Firebase e indicar o usuário-alvo. O script é **idempotente** (não
  duplica matérias/tópicos existentes).

  ```bash
  # 1. Credenciais de uma service account do projeto Firebase
  export GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json

  # 2. Usuário-alvo (uma das opções)
  export TARGET_EMAIL=seu-email@exemplo.com   # resolve o UID pelo e-mail
  # export TARGET_UID=<uid_do_firebase_auth>

  # 3. (opcional) Pré-visualizar sem gravar
  # export DRY_RUN=1

  npm run seed:topics
  ```

  O `projectId` e o `firestoreDatabaseId` são lidos de
  [`firebase-applet-config.json`](firebase-applet-config.json) e podem ser
  sobrescritos via `FIREBASE_PROJECT_ID` / `FIRESTORE_DATABASE_ID`.
