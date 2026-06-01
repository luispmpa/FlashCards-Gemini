import { Flashcard } from '../types';

export interface StudyCounts {
  due: number;      // cards vencidos para revisão (não-novos, due <= fim de hoje)
  newCards: number; // cards novos (state === "New")
}

// Conta, a partir de uma lista de cards, quantos estão vencidos para revisão hoje e quantos são novos.
export function countDueAndNew(cards: Flashcard[], now: Date = new Date()): StudyCounts {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  let due = 0;
  let newCards = 0;
  for (const card of cards) {
    if (card.fsrsData.state === 'New') {
      newCards++;
    } else if (card.fsrsData.due.getTime() <= endOfToday.getTime()) {
      due++;
    }
  }
  return { due, newCards };
}
