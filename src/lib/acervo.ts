// Acervo de flashcards pré-gerados (rotina "Gerador de flashcards (PDF → import)").
//
// Os arquivos vivem em `flashcards-gerados/`, espelhando `material-fonte/`:
//   - matéria simples:  flashcards-gerados/<materia>/<assunto>.json
//   - matéria agrupada: flashcards-gerados/<grupo>/<sub-materia>/<assunto>.json
//     (ex.: "Tecnologia da Informação/Informática/…")
//
// Tudo é EMPACOTADO NO BUILD (import.meta.glob) para o app importar com um clique,
// dentro de cada matéria, sem o usuário abrir o GitHub e colar JSON. Também
// enumeramos a ESTRUTURA de `material-fonte/` (via READMEs) para exibir de forma
// organizada as matérias/sub-matérias que ainda NÃO têm cards gerados.

export interface AcervoCard {
  front: string;
  back: string;
  options?: string[];
  correctOption?: string;
  topicName?: string;
}

// Uma folha do acervo com cards gerados (matéria simples ou sub-matéria de um grupo).
export interface AcervoEntry {
  /** Caminho relativo a flashcards-gerados/ (ex.: "afo" ou "Tecnologia da Informação/Informática"). */
  path: string;
  /** Grupo/matéria-pai quando aninhado (ex.: "Tecnologia da Informação"); indefinido se simples. */
  group?: string;
  /** Nome da folha (ex.: "afo" ou "Informática"). */
  name: string;
  cards: AcervoCard[];
  /** Quantos arquivos .json (assuntos) compõem a folha. */
  fileCount: number;
}

// Opção exibida no modal de importação (pode ter 0 cards = ainda não gerado).
export interface AcervoOption {
  /** Chave única (caminho relativo). */
  key: string;
  /** Rótulo exibido (nome da folha). */
  label: string;
  group?: string;
  cards: AcervoCard[];
  fileCount: number;
  /** true quando há cards gerados para importar. */
  available: boolean;
}

// Visão do acervo para um deck-raiz (matéria) específico do app.
export interface DeckAcervoView {
  matched: boolean;
  kind: 'group' | 'flat' | 'none';
  groupName?: string;
  options: AcervoOption[];
}

