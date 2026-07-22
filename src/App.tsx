import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { StudyView } from './components/StudyView';
import { DeckManager } from './components/DeckManager';
import { CardBrowser, CardBrowserFilter } from './components/CardBrowser';
import { Deck, Flashcard, ReviewLog, KnowledgeItem, KnowledgeCategory } from './types';
import { v4 as uuidv4 } from "uuid";
import { createInitialFSRSData } from './lib/fsrs';
import { SettingsView } from './components/SettingsView';
import { Search, Loader2, Menu } from 'lucide-react';
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { subscribeToDecks, subscribeToCards, saveDeckToDb, saveCardsBatchToDb, updateCardInDb, deleteCardFromDb, deleteDeckCascade, subscribeToReviewLogs, saveReviewLogInDb, clearAllCardsAndLogs, subscribeToKnowledgeItems, subscribeToKnowledgeCategories, saveKnowledgeItemToDb, updateKnowledgeItemInDb, deleteKnowledgeItemFromDb, saveKnowledgeCategoryToDb, updateKnowledgeCategoryInDb, deleteKnowledgeCategoryFromDb } from './db';
import { isSimilarTopic } from './lib/topicUtils';
import { buildAliasIndex, computeBacklinks } from './lib/knowledge';
import { ReviewHistory } from './components/ReviewHistory';
import { UpdatesView } from './components/UpdatesView';
import { ReportProblemModal } from './components/ReportProblemModal';
import { KnowledgeBase } from './components/KnowledgeBase';
import { KnowledgeViewerModal } from './components/KnowledgeViewerModal';
import { KnowledgeContext } from './components/KnowledgeContext';

interface NavigationState {
  view: string;
  filter?: CardBrowserFilter;
  studyCardId?: string;
  studyCardIds?: string[];
}

