import { expect, test, describe } from 'vitest';
import { calculateStreak } from './streak';
import { ReviewLog } from '../types';

describe('calculateStreak', () => {
    const createLog = (dateStr: string): ReviewLog => ({
        id: 'mock-id',
        cardId: 'mock-card',
        cardFront: 'mock-front',
        deckId: 'mock-deck',
        deckName: 'mock-deck-name',
        rating: 'Good',
        reviewedAt: new Date(`${dateStr}T12:00:00Z`), // Midday UTC to avoid timezone oddities
        oldState: "New",
        newState: "Review"
    } as any); // Using 'as any' since state types are strings in Firestore logs but map to Enums internally in ts-fsrs

    const mockNow = new Date('2026-06-01T10:00:00Z'); // Represents "today"

    test('lista vazia retorna 0', () => {
        expect(calculateStreak([], mockNow)).toBe(0);
    });

    test('atividade só hoje = 1', () => {
        const logs = [createLog('2026-06-01')];
        expect(calculateStreak(logs, mockNow)).toBe(1);
    });

    test('hoje + ontem + anteontem = 3', () => {
        const logs = [
            createLog('2026-06-01'),
            createLog('2026-05-31'),
            createLog('2026-05-30'),
        ];
        expect(calculateStreak(logs, mockNow)).toBe(3);
    });

    test('hoje e depois um buraco = conta só o bloco recente', () => {
        const logs = [
            createLog('2026-06-01'), // Hoje
            // Buraco em 31/05
            createLog('2026-05-30'), // Anteontem
            createLog('2026-05-29'),
        ];
        expect(calculateStreak(logs, mockNow)).toBe(1);
    });

    test('atividade só ontem (nada hoje) = ainda conta', () => {
        const logs = [
            createLog('2026-05-31'),
            createLog('2026-05-30'),
        ];
        expect(calculateStreak(logs, mockNow)).toBe(2);
    });

    test('atividade parou anteontem (nada hoje nem ontem) = 0', () => {
        const logs = [
            createLog('2026-05-30'),
            createLog('2026-05-29'),
        ];
        expect(calculateStreak(logs, mockNow)).toBe(0);
    });

    test('dois reviews no mesmo dia contam como 1', () => {
        const logs = [
            createLog('2026-06-01'),
            createLog('2026-06-01'),
        ];
        expect(calculateStreak(logs, mockNow)).toBe(1);
    });
});
