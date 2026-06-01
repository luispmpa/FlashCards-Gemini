import { Flashcard } from '../types';
import { differenceInCalendarDays, format, addDays } from 'date-fns';

export interface ForecastDataPoint {
  date: string;
  count: number;
}

export function getDueForecast(cards: Flashcard[], days: number = 14, now: Date = new Date()): ForecastDataPoint[] {
  const counts = new Array(days).fill(0);
  
  for (const card of cards) {
    if (!card.fsrsData || card.fsrsData.state === "New") continue;
    
    const due = new Date(card.fsrsData.due);
    const diff = differenceInCalendarDays(due, now);
    
    if (diff <= 0) {
      // Overdue or due today
      counts[0]++;
    } else if (diff < days) {
      counts[diff]++;
    }
  }
  
  return counts.map((count, i) => {
    const d = addDays(now, i);
    return {
      date: format(d, 'dd/MM'),
      count
    };
  });
}
