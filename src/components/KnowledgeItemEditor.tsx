import { useMemo, useState } from 'react';
import { KnowledgeItem, KnowledgeCategory, KnowledgeAttachment, ACCEPTED_ATTACHMENT_EXTENSIONS } from '../types';
import { normalizeAlias, findAliasConflicts, detectAttachmentKind } from '../lib/knowledge';
import { uploadImageFromPaste } from '../lib/imageUpload';
import { KnowledgeTextarea } from './KnowledgeTextarea';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Trash2, Loader2, Image as ImageIcon, Link2, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface KnowledgeItemEditorProps {
  item: KnowledgeItem | null; // null = criar novo
  categories: KnowledgeCategory[];
  allItems: KnowledgeItem[];
  onSave: (item: KnowledgeItem) => void;
  onClose: () => void;
}

const ACCEPT_ATTR = ACCEPTED_ATTACHMENT_EXTENSIONS.map(e => `.${e}`).join(',');

export function KnowledgeItemEditor({ item, categories, allItems, onSave, onClose }: KnowledgeItemEditorProps) {
  const isNew = !item;
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [content, setContent] = useState(item?.content || '');
  const [aliases, setAliases] = useState<string[]>(item?.aliases || []);
  const [aliasDraft, setAliasDraft] = useState('');
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>(item?.attachments || []);
  const [relatedIds, setRelatedIds] = useState<string[]>(item?.relatedIds || []);
  const [parentId, setParentId] = useState(item?.parentId || '');
  const [relatedSearch, setRelatedSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const otherItems = useMemo(() => allItems.filter(i => i.id !== item?.id), [allItems, item?.id]);

  const addAlias = (raw: string) => {
    const norm = normalizeAlias(raw);
    if (!norm) return;
    if (aliases.includes(norm)) { setAliasDraft(''); return; }
    const conflicts = findAliasConflicts([norm], allItems, item?.id);
    if (conflicts.length > 0) {
      setError(`O alias "${norm}" já está em uso por outro item.`);
      return;
    }
    setError('');
    setAliases([...aliases, norm]);
    setAliasDraft('');
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImageFromPaste(file);
        setAttachments(prev => [...prev, {
          id: uuidv4(),
          kind: 'image',
          mimeType: file.type || 'image/*',
          name: file.name,
          url,
          size: file.size,
        }]);
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao enviar a imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  const addAttachmentByUrl = () => {
    const url = window.prompt('URL do arquivo (PDF, imagem ou link):');
    if (!url) return;
    const name = window.prompt('Nome de exibição do anexo:', url.split('/').pop() || 'Anexo') || 'Anexo';
    setAttachments(prev => [...prev, {
      id: uuidv4(),
      kind: detectAttachmentKind(name || url, undefined),
      mimeType: '',
      name,
      url,
    }]);
  };

  const handleSave = () => {
    if (!title.trim()) { setError('O título é obrigatório.'); return; }
    const conflicts = findAliasConflicts(aliases, allItems, item?.id);
    if (conflicts.length > 0) {
      setError(`Aliases em conflito: ${conflicts.join(', ')}`);
      return;
    }
    const now = new Date();
    const saved: KnowledgeItem = {
      id: item?.id || uuidv4(),
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId || undefined,
      content,
      aliases,
      attachments,
      relatedIds,
      parentId: parentId || undefined,
      createdAt: item?.createdAt || now,
      updatedAt: now,
      embedding: item?.embedding,
      aiMeta: item?.aiMeta,
    };
    onSave(saved);
  };

  const relatedMatches = relatedSearch.trim()
    ? otherItems.filter(i =>
        !relatedIds.includes(i.id) &&
        i.title.toLowerCase().includes(relatedSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div className="fixed inset-0 z-[901] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="text-xl font-bold text-slate-900">{isNew ? 'Novo item do Acervo' : 'Editar item'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}

          {/* Título */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex.: Tutela de Urgência"
            />
          </div>

          {/* Descrição + Categoria */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descrição (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500"
                placeholder="Resumo curto"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Categoria</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Aliases */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Aliases <span className="font-normal text-slate-400">(apelidos para referenciar este item nos cards)</span>
            </label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-300 p-2">
              {aliases.map(a => (
                <span key={a} className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-sm font-medium text-indigo-700">
                  {a}
                  <button type="button" onClick={() => setAliases(aliases.filter(x => x !== a))} aria-label={`Remover ${a}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={aliasDraft}
                onChange={e => setAliasDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                    e.preventDefault();
                    addAlias(aliasDraft);
                  } else if (e.key === 'Backspace' && !aliasDraft && aliases.length) {
                    setAliases(aliases.slice(0, -1));
                  }
                }}
                onBlur={() => aliasDraft && addAlias(aliasDraft)}
                className="min-w-[160px] flex-1 border-0 p-1 text-sm focus:outline-none focus:ring-0"
                placeholder="ex.: fumus, tutela_urgencia — e tecle Enter"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Não use "#" nem "\": digite só o apelido e tecle <strong>Enter</strong> (sem acentos; espaços viram "_").
              Depois, no card, escreva <code className="rounded bg-slate-100 px-1 font-mono text-indigo-700">\{aliases[0] || 'fumus'}</code> para inserir a referência.
            </p>
          </div>

          {/* Conteúdo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Conteúdo <span className="font-normal text-slate-400">(Markdown · digite "\" para referenciar outros itens)</span>
            </label>
            <KnowledgeTextarea
              value={content}
              onChange={setContent}
              items={otherItems}
              className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 min-h-[160px] font-mono text-sm"
              placeholder="Escreva o conteúdo em Markdown. Tabelas, listas, imagens e destaques são suportados."
            />
          </div>

          {/* Anexos */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Anexos</label>
              <div className="flex gap-2">
                <label className={cn('inline-flex cursor-pointer items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200', isUploading && 'opacity-50')}>
                  <ImageIcon size={13} /> Enviar imagem
                  <input type="file" accept={ACCEPT_ATTR} multiple className="hidden" disabled={isUploading} onChange={e => handleImageUpload(e.target.files)} />
                </label>
                <button type="button" onClick={addAttachmentByUrl} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                  <Link2 size={13} /> Por URL
                </button>
              </div>
            </div>
            {isUploading && (
              <div className="mb-2 flex items-center gap-2 text-sm text-indigo-600"><Loader2 size={14} className="animate-spin" /> Enviando…</div>
            )}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                    {att.kind === 'image'
                      ? <img src={att.url} alt={att.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                      : <FileText size={18} className="shrink-0 text-rose-500" />}
                    <span className="flex-1 truncate text-slate-700">{att.name}</span>
                    <button type="button" onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))} aria-label="Remover anexo" className="text-slate-400 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hierarquia (item pai) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Item pai (hierarquia)</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Nenhum (raiz)</option>
              {otherItems.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </div>

          {/* Relacionados */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Itens relacionados</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {relatedIds.map(id => {
                const rel = allItems.find(i => i.id === id);
                if (!rel) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-sm text-slate-700">
                    {rel.title}
                    <button type="button" onClick={() => setRelatedIds(relatedIds.filter(x => x !== id))} aria-label={`Remover ${rel.title}`}>
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="relative">
              <input
                type="text"
                value={relatedSearch}
                onChange={e => setRelatedSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Buscar item para relacionar…"
              />
              {relatedMatches.length > 0 && (
                <ul className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {relatedMatches.map(m => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => { setRelatedIds([...relatedIds, m.id]); setRelatedSearch(''); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <Plus size={14} className="text-indigo-500" /> {m.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button onClick={handleSave} disabled={isUploading} className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            {isNew ? 'Criar item' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
