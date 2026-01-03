import { Occurrence, GoalFrequency } from "@/types";

export function calculateStreak(
  occurrences: Occurrence[],
  goalFrequency: GoalFrequency,
  goalCount: number
): { currentStreak: number; bestStreak: number } {
  if (occurrences.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const sortedOccurrences = [...occurrences].sort((a, b) => b.occurredAt - a.occurredAt);

  if (goalFrequency === "daily") {
    return calculateDailyStreak(sortedOccurrences, goalCount);
  } else if (goalFrequency === "weekly") {
    return calculateWeeklyStreak(sortedOccurrences, goalCount);
  } else {
    return calculateMonthlyStreak(sortedOccurrences, goalCount);
  }
}

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDailyStreak(
  occurrences: Occurrence[],
  goalCount: number
): { currentStreak: number; bestStreak: number } {
  const countsByDate: Map<string, number> = new Map();
  
  for (const occ of occurrences) {
    const date = occ.occurredDate;
    countsByDate.set(date, (countsByDate.get(date) || 0) + 1);
  }

  const today = new Date();
  const todayStr = getDateString(today);
  
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  
  const checkDate = new Date(today);
  const todayCount = countsByDate.get(todayStr) || 0;
  const startFromToday = todayCount >= goalCount;
  
  if (!startFromToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (true) {
    const dateStr = getDateString(checkDate);
    const count = countsByDate.get(dateStr) || 0;
    
    if (count >= goalCount) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    
    if (currentStreak > 365) break;
  }
  
  const allDates = Array.from(countsByDate.keys()).sort().reverse();
  tempStreak = 0;
  
  for (let i = 0; i < allDates.length; i++) {
    const dateStr = allDates[i];
    const count = countsByDate.get(dateStr) || 0;
    
    if (count >= goalCount) {
      tempStreak++;
      
      if (i < allDates.length - 1) {
        const currentDate = new Date(dateStr);
        const nextDate = new Date(allDates[i + 1]);
        const diffDays = Math.floor((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 0;
        }
      }
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  }
  
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);
  
  return { currentStreak, bestStreak };
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function calculateWeeklyStreak(
  occurrences: Occurrence[],
  goalCount: number
): { currentStreak: number; bestStreak: number } {
  const countsByWeek: Map<string, number> = new Map();
  
  for (const occ of occurrences) {
    const date = new Date(occ.occurredDate);
    const weekKey = getWeekKey(date);
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) || 0) + 1);
  }

  const today = new Date();
  const currentWeekKey = getWeekKey(today);
  
  let currentStreak = 0;
  let bestStreak = 0;
  
  const checkDate = new Date(today);
  const currentWeekCount = countsByWeek.get(currentWeekKey) || 0;
  const startFromCurrentWeek = currentWeekCount >= goalCount;
  
  if (!startFromCurrentWeek) {
    checkDate.setDate(checkDate.getDate() - 7);
  }
  
  while (true) {
    const weekKey = getWeekKey(checkDate);
    const count = countsByWeek.get(weekKey) || 0;
    
    if (count >= goalCount) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      break;
    }
    
    if (currentStreak > 52) break;
  }
  
  const allWeeks = Array.from(countsByWeek.keys()).sort().reverse();
  let tempStreak = 0;
  
  for (let i = 0; i < allWeeks.length; i++) {
    const weekKey = allWeeks[i];
    const count = countsByWeek.get(weekKey) || 0;
    
    if (count >= goalCount) {
      tempStreak++;
      
      if (i < allWeeks.length - 1) {
        const [year1, week1] = weekKey.split("-W").map((s, idx) => idx === 0 ? parseInt(s) : parseInt(s));
        const [year2, week2] = allWeeks[i + 1].split("-W").map((s, idx) => idx === 0 ? parseInt(s) : parseInt(s));
        
        const weeksDiff = (year1 - year2) * 52 + (week1 - week2);
        
        if (weeksDiff > 1) {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 0;
        }
      }
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  }
  
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);
  
  return { currentStreak, bestStreak };
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calculateMonthlyStreak(
  occurrences: Occurrence[],
  goalCount: number
): { currentStreak: number; bestStreak: number } {
  const countsByMonth: Map<string, number> = new Map();
  
  for (const occ of occurrences) {
    const date = new Date(occ.occurredDate);
    const monthKey = getMonthKey(date);
    countsByMonth.set(monthKey, (countsByMonth.get(monthKey) || 0) + 1);
  }

  const today = new Date();
  const currentMonthKey = getMonthKey(today);
  
  let currentStreak = 0;
  let bestStreak = 0;
  
  const checkDate = new Date(today);
  const currentMonthCount = countsByMonth.get(currentMonthKey) || 0;
  const startFromCurrentMonth = currentMonthCount >= goalCount;
  
  if (!startFromCurrentMonth) {
    checkDate.setMonth(checkDate.getMonth() - 1);
  }
  
  while (true) {
    const monthKey = getMonthKey(checkDate);
    const count = countsByMonth.get(monthKey) || 0;
    
    if (count >= goalCount) {
      currentStreak++;
      checkDate.setMonth(checkDate.getMonth() - 1);
    } else {
      break;
    }
    
    if (currentStreak > 24) break;
  }
  
  const allMonths = Array.from(countsByMonth.keys()).sort().reverse();
  let tempStreak = 0;
  
  for (let i = 0; i < allMonths.length; i++) {
    const monthKey = allMonths[i];
    const count = countsByMonth.get(monthKey) || 0;
    
    if (count >= goalCount) {
      tempStreak++;
      
      if (i < allMonths.length - 1) {
        const [year1, month1] = monthKey.split("-").map(Number);
        const [year2, month2] = allMonths[i + 1].split("-").map(Number);
        
        const monthsDiff = (year1 - year2) * 12 + (month1 - month2);
        
        if (monthsDiff > 1) {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 0;
        }
      }
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  }
  
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);
  
  return { currentStreak, bestStreak };
}

export function getLast7DaysStatus(
  occurrences: Occurrence[],
  goalCount: number
): { date: string; met: boolean; count: number }[] {
  const result: { date: string; met: boolean; count: number }[] = [];
  const today = new Date();
  
  const countsByDate: Map<string, number> = new Map();
  for (const occ of occurrences) {
    const date = occ.occurredDate;
    countsByDate.set(date, (countsByDate.get(date) || 0) + 1);
  }
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = getDateString(date);
    const count = countsByDate.get(dateStr) || 0;
    
    result.push({
      date: dateStr,
      met: count >= goalCount,
      count,
    });
  }
  
  return result;
}
