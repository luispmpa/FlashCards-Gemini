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
