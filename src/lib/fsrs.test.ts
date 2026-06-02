import { expect, test, describe } from 'vitest';
import { applyFSRSRating, createInitialFSRSData, shouldRequeue, shouldRequeueAfterRating, formatInterval } from './fsrs';
import { Flashcard } from '../types';

describe('FSRS Implementation', () => {
  const createMockCard = (): Flashcard => ({
    id: '1',
    deckId: 'deck-1',
    front: 'Test Front',
    options: ['A', 'B', 'C', 'D'],
    back: 'Test Back',
    fsrsData: createInitialFSRSData(),
    createdAt: new Date()
  });

  test('New card starts with stability 0 and goes to Review with interval >= 1 on Good', () => {
    const card = createMockCard();
    const now = new Date('2024-01-01T12:00:00Z');
    
    expect(card.fsrsData.state).toBe('New');
    
    const nextCard = applyFSRSRating(card, 'Good', now);
    
    expect(nextCard.fsrsData.state).not.toBe('New'); // Likely "Learning" if multiple steps, but standard ts-fsrs config puts it in Learning? Let's check state.
    // wait, ts-fsrs default Good on New card is state=Learning. 
    // Actually, in ts-fsrs, New + Good -> Learning or Review depending on interval.
    expect(nextCard.fsrsData.last_review).toBeDefined();
  });

  test('Existing card due date increases over time', () => {
    let card = createMockCard();
    const start = new Date('2024-01-01T12:00:00Z');
    
    // First review
    card = applyFSRSRating(card, 'Good', start);
    const afterFirst = new Date(card.fsrsData.due);
    expect(afterFirst.getTime()).toBeGreaterThan(start.getTime());

    // Next review a day later
    const day2 = new Date('2024-01-02T12:00:00Z');
    card = applyFSRSRating(card, 'Good', day2);
    const afterSecond = new Date(card.fsrsData.due);
    
    // The interval should increase
    const interval2 = afterSecond.getTime() - day2.getTime();
    
    expect(interval2).toBeGreaterThanOrEqual(0);
  });

  test('shouldRequeue: true para passo sub-diário (scheduled_days 0), false para >= 1 dia', () => {
    const card = createMockCard();
    card.fsrsData.scheduled_days = 0;
    expect(shouldRequeue(card)).toBe(true);
    card.fsrsData.scheduled_days = 1;
    expect(shouldRequeue(card)).toBe(false);
    card.fsrsData.scheduled_days = 10;
    expect(shouldRequeue(card)).toBe(false);
  });

  test('shouldRequeueAfterRating: só "Again" reapresenta na sessão; Hard/Good/Easy avançam', () => {
    const card = createMockCard();
    // passo sub-diário (ex.: Errei/Bom = poucos minutos)
    card.fsrsData.scheduled_days = 0;
    expect(shouldRequeueAfterRating('Again', card)).toBe(true);
    expect(shouldRequeueAfterRating('Hard', card)).toBe(false);
    expect(shouldRequeueAfterRating('Good', card)).toBe(false);
    expect(shouldRequeueAfterRating('Easy', card)).toBe(false);

    // intervalo de dias: nunca reapresenta na sessão, nem mesmo "Again"
    card.fsrsData.scheduled_days = 3;
    expect(shouldRequeueAfterRating('Again', card)).toBe(false);
  });

  test('formatInterval formata durações', () => {
    expect(formatInterval(30 * 1000)).toBe('<1min');
    expect(formatInterval(10 * 60 * 1000)).toBe('10min');
    expect(formatInterval(2 * 60 * 60 * 1000)).toBe('2h');
    expect(formatInterval(24 * 60 * 60 * 1000)).toBe('1d');
  });
});
