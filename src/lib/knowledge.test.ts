import { describe, it, expect } from "vitest";
import {
  normalizeAlias,
  extractReferences,
  buildAliasIndex,
  resolveReference,
  findAliasConflicts,
  computeBacklinks,
  searchKnowledgeItems,
  suggestAliases,
  detectAttachmentKind,
  buildKnowledgeTree,
  segmentText,
} from "./knowledge";
import { KnowledgeItem, Flashcard } from "../types";

const makeItem = (partial: Partial<KnowledgeItem>): KnowledgeItem => ({
  id: partial.id || "id",
  title: partial.title || "Título",
  content: partial.content || "",
  aliases: partial.aliases || [],
  attachments: partial.attachments || [],
  relatedIds: partial.relatedIds || [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...partial,
});

const makeCard = (partial: Partial<Flashcard>): Flashcard => ({
  id: partial.id || "c",
  deckId: partial.deckId || "d",
  front: partial.front || "",
  back: partial.back || "",
  fsrsData: {
    state: "New",
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
  },
  createdAt: new Date(),
  ...partial,
});

describe("normalizeAlias", () => {
  it("strips #, lowercases, removes accents and spaces", () => {
    expect(normalizeAlias("#Fumus Boni")).toBe("fumus_boni");
    expect(normalizeAlias("Tutela de Urgência")).toBe("tutela_de_urgencia");
    expect(normalizeAlias("{{fumus}}")).toBe("fumus");
    expect(normalizeAlias("  #FUMUS_PERICULUM  ")).toBe("fumus_periculum");
  });

  it("keeps hyphens and digits", () => {
    expect(normalizeAlias("art-5")).toBe("art-5");
  });
});

describe("extractReferences", () => {
  it("extracts {{alias}} tokens, normalized and de-duplicated", () => {
    const text = "Veja {{fumus}} e também {{#Competência}} e de novo {{fumus}}.";
    expect(extractReferences(text)).toEqual(["fumus", "competencia"]);
  });

  it("extracts \\alias tokens ending at non-alias chars", () => {
    expect(extractReferences("Veja \\fumus, \\tutela_urgencia e \\competencia.")).toEqual([
      "fumus",
      "tutela_urgencia",
      "competencia",
    ]);
  });

  it("supports an optional # after the backslash", () => {
    expect(extractReferences("Ref \\#Fumus aqui")).toEqual(["fumus"]);
  });

  it("mixes both formats and de-duplicates across them", () => {
    expect(extractReferences("{{fumus}} e \\fumus e \\competencia")).toEqual([
      "fumus",
      "competencia",
    ]);
  });

  it("returns empty for text without references", () => {
    expect(extractReferences("nada aqui #naoconta")).toEqual([]);
    expect(extractReferences("")).toEqual([]);
  });
});

describe("segmentText", () => {
  it("splits text into plain and reference segments", () => {
    const segs = segmentText("A {{fumus}} B");
    expect(segs).toEqual([
      { type: "text", value: "A " },
      { type: "reference", value: "fumus" },
      { type: "text", value: " B" },
    ]);
  });

  it("handles reference at start and end", () => {
    const segs = segmentText("{{a}}{{b}}");
    expect(segs).toEqual([
      { type: "reference", value: "a" },
      { type: "reference", value: "b" },
    ]);
  });

  it("splits \\alias references and keeps surrounding text", () => {
    expect(segmentText("A \\fumus B")).toEqual([
      { type: "text", value: "A " },
      { type: "reference", value: "fumus" },
      { type: "text", value: " B" },
    ]);
  });
});

describe("buildAliasIndex / resolveReference", () => {
  const items = [
    makeItem({ id: "1", aliases: ["fumus", "fumus_periculum"] }),
    makeItem({ id: "2", aliases: ["competencia"] }),
  ];
  const index = buildAliasIndex(items);

  it("maps every alias to its item", () => {
    expect(resolveReference(index, "fumus")?.id).toBe("1");
    expect(resolveReference(index, "#Fumus_Periculum")?.id).toBe("1");
    expect(resolveReference(index, "competencia")?.id).toBe("2");
  });

  it("returns undefined for unknown alias", () => {
    expect(resolveReference(index, "inexistente")).toBeUndefined();
  });
});

describe("findAliasConflicts", () => {
  const items = [
    makeItem({ id: "1", aliases: ["fumus"] }),
    makeItem({ id: "2", aliases: ["competencia"] }),
  ];

  it("detects aliases already taken by other items", () => {
    expect(findAliasConflicts(["fumus", "novo"], items)).toEqual(["fumus"]);
  });

  it("ignores aliases owned by the current item being edited", () => {
    expect(findAliasConflicts(["fumus"], items, "1")).toEqual([]);
  });
});

describe("computeBacklinks", () => {
  it("maps items to the cards that reference them", () => {
    const items = [makeItem({ id: "1", aliases: ["fumus"] })];
    const index = buildAliasIndex(items);
    const cards = {
      d1: [
        makeCard({ id: "c1", front: "O que é {{fumus}}?", back: "resp" }),
        makeCard({ id: "c2", front: "sem ref", back: "nada" }),
      ],
      d2: [makeCard({ id: "c3", front: "de novo {{fumus}}", back: "x" })],
    };
    const backlinks = computeBacklinks(cards, index);
    expect(backlinks.get("1")?.map((b) => b.cardId).sort()).toEqual([
      "c1",
      "c3",
    ]);
  });

  it("counts a card only once even with repeated references", () => {
    const items = [makeItem({ id: "1", aliases: ["fumus"] })];
    const index = buildAliasIndex(items);
    const cards = {
      d1: [makeCard({ id: "c1", front: "{{fumus}} {{fumus}}", back: "{{fumus}}" })],
    };
    expect(computeBacklinks(cards, index).get("1")?.length).toBe(1);
  });
});

describe("searchKnowledgeItems", () => {
  const items = [
    makeItem({ id: "1", title: "Tutela de Urgência", aliases: ["fumus"], categoryId: "cat1" }),
    makeItem({ id: "2", title: "Competência", content: "regras de competência", categoryId: "cat2" }),
  ];

  it("matches by title accent-insensitively", () => {
    expect(searchKnowledgeItems(items, "urgencia").map((i) => i.id)).toEqual(["1"]);
  });

  it("matches by alias and content", () => {
    expect(searchKnowledgeItems(items, "fumus").map((i) => i.id)).toEqual(["1"]);
    expect(searchKnowledgeItems(items, "regras").map((i) => i.id)).toEqual(["2"]);
  });

  it("filters by category", () => {
    expect(searchKnowledgeItems(items, "", { categoryId: "cat2" }).map((i) => i.id)).toEqual(["2"]);
  });
});

describe("suggestAliases", () => {
  const items = [
    makeItem({ id: "1", title: "Tutela", aliases: ["fumus", "fumus_periculum"] }),
    makeItem({ id: "2", title: "Outro", aliases: ["competencia"] }),
  ];

  it("suggests prefix matches first", () => {
    const res = suggestAliases(items, "fum");
    expect(res.map((r) => r.alias)).toEqual(["fumus", "fumus_periculum"]);
  });

  it("returns all when prefix empty (bounded by limit)", () => {
    expect(suggestAliases(items, "", 2).length).toBe(2);
  });
});

describe("detectAttachmentKind", () => {
  it("detects images and pdfs by mime and extension", () => {
    expect(detectAttachmentKind("x.png")).toBe("image");
    expect(detectAttachmentKind("x.svg")).toBe("image");
    expect(detectAttachmentKind("doc.pdf")).toBe("pdf");
    expect(detectAttachmentKind("weird", "image/webp")).toBe("image");
    expect(detectAttachmentKind("unknown.zip")).toBe("file");
  });
});

describe("buildKnowledgeTree", () => {
  it("nests children under parents and treats missing parents as roots", () => {
    const items = [
      makeItem({ id: "root" }),
      makeItem({ id: "child", parentId: "root" }),
      makeItem({ id: "orphan", parentId: "ghost" }),
    ];
    const tree = buildKnowledgeTree(items);
    const ids = tree.map((n) => n.item.id).sort();
    expect(ids).toEqual(["orphan", "root"]);
    const root = tree.find((n) => n.item.id === "root")!;
    expect(root.children.map((c) => c.item.id)).toEqual(["child"]);
  });
});
