import React, { useState, useMemo } from 'react';
import { Deck, Flashcard } from '../types';
import { Folder, FolderPlus, Plus, Sparkles, X, ChevronDown, ChevronRight, Layers, AlertCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { updateCardInDb, deleteDeckFromDb } from '../db';
import { auth } from '../firebase';

interface DeckManagerProps {
  decks: Deck[];
  cards: Record<string, Flashcard[]>;
  onAddDeck: (deck: Deck) => void;
  onDeleteDeck: (deckId: string) => void;
  onGenerateAI: (deckId: string, subject: string, topicPrompt: string, count: number) => void;
  onNavigate: (view: string, filter?: any) => void;
}

export function DeckManager({ decks, cards, onAddDeck, onDeleteDeck, onGenerateAI, onNavigate }: DeckManagerProps) {
  const rootDecks = decks.filter(d => !d.parentId);
  const [generations, setGenerations] = useState<Record<string, boolean>>({});
  
  // Accordion state
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  
  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetDeckId, setTargetDeckId] = useState<string | null>(null);
  const [targetSubject, setTargetSubject] = useState("");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [count, setCount] = useState<number>(10);

  const [createDeckModalOpen, setCreateDeckModalOpen] = useState(false);
  const [createDeckParentId, setCreateDeckParentId] = useState<string | undefined>();
  const [createDeckName, setCreateDeckName] = useState("");

  const [deleteDeckInfo, setDeleteDeckInfo] = useState<{isOpen: boolean, deckId: string, deckName: string}>({isOpen: false, deckId: '', deckName: ''});
  const [alertInfo, setAlertInfo] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ""});

  const toggleExpand = (id: string) => {
      const next = new Set(expandedDecks);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setExpandedDecks(next);
  };

  const handleCreateSub = (parentId: string) => {
      setCreateDeckParentId(parentId);
      setCreateDeckName("");
      setCreateDeckModalOpen(true);
  };

  const confirmCreateDeck = () => {
      const name = createDeckName;
      if (!name) return;
      const nameLower = name.trim().toLowerCase();
      
      if (createDeckParentId) {
          if (decks.some(d => d.parentId === createDeckParentId && d.name.trim().toLowerCase() === nameLower)) {
              setAlertInfo({isOpen: true, message: "Já existe um assunto com este nome nesta matéria."});
              return;
          }
          onAddDeck({ id: uuidv4(), parentId: createDeckParentId, name: name.trim(), createdAt: new Date() });
      } else {
          if (decks.some(d => !d.parentId && d.name.trim().toLowerCase() === nameLower)) {
              setAlertInfo({isOpen: true, message: "Já existe uma matéria principal com este nome."});
              return;
          }
          onAddDeck({ id: uuidv4(), name: name.trim(), createdAt: new Date() });
      }
      setCreateDeckModalOpen(false);
  };

  const handleCreateRoot = () => {
      setCreateDeckParentId(undefined);
      setCreateDeckName("");
      setCreateDeckModalOpen(true);
  };

  const openGenerationModal = (deckId: string, deckName: string, parentName?: string) => {
      const subject = parentName ? `${parentName} - ${deckName}` : deckName;
      setTargetDeckId(deckId);
      setTargetSubject(subject);
      setTopicPrompt("");
      setCount(10);
      setModalOpen(true);
  }

  const handleConfirmGeneration = async () => {
      if (!targetDeckId) return;
      setModalOpen(false);
      setGenerations(prev => ({...prev, [targetDeckId]: true}));
      await onGenerateAI(targetDeckId, targetSubject, topicPrompt || "decida os tópicos mais importantes", count);
      setGenerations(prev => ({...prev, [targetDeckId]: false}));
  }

  // Helper to recursively get all descendant deck IDs
  const getChildrenIds = (deckId: string): string[] => {
      const children = decks.filter(d => d.parentId === deckId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
          ids = [...ids, ...getChildrenIds(c.id)];
      });
      return ids;
  };

  const getDeckCardCountMap = useMemo(() => {
      const countMap: Record<string, number> = {};
      decks.forEach(deck => {
          const descendantIds = [deck.id, ...getChildrenIds(deck.id)];
          const total = descendantIds.reduce((acc, id) => acc + (cards[id]?.length || 0), 0);
          countMap[deck.id] = total;
      });
      return countMap;
  }, [decks, cards]);

  // Recursive Deck Node
  const renderDeckNode = (deck: Deck, level: number = 0, parentName?: string) => {
      const children = decks.filter(d => d.parentId === deck.id);
      const isExpanded = expandedDecks.has(deck.id);
      const cardCount = getDeckCardCountMap[deck.id] || 0;
      
      const paddingLeft = level === 0 ? 'px-4' : (level === 1 ? 'pl-8 pr-4' : (level === 2 ? 'pl-12 pr-4' : 'pl-16 pr-4'));
      const bgColor = level === 0 ? 'bg-slate-50 border-b border-slate-200' : 'bg-white hover:bg-slate-50 border-b border-slate-100';

      return (
          <div key={deck.id} className="relative">
              <div 
                  onClick={() => toggleExpand(deck.id)}
                  className={`${bgColor} ${paddingLeft} py-3 flex justify-between items-center group cursor-pointer transition-colors`}
              >
                  <div className="flex items-center text-slate-800 font-medium overflow-hidden">
                      {children.length > 0 ? (
                          isExpanded ? <ChevronDown size={18} className="mr-2 text-slate-400 shrink-0" /> : <ChevronRight size={18} className="mr-2 text-slate-400 shrink-0" />
                      ) : (
                          <div className="w-[18px] mr-2 shrink-0" /> // spacer
                      )}
                      {level === 0 && <Folder size={18} className="mr-2 text-indigo-500 fill-indigo-100 shrink-0"/>}
                      <span className="truncate" title={deck.name}>{deck.name}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate('browser', { deckId: deck.id }); }}
                        className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-normal transition-colors shrink-0"
                      >
                        {cardCount} cards
                      </button>
                  </div>
                  <div className="flex space-x-1 sm:space-x-2 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity items-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openGenerationModal(deck.id, deck.name, parentName); }}
                        className="text-xs flex items-center bg-indigo-50 text-indigo-600 px-2 sm:px-2.5 py-1 rounded-md font-medium hover:bg-indigo-100 transition disabled:opacity-50"
                        disabled={generations[deck.id]}
                        title="Gerar IA"
                      >
                         {generations[deck.id] ? "Gerando..." : <><Sparkles size={14} className="sm:mr-1"/> <span className="hidden sm:inline">Gerar IA</span></>}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleCreateSub(deck.id); }} className="p-1 hover:bg-slate-200 bg-slate-100 sm:bg-transparent rounded text-slate-500" title="Subtópico">
                          <Plus size={16}/>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteDeckInfo({isOpen: true, deckId: deck.id, deckName: deck.name}); }} className="p-1 hover:bg-rose-100 hover:text-rose-600 bg-slate-100 sm:bg-transparent rounded text-slate-400 transition-colors" title="Excluir">
                          <Trash2 size={16}/>
                      </button>
                  </div>
              </div>
              
              {isExpanded && children.length > 0 && (
                  <div className="animate-in fade-in duration-200">
                      {children.map(child => renderDeckNode(child, level + 1, deck.name))}
                  </div>
              )}
              {isExpanded && children.length === 0 && (
                  <div className={`${level === 0 ? 'pl-8' : (level === 1 ? 'pl-12' : 'pl-16')} py-2 text-xs text-slate-400 italic`}>
                      Nenhum subtópico.
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-200 pb-4 gap-4">
           <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Matérias e Assuntos</h2>
              <p className="text-slate-500 mt-1 text-sm md:text-base">Organize sua hierarquia de estudos e gere flashcards com IA.</p>
           </div>
           <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
              {/* removed */}
              <button 
                onClick={handleCreateRoot}
                className="px-4 py-2 justify-center bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition flex items-center shadow-sm"
              >
                 <FolderPlus size={16} className="mr-2"/> Adicionar Matéria
              </button>
           </div>
       </div>

       <div className="grid gap-6 md:grid-cols-2">
           {rootDecks.map(root => (
               <div key={root.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                   {renderDeckNode(root, 0)}
               </div>
           ))}
       </div>

       {modalOpen && (
           <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]">
               <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-800 flex items-center">
                           <Sparkles size={18} className="mr-2 text-indigo-500" />
                           Gerar Inteligência Artificial
                       </h3>
                       <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                           <X size={20} />
                       </button>
                   </div>
                   
                   <div className="p-6 space-y-5">
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">
                               Matéria / Foco Atual
                           </label>
                           <input 
                               type="text" 
                               readOnly 
                               value={targetSubject}
                               className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-sm"
                           />
                       </div>

                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">
                               Quantidade de Flashcards
                           </label>
                           <input 
                               type="number" 
                               min={1} 
                               max={30}
                               value={count}
                               onChange={e => setCount(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                               className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                           />
                           <p className="text-xs text-slate-500 mt-1">
                               Recomendamos gerar de 10 a 20 por vez para respostas mais rápidas e evitar timeout.
                           </p>
                       </div>

                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">
                               O que exatamente você quer que a IA crie?
                           </label>
                           <textarea 
                               placeholder="Ex: Crie 5 questões sobre Atos Vinculados e 5 sobre Princípios."
                               value={topicPrompt}
                               onChange={e => setTopicPrompt(e.target.value)}
                               rows={3}
                               className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                           />
                           <p className="text-xs text-slate-500 mt-1">
                               Deixe em branco para a IA decidir os temas mais importantes com base na Matéria Atual.
                           </p>
                       </div>
                   </div>

                   <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                       <button 
                           onClick={() => setModalOpen(false)}
                           className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
                       >
                           Cancelar
                       </button>
                       <button 
                           onClick={handleConfirmGeneration}
                           className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition flex items-center"
                       >
                           Gerar {count} Cards
                       </button>
                   </div>
               </div>
           </div>
       )}

       {createDeckModalOpen && (
           <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]">
               <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-800">
                           {createDeckParentId ? "Novo Subtópico" : "Nova Matéria Principal"}
                       </h3>
                       <button onClick={() => setCreateDeckModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                           <X size={20} />
                       </button>
                   </div>
                   
                   <div className="p-6">
                       <label className="block text-sm font-medium text-slate-700 mb-2">
                           Nome
                       </label>
                       <input 
                           type="text" 
                           autoFocus
                           placeholder={createDeckParentId ? "Ex: Poderes Administrativos" : "Ex: Direito Administrativo"}
                           value={createDeckName}
                           onChange={e => setCreateDeckName(e.target.value)}
                           onKeyDown={(e) => {
                               if (e.key === 'Enter') confirmCreateDeck();
                           }}
                           className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                       />
                   </div>

                   <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                       <button 
                           onClick={() => setCreateDeckModalOpen(false)}
                           className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
                       >
                           Cancelar
                       </button>
                       <button 
                           onClick={confirmCreateDeck}
                           disabled={!createDeckName.trim()}
                           className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                           Salvar
                       </button>
                   </div>
               </div>
           </div>
       )}

       {deleteDeckInfo.isOpen && (
           <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
               <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="p-6">
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Matéria/Tópico?</h3>
                       <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                           Tem certeza que deseja excluir <strong>"{deleteDeckInfo.deckName}"</strong>? 
                       </p>
                       <p className="text-sm text-slate-600 mb-2">
                           Os flashcards e subtópicos não serão excluídos, mas ficarão sem categoria ("Sem Matéria"). Esta ação não pode ser desfeita. Confirmar?
                       </p>
                   </div>
                   <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                       <button 
                           onClick={() => setDeleteDeckInfo({isOpen: false, deckId: '', deckName: ''})}
                           className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition rounded-lg"
                       >
                           Cancelar
                       </button>
                       <button 
                           onClick={() => {
                               onDeleteDeck(deleteDeckInfo.deckId);
                               setDeleteDeckInfo({isOpen: false, deckId: '', deckName: ''});
                           }}
                           className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 shadow-sm transition"
                       >
                           Excluir
                       </button>
                   </div>
               </div>
           </div>
       )}

       {alertInfo.isOpen && (
           <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
               <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="p-6 text-center">
                       <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                           <AlertCircle size={24} />
                       </div>
                       <h3 className="text-lg font-bold text-slate-900 mb-2">Atenção</h3>
                       <p className="text-sm text-slate-600 mb-6">{alertInfo.message}</p>
                       <button 
                           onClick={() => setAlertInfo({isOpen: false, message: ""})}
                           className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm transition hover:bg-slate-800"
                       >
                           Entendido
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
}
