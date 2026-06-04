import { useMemo } from 'react';
import {
  Database,
  FileStack,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileWarning,
  Github,
  Server,
} from 'lucide-react';
import generationData from '@/flashcards-gerados/_progresso.json';
import { Deck, Flashcard, GenerationProgress, MateriaProgress } from '../types';

interface GenerationDashboardProps {
  decks: Deck[];
  cards: Record<string, Flashcard[]>;
}

const gen = generationData as unknown as GenerationProgress;

// Normaliza nomes para casar "afo" (pasta) com "AFO" (deck), ignorando acentos/caixa.
const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f; // remove marcas de acento (combining)
    })
    .join('')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Conta cards no sistema (Firestore) de um deck e todos os seus descendentes.
function countCardsInTree(rootId: string, decks: Deck[], cards: Record<string, Flashcard[]>): number {
  const ids = [rootId];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const d of decks) if (d.parentId === cur) { ids.push(d.id); stack.push(d.id); }
  }
  return ids.reduce((sum, id) => sum + (cards[id]?.length ?? 0), 0);
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Database; label: string; value: string | number; sub?: string; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${tone}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SituacaoBadge({ gerado, noSistema }: { gerado: number; noSistema: number }) {
  if (gerado === 0) return <span className="text-xs text-slate-400">sem geração</span>;
  if (noSistema === 0)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><CircleDashed size={13} /> gerado, não importado</span>;
  if (noSistema < gerado)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600"><CircleDashed size={13} /> parcial ({noSistema}/{gerado})</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={13} /> importado</span>;
}

