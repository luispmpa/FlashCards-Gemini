import { useMemo, useState, useEffect } from 'react';
import { Flashcard, Deck } from '../types';
import { Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { format, isSameDay, isBefore, parseISO, isSameMonth } from 'date-fns';

export interface CardBrowserFilter {
  search?: string;
  state?: string;      // 'New', 'Review', 'Learning', or 'Review/Learning'
  dueDay?: string;     // ISO string for a specific day
  dueBefore?: string;  // ISO string
  dueMonth?: string;   // ISO string for a specific month
  deckId?: string;     // ID of deck
}

interface CardBrowserProps {
  cards: Record<string, Flashcard[]>;
  decks: Deck[];
  onDeleteCards: (cardsToDelete: {id: string, deckId: string}[]) => void;
  onEditCard: (card: Flashcard) => void;
  onStudyCard: (cardId: string) => void;
  initialFilter?: CardBrowserFilter;
}

type SortKey = 'front' | 'deck' | 'state' | 'due' | 'createdAt';

export function CardBrowser({ cards, decks, onDeleteCards, onEditCard, onStudyCard, initialFilter }: CardBrowserProps) {
  const [search, setSearch] = useState(initialFilter?.search || "");
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{isOpen: boolean, cardsToDelete: {id: string, deckId: string}[], message: string}>({isOpen: false, cardsToDelete: [], message: ""});
  
  useEffect(() => {
     if (initialFilter?.search !== undefined) {
         setSearch(initialFilter.search);
     }
  }, [initialFilter]);
  
  const allCards = useMemo(() => Object.values(cards).flat(), [cards]);
  
  const filteredCards = useMemo(() => {
     let result = allCards.filter(c => {
        const deck = decks.find(d => d.id === c.deckId);
        const parent = deck?.parentId ? decks.find(d => d.id === deck.parentId) : null;
        const searchLower = search.toLowerCase();
        
        return c.front.toLowerCase().includes(searchLower) || 
               c.back.toLowerCase().includes(searchLower) ||
               (deck && deck.name.toLowerCase().includes(searchLower)) ||
               (parent && parent.name.toLowerCase().includes(searchLower));
     });

     if (initialFilter) {
         if (initialFilter.state) {
             if (initialFilter.state === 'Review/Learning') {
                result = result.filter(c => c.fsrsData.state === 'Review' || c.fsrsData.state === 'Learning' || c.fsrsData.state === 'Relearning');
             } else {
                result = result.filter(c => c.fsrsData.state === initialFilter.state);
             }
         }
         if (initialFilter.dueDay) {
             const targetDay = parseISO(initialFilter.dueDay);
             result = result.filter(c => c.fsrsData.state !== 'New' && isSameDay(new Date(c.fsrsData.due), targetDay));
         }
         if (initialFilter.dueMonth) {
             const targetMonth = parseISO(initialFilter.dueMonth);
             result = result.filter(c => c.fsrsData.state !== 'New' && isSameMonth(new Date(c.fsrsData.due), targetMonth));
         }
         if (initialFilter.dueBefore) {
             const beforeDate = parseISO(initialFilter.dueBefore);
             result = result.filter(c => c.fsrsData.state !== 'New' && isBefore(new Date(c.fsrsData.due), beforeDate));
         }
         if (initialFilter.deckId) {
             // Also include subdecks
             const targetAndSubs = [initialFilter.deckId, ...decks.filter(d => d.parentId === initialFilter.deckId).map(d => d.id)];
             result = result.filter(c => targetAndSubs.includes(c.deckId));
         }
     }
     
     // Sorting
     result.sort((a, b) => {
         let comparison = 0;
         if (sortKey === 'front') {
             comparison = a.front.localeCompare(b.front);
         } else if (sortKey === 'state') {
             comparison = a.fsrsData.state.localeCompare(b.fsrsData.state);
         } else if (sortKey === 'due') {
             comparison = new Date(a.fsrsData.due).getTime() - new Date(b.fsrsData.due).getTime();
         } else if (sortKey === 'createdAt') {
             const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
             const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
             comparison = timeA - timeB;
         } else if (sortKey === 'deck') {
             const deckA = decks.find(d => d.id === a.deckId)?.name || '';
             const deckB = decks.find(d => d.id === b.deckId)?.name || '';
             comparison = deckA.localeCompare(deckB);
         }
         return sortDir === 'asc' ? comparison : -comparison;
     });

     return result;
  }, [allCards, search, initialFilter, sortKey, sortDir, decks]);

  const handleSort = (key: SortKey) => {
      if (sortKey === key) {
          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKey(key);
          setSortDir('asc');
      }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (sortKey !== columnKey) return <ArrowUpDown size={14} className="ml-1 opacity-40 group-hover:opacity-100" />;
      return sortDir === 'asc' ? <ArrowUp size={14} className="ml-1 text-indigo-600" /> : <ArrowDown size={14} className="ml-1 text-indigo-600" />;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-200 pb-4 shrink-0 gap-4">
           <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center">
                  Flashcards
                  {initialFilter && Object.keys(initialFilter).length > 0 && (
                      <span className="ml-3 text-sm font-normal bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
                          (Filtrado)
                      </span>
                  )}
              </h2>
              <div className="flex items-center space-x-4 mt-2">
                 <p className="text-slate-500 text-sm">
                     Exibindo {filteredCards.length} de {allCards.length} cards.
                 </p>
                 {selectedIds.size > 0 && (
                     <div className="flex items-center space-x-2 border-l border-slate-300 pl-4">
                        <span className="text-sm font-semibold text-slate-700">{selectedIds.size} selecionado(s)</span>
                        <button 
                           onClick={() => {
                               const toDelete = Array.from(selectedIds).map(id => {
                                   const card = allCards.find(c => c.id === id);
                                   return { id: card?.id as string, deckId: card?.deckId as string };
                               }).filter(c => c.id);
                               setConfirmDeleteModal({isOpen: true, cardsToDelete: toDelete, message: `Deseja realmente excluir ${selectedIds.size} flashcard(s)?`});
                           }}
                           className="flex items-center text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded hover:bg-rose-200 transition-colors"
                        >
                            <Trash2 size={14} className="mr-1"/> Excluir Seleção
                        </button>
                     </div>
                 )}
              </div>
           </div>
           
           <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                 type="text"
                 placeholder="Pesquisar nesta visão..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-10 pr-4 py-2 w-full sm:w-64 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
           </div>
       </div>

       <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden min-h-0 flex flex-col">
           <div className="overflow-x-auto overflow-y-auto">
               <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200 shadow-sm z-10 font-semibold">
                       <tr>
                           <th className="px-4 py-4 w-12 text-center">
                               <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={filteredCards.length > 0 && selectedIds.size === filteredCards.length}
                                  onChange={(e) => {
                                      if (e.target.checked) setSelectedIds(new Set(filteredCards.map(c => c.id)));
                                      else setSelectedIds(new Set());
                                  }}
                               />
                           </th>
                           <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group select-none transition-colors" onClick={() => handleSort('front')}>
                               <div className="flex items-center">Frente (Questão) <SortIcon columnKey="front" /></div>
                           </th>
                           <th className="px-6 py-4 w-48 cursor-pointer hover:bg-slate-100 group select-none transition-colors" onClick={() => handleSort('deck')}>
                               <div className="flex items-center">Matéria <SortIcon columnKey="deck" /></div>
                           </th>
                           <th className="px-6 py-4 w-32 cursor-pointer hover:bg-slate-100 group select-none transition-colors" onClick={() => handleSort('state')}>
                               <div className="flex items-center">Status <SortIcon columnKey="state" /></div>
                           </th>
                           <th className="px-6 py-4 w-36 cursor-pointer hover:bg-slate-100 group select-none transition-colors" onClick={() => handleSort('due')}>
                               <div className="flex items-center">Próx. Revisão <SortIcon columnKey="due" /></div>
                           </th>
                           <th className="px-6 py-4 w-36 cursor-pointer hover:bg-slate-100 group select-none transition-colors" onClick={() => handleSort('createdAt')}>
                               <div className="flex items-center">Inclusão <SortIcon columnKey="createdAt" /></div>
                           </th>
                           <th className="px-6 py-4 w-24 text-right">Ações</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                       {filteredCards.length > 0 ? filteredCards.map(card => {
                           const deck = decks.find(d => d.id === card.deckId);
                           const parent = deck?.parentId ? decks.find(d => d.id === deck.parentId) : null;
                           const deckLabel = parent ? `${parent.name} / ${deck?.name}` : deck?.name;

                           const isSelected = selectedIds.has(card.id);

                           return (
                               <tr key={card.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                   <td className="px-4 py-4 text-center">
                                      <input 
                                          type="checkbox" 
                                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          checked={isSelected}
                                          onChange={(e) => {
                                              const next = new Set(selectedIds);
                                              if (e.target.checked) next.add(card.id);
                                              else next.delete(card.id);
                                              setSelectedIds(next);
                                          }}
                                      />
                                   </td>
                                   <td className="px-6 py-4">
                                      <div 
                                         className="line-clamp-2 text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors"
                                         onClick={() => onStudyCard(card.id)}
                                         title="Clique para estudar"
                                      >
                                         {card.front}
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 text-slate-500">
                                      {deckLabel}
                                   </td>
                                   <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          card.fsrsData.state === 'New' ? 'bg-sky-100 text-sky-700' :
                                          card.fsrsData.state === 'Learning' || card.fsrsData.state === 'Relearning' ? 'bg-amber-100 text-amber-700' :
                                          'bg-emerald-100 text-emerald-700'
                                      }`}>
                                        {card.fsrsData.state === 'New' ? 'Novo' : 
                                         card.fsrsData.state === 'Learning' ? 'Aprendendo' : 
                                         card.fsrsData.state === 'Review' ? 'Revisão' : 'Reaprendendo'}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                      {format(new Date(card.fsrsData.due), "dd/MM/yyyy HH:mm")}
                                   </td>
                                   <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                      {card.createdAt ? format(new Date(card.createdAt), "dd/MM/yyyy HH:mm") : "-"}
                                   </td>
                                   <td className="px-6 py-4 text-right whitespace-nowrap">
                                      <button 
                                          onClick={() => onStudyCard(card.id)}
                                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 mr-1" title="Estudar"
                                      >
                                          <Play size={16} />
                                      </button>
                                      <button 
                                          onClick={() => setEditingCard({...card})}
                                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 mr-1" title="Editar"
                                      >
                                          <Edit2 size={16} />
                                      </button>
                                      <button 
                                          onClick={() => {
                                              setConfirmDeleteModal({isOpen: true, cardsToDelete: [{ id: card.id, deckId: card.deckId }], message: "Deseja realmente excluir este flashcard?"});
                                          }} 
                                          className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Excluir"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                   </td>
                               </tr>
                           )
                       }) : (
                           <tr>
                               <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhum card encontrado.</td>
                           </tr>
                       )}
                   </tbody>
               </table>
           </div>
       </div>

       {editingCard && (
           <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-6 flex flex-col max-h-full">
                   <h3 className="text-xl font-bold text-slate-800">Editar Flashcard</h3>
                   <div className="space-y-4 overflow-y-auto">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Frente (Questão)</label>
                          <textarea 
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                            value={editingCard.front}
                            onChange={e => setEditingCard({...editingCard, front: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Verso (Resposta e Explicação)</label>
                          <textarea 
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
                            value={editingCard.back}
                            onChange={e => setEditingCard({...editingCard, back: e.target.value})}
                          />
                       </div>
                   </div>
                   <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 shrink-0">
                       <button 
                         onClick={() => setEditingCard(null)}
                         className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                       >Cancelar</button>
                       <button 
                         onClick={() => {
                             onEditCard(editingCard);
                             setEditingCard(null);
                         }}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition shadow-sm"
                       >Salvar</button>
                   </div>
               </div>
           </div>
       )}

       {confirmDeleteModal.isOpen && (
           <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
               <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="p-6 text-center whitespace-pre-wrap">
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmar Exclusão</h3>
                       <p className="text-sm text-slate-600 mb-6">{confirmDeleteModal.message}</p>
                       <div className="flex justify-end space-x-3">
                           <button 
                               onClick={() => setConfirmDeleteModal({isOpen: false, cardsToDelete: [], message: ""})}
                               className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                           >
                               Cancelar
                           </button>
                           <button 
                               onClick={() => {
                                   if (confirmDeleteModal.cardsToDelete.length > 0) {
                                       onDeleteCards(confirmDeleteModal.cardsToDelete);
                                       setSelectedIds(new Set());
                                   }
                                   setConfirmDeleteModal({isOpen: false, cardsToDelete: [], message: ""});
                               }}
                               className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold shadow-sm transition hover:bg-rose-700"
                           >
                               Excluir
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  )
}
