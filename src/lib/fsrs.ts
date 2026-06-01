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

export function applyFSRSRating(card: Flashcard, rating: Rating, now: Date = new Date()): Flashcard {
  const currentData = card.fsrsData;
  
  // Compatibility: treat cards with old arbitrary states or 0 stability as new if state is 'New'
  const fsrsReadyCard = toFsrsCard(currentData);
  if (currentData.state === "New") {
    // Ensuring new cards start completely clean in ts-fsrs eyes
    Object.assign(fsrsReadyCard, createEmptyCard(fsrsReadyCard.due || now));
    // Carry over last_review if it existed in some weird legacy state
    if (currentData.last_review) {
      fsrsReadyCard.last_review = currentData.last_review;
    }
  }

  const result = f.next(fsrsReadyCard, now, RATING_MAP[rating]);
  
  return {
    ...card,
    fsrsData: fromFsrsCard(result.card)
  };
}

export function createInitialFSRSData(): FSRSData {
  return fromFsrsCard(createEmptyCard(new Date()));
}

export function shouldRequeue(card: Flashcard, now: Date = new Date()): boolean {
  // A card should be re-queued if its due time is within the same calendar day or earlier (<= end of today)
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  
  return card.fsrsData.due.getTime() <= endOfToday.getTime();
}
