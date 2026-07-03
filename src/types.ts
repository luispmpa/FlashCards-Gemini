export type FSRSState = "New" | "Learning" | "Review" | "Relearning";
export type Rating = "Again" | "Hard" | "Good" | "Easy";

export interface FSRSData {
  state: FSRSState;
  due: Date; // when it's due next
  stability: number; // Interval in days in memory
  difficulty: number; // 1 to 10
  elapsed_days: number; // days since last review
  scheduled_days: number; // current interval duration
  reps: number; // review counts
  lapses: number; // how many times forgotten
  last_review?: Date;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  options?: string[]; // A, B, C, D, E for questions
  back: string;
  correctOption?: string; // Optional for backward compatibility with old cards
  fsrsData: FSRSData;
  createdAt: Date;
}

export interface Deck {
  id: string;
  parentId?: string; // For hierarchical folders
  name: string;
  description?: string;
  createdAt: Date;
}

// In-memory or simulated global state signature
export interface AppState {
  decks: Deck[];
  cards: Record<string, Flashcard[]>; // deckId -> cards
}

export interface StudySession {
  cardsToReview: Flashcard[];
  newCards: Flashcard[];
  currentIndex: number;
}

export type UpdateCategory =
  | "bug"
  | "perf"
  | "a11y"
  | "security"
  | "ux"
  | "refactor"
  | "tests"
  | "deps"
  | "docs";

export type UpdateStatus = "applied" | "reverted";

// Each entry represents ONE atomic improvement applied by the automated
// "Melhoria contínua" routine. It maps 1:1 to a single git commit, so it can be
// reverted individually. Consumed by the "Atualizações" screen.
export interface AppUpdate {
  id: string; // matches the Update-Id commit trailer (uuid v4)
  date: string; // ISO timestamp of when it was applied
  category: UpdateCategory;
  title: string;
  description: string; // what changed and why, in pt-BR
  files: string[]; // files touched by this improvement
  commit: string; // short git sha of the atomic commit
  status: UpdateStatus;
}

// ----- Painel de geração de flashcards (rotina "PDF → import") -----
// Lido de flashcards-gerados/_progresso.json (mantido pela rotina). Alimenta o
// mini-dashboard em Configurações. A GERAÇÃO vive no repositório (GitHub) e não
// é afetada por apagar cards no app; o "no sistema" é calculado ao vivo do banco.
export interface PdfProgress {
  arquivo: string;
  assunto: string;
  paginas?: string;
  cardsGerados: number;
  concluido: boolean;
}

export interface MateriaProgress {
  materia: string;
  pdfsDetectados: number;
  pdfsProcessados: number;
  totalCardsGerados: number;
  topicosCanonicos: string[];
  pdfs: PdfProgress[];
  alertas?: string[];
}

export interface GenerationProgress {
  atualizadoEm: string | null;
  totalCardsGerados: number;
  possiveisDuplicatasEvitadas: number;
  materias: MateriaProgress[];
}

export interface ReviewLog {
  id: string;
  cardId: string;
  cardFront: string;
  deckId: string;
  deckName: string;
  rating: Rating;
  oldState: FSRSState;
  newState: FSRSState;
  reviewedAt: Date;
}

// ============================================================================
// Acervo de Conhecimento (Knowledge Base)
// ----------------------------------------------------------------------------
// Repositório centralizado de conteúdos de apoio (mnemônicos, mapas mentais,
// tabelas, resumos, jurisprudência etc.) reutilizáveis por múltiplos flashcards.
// Os flashcards NÃO duplicam esse conteúdo: apenas o referenciam por um alias
// no formato {{alias}}. Alterar um item do Acervo reflete automaticamente em
// todos os flashcards que o referenciam.
//
// A modelagem é deliberadamente preparada para evoluções futuras com IA
// (busca semântica, sugestões, deduplicação). Campos reservados para esses
// recursos são opcionais e NÃO são preenchidos/consumidos pela UI atual — ver
// KnowledgeItem.embedding / aiMeta. Isso permite adicioná-los sem refatoração.
// ============================================================================

// Tipos de anexo suportados. A lista é intencionalmente aberta ("file" cobre
// qualquer novo formato) para permitir novos tipos sem alterar a modelagem.
export type KnowledgeAttachmentKind = "image" | "pdf" | "file";

export interface KnowledgeAttachment {
  id: string;
  kind: KnowledgeAttachmentKind;
  mimeType: string; // ex.: "image/png", "application/pdf"
  name: string; // nome de exibição do arquivo
  url: string; // URL hospedada do arquivo
  size?: number; // bytes (opcional)
}

// Extensões de arquivo aceitas inicialmente para anexos. Ampliar esta lista é
// suficiente para habilitar novos formatos — nenhuma outra mudança é exigida.
export const ACCEPTED_ATTACHMENT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "pdf",
] as const;

export interface KnowledgeCategory {
  id: string;
  name: string;
  color?: string; // cor opcional para identificação visual
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  content: string; // texto rico em Markdown
  aliases: string[]; // apelidos únicos no sistema (normalizados, sem "#")
  attachments: KnowledgeAttachment[];
  relatedIds: string[]; // relacionamentos manuais com outros itens
  parentId?: string; // organização hierárquica (índice em árvore)
  createdAt: Date;
  updatedAt: Date;

  // ----- Reservado para evoluções futuras com IA (não usado hoje) -----
  // Vetor de embedding para busca semântica. Mantido opcional para que a
  // geração possa ser adicionada depois sem migração de dados.
  embedding?: number[];
  // Metadados livres gerados por IA (sugestões, deduplicação etc.).
  aiMeta?: Record<string, unknown>;
}

// Referência resolvida de um flashcard para um item do Acervo. Usada para
// exibir backlinks ("Utilizado em: Flashcard X, Y, Z").
export interface KnowledgeBacklink {
  cardId: string;
  deckId: string;
  cardFront: string;
}
