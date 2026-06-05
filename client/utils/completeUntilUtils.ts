import { Task, CalendarEvent } from "@/types";
import { getLocalDateString } from "@/utils/planUtils";

export const COMPLETE_UNTIL_REMINDER_PREFIX = "↩ ";

type EventMutator = {
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt">) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
};

export function findCompleteUntilReminder(
  events: CalendarEvent[],
  taskId: string,
): CalendarEvent | null {
  return (
    events.find(
      (e) =>
        e.linkedTaskId === taskId &&
        e.eventType === "reminder" &&
        e.title?.startsWith(COMPLETE_UNTIL_REMINDER_PREFIX),
    ) ?? null
  );
}

export async function syncCompleteUntilReminder(params: {
  task: Task;
  completeUntilDate: string | null;
  events: CalendarEvent[];
  addEvent: EventMutator["addEvent"];
  updateEvent: EventMutator["updateEvent"];
  deleteEvent: EventMutator["deleteEvent"];
}): Promise<void> {
  const { task, completeUntilDate, events, addEvent, deleteEvent } = params;

  const existingReminder = findCompleteUntilReminder(events, task.id);

  if (!completeUntilDate) {
    if (existingReminder) {
      await deleteEvent(existingReminder.id);
    }
    return;
  }

  const reminderData: Omit<CalendarEvent, "id" | "createdAt"> = {
    title: `${COMPLETE_UNTIL_REMINDER_PREFIX}${task.title}`,
    description: "This entry is due to reopen today",
    startDate: completeUntilDate,
    endDate: completeUntilDate,
    startTime: "12:00",
    endTime: "12:30",
    eventType: "reminder",
    recurrence: "none",
    categoryId: task.categoryId,
    linkedTaskId: task.id,
  };

  if (existingReminder) {
    if (existingReminder.startDate !== completeUntilDate) {
      await deleteEvent(existingReminder.id);
      await addEvent(reminderData);
    }
    return;
  }

  await addEvent(reminderData);
}

export function getCompleteUntilDateFromTask(task: Task): string | null {
  if (task.completionType !== "until" || !task.completionDate) {
    return null;
  }
  return task.completionDate;
}

export function isCompleteUntilDueForReopen(task: Task, today: string = getLocalDateString()): boolean {
  const untilDate = getCompleteUntilDateFromTask(task);
  if (!untilDate) {
    return false;
  }
  return untilDate <= today;
}

export function isCompleteUntilExpired(task: Task): boolean {
  return isCompleteUntilDueForReopen(task);
}

const reopenProcessingIds = new Set<string>();

type UpdateTaskFn = (id: string, updates: Partial<Task>) => Promise<void>;

export async function checkAndReopenCompleteUntilEntries(params: {
  tasks: Task[];
  updateTask: UpdateTaskFn;
  events?: CalendarEvent[];
  addEvent?: EventMutator["addEvent"];
  updateEvent?: EventMutator["updateEvent"];
  deleteEvent?: EventMutator["deleteEvent"];
}): Promise<{ reopenedCount: number; reopenedTitles: string[] }> {
  const { tasks, updateTask, events, addEvent, updateEvent, deleteEvent } = params;

  if (tasks.length === 0) {
    return { reopenedCount: 0, reopenedTitles: [] };
  }

  const today = getLocalDateString();
  const dueTasks = tasks.filter(
    (task) => isCompleteUntilDueForReopen(task, today) && !reopenProcessingIds.has(task.id),
  );

  if (dueTasks.length === 0) {
    return { reopenedCount: 0, reopenedTitles: [] };
  }

  const reopenedTitles: string[] = [];
  let nextPinOrder = Math.max(0, ...tasks.filter((t) => t.isPinned).map((t) => t.pinnedOrder || 0));
  const canSyncReminders = Boolean(events && addEvent && updateEvent && deleteEvent);

  for (const task of dueTasks) {
    reopenProcessingIds.add(task.id);
    try {
      const updates: Partial<Task> = {
        status: "pending",
        completionType: null,
        completionDate: undefined,
      };

      if (!task.isPinned) {
        nextPinOrder += 1;
        updates.isPinned = true;
        updates.pinnedOrder = nextPinOrder;
      }

      await updateTask(task.id, updates);

      if (canSyncReminders) {
        await syncCompleteUntilReminder({
          task,
          completeUntilDate: null,
          events: events!,
          addEvent: addEvent!,
          updateEvent: updateEvent!,
          deleteEvent: deleteEvent!,
        });
      }

      reopenedTitles.push(task.title);
    } catch (error) {
      console.warn(`Failed to reopen Complete Until entry "${task.title}":`, error);
    } finally {
      reopenProcessingIds.delete(task.id);
    }
  }

  return { reopenedCount: reopenedTitles.length, reopenedTitles };
}

export function formatCompleteUntilReopenMessage(
  reopenedCount: number,
  reopenedTitles: string[],
): string | null {
  if (reopenedCount === 0) {
    return null;
  }
  if (reopenedCount === 1) {
    return `↩ '${reopenedTitles[0]}' is back on your Master List`;
  }
  return `↩ ${reopenedCount} entries returned to your Master List`;
}
