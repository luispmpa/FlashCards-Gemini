import {
  KnowledgeItem,
  KnowledgeAttachmentKind,
  KnowledgeBacklink,
  Flashcard,
} from "../types";

// ============================================================================
// Núcleo do Acervo de Conhecimento: parsing de referências, índice de aliases,
// backlinks e busca. Tudo aqui é composto por funções puras para facilitar
// testes e manter baixo acoplamento com a UI e com o Firestore.
// ============================================================================

// Formato canônico de referência dentro de um flashcard: {{alias}}.
// Escolhido por ser inequívoco e não colidir com a sintaxe Markdown (onde "#"
// já significa cabeçalho). Aceita um "#" opcional interno ({{#fumus}}) para
// conforto de quem digita, mas o alias é sempre normalizado sem o "#".
const REFERENCE_TOKEN = /\{\{\s*#?([\p{L}\p{N}_-]+)\s*\}\}/gu;

/**
 * Normaliza um alias para a forma canônica usada como chave única no sistema:
 * sem "#", sem acentos, minúsculo, espaços viram "_" e apenas [a-z0-9_-].
 * Ex.: "#Fumus Boni" -> "fumus_boni".
 */
export function normalizeAlias(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "") // remove "#" iniciais
    .replace(/^\{\{|\}\}$/g, "") // remove chaves se vierem coladas
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/\s+/g, "_") // espaços -> _
    .replace(/[^a-z0-9_-]/g, ""); // mantém só caracteres seguros
}

/**
 * Extrai, em ordem de aparição, os aliases referenciados em um texto de
 * flashcard. Retorna aliases normalizados, sem duplicatas.
 */
export function extractReferences(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(REFERENCE_TOKEN)) {
    const alias = normalizeAlias(match[1]);
    if (alias && !seen.has(alias)) {
      seen.add(alias);
      found.push(alias);
    }
  }
  return found;
}

/**
 * Constrói um índice alias -> item. Quando dois itens declaram o mesmo alias
 * (não deveria ocorrer, pois a criação valida unicidade), o primeiro vence e o
 * conflito é ignorado silenciosamente para não quebrar a renderização.
 */
export function buildAliasIndex(
  items: KnowledgeItem[]
): Map<string, KnowledgeItem> {
  const index = new Map<string, KnowledgeItem>();
  for (const item of items) {
    for (const alias of item.aliases || []) {
      const norm = normalizeAlias(alias);
      if (norm && !index.has(norm)) index.set(norm, item);
    }
  }
  return index;
}

/** Resolve um alias (bruto ou normalizado) para o item correspondente. */
export function resolveReference(
  index: Map<string, KnowledgeItem>,
  alias: string
): KnowledgeItem | undefined {
  return index.get(normalizeAlias(alias));
}

/**
 * Dado o conjunto de aliases desejados para um item, retorna os que já estão
 * em uso por OUTRO item. Usado para garantir unicidade antes de salvar.
 */
export function findAliasConflicts(
  desiredAliases: string[],
  allItems: KnowledgeItem[],
  currentItemId?: string
): string[] {
  const taken = new Map<string, string>(); // alias -> itemId
  for (const item of allItems) {
    if (item.id === currentItemId) continue;
    for (const alias of item.aliases || []) {
      taken.set(normalizeAlias(alias), item.id);
    }
  }
  const conflicts: string[] = [];
  const seenLocal = new Set<string>();
  for (const raw of desiredAliases) {
    const norm = normalizeAlias(raw);
    if (!norm) continue;
    if (taken.has(norm) && !seenLocal.has(norm)) conflicts.push(norm);
    seenLocal.add(norm);
  }
  return conflicts;
}

/**
 * Calcula os backlinks de cada item: em quais flashcards ele é referenciado.
 * Percorre todos os cards uma única vez — O(n) sobre o total de cards.
 */
