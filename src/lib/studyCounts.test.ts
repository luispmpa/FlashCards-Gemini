import { describe, it, expect } from 'vitest';
import { countDueAndNew } from './studyCounts';
import { Flashcard } from '../types';

function makeCard(state: string, due: Date): Flashcard {
  return {
    id: Math.random().toString(36).slice(2),
    deckId: 'd1',
    front: 'q',
    back: 'a',
    fsrsData: {
      state, due,
      stability: 1, difficulty: 1, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0,
    } as any,
    createdAt: new Date(),
  } as Flashcard;
}

describe('countDueAndNew', () => {
  const now = new Date('2026-06-01T12:00:00');

  it('lista vazia retorna zero', () => {
    expect(countDueAndNew([], now)).toEqual({ due: 0, newCards: 0 });
  });

  it('conta cards novos', () => {
    const cards = [makeCard('New', now), makeCard('New', now)];
    expect(countDueAndNew(cards, now)).toEqual({ due: 0, newCards: 2 });
  });

  it('conta vencidos (due no passado ou hoje) como a revisar', () => {
    const cards = [
      makeCard('Review', new Date('2026-05-30T00:00:00')), // vencido
      makeCard('Review', new Date('2026-06-01T20:00:00')), // hoje (ainda dentro do dia)
    ];
    expect(countDueAndNew(cards, now)).toEqual({ due: 2, newCards: 0 });
  });

  it('não conta cards agendados para o futuro', () => {
    const cards = [makeCard('Review', new Date('2026-06-05T00:00:00'))];
    expect(countDueAndNew(cards, now)).toEqual({ due: 0, newCards: 0 });
  });

  it('mistura novos, vencidos e futuros', () => {
    const cards = [
      makeCard('New', now),
      makeCard('Review', new Date('2026-05-29T00:00:00')),
      makeCard('Review', new Date('2026-06-10T00:00:00')),
    ];
    expect(countDueAndNew(cards, now)).toEqual({ due: 1, newCards: 1 });
  });
});
