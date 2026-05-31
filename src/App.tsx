import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { StudyView } from './components/StudyView';
import { DeckManager } from './components/DeckManager';
import { CardBrowser, CardBrowserFilter } from './components/CardBrowser';
import { Deck, Flashcard, ReviewLog } from './types';
import { v4 as uuidv4 } from "uuid";
import { createInitialFSRSData } from './lib/fsrs';
import { Search, LogIn, Loader2, Menu, X } from 'lucide-react';
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { subscribeToDecks, subscribeToCards, saveDeckToDb, saveCardToDb, updateCardInDb, deleteCardFromDb, updateDeckInDb, deleteDeckFromDb, subscribeToReviewLogs, saveReviewLogInDb } from './db';
import { isSimilarTopic } from './lib/topicUtils';
import { runDatabaseMigration } from './lib/migration';
import { ReviewHistory } from './components/ReviewHistory';
import { ReportProblemModal } from './components/ReportProblemModal';

import { MOCK_CARDS } from './store/mockData';

interface NavigationState {
  view: string;
  filter?: CardBrowserFilter;
  studyCardId?: string;
}

export default function App() {
  const [navState, setNavState] = useState<NavigationState>({ view: 'dashboard' });
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Record<string, Flashcard[]>>({});
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");

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
      if (user) {
          unSubDecks = subscribeToDecks(user.uid, setDecks);
          unSubCards = subscribeToCards(user.uid, setCards);
          unSubLogs = subscribeToReviewLogs(user.uid, setReviewLogs);
      } else {
          setDecks([]);
          setCards({});
          setReviewLogs([]);
      }
      return () => {
          if (unSubDecks) unSubDecks();
          if (unSubCards) unSubCards();
          if (unSubLogs) unSubLogs();
      };
  }, [user]);

  const handleLogin = async () => {
      setIsLoggingIn(true);
      try {
          await loginWithGoogle();
      } catch (error) {
          setIsLoggingIn(false);
      }
  };


  const handleNavigate = (view: string, filter?: CardBrowserFilter, studyCardId?: string) => {
      setNavState({ view, filter, studyCardId });
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

  const handleDeleteDeck = async (deckId: string) => {
      if (user) {
          await deleteDeckFromDb(user.uid, deckId);
      }
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

  const handleGenerateCards = async (deckId: string, subject: string, topicPrompt: string, count: number) => {
      try {
         setIsGenerating(true);
         
         // Collect existing fronts for the deck (this is a bit shallow if it's a root deck, 
         // since it only checks cards ON the root deck. Let's find all cards in root or its subs)
         const relevantDeckIds = [deckId, ...decks.filter(d => d.parentId === deckId).map(d => d.id)];
         const existingFronts: string[] = [];
         relevantDeckIds.forEach(id => {
             if (cards[id]) existingFronts.push(...cards[id].map(c => c.front));
         });

         const existingTopics = decks.filter(d => d.parentId === deckId).map(d => d.name);

         const res = await fetch("/api/generate-cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, topicPrompt, examBoard: "CEBRASPE/FGV", count, existingFronts, existingTopics })
         });
         
         if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || "Failed to generate");
         }

         const aiCards: any[] = await res.json();
         
         if (!user) return;

         const targetDeck = decks.find(d => d.id === deckId);
         const isRoot = targetDeck && !targetDeck.parentId;

         // Tópicos sugeridos pela IA que ainda não existem nesta matéria (nome -> qtd de cards).
         // Não criamos tópicos automaticamente: o usuário cria os tópicos/assuntos manualmente.
         const missingTopics = new Map<string, number>();

         for (const c of aiCards) {
             let finalDeckId = deckId;
             if (isRoot && c.topicName && c.topicName.trim()) {
                 const topicStr = c.topicName.trim();
                 const existingSub = decks.find(
                     d => d.parentId === deckId && isSimilarTopic(d.name, topicStr, targetDeck?.name)
                 );

                 if (existingSub) {
                     finalDeckId = existingSub.id;
                 } else {
                     // Sem tópico/assunto correspondente: mantém o card na própria matéria (raiz)
                     // para o usuário mover depois, e registra qual tópico a IA sugeriu.
                     finalDeckId = deckId;
                     missingTopics.set(topicStr, (missingTopics.get(topicStr) || 0) + 1);
                 }
             }

             const newFlashcard: Flashcard = {
                 id: uuidv4(),
                 deckId: finalDeckId,
                 front: c.front,
                 options: c.options,
                 back: c.back,
                 fsrsData: createInitialFSRSData(),
                 createdAt: new Date()
             };

             await saveCardToDb(user.uid, newFlashcard);
         }

         let successMsg = `${aiCards.length} flashcards gerados com sucesso!`;
         if (missingTopics.size > 0) {
             const unmatchedCount = Array.from(missingTopics.values()).reduce((a, b) => a + b, 0);
             const detalhes = Array.from(missingTopics.entries())
                 .map(([name, qtd]) => `• ${name} (${qtd} card${qtd > 1 ? 's' : ''})`)
                 .join('\n');
             successMsg += `\n\n${unmatchedCount} card${unmatchedCount > 1 ? 's foram inseridos' : ' foi inserido'} na matéria "${subject}" por não haver tópico/assunto correspondente. Crie ${missingTopics.size > 1 ? 'estes tópicos' : 'este tópico'} e mova ${unmatchedCount > 1 ? 'os cards' : 'o card'}:\n${detalhes}`;
         }
         setAlertInfo({isOpen: true, title: "Sucesso", message: successMsg});
      } catch (e: any) {
         setAlertInfo({isOpen: true, title: "Erro na Geração", message: "Erro ao gerar flashcards.\n\n" + e.message});
      } finally {
         setIsGenerating(false);
      }
  };

  const handleRunMigration = async () => {
    if (!user) return;
    setIsMigrating(true);
    setMigrationStatus("Iniciando migração...");
    try {
        const allCardsList = Object.values(cards).flat();
        await runDatabaseMigration(user.uid, decks, allCardsList, (msg) => {
            setMigrationStatus(prev => prev + '\n' + msg);
        });
        setAlertInfo({isOpen: true, title: "Migração Concluída", message: "A estrutura de tópicos e organização de cards foi finalizada!"});
    } catch (err: any) {
        setAlertInfo({isOpen: true, title: "Erro", message: "Erro na migração: " + err.message});
    } finally {
        setIsMigrating(false);
    }
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

  return (
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
                className="mr-3 lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 focus:outline-none rounded-lg"
              >
                <Menu size={20} />
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
                 <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                     <div className="p-6 text-center whitespace-pre-wrap">
                         <h3 className="text-lg font-bold text-slate-900 mb-2">{alertInfo.title || "Atenção"}</h3>
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
             {navState.view === 'dashboard' && <Dashboard cards={cards} decks={decks} onNavigate={handleNavigate} />}
             {navState.view === 'study' && <StudyView decks={decks} allCards={cards} onSaveCard={handleSaveCard} onLogReview={handleLogReview} targetCardId={navState.studyCardId} onFinishStudy={() => handleNavigate('browser', navState.filter)} />}
             {navState.view === 'browser' && <CardBrowser cards={cards} decks={decks} onDeleteCards={handleDeleteCards} onEditCard={handleSaveCard} onStudyCard={(id) => handleNavigate('study', undefined, id)} initialFilter={navState.filter} /> }
             {navState.view === 'decks' && <DeckManager decks={decks} cards={cards} onAddDeck={handleAddDeck} onDeleteDeck={handleDeleteDeck} onGenerateAI={handleGenerateCards} onNavigate={handleNavigate} />}
             {navState.view === 'history' && <ReviewHistory logs={reviewLogs} />}
             {navState.view === 'settings' && (
                 <div className="p-8 max-w-4xl mx-auto space-y-6">
                     <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-6">Configurações</h2>
                     <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Geração de Dados e Estudo</h3>
                        <p className="text-slate-600 text-sm">
                            A geração de cards utiliza as permissões do sistema.
                            O algoritmo de espaçamento está operando em simulação local FSRS.
                        </p>
                     </div>

                     <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Administração de Dados</h3>
                        <p className="text-slate-600 text-sm mb-4">
                            Você pode reconstruir a estrutura básica de tópicos solicitada (Dir. Administrativo, Dir. Constitucional, AFO) com um clique e reposicionar seus cards automaticamente.
                        </p>
                        <button 
                            onClick={handleRunMigration}
                            disabled={isMigrating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                        >
                            {isMigrating ? "Executando..." : "Reorganizar Tópicos (Migração BD)"}
                        </button>
                        {migrationStatus && (
                            <pre className="mt-4 p-4 bg-slate-100 rounded-lg text-xs text-slate-600 overflow-aut whitespace-pre-wrap">
                                {migrationStatus}
                            </pre>
                        )}
                     </div>
                 </div>
             )}
         </div>

         <ReportProblemModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
      </main>
    </div>
  );
}
