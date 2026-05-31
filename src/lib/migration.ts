import { Deck, Flashcard } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { saveDeckToDb, updateCardInDb, deleteDeckFromDb, updateDeckInDb } from '../db';
import { normalizeTopic } from './topicUtils';

const TARGET_STRUCTURE = [
  {
    name: "Direito Administrativo",
    subtopics: [
      "Princípios administrativos",
      "Atos administrativos",
      "Poderes administrativos",
      "Organização administrativa",
      "Agentes públicos",
      "Licitações e contratos (Lei 14.133)",
      "Responsabilidade civil do Estado",
      "Improbidade administrativa",
      "Serviços públicos",
      "Controle da Administração"
    ]
  },
  {
    name: "Direito Constitucional",
    subtopics: [
      "Princípios fundamentais",
      "Direitos e garantias fundamentais",
      "Organização do Estado",
      "Administração Pública",
      "Poder Legislativo",
      "Poder Executivo",
      "Poder Judiciário",
      "Controle de constitucionalidade",
      "Processo legislativo",
      "Poder constituinte"
    ]
  },
  {
    name: "AFO - Administração Financeira Orçamentária",
    subtopics: [
      "PPA",
      "LDO",
      "LOA",
      "Créditos adicionais",
      "Receita pública",
      "Despesa pública",
      "Restos a pagar",
      "LRF",
      "Ciclo orçamentário",
      "Execução orçamentária"
    ]
  }
];

// Helper for strict matching
const getKeywords = (str: string) => {
    const stopwords = new Set(['e', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'lei', '14133', 'estado', 'sobre', 'sob', 'com', 'por', 'na', 'no', 'em']);
    return normalizeTopic(str).split(' ').filter(w => w.length > 2 && !stopwords.has(w));
};

export const runDatabaseMigration = async (userId: string, stateDecks: Deck[], allCards: Flashcard[], onProgress: (msg: string) => void) => {
  onProgress("Sincronizando Estado com o Servidor...");

  const { collection, getDocs } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  
  const decksSnap = await getDocs(collection(db, 'users', userId, 'decks'));
  const serverDecks: Deck[] = [];
  decksSnap.forEach(doc => {
      const data = doc.data();
      serverDecks.push({
          id: doc.id,
          name: data.name || "",
          parentId: data.parentId,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : undefined
      } as Deck);
  });

  const validDeckIds = new Set<string>();
  const newDeckMapping: Record<string, string> = {}; 
  const parentNameToId: Record<string, string> = {};

  const getOrCreateAndUpdateName = async (deckName: string, parentId?: string): Promise<Deck> => {
    let exactMatch = serverDecks.find(d => d.name === deckName && d.parentId === parentId);
    if (!exactMatch) {
       exactMatch = serverDecks.find(d => d.name.trim().toLowerCase() === deckName.trim().toLowerCase() && d.parentId === parentId);
       if (exactMatch) {
           await updateDeckInDb(userId, exactMatch.id, { name: deckName });
           exactMatch.name = deckName;
       }
    }

    if (exactMatch) {
        validDeckIds.add(exactMatch.id);
        return exactMatch;
    }

    const newDeck: Deck = {
        id: uuidv4(),
        name: deckName,
        parentId,
        createdAt: new Date()
    };
    await saveDeckToDb(userId, newDeck);
    serverDecks.push(newDeck);
    validDeckIds.add(newDeck.id);
    onProgress(`+ Assunto: ${deckName}`);
    return newDeck;
  };

  for (const parentGroup of TARGET_STRUCTURE) {
    const parentDeck = await getOrCreateAndUpdateName(parentGroup.name, undefined);
    parentNameToId[parentGroup.name] = parentDeck.id;

    for (const subtopicName of parentGroup.subtopics) {
        const subdeck = await getOrCreateAndUpdateName(subtopicName, parentDeck.id);
        newDeckMapping[subtopicName.trim().toLowerCase()] = subdeck.id;
    }
  }

  onProgress("Organizando cards no banco de dados...");
  
  const flatSubtopics = TARGET_STRUCTURE.flatMap(p => p.subtopics);
  let movedCount = 0;

  for (const card of allCards) {
      if (!card.deckId) continue;
      
      const currentDeck = serverDecks.find(d => d.id === card.deckId);
      if (currentDeck && validDeckIds.has(currentDeck.id) && currentDeck.parentId) {
         continue; 
      }

      let bestMatchSubtopic = "";
      
      const findBestMatch = (text: string) => {
          if (!text) return "";
          const keywords = getKeywords(text);
          for (const sub of flatSubtopics) {
             const subKeywords = getKeywords(sub);
             const overlap = keywords.filter(k => subKeywords.includes(k)).length;
             
             if (overlap > 0 && overlap >= (subKeywords.length > 2 ? 2 : 1)) {
                 if (overlap === 1 && keywords.includes("administrativ") && subKeywords.includes("administrativ")) {
                     continue; 
                 }
                 return sub;
             }
          }

          for (const sub of flatSubtopics) {
             const subKeywords = getKeywords(sub);
             const overlap = keywords.filter(k => subKeywords.includes(k) && k.length >= 4).length;
             if (overlap > 0 && !keywords.includes("direito")) {
                 return sub;
             }
          }
          return "";
      };

      if (currentDeck) {
          bestMatchSubtopic = findBestMatch(currentDeck.name);
      }

      if (!bestMatchSubtopic && card.tags) {
         for (const tag of card.tags) {
             bestMatchSubtopic = findBestMatch(tag);
             if (bestMatchSubtopic) break;
         }
      }

      if (bestMatchSubtopic) {
          const newDeckId = newDeckMapping[bestMatchSubtopic.trim().toLowerCase()];
          if (newDeckId && card.deckId !== newDeckId) {
             await updateCardInDb(userId, { ...card, deckId: newDeckId });
             movedCount++;
          }
      } else {
          let parentRoot = "";
          if (currentDeck) {
              const kws = getKeywords(currentDeck.name);
              if (kws.some(k => k.includes("constitucion"))) parentRoot = "Direito Constitucional";
              else if (kws.some(k => k.includes("administrativ"))) parentRoot = "Direito Administrativo";
              else if (kws.some(k => k.includes("orcament") || k.includes("afo"))) parentRoot = "AFO - Administração Financeira Orçamentária";
          }
          
          if (parentRoot) {
              const rootId = parentNameToId[parentRoot];
              if (rootId && card.deckId !== rootId) {
                  await updateCardInDb(userId, { ...card, deckId: rootId });
                  movedCount++;
              }
          } else {
               let baseOutros = serverDecks.find(d => d.name === "Outros" && !d.parentId);
               if (!baseOutros) {
                   baseOutros = await getOrCreateAndUpdateName("Outros", undefined);
               } else {
                   validDeckIds.add(baseOutros.id);
               }
               if (card.deckId !== baseOutros.id) {
                   await updateCardInDb(userId, { ...card, deckId: baseOutros.id });
                   movedCount++;
               }
          }
      }
  }

  onProgress(`Foram organizados ${movedCount} cards.`);
  onProgress("Limpando a estrutura antiga (apagando pastas não listadas)...");
  
  let deletedCount = 0;
  for (const deck of serverDecks) {
      if (!validDeckIds.has(deck.id)) {
          await deleteDeckFromDb(userId, deck.id);
          deletedCount++;
      }
  }

  onProgress(`Limpeza concluída. Total de estruturas ativas: ${validDeckIds.size}`);
};
