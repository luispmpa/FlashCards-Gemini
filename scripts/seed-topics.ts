/**
 * seed-topics.ts
 * -----------------------------------------------------------------------------
 * Cria, diretamente no Firestore (via Firebase Admin SDK), as matérias (decks
 * raiz) e seus assuntos/tópicos (subdecks) definidos em src/lib/topicStructure.ts.
 *
 * É idempotente: matérias/tópicos que já existem (mesmo nome + mesmo pai) são
 * reaproveitados, então rodar mais de uma vez NÃO gera duplicatas.
 *
 * Como os dados são por usuário (/users/{uid}/decks), é necessário informar o
 * usuário-alvo e credenciais de uma service account (o Admin SDK ignora as
 * regras de segurança do Firestore).
 *
 * Uso:
 *   1. Exporte as credenciais de uma service account do projeto Firebase:
 *        export GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json
 *      (ou export SERVICE_ACCOUNT_KEY=/caminho/serviceAccount.json)
 *
 *   2. Informe o usuário-alvo (uma das opções):
 *        export TARGET_UID=<uid_do_firebase_auth>
 *        export TARGET_EMAIL=luispaulo.carraro@gmail.com   # resolve o UID pelo e-mail
 *
 *   3. Rode:
 *        npm run seed:topics
 *
 * Variáveis opcionais:
 *   FIREBASE_PROJECT_ID       sobrescreve o projectId de firebase-applet-config.json
 *   FIRESTORE_DATABASE_ID     sobrescreve o firestoreDatabaseId de firebase-applet-config.json
 *   DRY_RUN=1                 apenas mostra o que seria criado, sem escrever
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initializeApp, cert, applicationDefault, type AppOptions } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { TARGET_STRUCTURE } from '../src/lib/topicStructure';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const appletConfig = JSON.parse(
  readFileSync(resolve(repoRoot, 'firebase-applet-config.json'), 'utf-8')
) as { projectId: string; firestoreDatabaseId: string };

const projectId = process.env.FIREBASE_PROJECT_ID || appletConfig.projectId;
const databaseId = process.env.FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId;
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function buildCredential(): AppOptions['credential'] {
  const keyPath = process.env.SERVICE_ACCOUNT_KEY;
  if (keyPath) {
    const serviceAccount = JSON.parse(readFileSync(resolve(keyPath), 'utf-8'));
    return cert(serviceAccount);
  }
  // Cai para GOOGLE_APPLICATION_CREDENTIALS / credenciais padrão do ambiente.
  return applicationDefault();
}

async function resolveTargetUid(): Promise<string> {
  if (process.env.TARGET_UID) return process.env.TARGET_UID.trim();

  const email = (process.env.TARGET_EMAIL || '').trim();
  if (!email) {
    throw new Error(
      'Defina TARGET_UID ou TARGET_EMAIL para indicar o usuário-alvo do seed.'
    );
  }
  const userRecord = await getAuth().getUserByEmail(email);
  console.log(`Usuário resolvido por e-mail: ${email} -> uid ${userRecord.uid}`);
  return userRecord.uid;
}

interface ExistingDeck {
  id: string;
  name: string;
  parentId?: string;
}

async function run() {
  initializeApp({ credential: buildCredential(), projectId });
  const dbAdmin = getFirestore(databaseId);

  const uid = await resolveTargetUid();
  const decksCol = dbAdmin.collection('users').doc(uid).collection('decks');

  // Carrega os decks existentes uma única vez para fazer o casamento em memória.
  const snapshot = await decksCol.get();
  const existing: ExistingDeck[] = snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name ?? '', parentId: data.parentId };
  });

  const sameName = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

  const findDeck = (name: string, parentId?: string) =>
    existing.find((d) => sameName(d.name, name) && d.parentId === parentId);

  let created = 0;
  let reused = 0;

  const getOrCreate = async (name: string, parentId?: string): Promise<string> => {
    const match = findDeck(name, parentId);
    if (match) {
      reused++;
      console.log(`  = já existe: "${name}"${parentId ? ' (subtópico)' : ' (matéria)'}`);
      return match.id;
    }

    const id = randomUUID();
    const data: Record<string, unknown> = {
      userId: uid,
      name,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parentId !== undefined) data.parentId = parentId;

    if (dryRun) {
      console.log(`  + (dry-run) criaria: "${name}"${parentId ? ' (subtópico)' : ' (matéria)'}`);
    } else {
      await decksCol.doc(id).set(data);
      console.log(`  + criado: "${name}"${parentId ? ' (subtópico)' : ' (matéria)'}`);
    }
    // Registra em memória para que execuções subsequentes na mesma run reusem.
    existing.push({ id, name, parentId });
    created++;
    return id;
  };

  console.log(
    `\nProjeto: ${projectId} | Database: ${databaseId} | uid: ${uid}` +
      (dryRun ? ' | MODO DRY-RUN (nada será gravado)' : '')
  );

  for (const group of TARGET_STRUCTURE) {
    console.log(`\nMatéria: ${group.name}`);
    const parentId = await getOrCreate(group.name, undefined);
    for (const sub of group.subtopics) {
      await getOrCreate(sub, parentId);
    }
  }

  console.log(`\nConcluído. Criados: ${created} | Reutilizados: ${reused}.`);
  if (dryRun) console.log('Nenhuma alteração foi gravada (DRY_RUN).');
}

run().catch((err) => {
  console.error('\nFalha ao executar o seed:', err?.message || err);
  process.exit(1);
});
