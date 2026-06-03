import { useState, useMemo } from 'react';
import { Deck, Flashcard } from '../types';
import { Folder, FolderPlus, Plus, Upload, X, ChevronDown, ChevronRight, AlertCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface DeckManagerProps {
  decks: Deck[];
  cards: Record<string, Flashcard[]>;
  onAddDeck: (deck: Deck) => void;
  onDeleteDeck: (deckId: string) => void;
  onImportCards: (deckId: string, cards: any[]) => void;
  onNavigate: (view: string, filter?: any) => void;
}

export function DeckManager({ decks, cards, onAddDeck, onDeleteDeck, onImportCards, onNavigate }: DeckManagerProps) {
  const rootDecks = decks.filter(d => !d.parentId);

  // Accordion state
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTargetDeckId, setImportTargetDeckId] = useState<string | null>(null);
  const [importTargetName, setImportTargetName] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

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

  const openImportModal = (deckId: string, deckName: string, parentName?: string) => {
      setImportTargetDeckId(deckId);
      setImportTargetName(parentName ? `${parentName} - ${deckName}` : deckName);
      setImportText("");
      setImportError("");
      setImportModalOpen(true);
  }

  const handleImportSubmit = () => {
      if (!importTargetDeckId) return;
      const cleaned = importText.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      if (!cleaned) { setImportError('Cole o JSON ou envie um arquivo.'); return; }
      let parsed: any;
      try { parsed = JSON.parse(cleaned); }
      catch { setImportError('JSON inválido. Verifique o conteúdo colado.'); return; }
      if (!Array.isArray(parsed)) { setImportError('O conteúdo deve ser um array JSON de flashcards.'); return; }
      if (parsed.length === 0) { setImportError('Nenhum flashcard encontrado no JSON.'); return; }
      setImportModalOpen(false);
      onImportCards(importTargetDeckId, parsed);
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
                  className={`${bgColor} ${paddingLeft} py-3 flex justify-between items-center group cursor-pointer transition-colors relative`}
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
                  <div className="flex items-center space-x-1 sm:space-x-2 shrink-0 opacity-100 transition-opacity lg:absolute lg:right-3 lg:top-1/2 lg:-translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 lg:bg-slate-50 lg:pl-3 lg:rounded-md">
                      <button
                        onClick={(e) => { e.stopPropagation(); openImportModal(deck.id, deck.name, parentName); }}
                        className="text-xs flex items-center bg-indigo-50 text-indigo-600 px-2 sm:px-2.5 py-1 rounded-md font-medium hover:bg-indigo-100 transition"
                        title="Importar flashcards (JSON)"
                      >
                         <Upload size={14} className="sm:mr-1"/> <span className="hidden sm:inline">Importar</span>
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
              {children.length === 0 && (level === 0 || isExpanded) && (
                  <div className={`${level === 0 ? 'px-4 border-t border-slate-100' : (level === 1 ? 'pl-12 pr-4' : 'pl-16 pr-4')} py-3 text-xs text-slate-400 italic`}>
                      {level === 0
                          ? 'Nenhum assunto ainda. Use "Importar" (JSON) ou adicione um subtópico (+).'
                          : 'Nenhum subtópico.'}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-200 pb-4 gap-4">
           <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Matérias e Assuntos</h2>
              <p className="text-slate-500 mt-1 text-sm md:text-base">Organize sua hierarquia de estudos e importe flashcards (JSON).</p>
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

       <div className="grid gap-6 md:grid-cols-2 items-start">
           {rootDecks.map(root => (
               <div key={root.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                   {renderDeckNode(root, 0)}
               </div>
           ))}
       </div>

       {importModalOpen && (
           <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]">
               <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                   <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                       <h3 className="font-bold text-slate-800 flex items-center">
                           <Upload size={18} className="mr-2 text-indigo-500" />
                           Importar Flashcards — {importTargetName}
                       </h3>
                       <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                           <X size={20} />
                       </button>
                   </div>

                   <div className="p-6 space-y-4 overflow-y-auto">
                       <p className="text-sm text-slate-500">
                           Cole o JSON dos flashcards ou envie um arquivo <code>.json</code>. Itens duplicados (mesmo enunciado) são ignorados.
                       </p>

                       <input
                           type="file"
                           accept="application/json,.json"
                           onChange={async (e) => {
                               const file = e.target.files?.[0];
                               if (!file) return;
                               const text = await file.text();
                               setImportText(text);
                               setImportError("");
                               e.target.value = '';
                           }}
                           className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                       />

                       <textarea
                           value={importText}
                           onChange={e => { setImportText(e.target.value); setImportError(""); }}
                           placeholder={'[ { "topicName": "...", "front": "...", "options": ["A) ...","B) ..."], "back": "Gabarito: B\\n...", "correctOption": "B" } ]'}
                           className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[220px] font-mono text-xs"
                       />

                       {importError && <p className="text-sm text-rose-600">{importError}</p>}
                   </div>

                   <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3 shrink-0">
                       <button
                           onClick={() => setImportModalOpen(false)}
                           className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
                       >
                           Cancelar
                       </button>
                       <button
                           onClick={handleImportSubmit}
                           className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition flex items-center"
                       >
                           Importar
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
