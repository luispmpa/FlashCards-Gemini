import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownContent } from './MarkdownContent';
import { KnowledgeContext } from './KnowledgeContext';
import { buildAliasIndex } from '../lib/knowledge';
import { KnowledgeItem } from '../types';

const item: KnowledgeItem = {
  id: '1', title: 'Tutela de Urgência', content: '', aliases: ['fumus'],
  attachments: [], relatedIds: [], createdAt: new Date(), updatedAt: new Date(),
};

describe('MarkdownContent knowledge refs (SSR)', () => {
  it('renders a resolved reference as a chip with the item title', () => {
    const idx = buildAliasIndex([item]);
    const html = renderToStaticMarkup(
      <KnowledgeContext.Provider value={{ aliasIndex: idx, onOpenKnowledge: () => {} }}>
        <MarkdownContent>{'Estude {{fumus}} hoje.'}</MarkdownContent>
      </KnowledgeContext.Provider>
    );
    expect(html).toContain('Tutela de Urgência');
    expect(html).toContain('<button');
  });

  it('renders a \\alias reference as a chip with the item title', () => {
    const idx = buildAliasIndex([item]);
    const html = renderToStaticMarkup(
      <KnowledgeContext.Provider value={{ aliasIndex: idx, onOpenKnowledge: () => {} }}>
        <MarkdownContent>{'Estude \\fumus hoje.'}</MarkdownContent>
      </KnowledgeContext.Provider>
    );
    expect(html).toContain('Tutela de Urgência');
    expect(html).toContain('<button');
  });

  it('renders an unresolved reference as a muted alias', () => {
    const idx = buildAliasIndex([]);
    const html = renderToStaticMarkup(
      <KnowledgeContext.Provider value={{ aliasIndex: idx, onOpenKnowledge: () => {} }}>
        <MarkdownContent>{'Veja {{inexistente}}.'}</MarkdownContent>
      </KnowledgeContext.Provider>
    );
    expect(html).toContain('inexistente');
    expect(html).toContain('line-through');
  });
});
