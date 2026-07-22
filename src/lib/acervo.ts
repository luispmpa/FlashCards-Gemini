// Acervo de flashcards pré-gerados (rotina "Gerador de flashcards (PDF → import)").
//
// Os arquivos vivem em `flashcards-gerados/<materia>/<assunto>.json`, cada um um
// array no formato de importação do AprovaCard. Aqui eles são EMPACOTADOS NO BUILD
// (via import.meta.glob) para que o app possa importá-los com um clique dentro de
// cada matéria — sem o usuário precisar abrir o GitHub, copiar e colar o JSON.

export interface AcervoCard {
  front: string;
  back: string;
  options?: string[];
  correctOption?: string;
  topicName?: string;
}

export interface AcervoMateria {
  /** Nome da pasta da matéria em flashcards-gerados/ (ex.: "afo"). */
  slug: string;
  /** Todos os cards da matéria (todos os assuntos concatenados). */
  cards: AcervoCard[];
  /** Quantos arquivos .json (assuntos) compõem a matéria. */
  fileCount: number;
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

// Dado o nome de um deck-raiz (matéria no app) e a lista de slugs disponíveis no
// acervo, tenta encontrar automaticamente a matéria correspondente. Retorna o slug
// casado ou null quando não há correspondência óbvia (aí o usuário escolhe à mão).
//
// Estratégia (slugs com < 2 caracteres são ignorados para evitar falsos positivos):
//  1. igualdade exata do nome normalizado;
//  2. o nome do deck começa com o slug (ex.: "AFO - Administração..." ↔ "afo");
//  3. o slug começa com o nome do deck (nomes curtos como acrônimos).
// Em empate, prefere o slug mais longo (correspondência mais específica).
export function findMatchingSlug(deckName: string, slugs: string[]): string | null {
  const deck = normalizeForMatch(deckName);
  if (!deck) return null;

  let best: string | null = null;
  let bestLen = -1;

  for (const slug of slugs) {
    const s = normalizeForMatch(slug);
    if (s.length < 2) continue;
    const matches = deck === s || deck.startsWith(s) || s.startsWith(deck);
    if (matches && s.length > bestLen) {
      best = slug;
      bestLen = s.length;
    }
  }
  return best;
}

// Extrai o nome da pasta da matéria a partir do caminho do módulo empacotado.
// Ex.: "../../flashcards-gerados/afo/ciclo-orcamentario.json" -> "afo".
function slugFromPath(path: string): string | null {
  const m = path.match(/flashcards-gerados\/([^/]+)\/[^/]+\.json$/);
  return m ? m[1] : null;
}

// Empacota TODOS os JSONs de matérias no build. `_progresso.json` (na raiz da
// pasta) e READMEs não casam com o padrão `*/*.json`, então ficam de fora.
const modules = import.meta.glob<{ default: unknown }>(
  '../../flashcards-gerados/*/*.json',
  { eager: true },
);

let cache: AcervoMateria[] | null = null;

// Retorna as matérias do acervo (ordenadas por nome), cada uma com seus cards já
// concatenados. O resultado é memoizado (os dados são estáticos no build).
export function getAcervoMaterias(): AcervoMateria[] {
  if (cache) return cache;

  const bySlug = new Map<string, { cards: AcervoCard[]; fileCount: number }>();

  for (const [path, mod] of Object.entries(modules)) {
    const slug = slugFromPath(path);
    if (!slug) continue;
    const arr = (mod as { default: unknown }).default;
    if (!Array.isArray(arr)) continue;

    const entry = bySlug.get(slug) ?? { cards: [], fileCount: 0 };
    entry.cards.push(...(arr as AcervoCard[]));
    entry.fileCount += 1;
    bySlug.set(slug, entry);
  }

  cache = Array.from(bySlug.entries())
    .map(([slug, { cards, fileCount }]) => ({ slug, cards, fileCount }))
    .sort((a, b) => a.slug.localeCompare(b.slug, 'pt-BR'));

  return cache;
}
