import { fsrs, generatorParameters, createEmptyCard, Rating as FsrsRating, State, type Card as FsrsCard } from 'ts-fsrs';
import { Flashcard, FSRSData, Rating, FSRSState } from '../types';

const f = fsrs(generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36500, // days (~100 years = no explosion, but absolute max)
  enable_fuzz: true,
}));

// Provide exactly what ts-fsrs expects for Rating
const RATING_MAP: Record<Rating, any> = {
  Again: FsrsRating.Again, 
  Hard: FsrsRating.Hard, 
  Good: FsrsRating.Good, 
  Easy: FsrsRating.Easy,
};

const STATE_TO_STR: Record<State, FSRSState> = {
  [State.New]: "New",
  [State.Learning]: "Learning",
  [State.Review]: "Review",
  [State.Relearning]: "Relearning"
};

const STR_TO_STATE: Record<FSRSState, State> = {
  "New": State.New,
  "Learning": State.Learning,
  "Review": State.Review,
  "Relearning": State.Relearning
};

function toFsrsCard(d: FSRSData): FsrsCard {
  return {
    due: d.due,
    stability: d.stability,
    difficulty: d.difficulty,
    elapsed_days: d.elapsed_days,
    scheduled_days: d.scheduled_days,
    reps: d.reps,
    lapses: d.lapses,
    state: STR_TO_STATE[d.state],
    last_review: d.last_review
  } as FsrsCard; // Cast to FsrsCard as ts-fsrs might add internal fields like learning_steps in newer versions
}

function fromFsrsCard(c: FsrsCard): FSRSData {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: STATE_TO_STR[c.state],
    last_review: c.last_review
  };
}

function prepFsrsCard(currentData: FSRSData, now: Date): FsrsCard {
  const fsrsReadyCard = toFsrsCard(currentData);
  if (currentData.state === "New") {
    Object.assign(fsrsReadyCard, createEmptyCard(fsrsReadyCard.due || now));
    if (currentData.last_review) {
      fsrsReadyCard.last_review = currentData.last_review;
    }
  }
  return fsrsReadyCard;
}

export function applyFSRSRating(card: Flashcard, rating: Rating, now: Date = new Date()): Flashcard {
  const fsrsReadyCard = prepFsrsCard(card.fsrsData, now);
  const result = f.next(fsrsReadyCard, now, RATING_MAP[rating]);
  return { ...card, fsrsData: fromFsrsCard(result.card) };
}

// Formata uma duração (ms) de forma curta e legível: "<1min", "10min", "5h", "1d", "3mes", "1a".
export function formatInterval(ms: number): string {
  if (ms < 60000) return '<1min';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mes`;
  return `${Math.round(days / 365)}a`;
}

export interface ScheduledOption {
  card: Flashcard;        // o card já agendado para esta avaliação (reusar ao confirmar)
  intervalLabel: string;  // rótulo legível do próximo intervalo
}

// Para o card atual, calcula via ts-fsrs o resultado de cada avaliação (Again/Hard/Good/Easy).
export function getSchedulingOptions(card: Flashcard, now: Date = new Date()): Record<Rating, ScheduledOption> {
  const ratings: Rating[] = ['Again', 'Hard', 'Good', 'Easy'];
  const out = {} as Record<Rating, ScheduledOption>;
  for (const r of ratings) {
    const base = prepFsrsCard(card.fsrsData, now); // fresco a cada avaliação
    const result = f.next(base, now, RATING_MAP[r]);
    out[r] = {
      card: { ...card, fsrsData: fromFsrsCard(result.card) },
      intervalLabel: formatInterval(result.card.due.getTime() - now.getTime()),
    };
  }
  return out;
}

export function createInitialFSRSData(): FSRSData {
  return fromFsrsCard(createEmptyCard(new Date()));
}

// Reaparece na MESMA sessão apenas se o FSRS agendou um passo de aprendizado sub-diário (< 1 dia).
export function shouldRequeue(card: Flashcard): boolean {
  return card.fsrsData.scheduled_days < 1;
}
