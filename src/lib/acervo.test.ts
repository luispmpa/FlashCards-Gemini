import { describe, it, expect } from 'vitest';
import { normalizeForMatch, findMatchingSlug } from './acervo';

describe('normalizeForMatch', () => {
  it('remove acentos, espaços e pontuação e deixa minúsculo', () => {
    expect(normalizeForMatch('Administração Orçamentária')).toBe('administracaoorcamentaria');
    expect(normalizeForMatch('AFO')).toBe('afo');
    expect(normalizeForMatch('Redes e Segurança')).toBe('redeseseguranca');
  });

  it('lida com entrada vazia ou nula', () => {
    expect(normalizeForMatch('')).toBe('');
    expect(normalizeForMatch(undefined as unknown as string)).toBe('');
  });
});

describe('findMatchingSlug', () => {
  const slugs = ['afo', 'direito-constitucional', 'banco-de-dados'];

  it('casa quando o nome do deck começa com o slug (acrônimo + descrição)', () => {
    expect(findMatchingSlug('AFO - Administração Orçamentária e Financeira', slugs)).toBe('afo');
  });

  it('casa por igualdade normalizada ignorando acentos e hífens', () => {
    expect(findMatchingSlug('Direito Constitucional', slugs)).toBe('direito-constitucional');
    expect(findMatchingSlug('Banco de Dados', slugs)).toBe('banco-de-dados');
  });

  it('retorna null quando não há correspondência óbvia', () => {
    expect(findMatchingSlug('Tecnologia da Informação', slugs)).toBeNull();
    expect(findMatchingSlug('Português', slugs)).toBeNull();
  });

  it('prefere o slug mais específico (mais longo) em caso de sobreposição', () => {
    expect(findMatchingSlug('Direito Constitucional', ['direito', 'direito-constitucional']))
      .toBe('direito-constitucional');
  });

  it('ignora slugs muito curtos e nomes vazios', () => {
    expect(findMatchingSlug('A - qualquer coisa', ['a'])).toBeNull();
    expect(findMatchingSlug('', slugs)).toBeNull();
  });
});
