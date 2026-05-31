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
  tags?: string[];
  comments?: string;
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
