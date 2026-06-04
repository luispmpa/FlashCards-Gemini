import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Flashcard, Deck, ReviewLog } from '../types';
import { isBefore, startOfToday, format, addDays, addMonths, isSameMonth } from "date-fns";
import { CheckCircle2, TrendingUp, Brain, Calendar, ChevronRight, Flame, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { getUserSettings } from '../lib/settings';
import { calculateStreak } from '../lib/streak';
import { getDueForecast } from '../lib/forecast';
import { getRetentionBySubject } from '../lib/retention';
import { getActivityByDay } from '../lib/heatmap';
import { Heatmap } from './Heatmap';

interface DashboardProps {
  cards: Record<string, Flashcard[]>;
  decks: Deck[];
  logs: ReviewLog[];
  onNavigate: (view: string, filter?: any) => void;
}

export function Dashboard({ cards, decks, logs, onNavigate }: DashboardProps) {
  type ChartRange = '7d' | '14d' | '30d' | '6m' | '1a';
  const [chartRange, setChartRange] = useState<ChartRange>('14d');
  const allCards = useMemo(() => Object.values(cards).flat(), [cards]);
  
  const today = startOfToday();
  const dueTodayCards = allCards.filter(c => isBefore(new Date(c.fsrsData.due), addDays(today, 1)) && c.fsrsData.state !== "New");
  const dueToday = dueTodayCards.length;
  
  const newCardsList = allCards.filter(c => c.fsrsData.state === "New");
  const newCards = newCardsList.length;
  
  const learnedCardsList = allCards.filter(c => c.fsrsData.state === "Review");
  const learnedCards = learnedCardsList.length;

  const totalReviews = allCards.reduce((acc, c) => acc + c.fsrsData.reps, 0);
  const totalLapses = allCards.reduce((acc, c) => acc + c.fsrsData.lapses, 0);
  const retention = totalReviews > 0 ? (((totalReviews - totalLapses) / totalReviews) * 100).toFixed(1) : "0";

  const scheduleData = useMemo(() => {
     const data = [];
     if (chartRange === '14d') {
          const forecast = getDueForecast(allCards, 14, today);
          return forecast.map((fPoint, index) => ({
              dateObj: addDays(today, index),
              isMonth: false,
              day: fPoint.date,
              revisoes: fPoint.count
          }));
     } else if (chartRange === '7d' || chartRange === '30d') {
         const days = chartRange === '7d' ? 7 : 30;
         for (let i = 0; i < days; i++) {
             const d = addDays(today, i);
             const count = allCards.filter(c => c.fsrsData.state !== "New" && format(new Date(c.fsrsData.due), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length;
             const overdues = i === 0 ? allCards.filter(c => isBefore(new Date(c.fsrsData.due), today) && c.fsrsData.state !== "New").length : 0;
             data.push({
                 dateObj: d,
                 isMonth: false,
                 day: format(d, 'dd/MM'),
                 revisoes: count + overdues
             });
         }
     } else {
         const months = chartRange === '6m' ? 6 : 12;
         for (let i = 0; i < months; i++) {
             const m = addMonths(today, i);
             const count = allCards.filter(c => {
                 if (c.fsrsData.state === "New") return false;
                 const due = new Date(c.fsrsData.due);
                 return isSameMonth(due, m);
             }).length;
             
             data.push({
                 dateObj: m,
                 isMonth: true,
                 day: format(m, 'MMM/yy'),
                 revisoes: count
             });
         }
     }
     return data;
  }, [allCards, today, chartRange]);

  const settings = getUserSettings();
  
  const streak = useMemo(() => calculateStreak(logs), [logs]);

  const reviewsToday = useMemo(() => {
      const todayStr = format(startOfToday(), 'yyyy-MM-dd');
      return logs.filter(log => format(new Date(log.reviewedAt), 'yyyy-MM-dd') === todayStr).length;
  }, [logs]);

  const goalProgress = Math.min(100, Math.round((reviewsToday / settings.reviewsPerDay) * 100));

  const heatmapDays = useMemo(() => getActivityByDay(logs, 112, today), [logs, today]);
  const subjectRetentions = useMemo(() => getRetentionBySubject(decks, logs), [decks, logs]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Daily Goal & Streak Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 w-full">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Meta Diária</h3>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-slate-900">{reviewsToday}</span>
                <span className="text-slate-500 mb-1">/ {settings.reviewsPerDay} revisões</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 max-w-md overflow-hidden border border-slate-200">
                <div 
                  className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      goalProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                  )} 
                  style={{ width: `${goalProgress}%` }}
                />
            </div>
            {goalProgress >= 100 && (
                <p className="text-emerald-600 text-sm mt-2 font-medium flex items-center">
                    <CheckCircle2 size={16} className="mr-1" /> Meta atingida!
                </p>
            )}
        </div>
        
        <div className="flex items-center gap-4 bg-orange-50 px-6 py-4 rounded-xl border border-orange-100 shrink-0 min-w-[200px] justify-center">
            <div className="bg-orange-100 p-3 rounded-full text-orange-500 shadow-sm">
                <Flame size={28} className={streak > 0 ? "fill-orange-500" : ""} />
            </div>
            <div>
                <p className="text-xs font-bold text-orange-600/80 uppercase tracking-wider">Ofensiva</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-orange-600">{streak}</span>
                    <span className="text-orange-700/70 font-medium">dias</span>
                </div>
            </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <Heatmap days={heatmapDays} />

      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 border-b pb-4">Visão Geral</h2>
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
            title="Revisões Pendentes" value={dueToday} icon={Calendar} trend="Para hoje" color="text-rose-600" bg="bg-rose-100" 
            onClick={() => onNavigate('browser', { state: 'Review/Learning', dueBefore: addDays(today, 1).toISOString() })}
        />
        <StatCard 
            title="Novos Flashcards" value={newCards} icon={Brain} trend="Na fila de aprendizado" color="text-indigo-600" bg="bg-indigo-100" 
            onClick={() => onNavigate('browser', { state: 'New' })}
        />
        <StatCard 
            title="Cards Aprendidos" value={learnedCards} icon={CheckCircle2} trend="Na memória de longo prazo" color="text-emerald-600" bg="bg-emerald-100" 
            onClick={() => onNavigate('browser', { state: 'Review' })}
        />
        <StatCard 
            title="Taxa de Retenção" value={`${retention}%`} icon={TrendingUp} trend="Acertos vs Erros" color="text-amber-600" bg="bg-amber-100" 
            onClick={() => alert(`Você possui ${totalReviews} revisões totais com ${totalLapses} erros (lapses).`)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
           <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-semibold flex items-center">
                 <Calendar className="mr-2 h-5 w-5 text-slate-500"/> Previsão de Revisões
               </h3>
               <select 
                  value={chartRange}
                  onChange={(e) => setChartRange(e.target.value as ChartRange)}
                  className="text-xs font-medium text-indigo-700 bg-indigo-50 border-none outline-none px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors"
               >
                   <option value="7d">7 dias</option>
                    <option value="14d">14 dias</option>
                   <option value="30d">30 dias</option>
                   <option value="6m">6 meses</option>
                   <option value="1a">1 ano</option>
               </select>
           </div>
           
           <div className="h-72 flex-1">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={scheduleData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} interval={chartRange === '30d' ? 4 : 0} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} allowDecimals={false} />
                 <Tooltip 
                    cursor={{fill: '#F1F5F9'}} 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                 />
                 <Bar dataKey="revisoes" radius={[4, 4, 0, 0]} maxBarSize={40}
                     onClick={(dataPayload) => {
                          const data = dataPayload?.payload || dataPayload;
                          if(data && data.dateObj) {
                              if (data.isMonth) {
                                  onNavigate('browser', { dueMonth: data.dateObj.toISOString() });
                              } else {
                                  onNavigate('browser', { dueDay: data.dateObj.toISOString() });
                              }
                          }
                      }}
                 >
                    {scheduleData.map((_entry, index) => (
                       <Cell key={`cell-${index}`} fill="#6366f1" className="cursor-pointer hover:opacity-80 transition-opacity" />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
           <h3 className="text-lg font-semibold mb-2">Matérias e Retenção</h3>
            <p className="text-xs text-slate-400 mb-6">Taxa de retenção acumulada baseada no histórico de acertos de cada matéria.</p>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                {decks.filter(d => !d.parentId).map(deck => {
                   const deckCards = cards[deck.id] || [];
                   const subDecks = decks.filter(sub => sub.parentId === deck.id);
                   const totalCards = deckCards.length + subDecks.reduce((acc, sub) => acc + (cards[sub.id]?.length || 0), 0);
                   
                   const retentionInfo = subjectRetentions.find(r => r.subjectId === deck.id);
                   const rate = retentionInfo ? retentionInfo.retentionRate : 100;
                   const totalReviews = retentionInfo ? retentionInfo.totalReviews : 0;
                   
                   const getProgressColor = (r: number) => {
                     if (r >= 85) return "bg-emerald-500";
                     if (r >= 70) return "bg-orange-500";
                     return "bg-rose-500";
                   };

                   return (
                       <div 
                          key={deck.id} 
                          onClick={() => onNavigate('browser', { deckId: deck.id })}
                          className="flex flex-col space-y-2 pb-4 border-b border-slate-100 last:border-0 cursor-pointer group"
                       >
                          <div className="flex justify-between items-start group-hover:text-indigo-600 transition-colors">
                              <div className="flex flex-col">
                                 <span className="font-medium text-slate-700 group-hover:text-indigo-600">{deck.name}</span>
                                 <span className="text-[11px] text-slate-400 group-hover:text-indigo-400">
                                   Retenção: <strong className="font-semibold text-slate-600">{rate}%</strong> ({totalReviews} {totalReviews === 1 ? 'rev.' : 'revs.'})
                                 </span>
                              </div>
                              <div className="flex items-center text-xs text-slate-500 group-hover:text-indigo-500">
                                 {totalCards} cards <ChevronRight size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"/>
                              </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                             <div className={cn("h-2 rounded-full transition-all", getProgressColor(rate))} style={{ width: `${rate}%` }}></div>
                          </div>
                       </div>
                   )
                })}
            </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend: string;
  color: string;
  bg: string;
  onClick: () => void;
}

function StatCard({ title, value, icon: Icon, trend, color, bg, onClick }: StatCardProps) {
  return (
    <button
        type="button"
        onClick={onClick}
        className="w-full text-left bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group active:scale-[0.98]"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">{title}</h3>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={cn("p-3 rounded-lg transition-transform group-hover:scale-110", bg)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-400 mt-4 group-hover:text-slate-500 transition-colors">{trend}</p>
    </button>
  );
}
