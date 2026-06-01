import { expect, test, describe } from 'vitest';
import { getActivityByDay } from './heatmap';
import { ReviewLog } from '../types';

describe('getActivityByDay', () => {
  const createLogOnDate = (dateStr: string): ReviewLog => ({
    id: 'log',
    cardId: 'card',
    cardFront: 'Q',
    deckId: 'deck',
    deckName: 'Deck',
    rating: 'Good',
    oldState: 'New',
    newState: 'Review',
    reviewedAt: new Date(`${dateStr}T12:00:00Z`)
  });

  const now = new Date('2026-06-01T12:00:00Z');

  test('soma logs por dia no periodo correto', () => {
    const logs = [
      createLogOnDate('2026-06-01'), // Hoje
      createLogOnDate('2026-06-01'), // Hoje duplicado
      createLogOnDate('2026-05-31'), // Ontem
      createLogOnDate('2026-05-25'), // 7 dias atrás
    ];

    const result = getActivityByDay(logs, 10, now);
    expect(result).toHaveLength(10);
    
    const today = result[result.length - 1];
    const yesterday = result[result.length - 2];
    
    expect(today.dateStr).toBe('2026-06-01');
    expect(today.count).toBe(2);

    expect(yesterday.dateStr).toBe('2026-05-31');
    expect(yesterday.count).toBe(1);
    
    const sevenDaysAgo = result.find(r => r.dateStr === '2026-05-25');
    expect(sevenDaysAgo).toBeDefined();
    expect(sevenDaysAgo?.count).toBe(1);
  });
});
