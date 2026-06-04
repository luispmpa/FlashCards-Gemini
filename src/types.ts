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
