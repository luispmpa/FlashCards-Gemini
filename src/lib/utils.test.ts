import { expect, test, describe } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  test('junta classes simples', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  test('ignora valores falsy (condicionais)', () => {
    expect(cn('px-2', false, null, undefined, '', 'py-1')).toBe('px-2 py-1');
  });

  test('resolve classes condicionais via objeto', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });

  test('a última classe Tailwind conflitante vence (twMerge)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-slate-400', 'text-slate-500')).toBe('text-slate-500');
  });

  test('sem argumentos retorna string vazia', () => {
    expect(cn()).toBe('');
  });
});
