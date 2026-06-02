import { Activity, BookOpen, Layers, Settings, Database, Brain, X, History, Bug } from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenReport: () => void;
}

export function Sidebar({ currentView, onChangeView, isMobileOpen, onCloseMobile, onOpenReport }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Activity },
    { id: "study", label: "Estudar", icon: Brain },
    { id: "browser", label: "Flashcards", icon: Database },
    { id: "decks", label: "Matérias (Hierarquia)", icon: Layers },
    { id: "history", label: "Histórico de Estudos", icon: History },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity",
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onCloseMobile}
      />
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full shrink-0 transform transition-transform duration-200 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 mb-6 flex items-center justify-between text-white border-b border-slate-800 lg:justify-start">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">AprovaCard</h1>
              <p className="text-xs text-indigo-400 font-medium">FSRS</p>
            </div>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChangeView(item.id);
                onCloseMobile();
              }}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                currentView === item.id 
                  ? "bg-indigo-500/10 text-indigo-400" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800 mt-auto space-y-4">
          <button 
            onClick={onOpenReport}
            className="w-full flex items-center space-x-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg transition-colors text-sm font-medium"
          >
            <Bug size={16} />
            <span>Relatar Problema</span>
          </button>
          <div className="bg-slate-800 rounded-lg p-4 space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">AprovaCard</h3>
              <p className="text-xs text-slate-400">Repetição espaçada com FSRS. Importe flashcards em JSON pela aba Matérias.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
