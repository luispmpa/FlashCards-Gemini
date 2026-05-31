import React, { useMemo, useState } from 'react';
import { ReviewLog } from '../types';
import { format } from 'date-fns';
import { Search, Calendar, Award, CheckCircle, Clock } from 'lucide-react';

interface ReviewHistoryProps {
  logs: ReviewLog[];
}

export function ReviewHistory({ logs }: ReviewHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const term = searchTerm.toLowerCase();
      return log.cardFront.toLowerCase().includes(term) || 
             log.deckName.toLowerCase().includes(term) ||
             log.rating.toLowerCase().includes(term);
    });
  }, [logs, searchTerm]);

  // Translate FSRS ratings
  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'Again':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 shadow-sm">Errei</span>;
      case 'Hard':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">Difícil</span>;
      case 'Good':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">Bom</span>;
      case 'Easy':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">Fácil</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{rating}</span>;
    }
  };

  // Translate FSRS states
  const translateState = (state: string) => {
    switch (state) {
      case 'New': return 'Novo';
      case 'Learning': return 'Aprendendo';
      case 'Review': return 'Revisão';
      case 'Relearning': return 'Reaprendendo';
      default: return state;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-200 pb-4 shrink-0 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center">
            Histórico de Estudos
            <span className="ml-3 text-sm font-normal bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
              Beta FSRS
            </span>
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Visualize o registro cronológico de todas as suas sessões e respostas dadas.
          </p>
        </div>
        
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Filtrar histórico..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full sm:w-64 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-450 border border-slate-100">
            <Calendar size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Nenhum estudo registrado</h3>
          <p className="text-slate-500 text-sm">
            Os records das suas revisões aparecerão aqui à medida que você responder aos seus flashcards na aba de Estudos.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold sticky top-0">
                <tr>
                  <th className="px-6 py-4 w-44">Data/Hora</th>
                  <th className="px-6 py-4 w-44">Matéria</th>
                  <th className="px-6 py-4">Frente (Questão)</th>
                  <th className="px-6 py-4 w-32">Classificação</th>
                  <th className="px-6 py-4 w-52">Transição Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                        {format(new Date(log.reviewedAt), "dd/MM/yyyy HH:mm:ss")}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-normal max-w-[200px] truncate" title={log.deckName}>
                        {log.deckName}
                      </td>
                      <td className="px-6 py-4 text-slate-800 max-w-md">
                        <div className="line-clamp-2" title={log.cardFront}>
                          {log.cardFront}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRatingBadge(log.rating)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1 p-1 bg-slate-50 border border-slate-100 rounded text-center justify-center font-medium max-w-max">
                          <span className="text-[11px] text-slate-500 px-1">{translateState(log.oldState)}</span>
                          <span className="text-slate-300 font-bold">&rarr;</span>
                          <span className="text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">{translateState(log.newState)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-550">
                      Nenhum resultado filtrado encontrado para "{searchTerm}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
