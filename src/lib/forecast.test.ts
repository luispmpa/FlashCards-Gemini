import { expect, test, describe } from 'vitest';
import { getDueForecast } from './forecast';
import { Flashcard } from '../types';

describe('getDueForecast', () => {
  const createCardWithDue = (dueStr: string, state: string = 'Review'): Flashcard => ({
    id: 'mock-id',
    deckId: 'mock-deck',
    front: 'Q',
    options: [],
    back: 'A',
    createdAt: new Date(),
    fsrsData: {
      due: new Date(`${dueStr}T12:00:00Z`),
      stability: 1,
      difficulty: 1,
      elapsed_days: 1,
      scheduled_days: 1,
      reps: 1,
      lapses: 0,
      state: state as any
    }
  });

  const now = new Date('2026-06-01T10:00:00Z');

  test('lista vazia retorna array de zeros', () => {
    const result = getDueForecast([], 5, now);
    expect(result).toHaveLength(5);
    expect(result.map(r => r.count)).toEqual([0, 0, 0, 0, 0]);
  });

  test('vence hoje ou antes vai para o indice 0', () => {
    const cards = [
      createCardWithDue('2026-06-01'), // Hoje
      createCardWithDue('2026-05-31'), // Ontem (overdue)
      createCardWithDue('2026-06-02'), // Amanhã
    ];
    const result = getDueForecast(cards, 3, now);
    expect(result.map(r => r.count)).toEqual([2, 1, 0]);
  });

  test('novos cards sao ignorados', () => {
    const cards = [
      createCardWithDue('2026-06-01', 'New'),
    ];
    const result = getDueForecast(cards, 3, now);
    expect(result.map(r => r.count)).toEqual([0, 0, 0]);
  });
});
