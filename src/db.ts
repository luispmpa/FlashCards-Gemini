import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Deck, Flashcard, ReviewLog } from './types';

export const saveCardsBatchToDb = async (userId: string, cards: Flashcard[]) => {
    try {
        const batch = writeBatch(db);
        cards.forEach(card => {
            const ref = doc(db, 'users', userId, 'cards', card.id);
            const { id, ...cardData } = card;
            const data: any = {
                ...cardData,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            if (data.options === undefined) delete data.options;
            if (data.correctOption === undefined) delete data.correctOption;
            if (data.fsrsData?.last_review === undefined) delete data.fsrsData.last_review;
            batch.set(ref, data);
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${userId}/cards (batch)`);
    }
};

export const deleteDeckCascade = async (userId: string, targetDeckIds: string[], targetCardIds: string[]) => {
    try {
        const batch = writeBatch(db);
        
        targetDeckIds.forEach(deckId => {
            const ref = doc(db, 'users', userId, 'decks', deckId);
            batch.delete(ref);
        });
        
        targetCardIds.forEach(cardId => {
            const ref = doc(db, 'users', userId, 'cards', cardId);
            batch.delete(ref);
        });
        
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}/decks (cascade)`);
    }
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const subscribeToDecks = (userId: string, callback: (decks: Deck[]) => void) => {
    const q = query(collection(db, 'users', userId, 'decks'));
    return onSnapshot(q, (snapshot) => {
        const decks: Deck[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            decks.push({
                id: doc.id,
                name: data.name || "",
                parentId: data.parentId,
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt ? data.updatedAt.toDate() : undefined
            } as Deck);
        });
        callback(decks);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/decks`);
    });
};

export const subscribeToCards = (userId: string, callback: (cards: Record<string, Flashcard[]>) => void) => {
    const q = query(collection(db, 'users', userId, 'cards'));
    return onSnapshot(q, (snapshot) => {
        const cardsRecord: Record<string, Flashcard[]> = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const card: Flashcard = {
                ...data,
                id: doc.id,
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt ? data.updatedAt.toDate() : undefined,
                fsrsData: {
                    ...data.fsrsData,
                    due: data.fsrsData.due ? data.fsrsData.due.toDate() : new Date(),
                    last_review: data.fsrsData.last_review ? data.fsrsData.last_review.toDate() : undefined
                }
            } as any;
            
            if (!cardsRecord[card.deckId]) {
                cardsRecord[card.deckId] = [];
            }
            cardsRecord[card.deckId].push(card);
        });
        callback(cardsRecord);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/cards`);
    });
};

/**
 * Incremental step towards #6: Isolates the reading of due cards for study sessions.
 * Currently uses the fetched `allCards` to not break existing UI, but prepares the API
 * for future direct Firestore querying using `getDocs` + `where`.
 */
export const getCardsForStudySession = (allCards: Record<string, Flashcard[]>, deckIds: string[], limitNew: number, limitDue: number, targetDate: Date): Flashcard[] => {
    const allEligible = deckIds.flatMap(id => allCards[id] || []);
    const newCards = allEligible.filter(c => c.fsrsData.state === "New");
    const dueCards = allEligible.filter(c => c.fsrsData.state !== "New" && c.fsrsData.due.getTime() <= targetDate.getTime());

    const limitedNew = newCards.slice(0, limitNew);
    const limitedDue = dueCards.slice(0, limitDue);
    
    return [...limitedDue, ...limitedNew];
};

export const saveDeckToDb = async (userId: string, deck: Deck) => {
    try {
        const ref = doc(db, 'users', userId, 'decks', deck.id);
        const { id, ...deckData } = deck;
        const data: any = {
            ...deckData,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        if (data.parentId === undefined) delete data.parentId;
        await setDoc(ref, data);
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${userId}/decks/${deck.id}`);
    }
};

export const updateDeckInDb = async (userId: string, deckId: string, updates: Partial<Deck>) => {
    try {
        const ref = doc(db, 'users', userId, 'decks', deckId);
        const { id, ...updateData } = updates as any;
        if (updateData.parentId === undefined) delete updateData.parentId;
        await updateDoc(ref, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/decks/${deckId}`);
    }
}

export const deleteDeckFromDb = async (userId: string, deckId: string) => {
    try {
        const ref = doc(db, 'users', userId, 'decks', deckId);
        await deleteDoc(ref);
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}/decks/${deckId}`);
    }
};

export const saveCardToDb = async (userId: string, card: Flashcard) => {
    try {
        const ref = doc(db, 'users', userId, 'cards', card.id);
        const { id, ...cardData } = card;
        const data: any = {
            ...cardData,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        if (data.options === undefined) delete data.options;
        if (data.fsrsData?.last_review === undefined) delete data.fsrsData.last_review;
        await setDoc(ref, data);
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${userId}/cards/${card.id}`);
    }
};

export const updateCardInDb = async (userId: string, card: Flashcard) => {
    try {
        const ref = doc(db, 'users', userId, 'cards', card.id);
        const { id, userId: _ui, ...updateData } = card as any;
        if (updateData.options === undefined) delete updateData.options;
        if (updateData.fsrsData?.last_review === undefined) delete updateData.fsrsData.last_review;
        await updateDoc(ref, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/cards/${card.id}`);
    }
};

export const deleteCardFromDb = async (userId: string, cardId: string) => {
    try {
        const ref = doc(db, 'users', userId, 'cards', cardId);
        await deleteDoc(ref);
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}/cards/${cardId}`);
    }
};

export const saveReviewLogInDb = async (userId: string, log: ReviewLog) => {
    try {
        const ref = doc(db, 'users', userId, 'reviewLogs', log.id);
        const { id, ...logData } = log;
        await setDoc(ref, {
            ...logData,
            userId,
            reviewedAt: serverTimestamp()
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${userId}/reviewLogs/${log.id}`);
    }
};

export const subscribeToReviewLogs = (userId: string, callback: (logs: ReviewLog[]) => void) => {
    const q = query(collection(db, 'users', userId, 'reviewLogs'), orderBy('reviewedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const logs: ReviewLog[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            logs.push({
                id: doc.id,
                cardId: data.cardId,
                cardFront: data.cardFront || "",
                deckId: data.deckId || "",
                deckName: data.deckName || "",
                rating: data.rating,
                oldState: data.oldState,
                newState: data.newState,
                reviewedAt: data.reviewedAt ? data.reviewedAt.toDate() : new Date()
            } as ReviewLog);
        });
        // Sort by reviewedAt descending
        logs.sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime());
        callback(logs);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/reviewLogs`);
    });
};
