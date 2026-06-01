import React, { useState, useEffect } from 'react';
import { Flashcard, Deck, Rating } from '../types';
import { applyFSRSRating, shouldRequeue } from '../lib/fsrs';
import { startOfToday, addDays } from 'date-fns';
import { Brain, CheckCircle, Clock, ChevronDown, ChevronRight, ChevronUp, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { getCorrectIndex } from '../lib/cardUtils';
import { getUserSettings } from '../lib/settings';
import { fetchDueCards, fetchNewCards } from '../db';
import { auth } from '../firebase';

interface StudyViewProps {
  decks: Deck[];
  allCards: Record<string, Flashcard[]>;
  onSaveCard: (card: Flashcard) => void;
  targetCardId?: string;
  onFinishStudy?: () => void; // Optional to know when specific card study is done
  onLogReview?: (card: Flashcard, rating: Rating, oldState: string, newState: string) => void;
}

export function StudyView({ decks, allCards, onSaveCard, targetCardId, onFinishStudy, onLogReview }: StudyViewProps) {
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [activeCard, setActiveCard] = useState<Flashcard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  useEffect(() => {
     if (targetCardId) {
         const card = Object.values(allCards).flat().find(c => c.id === targetCardId);
         // only update active if the current active isn't the target one we just updated
         // otherwise rating it might snap it back to new state when allCards ref changes.
         if (card && activeCard?.id !== targetCardId) {
             setQueue([card]);
             setActiveCard(card);
             setShowAnswer(false);
             setSelectedOptionIndex(null);
         }
     }
  }, [targetCardId]);

  const startStudy = async (deckId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setIsLoadingSession(true);
    try {
        // If no deck picked, gather all. In real app, we filter by selected
        const deckIds = deckId ? [deckId, ...decks.filter(d => d.parentId === deckId).map(d => d.id)] : decks.map(d => d.id);
        
        // Load user settings limits
        const settings = getUserSettings();
        
        // Limits applied via direct Firestore queries
        const targetDate = addDays(startOfToday(), 1);
        
        const [dueCards, newCards] = await Promise.all([
             fetchDueCards(userId, deckIds, targetDate, settings.reviewsPerDay),
             fetchNewCards(userId, deckIds, settings.newPerDay)
        ]);
        
        const cardsToStudy = [...dueCards, ...newCards];
        
        // Shuffle
        const shuffled = [...cardsToStudy].sort(() => Math.random() - 0.5);
        
        setQueue(shuffled);
        setActiveCard(shuffled[0] || null);
        setShowAnswer(false);
        setSelectedOptionIndex(null);
    } catch (e) {
        console.error("Failed to load study session", e);
    } finally {
        setIsLoadingSession(false);
    }
  };

  const handleRating = (rating: Rating) => {
    if (!activeCard) return;
    const oldState = activeCard.fsrsData.state;
    const updatedCard = applyFSRSRating(activeCard, rating);
    onSaveCard(updatedCard);
    
    if (onLogReview) {
      onLogReview(activeCard, rating, oldState, updatedCard.fsrsData.state);
    }
    
    // If we are studying a specific card from the browser, exit immediately after rating
    if (targetCardId) {
       setQueue([]);
       setActiveCard(null);
       setShowAnswer(false);
       setSelectedOptionIndex(null);
       return;
    }

    // Move to next
    const nextQueue = queue.slice(1);
    // Re-queue inside today's session only if the card's FSRS due date is still within today
    if (shouldRequeue(updatedCard)) {
        nextQueue.push(updatedCard);
    }

    setQueue(nextQueue);
    setActiveCard(nextQueue[0] || null);
    setShowAnswer(false);
    setSelectedOptionIndex(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!activeCard) return;
        if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase() || '')) return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (!showAnswer) setShowAnswer(true);
        } else if (showAnswer) {
            switch (e.key) {
                case '1': handleRating("Again"); break;
                case '2': handleRating("Hard"); break;
                case '3': handleRating("Good"); break;
                case '4': handleRating("Easy"); break;
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCard, showAnswer]);

  if (!activeCard) {
    if (targetCardId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
                <div className="p-6 bg-emerald-100 rounded-full text-emerald-500">
                    <CheckCircle size={64} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Pronto!</h2>
                <p className="text-slate-500 text-center max-w-sm">Revisão pontual do card completada. Volte à lista para continuar estudando.</p>
                {onFinishStudy && (
                    <button 
                        onClick={onFinishStudy}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-lg shadow-sm"
                    >Voltar para Flashcards</button>
                )}
            </div>
        )
    }

    return (
      <div className="flex flex-col items-center justify-start pt-24 h-full p-8 space-y-6 overflow-y-auto pb-32">
         <div className="p-6 bg-slate-100 rounded-full text-slate-400">
            <Brain size={64} />
         </div>
         <h2 className="text-2xl font-bold text-slate-800">Pronto para estudar?</h2>
         <div className="w-full max-w-md relative">
            <CustomDeckDropdown 
               decks={decks} 
               selectedDeckId={selectedDeckId} 
               onSelect={setSelectedDeckId} 
            />
            <button 
                onClick={() => startStudy(selectedDeckId)}
                disabled={isLoadingSession}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-75"
            >
                {isLoadingSession ? <Loader2 className="animate-spin" size={20} /> : "Iniciar Sessão"}
            </button>
         </div>
      </div>
    );
  }

  let correctIndex = -1;
  if (activeCard && activeCard.options && activeCard.back && showAnswer) {
      correctIndex = getCorrectIndex(activeCard);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col min-h-full justify-center animate-in slide-in-from-bottom-4 duration-300 py-8">
      
      <div className="w-full flex justify-between items-center mb-6 text-sm font-medium text-slate-500">
          <span>Cards restantes: {queue.length}</span>
          <span className="flex items-center"><Clock size={16} className="mr-1"/> FSRS Ativo</span>
      </div>

      <div className="w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
        {/* FRONT */}
        <div className="p-8 flex-1 flex flex-col">
          <div className="text-xs font-semibold tracking-wider text-indigo-500 uppercase mb-4">
             {decks.find(d => d.id === activeCard.deckId)?.name || 'Matéria'}
          </div>
          <div className="text-xl font-medium text-slate-800 leading-relaxed whitespace-pre-wrap flex-1">
             {activeCard.front}
          </div>
          
          {activeCard.options && !showAnswer && (
             <div className="mt-8 space-y-3">
                 {activeCard.options.map((opt, i) => (
                     <button 
                         key={i} 
                         onClick={() => setSelectedOptionIndex(i)}
                         className={cn(
                             "w-full p-4 border rounded-lg transition-colors text-left font-medium",
                             selectedOptionIndex === i 
                                 ? "border-indigo-500 bg-indigo-50 text-indigo-700" 
                                 : "border-slate-200 text-slate-700 hover:bg-slate-50"
                         )}
                     >
                         {opt}
                     </button>
                 ))}
                 <p className="text-xs text-slate-400 text-center mt-2 italic">Apenas reflita sobre a opção correta antes de revelar a resposta.</p>
             </div>
          )}

          {activeCard.options && showAnswer && (
              <div className="mt-8 space-y-2 pointer-events-none">
                 {activeCard.options.map((opt, i) => {
                     const isCorrect = i === correctIndex;
                     const isSelected = i === selectedOptionIndex;
                     
                     let className = "p-3 border rounded-lg text-sm font-medium transition-colors ";
                     if (isCorrect) {
                         className += "border-emerald-500 bg-emerald-50 text-emerald-800";
                     } else if (isSelected && !isCorrect) {
                         className += "border-rose-500 bg-rose-50 text-rose-800 opacity-90";
                     } else {
                         className += "border-slate-100 bg-white text-slate-400 opacity-60";
                     }
                     
                     return (
                         <div key={i} className={className}>
                             {opt}
                         </div>
                     );
                 })}
              </div>
          )}
        </div>

        {/* BACK / ANSWER ZONE */}
        {showAnswer ? (
            <div className="p-8 bg-slate-50 border-t border-slate-200 animate-in fade-in duration-300 shrink-0">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center">
                    <CheckCircle className="mr-2 text-emerald-500" size={18}/> 
                    Explicação
                </h4>
                <div className="text-sm text-slate-600 leading-relaxed max-w-none prose prose-slate prose-sm prose-headings:font-bold prose-a:text-indigo-600">
                    <ReactMarkdown>{activeCard.back}</ReactMarkdown>
                </div>
            </div>
        ) : null}
      </div>

      {/* CONTROLS */}
      <div className="mt-8 w-full max-w-xl mx-auto">
         {!showAnswer ? (
             <button 
                onClick={() => setShowAnswer(true)}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all shadow-md active:scale-95"
             >
                Mostrar Resposta
             </button>
         ) : (
             <div className="grid grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <RatingButton rating="Again" label="Errei" time="< 1m" color="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200" onClick={() => handleRating("Again")}/>
                 <RatingButton rating="Hard" label="Difícil" time="5m" color="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" onClick={() => handleRating("Hard")}/>
                 <RatingButton rating="Good" label="Bom" time="1d" color="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200" onClick={() => handleRating("Good")}/>
                 <RatingButton rating="Easy" label="Fácil" time="4d" color="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" onClick={() => handleRating("Easy")}/>
             </div>
         )}
      </div>
    </div>
  );
}

