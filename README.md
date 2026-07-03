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

## Deploy das regras do Firestore

As regras de segurança do Firestore ficam em [`firestore.rules`](firestore.rules).
Alterar esse arquivo **não** publica as regras automaticamente — o deploy do site
(GitHub Pages) não toca no Firebase. Sempre que as regras mudarem (por exemplo, ao
adicionar novas coleções como o Acervo de Conhecimento — `knowledgeItems` e
`knowledgeCategories`), publique-as manualmente:

```bash
npx firebase login          # apenas na primeira vez
npx firebase deploy --only firestore:rules
```

Se as regras não forem publicadas, as gravações nas novas coleções são **negadas**
(regra padrão de "negar tudo") e telas como "Novo item do Acervo" falham ao salvar.

### Publicação automática (opcional, recomendado)

O workflow [`.github/workflows/deploy-firestore-rules.yml`](.github/workflows/deploy-firestore-rules.yml)
publica as regras automaticamente sempre que `firestore.rules` mudar no `main`
(e pode ser disparado manualmente na aba **Actions**). Configuração única:

1. No **Google Cloud Console** do projeto (`graphite-pad-467523-q3`), vá em
   **IAM e administrador → Contas de serviço → Criar conta de serviço**.
2. Dê um nome (ex.: `github-firestore-deploy`) e conceda o papel
   **Firebase Rules Admin** (ou **Firebase Admin**).
3. Na conta criada, abra **Chaves → Adicionar chave → Criar nova chave → JSON**
   e baixe o arquivo.
4. No GitHub, em **Settings → Secrets and variables → Actions → New repository
   secret**, crie o secret **`FIREBASE_SERVICE_ACCOUNT`** e cole todo o conteúdo
   do JSON baixado.

Feito isso, cada alteração nas regras é publicada sozinha. Enquanto o secret não
existir, o workflow apenas avisa e é pulado (não falha).
