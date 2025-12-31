import { CalendarEvent, RecurrenceType } from "@/types";

const MAX_OCCURRENCES = 52;
const MAX_YEARS_AHEAD = 2;

export function generateUUID(): string {
  const chars = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4";
    } else if (i === 19) {
      uuid += chars[(Math.random() * 4 | 8)];
    } else {
      uuid += chars[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextOccurrence(currentDate: Date, recurrence: RecurrenceType): Date {
  switch (recurrence) {
    case "daily":
      return addDays(currentDate, 1);
    case "weekly":
      return addDays(currentDate, 7);
    case "biweekly":
      return addDays(currentDate, 14);
    case "monthly":
      return addMonths(currentDate, 1);
    case "yearly":
      return addYears(currentDate, 1);
    default:
      return currentDate;
  }
}

export function generateRecurringInstances(
  baseEvent: Omit<CalendarEvent, "id" | "createdAt">,
  seriesId: string
): Omit<CalendarEvent, "id" | "createdAt">[] {
  if (baseEvent.recurrence === "none") {
    return [{ ...baseEvent, seriesId: null }];
  }

  const instances: Omit<CalendarEvent, "id" | "createdAt">[] = [];
  const startDate = new Date(baseEvent.startDate + "T12:00:00");
  const endDate = new Date(baseEvent.endDate + "T12:00:00");
  const dayDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const maxDate = addYears(new Date(), MAX_YEARS_AHEAD);
  let currentStartDate = new Date(startDate);
  let count = 0;

  while (count < MAX_OCCURRENCES && currentStartDate <= maxDate) {
    const currentEndDate = addDays(currentStartDate, dayDiff);
    
    instances.push({
      ...baseEvent,
      startDate: getDateString(currentStartDate),
      endDate: getDateString(currentEndDate),
      seriesId,
      isException: false,
      originalDate: getDateString(currentStartDate),
    });

    currentStartDate = getNextOccurrence(currentStartDate, baseEvent.recurrence);
    count++;
  }

  return instances;
}

export function getRecurrenceDescription(recurrence: RecurrenceType, startDate: string): string {
  if (recurrence === "none") return "";
  
  const date = new Date(startDate + "T12:00:00");
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[date.getDay()];
  const dayOfMonth = date.getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[date.getMonth()];

  switch (recurrence) {
    case "daily":
      return "Repeats every day";
    case "weekly":
      return `Repeats weekly on ${dayName}s`;
    case "biweekly":
      return `Repeats every 2 weeks on ${dayName}s`;
    case "monthly":
      return `Repeats monthly on day ${dayOfMonth}`;
    case "yearly":
      return `Repeats yearly on ${monthName} ${dayOfMonth}`;
    default:
      return "";
  }
}

export function isRecurringEvent(event: CalendarEvent): boolean {
  return !!event.seriesId && event.recurrence !== "none";
}
