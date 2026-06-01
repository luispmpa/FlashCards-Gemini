import { HeatmapDay } from '../lib/heatmap';
import { cn } from '../lib/utils';

interface HeatmapProps {
  days: HeatmapDay[];
}

export function Heatmap({ days }: HeatmapProps) {
  // Determine color intensity based on review counts
  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-slate-100 text-slate-400 hover:bg-slate-200';
    if (count <= 2) return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200';
    if (count <= 5) return 'bg-indigo-300 text-white hover:bg-indigo-400';
    if (count <= 9) return 'bg-indigo-500 text-white hover:bg-indigo-600';
    return 'bg-indigo-700 text-white hover:bg-indigo-800';
  };

  // We have 112 days, which is exactly 16 weeks of 7 days (7 * 16 = 112)
  // Let's print neat little row labels for days of week
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Frequência de Estudos</h3>
        <p className="text-xs text-slate-400">Seu engajamento diário de revisões no período de 16 semanas.</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {/* Day-of-week labels */}
        <div className="grid grid-rows-7 gap-[3px] text-[10px] text-slate-400 select-none pr-1 pt-1 h-[134px] justify-between">
          {dayLabels.map((lbl, idx) => (
            // Only show labels for some days to keep it tidy
            <span key={idx} className={cn("h-4 flex items-center pr-1 font-medium", idx % 2 === 0 ? "opacity-100" : "opacity-0")}>
              {lbl}
            </span>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] h-[134px]">
          {days.map((day) => (
            <div
              key={day.dateStr}
              title={day.label}
              className={cn(
                "w-4 h-4 rounded-[2px] transition-all cursor-pointer relative group",
                getColorClass(day.count)
              )}
            >
              {/* Simple CSS-only hover tooltip for a beautiful and fast UX */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded font-sans whitespace-nowrap z-30 shadow-md">
                {day.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-end text-[10px] text-slate-400 gap-1.5 pt-1 pr-1 border-t border-slate-100 select-none">
        <span>Menos</span>
        <div className="w-3 h-3 rounded-[1px] bg-slate-100 border border-slate-200" />
        <div className="w-3 h-3 rounded-[1px] bg-indigo-100" />
        <div className="w-3 h-3 rounded-[1px] bg-indigo-300" />
        <div className="w-3 h-3 rounded-[1px] bg-indigo-500" />
        <div className="w-3 h-3 rounded-[1px] bg-indigo-700" />
        <span>Mais</span>
      </div>
    </div>
  );
}
