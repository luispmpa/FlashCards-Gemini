#!/usr/bin/env node
// Valida arquivos de flashcards gerados contra o schema de importação do
// AprovaCard, replicando as regras de `buildAndSaveCards`/`normalizeFront`
// (src/App.tsx). Uso:
//   node scripts/validate-flashcards.mjs                      # valida flashcards-gerados/*.json
//   node scripts/validate-flashcards.mjs caminho/arquivo.json # valida um arquivo
//   npm run validate:cards
//
// Sai com código 1 se houver QUALQUER erro (card que seria descartado ou
// inválido na importação). Duplicatas e avisos não derrubam o build.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const GENERATED_DIR = 'flashcards-gerados';
const PROGRESS_FILE = '_progresso.json';

// Mesma normalização usada pelo app para deduplicar por `front`.
const normalizeFront = (s) =>
  String(s)
    .replace(/^\*\*\[Assunto Sugerido pela IA:.*?\]\*\*\s*/s, '')
    .trim()
    .toLowerCase();

function collectFiles() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args;
  if (!existsSync(GENERATED_DIR)) {
    console.error(`Pasta "${GENERATED_DIR}" não encontrada.`);
    process.exit(1);
  }
  return readdirSync(GENERATED_DIR)
    .filter((f) => f.endsWith('.json') && f !== PROGRESS_FILE)
    .map((f) => join(GENERATED_DIR, f));
}

let totalCards = 0;
let totalErrors = 0;
let totalWarnings = 0;
// Mapa global de fronts para detectar duplicatas ENTRE arquivos também.
const seenGlobal = new Map(); // frontNormalizado -> "arquivo[#índice]"

const files = collectFiles();
if (files.length === 0) {
  console.log('Nenhum arquivo de flashcards para validar.');
  process.exit(0);
}

for (const file of files) {
  const label = basename(file);
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`✗ ${label}: não foi possível ler (${e.message})`);
    totalErrors++;
    continue;
  }

  // Aceita o mesmo "limpa cercas" que o modal de importação faz.
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    console.error(`✗ ${label}: JSON inválido (${e.message})`);
    totalErrors++;
    continue;
  }

  if (!Array.isArray(data)) {
    console.error(`✗ ${label}: o conteúdo deve ser um array JSON de flashcards.`);
    totalErrors++;
    continue;
  }

  const errors = [];
  const warnings = [];
  const seenLocal = new Set();

  data.forEach((c, i) => {
    const at = `${label}[#${i}]`;

    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`${at}: item não é um objeto.`);
      return;
    }

    // front / back obrigatórios e não vazios (senão o app DESCARTA o card).
    if (typeof c.front !== 'string' || !c.front.trim()) {
      errors.push(`${at}: "front" ausente ou vazio (card seria descartado).`);
    }
    if (typeof c.back !== 'string' || !c.back.trim()) {
      errors.push(`${at}: "back" ausente ou vazio (card seria descartado).`);
    }

    // options: se existir, deve ser array de strings não vazias.
    const hasOptions = c.options !== undefined;
    if (hasOptions) {
      if (!Array.isArray(c.options) || c.options.length < 2) {
        errors.push(`${at}: "options" deve ser um array com 2+ alternativas.`);
      } else if (!c.options.every((o) => typeof o === 'string' && o.trim())) {
        errors.push(`${at}: "options" contém alternativa vazia ou não-string.`);
      }
    }

    // correctOption: letra A–E dentro do range de options.
    const gabaritoNoBack =
      typeof c.back === 'string' && /Gabarito:\s*([A-E])/i.test(c.back);
    if (c.correctOption !== undefined) {
      if (typeof c.correctOption !== 'string' || !/^[A-Ea-e]$/.test(c.correctOption.trim())) {
        errors.push(`${at}: "correctOption" deve ser uma letra de A a E.`);
      } else if (Array.isArray(c.options)) {
        const idx = c.correctOption.trim().toUpperCase().charCodeAt(0) - 65;
        if (idx >= c.options.length) {
          errors.push(
            `${at}: "correctOption" (${c.correctOption}) fora do range de options (${c.options.length}).`,
          );
        }
      }
    } else if (hasOptions && !gabaritoNoBack) {
      warnings.push(`${at}: questão com "options" sem "correctOption" nem "Gabarito:" no back.`);
    }

    if (c.topicName !== undefined && typeof c.topicName !== 'string') {
      warnings.push(`${at}: "topicName" deveria ser string.`);
    }

    // Duplicatas por front normalizado (local e global).
    if (typeof c.front === 'string' && c.front.trim()) {
      const key = normalizeFront(c.front);
      if (seenLocal.has(key)) {
        warnings.push(`${at}: "front" duplicado dentro do próprio arquivo.`);
      }
      seenLocal.add(key);
      if (seenGlobal.has(key)) {
        warnings.push(`${at}: "front" duplicado de ${seenGlobal.get(key)} (será pulado na importação).`);
      } else {
        seenGlobal.set(key, at);
      }
    }
  });

  totalCards += data.length;
  totalErrors += errors.length;
  totalWarnings += warnings.length;

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✓ ${label}: ${data.length} cards OK.`);
  } else {
    console.log(`${errors.length ? '✗' : '⚠'} ${label}: ${data.length} cards, ${errors.length} erro(s), ${warnings.length} aviso(s).`);
    errors.forEach((e) => console.log(`    ERRO  ${e}`));
    warnings.forEach((w) => console.log(`    aviso ${w}`));
  }
}

console.log(
  `\nResumo: ${files.length} arquivo(s), ${totalCards} cards, ${totalErrors} erro(s), ${totalWarnings} aviso(s).`,
);
process.exit(totalErrors > 0 ? 1 : 0);
