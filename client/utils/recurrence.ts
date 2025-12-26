import { CalendarEvent, RecurrenceType } from "@/types";

const MAX_OCCURRENCES = 100;
const MAX_YEARS_AHEAD = 2;

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
  const startDate = new Date(baseEvent.startDate);
  const endDate = new Date(baseEvent.endDate);
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
  
  const date = new Date(startDate);
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
