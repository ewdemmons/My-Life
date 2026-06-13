import { CalendarEvent, Person } from "@/types";
import { formatLocalDateYYYYMMDD } from "@/utils/masterListUtils";

export function birthdayToFullDate(birthday: string): string {
  if (!birthday) {
    return formatLocalDateYYYYMMDD(new Date());
  }
  const year = new Date().getFullYear();
  return `${year}-${birthday}`;
}

export function formatBirthdayDisplay(birthday: string): string {
  if (!birthday) return "Not set";
  const [month, day] = birthday.split("-").map(Number);
  const date = new Date(2000, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function getNextBirthdayDate(birthday: string): string {
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [month, day] = birthday.split("-").map(Number);
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  const nextYear = new Date(today.getFullYear() + 1, month - 1, day);
  return formatLocalDateYYYYMMDD(thisYear >= todayLocal ? thisYear : nextYear);
}

export function getBirthdayMinusSevenDays(birthday: string): string {
  const [y, m, d] = getNextBirthdayDate(birthday).split("-").map(Number);
  const nextBirthday = new Date(y, m - 1, d);
  nextBirthday.setDate(nextBirthday.getDate() - 7);
  let result = formatLocalDateYYYYMMDD(nextBirthday);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resultParts = result.split("-").map(Number);
  const resultDate = new Date(resultParts[0], resultParts[1] - 1, resultParts[2]);

  if (resultDate < today) {
    const nextYearBirthday = new Date(y + 1, m - 1, d);
    nextYearBirthday.setDate(nextYearBirthday.getDate() - 7);
    result = formatLocalDateYYYYMMDD(nextYearBirthday);
  }

  return result;
}

export function findBirthdayReminders(
  events: CalendarEvent[],
  personId: string,
): CalendarEvent[] {
  return events.filter(
    (e) =>
      e.linkedPersonId === personId &&
      e.eventType === "reminder" &&
      (e.title?.includes("'s Birthday") ||
        e.title?.startsWith("🎂") ||
        e.title?.startsWith("🎁")),
  );
}

export interface SyncBirthdayParams {
  person: Person;
  birthday: string | null;
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  deleteEventSeries: (seriesId: string) => Promise<void>;
}

export async function syncBirthdayReminders(params: SyncBirthdayParams): Promise<void> {
  try {
    const existingReminders = findBirthdayReminders(params.events, params.person.id);

    if (existingReminders.length > 0) {
      const seriesIds = [
        ...new Set(
          existingReminders.filter((e) => e.seriesId).map((e) => e.seriesId!),
        ),
      ];

      for (const sid of seriesIds) {
        await params.deleteEventSeries(sid);
      }

      const noSeries = existingReminders.filter((e) => !e.seriesId);
      for (const e of noSeries) {
        await params.deleteEvent(e.id);
      }
    }

    if (!params.birthday) {
      return;
    }

    const categoryId = params.person.categoryIds?.[0] ?? null;
    const birthdayDate = getNextBirthdayDate(params.birthday);
    const sevenDayDate = getBirthdayMinusSevenDays(params.birthday);

    console.log("[Birthday] Creating birthday reminder:", birthdayDate);
    await params.addEvent({
      title: `${params.person.name}'s Birthday`,
      description: `${params.person.name}'s birthday`,
      startDate: birthdayDate,
      endDate: birthdayDate,
      startTime: "10:00",
      endTime: "10:30",
      eventType: "reminder",
      recurrence: "yearly",
      linkedPersonId: params.person.id,
      linkedTaskId: null,
      categoryId,
    });

    console.log("[Birthday] Creating 7-day reminder:", sevenDayDate);
    await params.addEvent({
      title: `${params.person.name}'s Birthday - 7 Day Reminder`,
      description: `${params.person.name}'s birthday is in 7 days`,
      startDate: sevenDayDate,
      endDate: sevenDayDate,
      startTime: "10:00",
      endTime: "10:30",
      eventType: "reminder",
      recurrence: "yearly",
      linkedPersonId: params.person.id,
      linkedTaskId: null,
      categoryId,
    });
  } catch (error) {
    console.warn("syncBirthdayReminders error:", error);
  }
}