export function computeBacklinks(
  cardsByDeck: Record<string, Flashcard[]>,
  aliasIndex: Map<string, KnowledgeItem>
): Map<string, KnowledgeBacklink[]> {
  const result = new Map<string, KnowledgeBacklink[]>();
  for (const cards of Object.values(cardsByDeck)) {
    for (const card of cards) {
      const refs = extractReferences(`${card.front}\n${card.back}`);
      const itemIdsInThisCard = new Set<string>();
      for (const alias of refs) {
        const item = aliasIndex.get(alias);
        if (!item || itemIdsInThisCard.has(item.id)) continue;
        itemIdsInThisCard.add(item.id);
        const list = result.get(item.id) ?? [];
        list.push({
          cardId: card.id,
          deckId: card.deckId,
          cardFront: card.front,
        });
        result.set(item.id, list);
      }
    }
  }
  return result;
}

/**
 * Busca itens do Acervo por título, aliases, descrição, conteúdo textual e
 * (opcionalmente) categoria. Case/acento-insensível. Rápida o suficiente para
 * milhares de registros por ser um único filtro linear.
 */
export function searchKnowledgeItems(
  items: KnowledgeItem[],
  query: string,
  opts: { categoryId?: string } = {}
): KnowledgeItem[] {
  let result = items;
  if (opts.categoryId) {
    result = result.filter((i) => i.categoryId === opts.categoryId);
  }
  const q = foldText(query);
  if (q) {
    result = result.filter((item) => {
      const haystack = foldText(
        [
          item.title,
          item.description || "",
          item.content || "",
          (item.aliases || []).join(" "),
        ].join(" \n ")
      );
      return haystack.includes(q);
    });
  }
  return result;
}

/**
 * Sugestões de autocomplete a partir de um prefixo de alias digitado.
 * Prioriza aliases que começam com o prefixo, depois os que o contêm.
 */
export interface AliasSuggestion {
  alias: string;
  item: KnowledgeItem;
}

export function suggestAliases(
  items: KnowledgeItem[],
  rawPrefix: string,
  limit = 8
): AliasSuggestion[] {
  const prefix = normalizeAlias(rawPrefix);
  const starts: AliasSuggestion[] = [];
  const contains: AliasSuggestion[] = [];
  for (const item of items) {
    for (const alias of item.aliases || []) {
      const norm = normalizeAlias(alias);
      if (!norm) continue;
      if (!prefix) {
        starts.push({ alias: norm, item });
      } else if (norm.startsWith(prefix)) {
        starts.push({ alias: norm, item });
      } else if (norm.includes(prefix)) {
        contains.push({ alias: norm, item });
      }
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Remove acentos e baixa a caixa — para comparações de texto tolerantes. */
function foldText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ----- Anexos -------------------------------------------------------------

const EXTENSION_TO_KIND: Record<string, KnowledgeAttachmentKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  svg: "image",
  pdf: "pdf",
};

/** Deriva o tipo de anexo a partir do nome/mimeType do arquivo. */
export function detectAttachmentKind(
  fileName: string,
  mimeType?: string
): KnowledgeAttachmentKind {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return EXTENSION_TO_KIND[ext] ?? "file";
}

// ----- Hierarquia ---------------------------------------------------------

export interface KnowledgeTreeNode {
  item: KnowledgeItem;
  children: KnowledgeTreeNode[];
}

/**
 * Monta a árvore hierárquica de itens (índice em árvore). Itens cujo parentId
 * não existe entre os informados são tratados como raiz, evitando "órfãos".
 */
export function buildKnowledgeTree(items: KnowledgeItem[]): KnowledgeTreeNode[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const nodes = new Map<string, KnowledgeTreeNode>(
    items.map((i) => [i.id, { item: i, children: [] }])
  );
  const roots: KnowledgeTreeNode[] = [];
  for (const item of items) {
    const node = nodes.get(item.id)!;
    if (item.parentId && byId.has(item.parentId)) {
      nodes.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Segmenta um texto em partes de texto simples e referências {{alias}}. */
export interface TextSegment {
  type: "text" | "reference";
  value: string; // texto bruto ou alias normalizado
}

export function segmentText(text: string): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(REFERENCE_TOKEN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    segments.push({ type: "reference", value: normalizeAlias(match[1]) });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}
