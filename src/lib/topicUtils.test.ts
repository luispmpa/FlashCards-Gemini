import { expect, test, describe } from 'vitest';
import { findSimilarDeck, isSimilarTopic } from './topicUtils';

describe('topicUtils.findSimilarDeck', () => {
  const decks = [
    { id: '1', name: 'Licitações' },
    { id: '2', name: 'Recursos Humanos' },
    { id: '3', name: 'Contabilidade' },
  ];

  test('reaproveita tópico existente em variações (plural/acentos/typos)', () => {
    expect(findSimilarDeck('Licitação', decks)?.id).toBe('1');
    expect(findSimilarDeck('licitacoes', decks)?.id).toBe('1');
    expect(findSimilarDeck('recursos humanos', decks)?.id).toBe('2');
  });

  test('retorna undefined quando o tópico é realmente novo', () => {
    expect(findSimilarDeck('Direito Penal', decks)).toBeUndefined();
    expect(findSimilarDeck('Geografia', decks)).toBeUndefined();
  });

  test('não cria duplicata ao casar com um tópico criado no mesmo import', () => {
    const created: { id: string; name: string }[] = [];
    const resolve = (topic: string) => {
      const match = findSimilarDeck(topic, decks) || findSimilarDeck(topic, created);
      if (match) return match.id;
      const nd = { id: `new-${created.length}`, name: topic };
      created.push(nd);
      return nd.id;
    };
    const a = resolve('Direito Penal');
    const b = resolve('direito penal'); // variação -> deve casar com o recém-criado
    expect(a).toBe(b);
    expect(created).toHaveLength(1);
  });

  test('isSimilarTopic continua exposto e coerente', () => {
    expect(isSimilarTopic('Licitações', 'Licitação')).toBe(true);
    expect(isSimilarTopic('Licitações', 'Geografia')).toBe(false);
  });
});
