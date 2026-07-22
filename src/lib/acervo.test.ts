import { describe, it, expect } from 'vitest';
import {
  normalizeForMatch,
  findMatchingSlug,
  getAcervoEntries,
  getSourceStructure,
  resolveDeckAcervo,
} from './acervo';

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

// Testes de integração: usam o import.meta.glob real (vitest roda sobre o Vite),
// lendo flashcards-gerados/ e material-fonte/ do próprio repositório.
describe('acervo (integração com os arquivos do repositório)', () => {
  it('empacota a matéria simples afo e a sub-matéria aninhada de TI', () => {
    const entries = getAcervoEntries();
    const afo = entries.find(e => e.path === 'afo');
    expect(afo).toBeDefined();
    expect(afo!.group).toBeUndefined();
    expect(afo!.cards.length).toBeGreaterThan(0);

    const info = entries.find(e => e.path === 'Tecnologia da Informação/Informática');
    expect(info).toBeDefined();
    expect(info!.group).toBe('Tecnologia da Informação');
    expect(info!.name).toBe('Informática');
    expect(info!.cards.length).toBeGreaterThan(0);
  });

  it('enumera Tecnologia da Informação como grupo com suas sub-matérias', () => {
    const { groups } = getSourceStructure();
    const subs = groups.get('Tecnologia da Informação');
    expect(subs).toBeDefined();
    expect(subs).toContain('Informática');
    expect(subs).toContain('Banco de dados');
    expect(subs).toContain('Redes e Segurança');
  });

  it('resolve um deck-grupo listando sub-matérias, com e sem cards', () => {
    const view = resolveDeckAcervo('Tecnologia da Informação');
    expect(view.kind).toBe('group');
    expect(view.matched).toBe(true);

    const info = view.options.find(o => o.label === 'Informática');
    expect(info?.available).toBe(true);
    expect(info?.group).toBe('Tecnologia da Informação');

    const banco = view.options.find(o => o.label === 'Banco de dados');
    expect(banco?.available).toBe(false); // ainda não gerado
  });

  it('resolve uma matéria simples por prefixo (AFO… ↔ afo) importável na raiz', () => {
    const view = resolveDeckAcervo('AFO - Administração Orçamentária e Financeira');
    expect(view.kind).toBe('flat');
    expect(view.matched).toBe(true);
    expect(view.options).toHaveLength(1);
    expect(view.options[0].available).toBe(true);
    expect(view.options[0].group).toBeUndefined();
  });

  it('sem correspondência: não casa e oferece opções para escolha manual', () => {
    const view = resolveDeckAcervo('Direito Constitucional');
    expect(view.matched).toBe(false);
    expect(view.kind).toBe('none');
    expect(view.options.length).toBeGreaterThan(0);
  });
});