export default function App() {
  const [navState, setNavState] = useState<NavigationState>({ view: 'dashboard' });
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Record<string, Flashcard[]>>({});
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeCategory[]>([]);
  const [viewingKnowledgeId, setViewingKnowledgeId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const [alertInfo, setAlertInfo] = useState<{isOpen: boolean, message: string, title?: string}>({isOpen: false, message: ""});

  useEffect(() => {
     const unsubscribe = onAuthStateChanged(auth, (u) => {
         setUser(u);
         setAuthLoading(false);
         setIsLoggingIn(false);
     });
     return () => unsubscribe();
  }, []);

  useEffect(() => {
      let unSubDecks: () => void;
      let unSubCards: () => void;
      let unSubLogs: () => void;
      let unSubKnowledge: () => void;
      let unSubCategories: () => void;
      if (user) {
          unSubDecks = subscribeToDecks(user.uid, setDecks);
          unSubCards = subscribeToCards(user.uid, setCards);
          unSubLogs = subscribeToReviewLogs(user.uid, setReviewLogs);
          unSubKnowledge = subscribeToKnowledgeItems(user.uid, setKnowledgeItems);
          unSubCategories = subscribeToKnowledgeCategories(user.uid, setKnowledgeCategories);
      } else {
          setDecks([]);
          setCards({});
          setReviewLogs([]);
          setKnowledgeItems([]);
          setKnowledgeCategories([]);
      }
      return () => {
          if (unSubDecks) unSubDecks();
          if (unSubCards) unSubCards();
          if (unSubLogs) unSubLogs();
          if (unSubKnowledge) unSubKnowledge();
          if (unSubCategories) unSubCategories();
      };
  }, [user]);

  // Índice de aliases e backlinks derivados do Acervo + flashcards. Recalculados
  // só quando itens/cards mudam — O(n) e suficiente para milhares de registros.
  const aliasIndex = useMemo(() => buildAliasIndex(knowledgeItems), [knowledgeItems]);
  const backlinks = useMemo(() => computeBacklinks(cards, aliasIndex), [cards, aliasIndex]);

  const handleLogin = async () => {
      setIsLoggingIn(true);
      try {
          await loginWithGoogle();
      } catch (error) {
          setIsLoggingIn(false);
      }
  };


  const handleNavigate = (view: string, filter?: CardBrowserFilter, studyCardId?: string, studyCardIds?: string[]) => {
      setNavState({ view, filter, studyCardId, studyCardIds });
      if (view !== 'browser' || (filter && !filter.search)) {
          setGlobalSearch(""); // clear top search if not actively typing a search or leaving browser
      }
  };

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setGlobalSearch(val);
      if (val) {
          setNavState({ view: 'browser', filter: { search: val } });
      } else if (navState.view === 'browser' && navState.filter?.search) {
          // If they clear the search, stay on browser but clear filter
          setNavState({ view: 'browser', filter: { ...navState.filter, search: undefined } });
      }
  };

  const handleAddDeck = async (deck: Deck) => {
    if (user) {
        await saveDeckToDb(user.uid, deck);
        handleNavigate('decks');
    }
  };

  const getDeckDescendantIds = (parentId: string): string[] => {
      let ids: string[] = [];
      const children = decks.filter(d => d.parentId === parentId);
      for (const c of children) {
          ids.push(c.id);
          ids = ids.concat(getDeckDescendantIds(c.id));
      }
      return ids;
  };

  // Exclui em lote as matérias/tópicos informados, junto com seus subtópicos e flashcards.
  const handleDeleteDecks = async (deckIds: string[]) => {
      if (!user || deckIds.length === 0) return;

      const allDeckIds = new Set<string>();
      deckIds.forEach(id => {
          allDeckIds.add(id);
          getDeckDescendantIds(id).forEach(c => allDeckIds.add(c));
      });

      const cardIdsToDelete: string[] = [];
      allDeckIds.forEach(dId => {
          if (cards[dId]) cardIdsToDelete.push(...cards[dId].map(c => c.id));
      });

      await deleteDeckCascade(user.uid, Array.from(allDeckIds), cardIdsToDelete);
  };

  const handleDeleteDeck = async (deckId: string) => {
      await handleDeleteDecks([deckId]);
  };

  const handleSaveCard = async (updatedCard: Flashcard) => {
      if (user) {
          await updateCardInDb(user.uid, updatedCard);
      }
  };

  const handleLogReview = async (card: Flashcard, rating: any, oldState: string, newState: string) => {
      if (user) {
          const deck = decks.find(d => d.id === card.deckId);
          const parent = deck?.parentId ? decks.find(d => d.id === deck.parentId) : null;
          const deckName = parent ? `${parent.name} / ${deck?.name}` : (deck?.name || "Sem Matéria");
          
          const logEntry: ReviewLog = {
              id: uuidv4(),
              cardId: card.id,
              cardFront: card.front,
              deckId: card.deckId,
              deckName,
              rating,
              oldState: oldState as any,
              newState: newState as any,
              reviewedAt: new Date()
          };
          await saveReviewLogInDb(user.uid, logEntry);
      }
  };

  const handleDeleteCards = async (cardsToDelete: {id: string, deckId: string}[]) => {
      if (!user) return;
      await Promise.all(cardsToDelete.map(c => deleteCardFromDb(user.uid, c.id)));
  }

  // Normaliza o enunciado para comparar duplicatas (ignora o prefixo de "assunto sugerido").
  const normalizeFront = (s: string) =>
      s.replace(/^\*\*\[Assunto Sugerido pela IA:.*?\]\*\*\s*/s, '').trim().toLowerCase();

  // Constrói os Flashcards a partir de um array (vindo de importação), encaixa em tópicos
  // (criando o sub-deck automaticamente quando não existe), pula duplicatas e salva em lote.
  const buildAndSaveCards = async (
      deckId: string,
      aiCards: any[],
      opts: { skipDuplicates?: boolean; forceTopicNesting?: boolean } = {}
  ): Promise<{ added: number; skipped: number; topicsCreated: number }> => {
      if (!user) return { added: 0, skipped: 0, topicsCreated: 0 };

      const targetDeck = decks.find(d => d.id === deckId);
      // Cria sub-decks a partir do topicName quando o alvo é uma matéria-raiz OU
      // quando o chamador força o aninhamento (ex.: importar uma sub-matéria do
      // acervo dentro da pasta correta, preservando o assunto como subtópico).
      const isRoot = (targetDeck && !targetDeck.parentId) || opts.forceTopicNesting;

      const relevantDeckIds = [deckId, ...decks.filter(d => d.parentId === deckId).map(d => d.id)];
      const existingFronts = new Set<string>();
      relevantDeckIds.forEach(id => (cards[id] || []).forEach(c => existingFronts.add(normalizeFront(c.front))));

      const newDecks: Deck[] = []; // tópicos (sub-decks) criados neste import
      const newCards: Flashcard[] = [];
      let skipped = 0;

      for (const c of aiCards) {
          if (!c || typeof c.front !== 'string' || !c.front.trim() || typeof c.back !== 'string' || !c.back.trim()) {
              skipped++; continue; // item inválido
          }
          const key = normalizeFront(c.front);
          if (opts.skipDuplicates && existingFronts.has(key)) { skipped++; continue; }

          let finalDeckId = deckId;
          if (isRoot && c.topicName) {
              const topicStr = (String(c.topicName).trim() || 'Assuntos Gerais').slice(0, 100);
              // Procura um tópico semelhante: já existente OU criado neste mesmo lote.
              const existingSub =
                  decks.find(d => d.parentId === deckId && isSimilarTopic(d.name, topicStr, targetDeck?.name)) ??
                  newDecks.find(d => isSimilarTopic(d.name, topicStr, targetDeck?.name));
              if (existingSub) {
                  finalDeckId = existingSub.id;
              } else {
                  // Cria o tópico (sub-deck) automaticamente, um nível abaixo da matéria.
                  const novoTopico: Deck = { id: uuidv4(), parentId: deckId, name: topicStr, createdAt: new Date() };
                  newDecks.push(novoTopico);
                  finalDeckId = novoTopico.id;
              }
          }

          newCards.push({
              id: uuidv4(),
              deckId: finalDeckId,
              front: c.front,
              options: Array.isArray(c.options) ? c.options : undefined,
              back: c.back,
              correctOption: typeof c.correctOption === 'string' ? c.correctOption : undefined,
              fsrsData: createInitialFSRSData(),
              createdAt: new Date(),
          });
          existingFronts.add(key); // evita duplicar dentro do próprio lote
      }

      for (const d of newDecks) await saveDeckToDb(user.uid, d);
      if (newCards.length > 0) await saveCardsBatchToDb(user.uid, newCards);
      return { added: newCards.length, skipped, topicsCreated: newDecks.length };
  };

  const handleImportCards = async (deckId: string, aiCards: any[], opts: { forceTopicNesting?: boolean } = {}) => {
      try {
          const { added, skipped, topicsCreated } = await buildAndSaveCards(deckId, aiCards, { skipDuplicates: true, forceTopicNesting: opts.forceTopicNesting });
          const parts = [`${added} flashcards importados.`];
          if (topicsCreated > 0) parts.push(`${topicsCreated} tópico(s) criado(s).`);
          if (skipped > 0) parts.push(`${skipped} pulados (duplicados ou inválidos).`);
          setAlertInfo({ isOpen: true, title: "Importação concluída", message: parts.join(' ') });
      } catch (e: any) {
          setAlertInfo({ isOpen: true, title: "Erro na Importação", message: "Falha ao importar.\n\n" + (e?.message || '') });
      }
  };

  const handleClearAllData = async () => {
      if (!user) return;
      try {
          const { cards: nCards, logs: nLogs } = await clearAllCardsAndLogs(user.uid);
          setAlertInfo({
              isOpen: true,
              title: "Base limpa",
              message: `${nCards} flashcards e ${nLogs} registros de histórico foram apagados. As matérias e tópicos foram mantidos.`,
          });
      } catch (e: any) {
          setAlertInfo({ isOpen: true, title: "Erro ao limpar", message: "Falha ao limpar a base.\n\n" + (e?.message || '') });
      }
  };

  // ----- Acervo de Conhecimento -----
  const handleSaveKnowledgeItem = async (item: KnowledgeItem) => {
      if (user) await saveKnowledgeItemToDb(user.uid, item);
  };
  const handleUpdateKnowledgeItem = async (item: KnowledgeItem) => {
      if (user) await updateKnowledgeItemInDb(user.uid, item);
  };
  const handleDeleteKnowledgeItem = async (itemId: string) => {
      if (user) await deleteKnowledgeItemFromDb(user.uid, itemId);
  };
  const handleSaveKnowledgeCategory = async (cat: KnowledgeCategory) => {
      if (user) await saveKnowledgeCategoryToDb(user.uid, cat);
  };
  const handleUpdateKnowledgeCategory = async (cat: KnowledgeCategory) => {
      if (user) await updateKnowledgeCategoryInDb(user.uid, cat);
  };
  const handleDeleteKnowledgeCategory = async (catId: string) => {
      if (user) await deleteKnowledgeCategoryFromDb(user.uid, catId);
  };
  const handleOpenCardFromKnowledge = (cardId: string) => {
      setViewingKnowledgeId(null);
      handleNavigate('study', undefined, cardId);
  };

  if (authLoading) {
      return (
          <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
      );
  }

  if (!user) {
      const isIframe = window.self !== window.top;

      return (
          <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-md rotate-3">
                     <span className="text-white font-bold text-2xl">A</span>
                  </div>
                  <div>
                      <h1 className="text-2xl font-bold text-slate-800">AprovaCard</h1>
                      <p className="text-slate-500 mt-2 text-sm">Entre com o Google para salvar seus flashcards e revisões na nuvem para sempre, e nunca perder o progresso.</p>
                  </div>
                  
                  {isIframe ? (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded-xl text-sm text-left">
                          <p className="font-bold flex items-center mb-2">Acesso Bloqueado no Preview</p>
                          <p className="mb-4">Para fazer login com o Google (que utiliza pop-up), você precisa abrir o aplicativo em uma nova aba por segurança do navegador.</p>
                          <a href={window.location.href} target="_blank" rel="noreferrer" className="block w-full text-center bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 py-2.5 rounded-lg font-semibold transition">
                              Abrir em Nova Aba
                          </a>
                      </div>
                  ) : (
                      <button 
                          onClick={handleLogin}
                          disabled={isLoggingIn}
                          className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                      >
                         <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                         <span>{isLoggingIn ? "Conectando..." : "Continuar com o Google"}</span>
                      </button>
                  )}
              </div>
          </div>
      );
  }

  const viewingKnowledgeItem = viewingKnowledgeId ? knowledgeItems.find(i => i.id === viewingKnowledgeId) : null;

  return (
   <KnowledgeContext.Provider value={{ aliasIndex, onOpenKnowledge: setViewingKnowledgeId }}>
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-sans">
      <Sidebar
        currentView={navState.view} 
        onChangeView={(v) => handleNavigate(v)} 
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenReport={() => setReportModalOpen(true)}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
         {/* Global Top Bar */}
         <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 md:px-8 justify-between shrink-0 top-0 sticky z-20">
            <div className="flex items-center flex-1 mr-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu"
                className="mr-3 lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 focus:outline-none rounded-lg"
              >
                <Menu size={20} aria-hidden="true" />
              </button>
              <div className="relative w-full max-w-lg">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                      type="text" 
                      placeholder="Pesquisar..." 
                      className="pl-10 pr-4 py-2 w-full border border-slate-200 bg-slate-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                      value={globalSearch}
                      onChange={handleGlobalSearch}
                  />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <button 
                  onClick={logout} 
                  className="text-xs text-slate-500 hover:text-slate-800 transition"
                >
                  Sair
                </button>
                <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm" title={user.email || ""}>
                   {user.displayName ? user.displayName.charAt(0) : "U"}
                </div>
            </div>
         </header>

         {alertInfo.isOpen && (
             <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[999] backdrop-blur-sm">
                 <div
                     role="alertdialog"
                     aria-modal="true"
                     aria-labelledby="app-alert-title"
                     className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                 >
                     <div className="p-6 text-center whitespace-pre-wrap">
                         <h3 id="app-alert-title" className="text-lg font-bold text-slate-900 mb-2">{alertInfo.title || "Atenção"}</h3>
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

         <div className="flex-1 overflow-y-auto">
             {navState.view === 'dashboard' && <Dashboard cards={cards} decks={decks} logs={reviewLogs} onNavigate={handleNavigate} />}
             {navState.view === 'study' && <StudyView decks={decks} allCards={cards} onSaveCard={handleSaveCard} onLogReview={handleLogReview} targetCardId={navState.studyCardId} targetCardIds={navState.studyCardIds} onFinishStudy={() => handleNavigate('browser', navState.filter)} knowledgeItems={knowledgeItems} />}
             {navState.view === 'browser' && <CardBrowser cards={cards} decks={decks} onDeleteCards={handleDeleteCards} onEditCard={handleSaveCard} onStudyCard={(id) => handleNavigate('study', undefined, id)} onStudyCards={(ids) => handleNavigate('study', navState.filter, undefined, ids)} initialFilter={navState.filter} knowledgeItems={knowledgeItems} /> }
             {navState.view === 'acervo' && (
                 <KnowledgeBase
                   items={knowledgeItems}
                   categories={knowledgeCategories}
                   backlinks={backlinks}
                   onSaveItem={handleSaveKnowledgeItem}
                   onUpdateItem={handleUpdateKnowledgeItem}
                   onDeleteItem={handleDeleteKnowledgeItem}
                   onSaveCategory={handleSaveKnowledgeCategory}
                   onUpdateCategory={handleUpdateKnowledgeCategory}
                   onDeleteCategory={handleDeleteKnowledgeCategory}
                   onOpenCard={handleOpenCardFromKnowledge}
                 />
             )}
             {navState.view === 'decks' && <DeckManager decks={decks} cards={cards} onAddDeck={handleAddDeck} onDeleteDeck={handleDeleteDeck} onDeleteDecks={handleDeleteDecks} onImportCards={handleImportCards} onNavigate={handleNavigate} />}
             {navState.view === 'history' && <ReviewHistory logs={reviewLogs} />}
             {navState.view === 'updates' && <UpdatesView />}
             {navState.view === 'settings' && (
                 <SettingsView
                   cardCount={Object.values(cards).reduce((acc, arr) => acc + arr.length, 0)}
                   decks={decks}
                   cards={cards}
                   onClearAllData={handleClearAllData}
                 />
             )}
         </div>

         <ReportProblemModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />

         {viewingKnowledgeItem && (
             <KnowledgeViewerModal
                 item={viewingKnowledgeItem}
                 categories={knowledgeCategories}
                 allItems={knowledgeItems}
                 backlinks={backlinks.get(viewingKnowledgeItem.id) || []}
                 onClose={() => setViewingKnowledgeId(null)}
                 onOpenItem={(id) => setViewingKnowledgeId(id)}
                 onOpenCard={(cardId) => handleOpenCardFromKnowledge(cardId)}
             />
         )}
      </main>
    </div>
   </KnowledgeContext.Provider>
  );
}
