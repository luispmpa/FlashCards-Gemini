import { Deck, ReviewLog } from '../types';

export interface SubjectRetention {
  subjectId: string;
  subjectName: string;
  retentionRate: number; // percentage (0 to 100)
  totalReviews: number;
}

/**
 * Calculates the retention rate per root deck (subject), aggregating review logs from both the root deck
 * and any of its sub-topics (child deks).
 *
 * Formula: ((total Good + total Easy) / total reviews) * 100
 * If a subject has 0 reviews, we default to 100% retention with 0 reviews.
 */
export function getRetentionBySubject(decks: Deck[], logs: ReviewLog[]): SubjectRetention[] {
  // 1. Identify root decks (subjects that do not have a parentId)
  const rootDecks = decks.filter(d => !d.parentId);
  
  // 2. Map every deckId to its root deck's ID
  const deckToRootMap: Record<string, string> = {};
  
  for (const deck of decks) {
    if (!deck.parentId) {
      deckToRootMap[deck.id] = deck.id;
    } else {
      let pId = deck.parentId;
      const seen = new Set<string>();
      while (pId && !seen.has(pId)) {
        seen.add(pId);
        const parent = decks.find(d => d.id === pId);
        if (parent && parent.parentId) {
          pId = parent.parentId;
        } else {
          break;
        }
      }
      deckToRootMap[deck.id] = pId;
    }
  }

  // 3. Keep counts
  const subjectSums: Record<string, { goodEasy: number; total: number }> = {};
  for (const r of rootDecks) {
    subjectSums[r.id] = { goodEasy: 0, total: 0 };
  }

  for (const log of logs) {
    const rootId = deckToRootMap[log.deckId] || log.deckId;
    if (rootId) {
      if (!subjectSums[rootId]) {
        subjectSums[rootId] = { goodEasy: 0, total: 0 };
      }
      subjectSums[rootId].total++;
      if (log.rating === "Good" || log.rating === "Easy") {
        subjectSums[rootId].goodEasy++;
      }
    }
  }

  // 4. Map back to SubjectRetention list
  return rootDecks.map(r => {
    const sum = subjectSums[r.id] || { goodEasy: 0, total: 0 };
    const rate = sum.total > 0 ? Math.round((sum.goodEasy / sum.total) * 100) : 100;
    return {
      subjectId: r.id,
      subjectName: r.name,
      retentionRate: rate,
      totalReviews: sum.total
    };
  });
}
