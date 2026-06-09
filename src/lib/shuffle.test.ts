import { expect, test, describe, vi, afterEach } from 'vitest';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('não muta o array original', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  test('preserva todos os elementos (mesma multiset)', () => {
    const input = [1, 2, 3, 4, 5, 5, 'a', 'b'];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  test('array vazio retorna array vazio', () => {
    expect(shuffle([])).toEqual([]);
  });

  test('array de um elemento permanece igual', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  test('produz a permutação esperada com Math.random determinístico', () => {
    // Com Math.random fixo em 0, o índice j é sempre 0, então cada passo
    // troca a posição i com a posição 0 — resultado previsível.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
  });
});
