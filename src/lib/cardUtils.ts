import { Flashcard } from '../types';

export function getCorrectIndex(card: Flashcard | null): number {
  if (!card || !card.options || !card.back) return -1;
  
  const letter = card.correctOption ?? card.back.match(/Gabarito:\s*([A-E])/i)?.[1];
  if (letter) {
    return letter.toUpperCase().charCodeAt(0) - 65;
  }
  
  return -1;
}
