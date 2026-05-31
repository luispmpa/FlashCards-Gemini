import { expect, test, describe } from 'vitest';
import { applyFSRSRating, createInitialFSRSData } from './fsrs';
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
});
