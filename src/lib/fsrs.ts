import { Flashcard, FSRSData, Rating } from "../types";
import { addDays, addMinutes, differenceInDays } from "date-fns";

// This is a simplified, simulated FSRS scheduling algorithm.
// A real implementation would use the exact FSRS weights and logarithmic formulas.
export function applyFSRSRating(card: Flashcard, rating: Rating, now: Date = new Date()): Flashcard {
  const currentData = card.fsrsData;
  const oldState = currentData.state;
  
  let nextState = currentData.state;
  let nextDifficulty = currentData.difficulty;
  let nextStability = currentData.stability;
  let nextLapses = currentData.lapses;
  let nextDue = now;
  
  // Rating multiplier approximations
  const difficultyAdjustments = {
    Again: +2,
    Hard: +1,
    Good: -0.5,
    Easy: -2
  };
  
  const stabilityMultipliers = {
    Again: 0.1,
    Hard: 1.2,
    Good: 2.5,
    Easy: 3.5
  };

  if (oldState === "New" || oldState === "Learning") {
    if (rating === "Again") {
      nextState = "Learning";
      nextDue = addMinutes(now, 1);
    } else if (rating === "Hard") {
      nextState = "Learning";
      nextDue = addMinutes(now, 5);
    } else if (rating === "Good") {
      nextState = "Review";
      nextStability = 1;
      nextDifficulty = 5;
      nextDue = addDays(now, 1);
    } else if (rating === "Easy") {
      nextState = "Review";
      nextStability = 4;
      nextDifficulty = 3;
      nextDue = addDays(now, 4);
    }
  } else if (oldState === "Review") {
    if (rating === "Again") {
      nextState = "Relearning";
      nextLapses += 1;
      nextStability = Math.max(0.1, nextStability * stabilityMultipliers.Again);
      nextDue = addMinutes(now, 5);
      nextDifficulty = Math.min(10, nextDifficulty + difficultyAdjustments.Again);
    } else {
      nextDifficulty = Math.max(1, Math.min(10, nextDifficulty + difficultyAdjustments[rating as keyof typeof difficultyAdjustments]));
      nextStability = nextStability * stabilityMultipliers[rating as keyof typeof stabilityMultipliers];
      nextDue = addDays(now, nextStability);
    }
  } else if (oldState === "Relearning") {
    if (rating === "Again") {
      nextDue = addMinutes(now, 5);
    } else if (rating === "Hard") {
      nextDue = addMinutes(now, 10);
    } else {
      nextState = "Review";
      nextDue = addDays(now, 1);
    }
  }

  const elapsed = currentData.last_review ? differenceInDays(now, currentData.last_review) : 0;
  
  return {
    ...card,
    fsrsData: {
      state: nextState,
      difficulty: nextDifficulty,
      stability: nextStability,
      due: nextDue,
      reps: currentData.reps + 1,
      lapses: nextLapses,
      last_review: now,
      elapsed_days: elapsed,
      scheduled_days: differenceInDays(nextDue, now)
    }
  };
}

export function createInitialFSRSData(): FSRSData {
  return {
    state: "New",
    due: new Date(),
    stability: 0,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0
  };
}