// Normaliza um texto para comparação de nomes: minúsculas, sem acentos e
// mantendo apenas caracteres alfanuméricos (remove espaços, hífens, etc.).
export function normalizeForMatch(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Dado um nome (deck) e uma lista de candidatos, encontra o mais provável pelo
// nome normalizado. Retorna o candidato casado ou null. Candidatos < 2 chars são
// ignorados (evita falsos positivos). Em empate, prefere o mais longo (específico).
export function findMatchingSlug(deckName: string, candidates: string[]): string | null {
  const deck = normalizeForMatch(deckName);
  if (!deck) return null;

  let best: string | null = null;
  let bestLen = -1;

  for (const cand of candidates) {
    const c = normalizeForMatch(cand);
    if (c.length < 2) continue;
    const matches = deck === c || deck.startsWith(c) || c.startsWith(deck);
    if (matches && c.length > bestLen) {
      best = cand;
      bestLen = c.length;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Empacotamento no build
// ---------------------------------------------------------------------------

// Todos os JSONs de matérias (qualquer profundidade). `_progresso.json` fica na
// raiz da pasta (1 segmento) e é descartado pela contagem de segmentos abaixo.
const acervoModules = import.meta.glob<{ default: unknown }>(
  '../../flashcards-gerados/**/*.json',
  { eager: true },
);

// READMEs de material-fonte servem para enumerar a ESTRUTURA de pastas (matérias
// e sub-matérias) sem empacotar os PDFs (que são grandes). São arquivos minúsculos.
const sourceReadmes = import.meta.glob(
  '../../material-fonte/**/README.md',
  { eager: true, query: '?raw', import: 'default' },
);

// "…/flashcards-gerados/a/b/c.json" -> ["a","b","c.json"]
function segmentsAfter(marker: string, path: string): string[] | null {
  const i = path.indexOf(marker);
  if (i === -1) return null;
  return path
    .slice(i + marker.length)
    .split('/')
    .filter(Boolean);
}

let entriesCache: AcervoEntry[] | null = null;

// Folhas do acervo com cards gerados, agrupadas por caminho.
export function getAcervoEntries(): AcervoEntry[] {
  if (entriesCache) return entriesCache;

  const byPath = new Map<string, { group?: string; name: string; cards: AcervoCard[]; fileCount: number }>();

  for (const [full, mod] of Object.entries(acervoModules)) {
    const segs = segmentsAfter('/flashcards-gerados/', full);
    // Precisa de pelo menos <pasta>/<arquivo>.json. `_progresso.json` (1 seg) sai daqui.
    if (!segs || segs.length < 2) continue;
    const arr = (mod as { default: unknown }).default;
    if (!Array.isArray(arr)) continue;

    const dirs = segs.slice(0, -1); // remove o arquivo
    const path = dirs.join('/');
    const group = dirs.length >= 2 ? dirs.slice(0, -1).join('/') : undefined;
    const name = dirs[dirs.length - 1];

    const entry = byPath.get(path) ?? { group, name, cards: [], fileCount: 0 };
    entry.cards.push(...(arr as AcervoCard[]));
    entry.fileCount += 1;
    byPath.set(path, entry);
  }

  entriesCache = Array.from(byPath.entries())
    .map(([path, e]) => ({ path, ...e }))
    .sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));

  return entriesCache;
}

interface SourceStructure {
  /** grupo -> nomes das sub-matérias (folhas) */
  groups: Map<string, string[]>;
  /** matérias de nível 1 que são folhas (sem sub-pastas) */
  flat: string[];
}

let sourceCache: SourceStructure | null = null;

// Enumera a estrutura de material-fonte a partir dos READMEs de cada pasta.
export function getSourceStructure(): SourceStructure {
  if (sourceCache) return sourceCache;

  // Conjunto de caminhos de pasta (relativos a material-fonte/), sem o README.
  const folders = new Set<string>();
  for (const full of Object.keys(sourceReadmes)) {
    const segs = segmentsAfter('/material-fonte/', full);
    if (!segs) continue;
    const dirs = segs.slice(0, -1); // remove README.md
    if (dirs.length === 0) continue; // README raiz de material-fonte
    folders.add(dirs.join('/'));
  }

  // Uma pasta é "grupo" quando existe outra pasta com ela como prefixo (tem filhos).
  const list = Array.from(folders);
  const isGroup = (f: string) => list.some((o) => o !== f && o.startsWith(f + '/'));

  const groups = new Map<string, string[]>();
  const flat: string[] = [];

  for (const f of list) {
    const parts = f.split('/');
    if (parts.length === 1) {
      if (!isGroup(f)) flat.push(f); // matéria simples de nível 1
    } else if (parts.length === 2) {
      const [group, sub] = parts;
      const arr = groups.get(group) ?? [];
      arr.push(sub);
      groups.set(group, arr);
    }
    // (profundidades maiores não são usadas hoje)
  }

  for (const [, subs] of groups) subs.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  flat.sort((a, b) => a.localeCompare(b, 'pt-BR'));

  sourceCache = { groups, flat };
  return sourceCache;
}

// Monta uma AcervoOption a partir de um nome de folha e (opcional) grupo,
// encontrando os cards gerados correspondentes por caminho ou nome normalizado.
function toOption(name: string, group: string | undefined, entries: AcervoEntry[]): AcervoOption {
  const path = group ? `${group}/${name}` : name;
  const match =
    entries.find((e) => e.path === path) ??
    entries.find((e) => (e.group ?? '') === (group ?? '') && normalizeForMatch(e.name) === normalizeForMatch(name)) ??
    // fallback para matérias simples cujo slug gerado difere do nome da pasta-fonte
    (group ? undefined : entries.find((e) => !e.group && findMatchingSlug(name, [e.path]) === e.path));

  const cards = match?.cards ?? [];
  return {
    key: match?.path ?? path,
    label: name,
    group,
    cards,
    fileCount: match?.fileCount ?? 0,
    available: cards.length > 0,
  };
}

// Resolve o que mostrar no modal "Atualizar do acervo" para um deck-raiz do app.
export function resolveDeckAcervo(deckName: string): DeckAcervoView {
  const entries = getAcervoEntries();
  const { groups, flat } = getSourceStructure();

  // Nomes de grupos conhecidos (material-fonte + acervo aninhado).
  const groupNames = new Set<string>(groups.keys());
  entries.forEach((e) => e.group && groupNames.add(e.group));

  // 1) O deck casa com um GRUPO (ex.: "Tecnologia da Informação")?
  const matchedGroup = findMatchingSlug(deckName, Array.from(groupNames));
  if (matchedGroup) {
    // Sub-matérias = folhas em material-fonte ∪ folhas com cards no acervo.
    const subs = new Set<string>(groups.get(matchedGroup) ?? []);
    entries.filter((e) => e.group === matchedGroup).forEach((e) => subs.add(e.name));

    const options = Array.from(subs)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((sub) => toOption(sub, matchedGroup, entries));

    return { matched: true, kind: 'group', groupName: matchedGroup, options };
  }

  // 2) O deck casa com uma matéria SIMPLES do acervo (ex.: "AFO…" ↔ "afo")?
  const flatEntries = entries.filter((e) => !e.group);
  const matchedFlatPath = findMatchingSlug(deckName, flatEntries.map((e) => e.path));
  if (matchedFlatPath) {
    const e = flatEntries.find((x) => x.path === matchedFlatPath)!;
    return {
      matched: true,
      kind: 'flat',
      options: [{ key: e.path, label: e.name, cards: e.cards, fileCount: e.fileCount, available: e.cards.length > 0 }],
    };
  }

  // 3) Sem correspondência óbvia: oferece TODAS as folhas do acervo para escolha
  //    manual (não pré-seleciona nada relacionado indevidamente).
  const options: AcervoOption[] = [
    ...flat.map((m) => toOption(m, undefined, flatEntries)),
    ...Array.from(groupNames).flatMap((g) => {
      const subs = new Set<string>(groups.get(g) ?? []);
      entries.filter((e) => e.group === g).forEach((e) => subs.add(e.name));
      return Array.from(subs).map((sub) => toOption(sub, g, entries));
    }),
  ];
  // Garante que folhas simples do acervo sem README-fonte (ex.: "afo") apareçam.
  flatEntries.forEach((e) => {
    if (!options.some((o) => o.key === e.path)) {
      options.push({ key: e.path, label: e.name, cards: e.cards, fileCount: e.fileCount, available: e.cards.length > 0 });
    }
  });

  // Ordena: disponíveis primeiro, depois por rótulo.
  options.sort((a, b) => Number(b.available) - Number(a.available) || a.label.localeCompare(b.label, 'pt-BR'));

  return { matched: false, kind: 'none', options };
}
