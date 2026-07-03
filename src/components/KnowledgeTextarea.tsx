import { useRef, useState, useCallback } from 'react';
import { KnowledgeItem } from '../types';
import { suggestAliases, AliasSuggestion } from '../lib/knowledge';
import { BookMarked } from 'lucide-react';
import { cn } from '../lib/utils';

interface KnowledgeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  items: KnowledgeItem[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

type TriggerForm = 'backslash' | 'brace';

// Detecta um gatilho de autocomplete imediatamente antes do cursor:
//   - "\" seguido do apelido em digitação (formato principal), ou
//   - "{{" ainda não fechado (formato legado).
// Retorna o prefixo digitado, onde o gatilho começa e qual formato usar.
function detectTrigger(
  text: string,
  caret: number
): { start: number; query: string; form: TriggerForm } | null {
  const before = text.slice(0, caret);
  const brace = before.match(/\{\{\s*#?([^{}\n]*)$/);
  if (brace) return { start: caret - brace[0].length, query: brace[1], form: 'brace' };
  const back = before.match(/\\#?([\p{L}\p{N}_-]*)$/u);
  if (back) return { start: caret - back[0].length, query: back[1], form: 'backslash' };
  return null;
}

/**
 * Textarea com autocomplete de aliases do Acervo. Ao digitar "{{", sugere itens
 * (título, categoria, descrição) e insere "{{alias}}" ao selecionar. Preserva o
 * comportamento de colar (onPaste) do editor de flashcards.
 */
export function KnowledgeTextarea({
  value,
  onChange,
  items,
  className,
  placeholder,
  disabled,
  id,
  onPaste,
  ...rest
}: KnowledgeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [suggestions, setSuggestions] = useState<AliasSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<{ start: number; query: string; form: TriggerForm } | null>(null);

  const refresh = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const trig = detectTrigger(value, el.selectionStart || 0);
    triggerRef.current = trig;
    if (!trig) {
      setOpen(false);
      return;
    }
    const sugg = suggestAliases(items, trig.query, 8);
    setSuggestions(sugg);
    setActiveIndex(0);
    // Abre para cima quando não há espaço suficiente abaixo (ex.: campo Verso,
    // mais embaixo no modal), evitando que a lista de sugestões fique cortada.
    const rect = el.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 288);
    setOpen(sugg.length > 0);
  }, [value, items]);

  const accept = (s: AliasSuggestion) => {
    const el = ref.current;
    const trig = triggerRef.current;
    if (!el || !trig) return;
    const caret = el.selectionStart || 0;
    // Insere no mesmo formato do gatilho usado: "\alias" (principal) ou o
    // legado "{{alias}}". Um espaço final delimita o "\alias" do texto seguinte.
    const insert = trig.form === 'backslash' ? `\\${s.alias} ` : `{{${s.alias}}}`;
    const next = value.slice(0, trig.start) + insert + value.slice(caret);
    onChange(next);
    setOpen(false);
    const newCaret = trig.start + insert.length;
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.selectionStart = newCaret;
        ref.current.selectionEnd = newCaret;
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      accept(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        aria-label={rest['aria-label']}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          // refresh após o valor propagar
          setTimeout(refresh, 0);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={refresh}
        onClick={refresh}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onPaste={onPaste}
      />
      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute left-0 right-0 z-30 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {suggestions.map((s, i) => (
            <li key={`${s.item.id}-${s.alias}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); accept(s); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                  i === activeIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'
                )}
              >
                <BookMarked size={14} className="mt-0.5 shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium text-slate-800">{s.item.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{`\\${s.alias}`}</span>
                  </span>
                  {s.item.description && (
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{s.item.description}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
