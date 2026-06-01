import { expect, test, describe } from 'vitest';
import { getRetentionBySubject } from './retention';
import { Deck, ReviewLog } from '../types';

describe('getRetentionBySubject', () => {
  const createDeck = (id: string, name: string, parentId?: string): Deck => ({
    id,
    name,
    parentId,
    createdAt: new Date()
  });

  const createLog = (deckId: string, rating: 'Again' | 'Hard' | 'Good' | 'Easy'): ReviewLog => ({
    id: `${deckId}-log`,
    cardId: 'card-1',
    cardFront: 'Q',
    deckId,
    deckName: 'Mock Deck',
    rating,
    oldState: 'New',
    newState: 'Review',
    reviewedAt: new Date()
  });

  test('calcula retencao por deck raiz agregando filhos', () => {
    const decks = [
      createDeck('root1', 'Constitucional'),
      createDeck('child1', 'Direitos Individuais', 'root1'),
      createDeck('root2', 'Administrativo'),
    ];

    const logs = [
      createLog('root1', 'Good'), // Constitucional root
      createLog('child1', 'Easy'), // Constitucional child
      createLog('child1', 'Again'), // Constitucional child (fail)
      createLog('root2', 'Again'), // Administrativo (fail)
    ];

    const result = getRetentionBySubject(decks, logs);

    // root1 total: 3 reviews (Good, Easy, Again) -> 2 successes -> 67%
    // root2 total: 1 review (Again) -> 0 success -> 0%
    expect(result).toHaveLength(2);
    
    const r1 = result.find(r => r.subjectId === 'root1');
    const r2 = result.find(r => r.subjectId === 'root2');

    expect(r1).toBeDefined();
    expect(r1?.retentionRate).toBe(67);
    expect(r1?.totalReviews).toBe(3);

    expect(r2).toBeDefined();
    expect(r2?.retentionRate).toBe(0);
    expect(r2?.totalReviews).toBe(1);
  });

  test('retorna 100% de retencao se nao houver reviews para um deck', () => {
    const decks = [createDeck('root1', 'Constitucional')];
    const result = getRetentionBySubject(decks, []);
    expect(result[0].retentionRate).toBe(100);
    expect(result[0].totalReviews).toBe(0);
  });
});
