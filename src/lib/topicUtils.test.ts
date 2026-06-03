import { expect, test, describe } from 'vitest';
import { normalizeTopic, stemPortugueseWord, isSimilarTopic } from './topicUtils';

describe('normalizeTopic', () => {
  test('lowercases and removes accents', () => {
    expect(normalizeTopic('Ações Penais')).toBe('acoes penais');
  });

  test('removes parenthetical content', () => {
    expect(normalizeTopic('Licitações (Lei 8.666)')).toBe('licitacoes');
  });

  test('collapses repeated whitespace', () => {
    expect(normalizeTopic('Direito   Penal')).toBe('direito penal');
  });
});

describe('stemPortugueseWord', () => {
  test('keeps short words unchanged', () => {
    expect(stemPortugueseWord('lei')).toBe('lei');
  });

  test('removes simple plural', () => {
    expect(stemPortugueseWord('atos')).toBe('ato');
  });

  test('normalizes -oes plural ending', () => {
    expect(stemPortugueseWord('licitacoes')).toBe('licitacao');
  });
});

describe('isSimilarTopic', () => {
  test('matches identical topics after normalization', () => {
    expect(isSimilarTopic('Atos Administrativos', 'atos administrativos')).toBe(true);
  });

  test('matches singular/plural variations', () => {
    expect(isSimilarTopic('Licitações', 'Licitação')).toBe(true);
  });

  test('matches a topic contained within a broader one', () => {
    expect(isSimilarTopic('Licitações', 'Dispensa de Licitações')).toBe(true);
  });

  test('does not match unrelated topics', () => {
    expect(isSimilarTopic('Matemática', 'História')).toBe(false);
  });
});
