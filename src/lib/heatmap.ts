import { ReviewLog } from '../types';
import { format, subDays, startOfDay } from 'date-fns';

export interface HeatmapDay {
  dateStr: string; // "yyyy-MM-dd"
  count: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  label: string;
}

export function getActivityByDay(logs: ReviewLog[], rangeDays: number = 112, now: Date = new Date()): HeatmapDay[] {
  const result: HeatmapDay[] = [];
  const startOfNow = startOfDay(now);
  
  const countMap: Record<string, number> = {};
  
  for (const log of logs) {
    if (!log.reviewedAt) continue;
    const dStr = format(new Date(log.reviewedAt), 'yyyy-MM-dd');
    countMap[dStr] = (countMap[dStr] || 0) + 1;
  }
  
  // Create days from (now - rangeDays + 1) to today
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = subDays(startOfNow, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const count = countMap[dateStr] || 0;
    const dayOfWeek = d.getDay();
    const label = `${format(d, 'dd/MM/yyyy')}: ${count} ${count === 1 ? 'revisão' : 'revisões'}`;
    
    result.push({
      dateStr,
      count,
      dayOfWeek,
      label
    });
  }
  
  return result;
}
