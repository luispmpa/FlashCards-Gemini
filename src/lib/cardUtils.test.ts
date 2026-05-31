import { expect, test, describe } from 'vitest';
import { getCorrectIndex } from './cardUtils';
import { Flashcard } from '../types';
import { createInitialFSRSData } from './fsrs';

describe('getCorrectIndex', () => {
  const baseCard: Flashcard = {
    id: '1',
    deckId: '2',
    front: 'Question',
    options: ['A', 'B', 'C', 'D'],
    back: 'Explanation',
    fsrsData: createInitialFSRSData(),
    createdAt: new Date()
  };

  test('extracts from correctOption if present', () => {
    const card = { ...baseCard, correctOption: 'C' };
    expect(getCorrectIndex(card)).toBe(2);
  });

  test('extracts from back using regex if correctOption is missing', () => {
    const card = { ...baseCard, back: 'Some text. Gabarito: B. More text.' };
    expect(getCorrectIndex(card)).toBe(1);
  });

  test('returns -1 if nothing matches', () => {
    const card = { ...baseCard, back: 'Just an explanation without answer.' };
    expect(getCorrectIndex(card)).toBe(-1);
  });
});
