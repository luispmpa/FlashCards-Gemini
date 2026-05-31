import { ReviewLog } from '../types';
import { format, subDays, startOfDay } from 'date-fns';

export function calculateStreak(logs: ReviewLog[], now: Date = new Date()): number {
    if (!logs || logs.length === 0) return 0;
      
    const distinctDays = [...new Set(logs.map(log => format(new Date(log.reviewedAt), 'yyyy-MM-dd')))].sort().reverse();
    
    let currentStreak = 0;
    let checkDate = startOfDay(now);
    
    if (distinctDays[0] === format(checkDate, 'yyyy-MM-dd')) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
    } else if (distinctDays[0] === format(subDays(checkDate, 1), 'yyyy-MM-dd')) {
        // Started yesterday, acceptable to continue today
        checkDate = subDays(checkDate, 1);
    } else {
        return 0; // No activity today or yesterday
    }

    for (let i = currentStreak === 1 ? 1 : 0; i < distinctDays.length; i++) {
        if (distinctDays[i] === format(checkDate, 'yyyy-MM-dd')) {
            currentStreak++;
            checkDate = subDays(checkDate, 1);
        } else {
            break;
        }
    }
    return currentStreak;
}
