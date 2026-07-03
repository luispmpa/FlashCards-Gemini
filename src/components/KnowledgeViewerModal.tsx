import { KnowledgeItem, KnowledgeCategory, KnowledgeBacklink } from '../types';
import { MarkdownContent } from './MarkdownContent';
import { X, FileText, ExternalLink, Link2, Tag, BookMarked, GitBranch } from 'lucide-react';

interface KnowledgeViewerModalProps {
  item: KnowledgeItem;
  categories: KnowledgeCategory[];
  allItems: KnowledgeItem[];
  backlinks: KnowledgeBacklink[];
  onClose: () => void;
  onOpenItem: (itemId: string) => void;
  onOpenCard?: (cardId: string, deckId: string) => void;
}

export function KnowledgeViewerModal({
  item,
  categories,
  allItems,
  backlinks,
  onClose,
  onOpenItem,
  onOpenCard,
}: KnowledgeViewerModalProps) {
  const category = categories.find(c => c.id === item.categoryId);
  const related = item.relatedIds
    .map(id => allItems.find(i => i.id === id))
    .filter((i): i is KnowledgeItem => !!i);

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kb-viewer-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-indigo-600">
              <BookMarked size={16} />
              {category && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                  style={category.color ? { backgroundColor: `${category.color}20`, color: category.color } : undefined}
                >
                  <Tag size={11} /> {category.name}
                </span>
              )}
            </div>
            <h2 id="kb-viewer-title" className="text-xl font-bold text-slate-900">{item.title}</h2>
            {item.description && <p className="mt-1 text-sm text-slate-500">{item.description}</p>}
            {item.aliases.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.aliases.map(a => (
                  <span key={a} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{`\\${a}`}</span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {item.content && <MarkdownContent>{item.content}</MarkdownContent>}

          {/* Attachments */}
          {item.attachments.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Anexos</h3>
              <div className="space-y-3">
                {item.attachments.map(att => (
                  att.kind === 'image' ? (
                    <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block">
                      <img src={att.url} alt={att.name} className="max-h-80 w-auto rounded-lg border border-slate-200" />
                    </a>
                  ) : (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm transition-colors hover:bg-slate-50"
                    >
                      <FileText size={18} className="shrink-0 text-rose-500" />
                      <span className="flex-1 truncate text-slate-700">{att.name}</span>
                      <ExternalLink size={14} className="shrink-0 text-slate-400" />
                    </a>
                  )
                ))}
              </div>
            </section>
          )}

          {/* Related items */}
          {related.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <GitBranch size={13} /> Itens relacionados
              </h3>
              <div className="flex flex-wrap gap-2">
                {related.map(r => (
                  <button
                    key={r.id}
                    onClick={() => onOpenItem(r.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Backlinks */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Link2 size={13} /> Utilizado em ({backlinks.length})
            </h3>
            {backlinks.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum flashcard referencia este item ainda.</p>
            ) : (
              <ul className="space-y-1">
                {backlinks.map(bl => (
                  <li key={bl.cardId}>
                    <button
                      onClick={() => onOpenCard?.(bl.cardId, bl.deckId)}
                      disabled={!onOpenCard}
                      className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-slate-600 transition-colors enabled:hover:bg-slate-100 enabled:hover:text-indigo-700 disabled:cursor-default"
                      title={bl.cardFront}
                    >
                      {bl.cardFront.slice(0, 90) || 'Flashcard'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