export function GenerationDashboard({ decks, cards }: GenerationDashboardProps) {
  const roots = useMemo(() => decks.filter((d) => !d.parentId), [decks]);

  const totalNoSistema = useMemo(
    () => roots.reduce((sum, r) => sum + countCardsInTree(r.id, decks, cards), 0),
    [roots, decks, cards],
  );

  // Casa cada matéria do manifesto com um deck-raiz (por nome normalizado).
  const linhas = useMemo(() => {
    return gen.materias.map((m: MateriaProgress) => {
      const root = roots.find((r) => normName(r.name) === normName(m.materia));
      const noSistema = root ? countCardsInTree(root.id, decks, cards) : 0;
      const matched = !!root;
      return { m, noSistema, matched };
    });
  }, [roots, decks, cards]);

  // Matérias que existem no app mas não estão no manifesto (criadas manualmente).
  const materiasSoNoSistema = useMemo(() => {
    const nomesGerados = new Set(gen.materias.map((m) => normName(m.materia)));
    return roots
      .filter((r) => !nomesGerados.has(normName(r.name)))
      .map((r) => ({ r, noSistema: countCardsInTree(r.id, decks, cards) }))
      .filter((x) => x.noSistema > 0 || decks.some((d) => d.parentId === x.r.id));
  }, [roots, decks, cards]);

  const totalPdfsDet = gen.materias.reduce((a, m) => a + (m.pdfsDetectados || 0), 0);
  const totalPdfsProc = gen.materias.reduce((a, m) => a + (m.pdfsProcessados || 0), 0);

  // Alertas consolidados.
  const alertas = useMemo(() => {
    const out: string[] = [];
    if (gen.possiveisDuplicatasEvitadas > 0)
      out.push(`${gen.possiveisDuplicatasEvitadas} possível(is) duplicata(s) evitada(s) pela rotina.`);
    for (const { m, noSistema, matched } of linhas) {
      const pend = (m.pdfsDetectados || 0) - (m.pdfsProcessados || 0);
      if (pend > 0) out.push(`${m.materia}: ${pend} PDF(s) ainda não processado(s).`);
      for (const p of m.pdfs || []) if (!p.concluido) out.push(`${m.materia} / ${p.assunto}: PDF marcado como incompleto.`);
      if (m.totalCardsGerados > 0 && matched && noSistema === 0)
        out.push(`${m.materia}: ${m.totalCardsGerados} cards gerados ainda não importados no sistema.`);
      for (const a of m.alertas || []) out.push(`${m.materia}: ${a}`);
    }
    return out;
  }, [linhas]);

  const semGeracao = gen.materias.length === 0;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles size={20} className="text-indigo-500" /> Painel de geração de flashcards
        </h3>
        {gen.atualizadoEm && (
          <span className="text-xs text-slate-400">manifesto atualizado em {new Date(gen.atualizadoEm).toLocaleString('pt-BR')}</span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Sparkles} label="Cards gerados (GitHub)" value={gen.totalCardsGerados} tone="bg-indigo-50 text-indigo-600" />
        <Kpi icon={Database} label="Cards no sistema (ao vivo)" value={totalNoSistema} tone="bg-emerald-50 text-emerald-600" />
        <Kpi icon={FileStack} label="PDFs processados" value={`${totalPdfsProc}/${totalPdfsDet}`} sub="processados / detectados" tone="bg-amber-50 text-amber-600" />
        <Kpi icon={Layers} label="Matérias com material" value={gen.materias.length} tone="bg-sky-50 text-sky-600" />
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3">
        <span className="inline-flex items-center gap-1 font-medium text-slate-600"><Github size={13} /> Geração</span>
        fica no repositório e <strong className="mx-1">não some</strong> ao apagar cards.
        <span className="inline-flex items-center gap-1 font-medium text-slate-600 ml-2"><Server size={13} /> No sistema</span>
        é o que está no seu banco agora e <strong className="mx-1">reflete o botão Apagar</strong>.
      </div>

      {semGeracao ? (
        <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-lg">
          <FileStack size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm text-slate-500 font-medium">Nenhuma geração registrada ainda.</p>
          <p className="text-xs">Os dados aparecem aqui após a rotina noturna gerar flashcards a partir dos PDFs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map(({ m, noSistema, matched }) => {
            const cobertura = m.pdfsDetectados > 0 ? Math.round((m.pdfsProcessados / m.pdfsDetectados) * 100) : 0;
            return (
              <div key={m.materia} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{m.materia}</span>
                    {!matched && <span className="text-[11px] text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> sem matéria correspondente no app</span>}
                  </div>
                  <SituacaoBadge gerado={m.totalCardsGerados} noSistema={noSistema} />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                  <span>📄 PDFs: <strong>{m.pdfsProcessados}/{m.pdfsDetectados}</strong></span>
                  <span>🏷️ Tópicos: <strong>{m.topicosCanonicos?.length ?? 0}</strong></span>
                  <span>✨ Gerados: <strong>{m.totalCardsGerados}</strong></span>
                  <span>💾 No sistema: <strong>{noSistema}</strong></span>
                </div>

                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${cobertura}%` }} />
                </div>

                {m.pdfs && m.pdfs.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-1.5 font-semibold">Assunto</th>
                          <th className="px-3 py-1.5 font-semibold">Páginas</th>
                          <th className="px-3 py-1.5 font-semibold">Cards</th>
                          <th className="px-3 py-1.5 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.pdfs.map((p, i) => (
                          <tr key={`${p.arquivo}-${i}`} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 text-slate-700">{p.assunto}</td>
                            <td className="px-3 py-1.5 text-slate-500">{p.paginas ?? '—'}</td>
                            <td className="px-3 py-1.5 text-slate-700">{p.cardsGerados}</td>
                            <td className="px-3 py-1.5">
                              {p.concluido
                                ? <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> concluído</span>
                                : <span className="text-amber-600 inline-flex items-center gap-1"><CircleDashed size={12} /> em andamento</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {materiasSoNoSistema.length > 0 && (
        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-600 mb-1">Outras matérias no sistema (sem geração registrada):</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {materiasSoNoSistema.map(({ r, noSistema }) => (
              <li key={r.id}>{r.name} — {noSistema} cards no sistema</li>
            ))}
          </ul>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-1">
            <FileWarning size={16} /> Pontos de atenção
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-800">
            {alertas.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
