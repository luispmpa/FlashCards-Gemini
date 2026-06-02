import { useState, useEffect, useMemo } from 'react';
import { Flashcard, Deck, Rating } from '../types';
import { applyFSRSRating, shouldRequeue, getSchedulingOptions } from '../lib/fsrs';
import { startOfToday, addDays } from 'date-fns';
import { Brain, CheckCircle, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { MarkdownContent } from './MarkdownContent';
import { getCorrectIndex } from '../lib/cardUtils';
import { getUserSettings } from '../lib/settings';
import { fetchDueCards, fetchNewCards, getCardsForStudySession } from '../db';
import { auth } from '../firebase';
import { countDueAndNew } from '../lib/studyCounts';

interface StudyViewProps {
  decks: Deck[];
  allCards: Record<string, Flashcard[]>;
  onSaveCard: (card: Flashcard) => void;
  targetCardId?: string;
  onFinishStudy?: () => void; // Optional to know when specific card study is done
  onLogReview?: (card: Flashcard, rating: Rating, oldState: string, newState: string) => void;
}

export function StudyView({ decks, allCards, onSaveCard, targetCardId, onFinishStudy, onLogReview }: StudyViewProps) {
  const [activeCard, setActiveCard] = useState<Flashcard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [expandedDecks, setExpandedDecks] = useState<Record<string, boolean>>({});
  const [loadingDeckId, setLoadingDeckId] = useState<string | null>(null);

  const scheduling = useMemo(
    () => (activeCard ? getSchedulingOptions(activeCard) : null),
    [activeCard]
  );

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

  const getDescendantDeckIds = (parentId: string): string[] => {
    const children = decks.filter(d => d.parentId === parentId);
    return children.flatMap(child => [child.id, ...getDescendantDeckIds(child.id)]);
  };

  const startStudy = async (deckId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setLoadingDeckId(deckId);
    try {
        const deckIds = deckId ? [deckId, ...getDescendantDeckIds(deckId)] : decks.map(d => d.id);
        const settings = getUserSettings();
        const targetDate = addDays(startOfToday(), 1);
        const subscribedCards = getCardsForStudySession(
          allCards,
          deckIds,
          settings.newPerDay,
          settings.reviewsPerDay,
          targetDate
        );
        let cardsToStudy: Flashcard[] = [];

        try {
            const [dueCards, newCards] = await Promise.all([
                 fetchDueCards(userId, deckIds, targetDate, settings.reviewsPerDay),
                 fetchNewCards(userId, deckIds, settings.newPerDay)
            ]);
            cardsToStudy = [...dueCards, ...newCards];

            if (cardsToStudy.length === 0 && subscribedCards.length > 0) {
              cardsToStudy = subscribedCards;
            }
        } catch (queryError) {
            console.warn("Direct Firestore study query failed; using subscribed cards fallback.", queryError);
            cardsToStudy = subscribedCards;
        }

        const shuffled = [...cardsToStudy].sort(() => Math.random() - 0.5);
        setQueue(shuffled);
        setActiveCard(shuffled[0] || null);
        setShowAnswer(false);
        setSelectedOptionIndex(null);
    } catch (e) {
        console.error("Failed to load study session", e);
    } finally {
        setLoadingDeckId(null);
    }
  };

  const handleRating = (rating: Rating) => {
    if (!activeCard) return;
    const oldState = activeCard.fsrsData.state;
    const updatedCard = scheduling ? scheduling[rating].card : applyFSRSRating(activeCard, rating);
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
    // FSRS-nativo: volta à sessão só se foi um passo sub-diário (< 1 dia).
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

    const now = new Date();
    const rootDecks = decks.filter(d => !d.parentId);

    const rows = rootDecks.map(root => {
      const children = decks.filter(d => d.parentId === root.id);
      const aggregateDeckIds = [root.id, ...getDescendantDeckIds(root.id)];
      const aggregateCards = aggregateDeckIds.flatMap(id => allCards[id] || []);
      return {
        deck: root,
        counts: countDueAndNew(aggregateCards, now),
        children: children.map(c => ({ deck: c, counts: countDueAndNew(allCards[c.id] || [], now) })),
      };
    });

    rows.sort((a, b) =>
      (b.counts.due - a.counts.due) ||
      (b.counts.newCards - a.counts.newCards) ||
      a.deck.name.localeCompare(b.deck.name)
    );

    const totalDue = rows.reduce((s, r) => s + r.counts.due, 0);
    const totalNew = rows.reduce((s, r) => s + r.counts.newCards, 0);

    return (
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6 overflow-y-auto pb-32">
        {/* Cabeçalho: revisão do dia + estudar tudo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="mx-auto p-4 bg-indigo-50 rounded-full text-indigo-500 w-fit">
            <Brain size={40} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Revisão do dia</h2>
            <p className="text-sm text-slate-500 mt-1">
              {totalDue} a revisar · {totalNew} novos
            </p>
          </div>
          <button
            onClick={() => startStudy("")}
            disabled={loadingDeckId !== null || (totalDue + totalNew === 0)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingDeckId === "" ? <Loader2 className="animate-spin" size={20} /> : "Estudar tudo"}
          </button>
        </div>

        {/* Lista de matérias */}
        <div className="space-y-3">
          {rows.map(({ deck, counts, children }) => {
            const isEmDia = counts.due === 0 && counts.newCards === 0;
            const isExpanded = expandedDecks[deck.id];
            return (
              <div
                key={deck.id}
                className={cn(
                  "bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-opacity",
                  isEmDia && "opacity-60"
                )}
              >
                <div className="flex items-center p-4 gap-2">
                  {/* expandir */}
                  {children.length > 0 ? (
                    <button
                      onClick={() => setExpandedDecks(prev => ({ ...prev, [deck.id]: !prev[deck.id] }))}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      aria-label="Expandir"
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  ) : <span className="w-6" />}

                  {/* nome + contadores */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{deck.name}</div>
                    <div className="text-xs mt-0.5 flex gap-3">
                      {isEmDia ? (
                        <span className="text-emerald-600 font-medium">✓ Em dia</span>
                      ) : (
                        <>
                          {counts.due > 0 && <span className="text-rose-600 font-medium">{counts.due} a revisar</span>}
                          {counts.newCards > 0 && <span className="text-sky-600 font-medium">{counts.newCards} novos</span>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* estudar matéria */}
                  <button
                    onClick={() => startStudy(deck.id)}
                    disabled={loadingDeckId !== null || (counts.due + counts.newCards === 0)}
                    className="px-4 py-2 text-sm font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-40 flex items-center"
                  >
                    {loadingDeckId === deck.id ? <Loader2 className="animate-spin" size={16} /> : "Estudar"}
                  </button>
                </div>

                {/* assuntos */}
                {isExpanded && children.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/60 divide-y divide-slate-100">
                    {children.map(({ deck: child, counts: cc }) => {
                      const childEmDia = cc.due === 0 && cc.newCards === 0;
                      return (
                        <div key={child.id} className={cn("flex items-center gap-2 pl-12 pr-4 py-3", childEmDia && "opacity-60")}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-700 truncate">{child.name}</div>
                            <div className="text-xs mt-0.5 flex gap-3">
                              {childEmDia ? (
                                <span className="text-emerald-600">✓ Em dia</span>
                              ) : (
                                <>
                                  {cc.due > 0 && <span className="text-rose-600">{cc.due} a revisar</span>}
                                  {cc.newCards > 0 && <span className="text-sky-600">{cc.newCards} novos</span>}
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => startStudy(child.id)}
                            disabled={loadingDeckId !== null || (cc.due + cc.newCards === 0)}
                            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 flex items-center"
                          >
                            {loadingDeckId === child.id ? <Loader2 className="animate-spin" size={14} /> : "Estudar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
          <MarkdownContent className="text-xl font-medium text-slate-800 leading-relaxed flex-1 prose-p:text-xl prose-p:font-medium">
             {activeCard.front}
          </MarkdownContent>
          
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
                         <MarkdownContent className="prose-p:m-0 prose-p:text-inherit prose-p:font-inherit">{opt}</MarkdownContent>
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
                             <MarkdownContent className="prose-p:m-0 prose-p:text-inherit prose-p:font-inherit">{opt}</MarkdownContent>
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
                <MarkdownContent className="text-sm text-slate-600 leading-relaxed">
                    {activeCard.back}
                </MarkdownContent>
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
                 <RatingButton rating="Again" label="Errei" time={scheduling?.Again.intervalLabel ?? ''} color="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200" onClick={() => handleRating("Again")}/>
                 <RatingButton rating="Hard" label="Difícil" time={scheduling?.Hard.intervalLabel ?? ''} color="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" onClick={() => handleRating("Hard")}/>
                 <RatingButton rating="Good" label="Bom" time={scheduling?.Good.intervalLabel ?? ''} color="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200" onClick={() => handleRating("Good")}/>
                 <RatingButton rating="Easy" label="Fácil" time={scheduling?.Easy.intervalLabel ?? ''} color="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" onClick={() => handleRating("Easy")}/>
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
