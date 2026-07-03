import { useMemo, useState } from 'react';
import { KnowledgeItem, KnowledgeCategory, KnowledgeBacklink } from '../types';
import { searchKnowledgeItems } from '../lib/knowledge';
import { KnowledgeItemEditor } from './KnowledgeItemEditor';
import { KnowledgeViewerModal } from './KnowledgeViewerModal';
import { v4 as uuidv4 } from 'uuid';
import {
  Search, Plus, Eye, Edit2, Trash2, Copy, Tag, Link2, BookMarked, Settings2, X,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface KnowledgeBaseProps {
  items: KnowledgeItem[];
  categories: KnowledgeCategory[];
  backlinks: Map<string, KnowledgeBacklink[]>;
  onSaveItem: (item: KnowledgeItem) => void | Promise<void>;
  onUpdateItem: (item: KnowledgeItem) => void | Promise<void>;
  onDeleteItem: (itemId: string) => void;
  onSaveCategory: (cat: KnowledgeCategory) => void;
  onUpdateCategory: (cat: KnowledgeCategory) => void;
  onDeleteCategory: (catId: string) => void;
  onOpenCard?: (cardId: string, deckId: string) => void;
}

export function KnowledgeBase({
  items, categories, backlinks,
  onSaveItem, onUpdateItem, onDeleteItem,
  onSaveCategory, onUpdateCategory, onDeleteCategory,
  onOpenCard,
}: KnowledgeBaseProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editing, setEditing] = useState<KnowledgeItem | null | 'new'>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeItem | null>(null);

  const filtered = useMemo(
    () => searchKnowledgeItems(items, search, { categoryId: categoryFilter || undefined }),
    [items, search, categoryFilter]
  );

  const viewingItem = viewingId ? items.find(i => i.id === viewingId) : null;

  const handleDuplicate = (item: KnowledgeItem) => {
    // Aliases devem ser únicos — a cópia começa sem aliases para evitar conflito.
    const now = new Date();
    onSaveItem({
      ...item,
      id: uuidv4(),
      title: `${item.title} (cópia)`,
      aliases: [],
      createdAt: now,
      updatedAt: now,
    });
  };

  const catName = (id?: string) => categories.find(c => c.id === id)?.name;

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            <BookMarked className="text-indigo-600" /> Acervo de Conhecimento
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {items.length} {items.length === 1 ? 'item' : 'itens'} · conteúdos reutilizáveis referenciados pelos flashcards.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategories(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings2 size={16} /> Categorias
          </button>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus size={16} /> Novo item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por título, alias, categoria ou conteúdo…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 py-16 text-center">
            <BookMarked size={40} className="text-slate-300" />
            <p className="text-slate-500">
              {items.length === 0 ? 'Seu Acervo está vazio. Crie o primeiro item de apoio.' : 'Nenhum item encontrado para este filtro.'}
            </p>
            {items.length === 0 && (
              <button onClick={() => setEditing('new')} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                <Plus size={16} /> Novo item
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(item => {
              const count = backlinks.get(item.id)?.length || 0;
              return (
                <div key={item.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <button onClick={() => setViewingId(item.id)} className="min-w-0 text-left">
                      <h3 className="truncate font-semibold text-slate-800 hover:text-indigo-600">{item.title}</h3>
                    </button>
                    {catName(item.categoryId) && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                        <Tag size={10} /> {catName(item.categoryId)}
                      </span>
                    )}
                  </div>
                  {item.description && <p className="mb-2 line-clamp-2 text-sm text-slate-500">{item.description}</p>}
                  {item.aliases.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {item.aliases.slice(0, 4).map(a => (
                        <span key={a} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{a}</span>
                      ))}
                      {item.aliases.length > 4 && <span className="text-[11px] text-slate-400">+{item.aliases.length - 4}</span>}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Flashcards que usam este item">
                      <Link2 size={13} /> {count}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewingId(item.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Visualizar"><Eye size={16} /></button>
                      <button onClick={() => setEditing(item)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Editar"><Edit2 size={16} /></button>
                      <button onClick={() => handleDuplicate(item)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Duplicar"><Copy size={16} /></button>
                      <button onClick={() => setConfirmDelete(item)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Excluir"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor */}
      {editing !== null && (
        <KnowledgeItemEditor
          item={editing === 'new' ? null : editing}
          categories={categories}
          allItems={items}
          onSave={async (saved) => {
            // Aguarda a confirmação da escrita; o editor se fecha sozinho no
            // sucesso e exibe o erro (sem fechar) em caso de falha.
            if (editing === 'new') await onSaveItem(saved);
            else await onUpdateItem(saved);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Viewer */}
      {viewingItem && (
        <KnowledgeViewerModal
          item={viewingItem}
          categories={categories}
          allItems={items}
          backlinks={backlinks.get(viewingItem.id) || []}
          onClose={() => setViewingId(null)}
          onOpenItem={(id) => setViewingId(id)}
          onOpenCard={onOpenCard ? (cardId, deckId) => { setViewingId(null); onOpenCard(cardId, deckId); } : undefined}
        />
      )}

      {/* Category manager */}
      {showCategories && (
        <CategoryManager
          categories={categories}
          items={items}
          onSave={onSaveCategory}
          onUpdate={onUpdateCategory}
          onDelete={onDeleteCategory}
          onClose={() => setShowCategories(false)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 text-center shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">Excluir item</h3>
            <p className="mb-6 text-sm text-slate-600">
              Excluir <strong>{confirmDelete.title}</strong>? Os flashcards que o referenciam mostrarão a referência como não encontrada.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button
                onClick={() => { onDeleteItem(confirmDelete.id); setConfirmDelete(null); }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
              >Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gerenciador de categorias (criar, renomear, excluir).
// ---------------------------------------------------------------------------
interface CategoryManagerProps {
  categories: KnowledgeCategory[];
  items: KnowledgeItem[];
  onSave: (cat: KnowledgeCategory) => void;
  onUpdate: (cat: KnowledgeCategory) => void;
  onDelete: (catId: string) => void;
  onClose: () => void;
}

function CategoryManager({ categories, items, onSave, onUpdate, onDelete, onClose }: CategoryManagerProps) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const usageCount = (catId: string) => items.filter(i => i.categoryId === catId).length;

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { setDraft(''); return; }
    const now = new Date();
    onSave({ id: uuidv4(), name, createdAt: now, updatedAt: now });
    setDraft('');
  };

  return (
    <div className="fixed inset-0 z-[902] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-900">Categorias</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-5">
          {categories.length === 0 && <p className="text-sm text-slate-400">Nenhuma categoria ainda.</p>}
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
              {editingId === c.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 rounded border border-slate-300 p-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={() => { if (editName.trim()) onUpdate({ ...c, name: editName.trim() }); setEditingId(null); }}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                  >Salvar</button>
                  <button onClick={() => setEditingId(null)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">{c.name}</span>
                  <span className="text-xs text-slate-400">{usageCount(c.id)} itens</span>
                  <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="rounded p-1 text-slate-400 hover:text-indigo-600" title="Renomear"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(c.id)} className="rounded p-1 text-slate-400 hover:text-rose-600" title="Excluir"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-slate-200 p-4">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="Nova categoria…"
            className={cn('flex-1 rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500')}
          />
          <button onClick={add} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
