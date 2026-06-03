#!/usr/bin/env node
// Gera/atualiza flashcards-gerados/STATUS.md — um painel visual do andamento.
//
// - Varre flashcards-gerados/ (recursivo) procurando arquivos .json de cards.
// - Agrupa por MATÉRIA (primeira subpasta sob flashcards-gerados/; arquivos na
//   raiz ficam em "(sem matéria)").
// - Para cada arquivo: conta os cards e identifica o(s) tópico(s) (topicName).
// - Renderiza checklists ( - [ ] ) que o GitHub mostra como caixas clicáveis.
// - PRESERVA as marcações de "importado" ([x]) já existentes no STATUS.md,
//   casando pelo caminho do arquivo — então rodar de novo não apaga seus cliques.
//
// Uso: npm run status:cards

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIR = 'flashcards-gerados';
const STATUS_FILE = join(DIR, 'STATUS.md');
const PROGRESS_FILE = 'flashcards-gerados/_progresso.json';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.json') && entry !== '_progresso.json') out.push(full);
  }
  return out;
}

// Lê o STATUS.md atual e devolve o conjunto de caminhos já marcados como importados.
function readCheckedPaths() {
  const checked = new Set();
  if (!existsSync(STATUS_FILE)) return checked;
  const text = readFileSync(STATUS_FILE, 'utf8');
  for (const line of text.split('\n')) {
    const isChecked = /^\s*-\s*\[x\]/i.test(line);
    if (!isChecked) continue;
    const m = line.match(/`([^`]+\.json)`/);
    if (m) checked.add(m[1]);
  }
  return checked;
}

function analyze(file) {
  let cards = 0;
  const topics = new Set();
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(data)) {
      cards = data.length;
      for (const c of data) if (c && typeof c.topicName === 'string' && c.topicName.trim()) topics.add(c.topicName.trim());
    }
  } catch {
    /* arquivo inválido: aparece com 0 cards */
  }
  return { cards, topics: [...topics] };
}

function materiaOf(relPath) {
  const parts = relPath.split(sep);
  // relPath é relativo a flashcards-gerados/. Se houver subpasta, ela é a matéria.
  return parts.length > 1 ? parts[0] : '(sem matéria)';
}

function main() {
  if (!existsSync(DIR)) {
    console.error(`Pasta "${DIR}" não encontrada.`);
    process.exit(1);
  }
  const checked = readCheckedPaths();
  const files = walk(DIR).sort();

  const byMateria = new Map();
  let totalCards = 0;
  let totalImported = 0;

  for (const file of files) {
    const rel = relative(DIR, file);
    const repoPath = file; // caminho a partir da raiz do repo (ex.: flashcards-gerados/afo/x.json)
    const materia = materiaOf(rel);
    const { cards, topics } = analyze(file);
    const isImported = checked.has(repoPath);
    totalCards += cards;
    if (isImported) totalImported++;

    if (!byMateria.has(materia)) byMateria.set(materia, []);
    byMateria.get(materia).push({ repoPath, rel, cards, topics, isImported });
  }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines = [];
  lines.push('# Status das importações de flashcards');
  lines.push('');
  lines.push('> Gerado automaticamente por `npm run status:cards`. **Marque a caixa** de cada item que você já importou no app — o GitHub salva o clique, e rodar o script de novo NÃO apaga suas marcações.');
  lines.push('');
  lines.push(`**Resumo:** ${files.length} arquivo(s) · ${totalCards} cards · ${totalImported}/${files.length} importado(s) · atualizado em ${now}`);
  lines.push('');

  if (files.length === 0) {
    lines.push('_Nenhum arquivo de flashcards gerado ainda._');
  } else {
    for (const materia of [...byMateria.keys()].sort()) {
      const items = byMateria.get(materia);
      const mCards = items.reduce((a, i) => a + i.cards, 0);
      const mImp = items.filter((i) => i.isImported).length;
      lines.push(`## ${materia}  —  ${items.length} arquivo(s), ${mCards} cards, ${mImp}/${items.length} importado(s)`);
      lines.push('');
      for (const it of items) {
        const box = it.isImported ? '[x]' : '[ ]';
        const topicLabel = it.topics.length === 1
          ? it.topics[0]
          : it.topics.length > 1
            ? `${it.topics.length} tópicos`
            : it.rel.split(sep).pop().replace(/\.json$/, '');
        lines.push(`- ${box} **${topicLabel}** — ${it.cards} cards — \`${it.repoPath}\``);
      }
      lines.push('');
    }
  }

  writeFileSync(STATUS_FILE, lines.join('\n') + '\n');
  console.log(`STATUS.md atualizado: ${files.length} arquivo(s), ${totalCards} cards, ${totalImported} importado(s).`);
}

main();