function RatingButton({ label, time, color, onClick }: any) {
    return (
        <button 
            type="button"
            onClick={onClick}
            className={cn("flex flex-col items-center justify-center py-3 border rounded-xl transition-all font-medium active:scale-95", color)}
        >
            <span>{label}</span>
            <span className="text-xs opacity-70 mt-0.5">{time}</span>
        </button>
    )
}

function CustomDeckDropdown({ decks, selectedDeckId, onSelect }: { decks: Deck[], selectedDeckId: string, onSelect: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const parents = decks.filter(d => !d.parentId);
  
  const getSelectedLabel = () => {
    if (!selectedDeckId) return "Todas as Matérias";
    const selected = decks.find(d => d.id === selectedDeckId);
    if (!selected) return "Todas as Matérias";
    if (!selected.parentId) return `Tudo de ${selected.name}`;
    return selected.name;
  };

  return (
    <div className="relative mb-4">
       <button 
         onClick={() => setIsOpen(!isOpen)}
         className="w-full p-3 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none flex items-center justify-between shadow-sm"
       >
         <span className="truncate mr-2 text-slate-800 font-medium">{getSelectedLabel()}</span>
         {isOpen ? <ChevronUp size={18} className="text-slate-400 min-w-max" /> : <ChevronDown size={18} className="text-slate-400 min-w-max" />}
       </button>

       {isOpen && (
         <>
         <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)}></div>
         <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto max-h-64 text-left">
           <div 
             className={cn("p-3 cursor-pointer hover:bg-slate-50 flex items-center justify-between", !selectedDeckId ? "bg-indigo-50 text-indigo-700" : "text-slate-700")}
             onClick={() => { onSelect(""); setIsOpen(false); }}
           >
             <span className="font-medium pr-2">Todas as Matérias</span>
             {!selectedDeckId && <Check size={16} className="text-indigo-600 flex-shrink-0"/>}
           </div>
           
           {parents.map(parent => {
             const children = decks.filter(sub => sub.parentId === parent.id);
             const isExpanded = expandedGroups[parent.id] !== false;
             
             return (
               <div key={parent.id} className="border-t border-slate-100">
                 <div className="flex items-start">
                    <div 
                      className="p-3 pl-2 pr-1 flex-shrink-0 cursor-pointer text-slate-400 hover:text-slate-600"
                      onClick={(e) => toggleGroup(parent.id, e)}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <div 
                      className={cn("p-3 pl-2 font-semibold flex-1 cursor-pointer hover:bg-slate-50 flex items-start justify-between", selectedDeckId === parent.id ? "text-indigo-700" : "text-slate-800")}
                      onClick={() => { onSelect(parent.id); setIsOpen(false); }}
                    >
                      <span className="pr-2 leading-snug break-words">Tudo de {parent.name}</span>
                      {selectedDeckId === parent.id && <Check size={16} className="text-indigo-600 flex-shrink-0 mt-0.5"/>}
                    </div>
                 </div>

                 {isExpanded && children.length > 0 && (
                   <div className="bg-slate-50 border-t border-slate-100">
                     {children.map(child => (
                       <div 
                         key={child.id}
                         className={cn("p-3 py-2 pl-10 cursor-pointer hover:bg-slate-100 flex items-start text-sm justify-between w-full", selectedDeckId === child.id ? "text-indigo-700 font-medium" : "text-slate-600")}
                         onClick={() => { onSelect(child.id); setIsOpen(false); }}
                       >
                         <span className="pr-2 leading-snug break-words">{child.name}</span>
                         {selectedDeckId === child.id && <Check size={16} className="text-indigo-600 flex-shrink-0 mt-0.5"/>}
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             );
           })}
         </div>
         </>
       )}
    </div>
  );
}