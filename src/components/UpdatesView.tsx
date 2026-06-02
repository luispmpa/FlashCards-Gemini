import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sparkles,
  Search,
  Undo2,
  FileCode2,
  Bug,
  Gauge,
  Accessibility,
  ShieldCheck,
  Wand2,
  Hammer,
  FlaskConical,
  Package,
  FileText,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import updatesData from '../data/updates.json';
import { AppUpdate, UpdateCategory } from '../types';

// GitHub repository that hosts this project. Used to build per-commit links so
// each improvement can be reverted individually.
const REPO_URL = 'https://github.com/luispmpa/FlashCards-Gemini';

const CATEGORY_META: Record<
  UpdateCategory,
  { label: string; className: string; icon: typeof Bug }
> = {
  bug: { label: 'Correção', className: 'bg-rose-50 text-rose-700 border-rose-100', icon: Bug },
  perf: { label: 'Performance', className: 'bg-amber-50 text-amber-700 border-amber-100', icon: Gauge },
  a11y: { label: 'Acessibilidade', className: 'bg-teal-50 text-teal-700 border-teal-100', icon: Accessibility },
  security: { label: 'Segurança', className: 'bg-red-50 text-red-700 border-red-100', icon: ShieldCheck },
  ux: { label: 'UX', className: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: Wand2 },
  refactor: { label: 'Refatoração', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Hammer },
  tests: { label: 'Testes', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: FlaskConical },
  deps: { label: 'Dependências', className: 'bg-violet-50 text-violet-700 border-violet-100', icon: Package },
  docs: { label: 'Documentação', className: 'bg-sky-50 text-sky-700 border-sky-100', icon: FileText },
};

function CategoryBadge({ category }: { category: UpdateCategory }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.refactor;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${meta.className}`}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function formatDay(iso: string): string {
  try {
    return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm', { locale: ptBR });
  } catch {
    return '';
  }
}

export function UpdatesView() {
  const [searchTerm, setSearchTerm] = useState('');

  const updates = updatesData as AppUpdate[];

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = [...updates].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!term) return list;
    return list.filter(
      (u) =>
        u.title.toLowerCase().includes(term) ||
        u.description.toLowerCase().includes(term) ||
        u.category.toLowerCase().includes(term) ||
        u.files.some((f) => f.toLowerCase().includes(term)),
    );
  }, [updates, searchTerm]);

  // Group by calendar day (one routine run per night → one group).
  const groups = useMemo(() => {
    const map = new Map<string, AppUpdate[]>();
    for (const u of filtered) {
      const day = u.date.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(u);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const appliedCount = updates.filter((u) => u.status === 'applied').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-200 pb-4 shrink-0 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            <Sparkles className="mr-3 text-indigo-500" size={28} />
            Atualizações
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Melhorias aplicadas automaticamente ao AprovaCard. Cada item é independente e
            pode ser revertido individualmente.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-indigo-600">{appliedCount}</p>
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            melhorias ativas
          </p>
        </div>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por título, descrição, categoria ou arquivo..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 pb-4">
        {groups.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Sparkles size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium text-slate-500">Nenhuma atualização encontrada.</p>
            <p className="text-sm">
              As melhorias da rotina automática aparecerão aqui.
            </p>
          </div>
        )}

        {groups.map(([day, items]) => (
          <section key={day} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                {formatDay(items[0].date)}
              </h3>
              <span className="text-xs text-slate-400">
                {items.length} {items.length === 1 ? 'melhoria' : 'melhorias'}
              </span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <div className="space-y-3">
              {items.map((u) => {
                const reverted = u.status === 'reverted';
                const revertUrl = u.commit
                  ? `${REPO_URL}/commit/${u.commit}`
                  : `${REPO_URL}/commits`;
                return (
                  <article
                    key={u.id}
                    className={`rounded-xl border bg-white p-4 md:p-5 shadow-sm transition-colors ${
                      reverted ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CategoryBadge category={u.category} />
                          {reverted ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                              <RotateCcw size={13} /> Revertida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle2 size={13} /> Aplicada
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{formatTime(u.date)}</span>
                        </div>

                        <h4
                          className={`font-semibold text-slate-900 ${
                            reverted ? 'line-through text-slate-500' : ''
                          }`}
                        >
                          {u.title}
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{u.description}</p>

                        {u.files.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {u.files.map((f) => (
                              <span
                                key={f}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] font-mono text-slate-600"
                              >
                                <FileCode2 size={11} />
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex md:flex-col items-stretch gap-2">
                        {!reverted && (
                          <a
                            href={revertUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abre o commit no GitHub, onde você pode revertê-lo individualmente"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                          >
                            <Undo2 size={15} />
                            Reverter
                          </a>
                        )}
                        {u.commit && (
                          <a
                            href={`${REPO_URL}/commit/${u.commit}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-mono"
                          >
                            {u.commit.slice(0, 7)}
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
