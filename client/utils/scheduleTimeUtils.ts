export function timeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function isEndAfterStart(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

export function formatTime12h(hhmm: string): string {
  const [hoursStr, minutesStr] = hhmm.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatDateMMDDYYYY(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${month}/${day}/${year}`;
}

export function formatEventDateTimeDisplay(startDate: string, startTime: string): string {
  return `${formatDateMMDDYYYY(startDate)} at ${formatTime12h(startTime)}`;
}

const LEGACY_EVENT_DATETIME_IN_BODY = /\d{4}-\d{2}-\d{2}\s+at\s+\d{1,2}:\d{2}/;

export function hasLegacyEventDateTimeInBody(body: string): boolean {
  return LEGACY_EVENT_DATETIME_IN_BODY.test(body);
}

export function getEventReminderNotificationBody(
  storedBody: string,
  event?: { startDate: string; startTime: string } | null,
): string {
  if (event) {
    const prefix = storedBody.startsWith("Updated:") ? "Updated: " : "Scheduled for ";
    return `${prefix}${formatEventDateTimeDisplay(event.startDate, event.startTime)}`;
  }

  const match = storedBody.match(/^(Scheduled for|Updated:)\s+(\d{4}-\d{2}-\d{2})\s+at\s+(\d{1,2}:\d{2})/);
  if (match) {
    const prefix = match[1] === "Updated:" ? "Updated: " : "Scheduled for ";
    return `${prefix}${formatEventDateTimeDisplay(match[2], match[3])}`;
  }

  return storedBody;
}

export function getTimeStringFromDate(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function dateFromTimeString(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEK_PREVIEW_DAYS: { index: number; label: string }[] = [
  { index: 0, label: "Sun" },
  { index: 1, label: "Mon" },
  { index: 2, label: "Tue" },
  { index: 3, label: "Wed" },
  { index: 4, label: "Thu" },
  { index: 5, label: "Fri" },
  { index: 6, label: "Sat" },
];

export const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
export const DEFAULT_START_TIME = "09:00";
export const DEFAULT_END_TIME = "17:00";
