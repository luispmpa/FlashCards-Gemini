import { useMemo, useState, useEffect } from 'react';
import { Flashcard, Deck } from '../types';
import { Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Play, Loader2 } from 'lucide-react';
import { format, isSameDay, isBefore, parseISO, isSameMonth } from 'date-fns';
import { uploadImageFromPaste } from '../lib/imageUpload';

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
  onStudyCards: (cardIds: string[]) => void;
  initialFilter?: CardBrowserFilter;
}

type SortKey = 'front' | 'deck' | 'state' | 'due' | 'createdAt';

export function CardBrowser({ cards, decks, onDeleteCards, onEditCard, onStudyCard, onStudyCards, initialFilter }: CardBrowserProps) {
  const [search, setSearch] = useState(initialFilter?.search || "");
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{isOpen: boolean, cardsToDelete: {id: string, deckId: string}[], message: string}>({isOpen: false, cardsToDelete: [], message: ""});
  
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>, field: 'front' | 'back') => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      // Capture the state before any async operations or re-renders
      const textarea = e.currentTarget;
      const startPos = textarea.selectionStart || 0;
      const endPos = textarea.selectionEnd || 0;

      for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
              e.preventDefault();
              const file = items[i].getAsFile();
              if (!file || !editingCard) return;
              
              setIsUploading(true);
              try {
                  const url = await uploadImageFromPaste(file);
                  const markdownImage = `\n![imagem](${url})\n`;
                  
                  const text = editingCard[field] || "";
                  const newText = text.substring(0, startPos) + markdownImage + text.substring(endPos);
                  setEditingCard({ ...editingCard, [field]: newText });
                  
                  // Try to restore focus after the state updates
                  setTimeout(() => {
                      if (textarea && !textarea.disabled) {
                          textarea.selectionStart = startPos + markdownImage.length;
                          textarea.selectionEnd = startPos + markdownImage.length;
                          textarea.focus();
                      }
                  }, 100);
              } catch (error: any) {
                  console.error("Failed to upload image", error);
                  alert(error.message || "Erro ao enviar a imagem. Verifique sua chave da API.");
              } finally {
                  setIsUploading(false);
              }
              break; // Handle only the first image
          }
      }
  };

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

  const handleSelectCard = (index: number, checked: boolean, shiftKey: boolean) => {
      const next = new Set(selectedIds);

      // Shift+click: select/deselect the whole range between the last clicked
      // card and the current one (inclusive), matching the displayed order.
      if (shiftKey && lastSelectedIndex !== null) {
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          for (let i = start; i <= end; i++) {
              const rangeCard = filteredCards[i];
              if (!rangeCard) continue;
              if (checked) next.add(rangeCard.id);
              else next.delete(rangeCard.id);
          }
      } else {
          const card = filteredCards[index];
          if (card) {
              if (checked) next.add(card.id);
              else next.delete(card.id);
          }
      }

      setSelectedIds(next);
      setLastSelectedIndex(index);
  };

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
                               const ids = filteredCards.filter(c => selectedIds.has(c.id)).map(c => c.id);
                               if (ids.length > 0) onStudyCards(ids);
                           }}
                           className="flex items-center text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors"
                        >
                            <Play size={14} className="mr-1"/> Estudar Selecionados
                        </button>
                        <button
                           onClick={() => {
                               const toDelete = Array.from(selectedIds)
                                   .map(id => allCards.find(c => c.id === id))
                                   .filter((c): c is Flashcard => Boolean(c))
                                   .map(c => ({ id: c.id, deckId: c.deckId }));
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
                           <th scope="col" className="px-4 py-4 w-12 text-center">
                               <input
                                  type="checkbox"
                                  aria-label="Selecionar todos os cards exibidos"
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={filteredCards.length > 0 && selectedIds.size === filteredCards.length}
                                  onChange={(e) => {
                                      if (e.target.checked) setSelectedIds(new Set(filteredCards.map(c => c.id)));
                                      else setSelectedIds(new Set());
                                      setLastSelectedIndex(null);
                                  }}
                               />
                           </th>
                           <th scope="col" className="px-6 py-4">
                               <button type="button" onClick={() => handleSort('front')} aria-label="Ordenar por Frente (Questão)" className="flex items-center w-full hover:text-indigo-600 transition-colors">Frente (Questão) <SortIcon columnKey="front" /></button>
                           </th>
                           <th scope="col" className="px-6 py-4 w-48">
                               <button type="button" onClick={() => handleSort('deck')} aria-label="Ordenar por Matéria" className="flex items-center w-full hover:text-indigo-600 transition-colors">Matéria <SortIcon columnKey="deck" /></button>
                           </th>
                           <th scope="col" className="px-6 py-4 w-32">
                               <button type="button" onClick={() => handleSort('state')} aria-label="Ordenar por Status" className="flex items-center w-full hover:text-indigo-600 transition-colors">Status <SortIcon columnKey="state" /></button>
                           </th>
                           <th scope="col" className="px-6 py-4 w-36">
                               <button type="button" onClick={() => handleSort('due')} aria-label="Ordenar por Próxima Revisão" className="flex items-center w-full hover:text-indigo-600 transition-colors">Próx. Revisão <SortIcon columnKey="due" /></button>
                           </th>
                           <th scope="col" className="px-6 py-4 w-36">
                               <button type="button" onClick={() => handleSort('createdAt')} aria-label="Ordenar por Inclusão" className="flex items-center w-full hover:text-indigo-600 transition-colors">Inclusão <SortIcon columnKey="createdAt" /></button>
                           </th>
                           <th scope="col" className="px-6 py-4 w-24 text-right">Ações</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                       {filteredCards.length > 0 ? filteredCards.map((card, index) => {
                           const deck = decks.find(d => d.id === card.deckId);
                           const parent = deck?.parentId ? decks.find(d => d.id === deck.parentId) : null;
                           const deckLabel = parent ? `${parent.name} / ${deck?.name}` : deck?.name;

                           const isSelected = selectedIds.has(card.id);

                           return (
                               <tr key={card.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                   <td className="px-4 py-4 text-center">
                                      <input
                                          type="checkbox"
                                          aria-label={`Selecionar card: ${card.front.slice(0, 60)}`}
                                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          checked={isSelected}
                                          onChange={(e) => {
                                              const shiftKey = (e.nativeEvent as MouseEvent).shiftKey;
                                              handleSelectCard(index, e.target.checked, shiftKey);
                                          }}
                                      />
                                   </td>
                                   <td className="px-6 py-4">
                                      <div
                                         role="button"
                                         tabIndex={0}
                                         className="line-clamp-2 text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                         onClick={() => onStudyCard(card.id)}
                                         onKeyDown={(e) => {
                                             if (e.key === 'Enter' || e.key === ' ') {
                                                 e.preventDefault();
                                                 onStudyCard(card.id);
                                             }
                                         }}
                                         title="Clique para estudar"
                                         aria-label={`Estudar card: ${card.front.slice(0, 60)}`}
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
                                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 mr-1" title="Estudar" aria-label="Estudar este card"
                                      >
                                          <Play size={16} />
                                      </button>
                                      <button
                                          onClick={() => setEditingCard({...card})}
                                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 mr-1" title="Editar" aria-label="Editar este card"
                                      >
                                          <Edit2 size={16} />
                                      </button>
                                      <button
                                          onClick={() => {
                                              setConfirmDeleteModal({isOpen: true, cardsToDelete: [{ id: card.id, deckId: card.deckId }], message: "Deseja realmente excluir este flashcard?"});
                                          }}
                                          className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Excluir" aria-label="Excluir este card"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                   </td>
                               </tr>
                           )
                       }) : (
                           <tr>
                               <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Nenhum card encontrado.</td>
                           </tr>
                       )}
                   </tbody>
               </table>
           </div>
       </div>

       {editingCard && (
           <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-6 flex flex-col max-h-full relative">
                   <h3 className="text-xl font-bold text-slate-800">Editar Flashcard</h3>
                   <div className="space-y-4 overflow-y-auto">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                              <span>Frente (Questão)</span>
                              <span className="text-xs text-slate-400 font-normal">Aceita Ctrl+V de imagens</span>
                          </label>
                          <textarea 
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                            value={editingCard.front}
                            onChange={e => setEditingCard({...editingCard, front: e.target.value})}
                            onPaste={(e) => handlePaste(e, 'front')}
                            disabled={isUploading}
                          />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                              <span>Verso (Resposta e Explicação)</span>
                              <span className="text-xs text-slate-400 font-normal">Aceita Ctrl+V de imagens</span>
                          </label>
                          <textarea 
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
                            value={editingCard.back}
                            onChange={e => setEditingCard({...editingCard, back: e.target.value})}
                            onPaste={(e) => handlePaste(e, 'back')}
                            disabled={isUploading}
                          />
                       </div>
                   </div>
                   {isUploading && (
                       <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                           <div className="flex items-center space-x-2 text-indigo-600 bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100">
                               <Loader2 className="w-5 h-5 animate-spin" />
                               <span className="font-medium text-sm">Enviando imagem...</span>
                           </div>
                       </div>
                   )}
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
