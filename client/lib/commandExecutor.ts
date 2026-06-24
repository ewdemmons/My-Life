import {
  CreateEntryInput,
  ScheduleEventInput,
  CreateHabitInput,
  LogHabitInput,
  PinEntryInput,
  CompleteEntryInput,
  CompleteEntryUntilInput,
  UpdateEntryInput,
  UpdateEventInput,
} from "@/lib/commandService";
import { TASK_TYPES, EVENT_TYPES, LifeCategory, Habit, Task, CalendarEvent } from "@/types";
import { getLocalDateString } from "@/utils/planUtils";
import { syncCompleteUntilReminder } from "@/utils/completeUntilUtils";

export interface CommandExecutionResult {
  success: boolean;
  message: string;
  undo: (() => Promise<void>) | null;
  error?: string;
  trackedEntity?: { id: string; kind: "task" | "event"; title: string };
}

function addHourToTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const newHours = (hours + 1) % 24;
  return `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatCommandDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatCommandTime(time24h: string): string {
  const [hoursStr, minutes] = time24h.split(":");
  const hours = parseInt(hoursStr, 10);
  if (Number.isNaN(hours)) return time24h;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${suffix}`;
}

function findEventByPayload(
  getEventsByDate: (date: string) => CalendarEvent[],
  payload: { title: string; startTime: string; startDate: string },
): CalendarEvent | undefined {
  return getEventsByDate(payload.startDate)
    .filter((e) => e.title === payload.title && e.startTime === payload.startTime)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

function normalizeTimeTo24h(time: string): string {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) {
    const [hoursStr, minutesPart] = trimmed.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt((minutesPart || "00").replace(/\D/g, "").slice(0, 2), 10);
    if (Number.isNaN(hours)) return trimmed;
    return `${String(hours).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}`;
  }

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const suffix = match[3]?.toUpperCase();
  if (suffix === "PM" && hours < 12) hours += 12;
  if (suffix === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

export async function executeCreateEntry(
  input: CreateEntryInput,
  helpers: {
    addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Promise<Task | null>;
    deleteTask: (id: string) => Promise<void>;
    categories: LifeCategory[];
  },
): Promise<CommandExecutionResult> {
  const priority = input.priority ?? "medium";
  const isPinned = priority === "high";
  const excludeFromPlan = priority === "low";
  const finalCategoryId = input.categoryId ?? helpers.categories[0]?.id ?? "";

  try {
    const newTask = await helpers.addTask({
      title: input.title,
      type: input.type,
      categoryId: finalCategoryId,
      priority,
      isPinned,
      excludeFromPlan,
      description: input.description ?? "",
      parentId: null,
      status: "pending",
    });

    if (!newTask) {
      return { success: false, message: "", undo: null, error: "addTask returned null" };
    }

    const typeLabel =
      TASK_TYPES.find((t) => t.value === input.type)?.label ?? input.type;
    const categoryName =
      helpers.categories.find((c) => c.id === finalCategoryId)?.name ?? "Unsorted";

    const taskIdToUndo = newTask.id;

    return {
      success: true,
      message: `Created "${input.title}" as a ${typeLabel} in ${categoryName}. Want any changes?`,
      undo: async () => {
        await helpers.deleteTask(taskIdToUndo);
      },
      trackedEntity: { id: newTask.id, kind: "task", title: input.title },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeScheduleEvent(
  input: ScheduleEventInput,
  helpers: {
    addEvent: (event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
    getEventsByDate: (date: string) => CalendarEvent[];
    categories: LifeCategory[];
  },
): Promise<CommandExecutionResult> {
  const startDate = input.startDate;
  const normalizedStartTime = normalizeTimeTo24h(input.startTime);
  const normalizedEndTime = input.endTime
    ? normalizeTimeTo24h(input.endTime)
    : addHourToTime(normalizedStartTime);

  const eventPayload = {
    title: input.title,
    description: "",
    startDate,
    startTime: normalizedStartTime,
    endDate: input.endDate ?? startDate,
    endTime: normalizedEndTime,
    eventType: input.eventType ?? ("appointment" as const),
    recurrence: "none" as const,
    linkedTaskId: null,
    categoryId: input.categoryId ?? helpers.categories[0]?.id ?? null,
    attendeeIds: input.peopleIds ?? [],
  };

  try {
    await helpers.addEvent(eventPayload);

    const eventTypeLabel =
      EVENT_TYPES.find((t) => t.value === eventPayload.eventType)?.label ??
      eventPayload.eventType;
    const categoryName =
      helpers.categories.find((c) => c.id === eventPayload.categoryId)?.name ?? "Unsorted";

    const createdEvent = findEventByPayload(helpers.getEventsByDate, {
      title: eventPayload.title,
      startTime: eventPayload.startTime,
      startDate: eventPayload.startDate,
    });

    return {
      success: true,
      message: `Scheduled "${input.title}" as a ${eventTypeLabel} in ${categoryName} for ${formatCommandDate(startDate)} at ${formatCommandTime(normalizedStartTime)}. Want any changes?`,
      undo: async () => {
        const event = findEventByPayload(helpers.getEventsByDate, {
          title: eventPayload.title,
          startTime: eventPayload.startTime,
          startDate: eventPayload.startDate,
        });
        if (event) {
          await helpers.deleteEvent(event.id);
        }
      },
      trackedEntity: createdEvent
        ? { id: createdEvent.id, kind: "event", title: input.title }
        : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeCreateHabit(
  input: CreateHabitInput,
  helpers: {
    addHabit: (habit: Omit<Habit, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
    getHabits: () => Habit[];
    categories: LifeCategory[];
  },
): Promise<CommandExecutionResult> {
  const finalCategoryId = input.categoryId ?? helpers.categories[0]?.id ?? null;

  const habitPayload = {
    name: input.title,
    description: input.unit
      ? input.targetValue
        ? `${input.targetValue} ${input.unit}`
        : input.unit
      : undefined,
    habitType: "positive" as const,
    goalFrequency: input.frequency,
    goalCount: input.targetValue ?? 1,
    categoryId: finalCategoryId,
    linkedTaskId: null,
    isActive: true,
  };

  try {
    await helpers.addHabit(habitPayload);

    const habitTitle = input.title;
    const habitCategoryId = finalCategoryId;

    return {
      success: true,
      message: `Created habit "${input.title}". Want any changes?`,
      undo: async () => {
        const matches = helpers
          .getHabits()
          .filter(
            (h) => h.name === habitTitle && h.categoryId === habitCategoryId,
          )
          .sort((a, b) => b.createdAt - a.createdAt);
        const created = matches[0];
        if (created) {
          await helpers.deleteHabit(created.id);
        }
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeLogHabit(
  input: LogHabitInput,
  helpers: {
    addOccurrence: (occurrence: {
      itemId: string;
      itemType: "habit";
      occurredAt: number;
      occurredDate: string;
    }) => Promise<{ id: string } | null>;
    deleteOccurrence: (id: string) => Promise<void>;
    getHabitName: (habitId: string) => string;
  },
): Promise<CommandExecutionResult> {
  const count = input.value != null ? Math.max(1, Math.round(input.value)) : 1;
  const logDate = input.date ?? getLocalDateString();
  const isSpecificDate = Boolean(input.date);
  const baseTime = isSpecificDate
    ? new Date(logDate + "T12:00:00").getTime()
    : Date.now();

  try {
    const occurrenceIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const occurredAt = isSpecificDate
        ? baseTime + i * 60_000
        : baseTime + i * 1_000;
      const occ = await helpers.addOccurrence({
        itemId: input.habitId,
        itemType: "habit",
        occurredAt,
        occurredDate: logDate,
      });
      if (occ?.id) occurrenceIds.push(occ.id);
    }

    const habitName = helpers.getHabitName(input.habitId);
    const message = isSpecificDate
      ? `Logged ${count} for "${habitName}" on ${formatCommandDate(logDate)}`
      : count > 1
        ? `Logged ${count} for "${habitName}"`
        : `Logged today's "${habitName}" habit`;

    return {
      success: true,
      message,
      undo: async () => {
        for (const id of occurrenceIds) {
          await helpers.deleteOccurrence(id);
        }
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executePinEntry(
  input: PinEntryInput,
  helpers: {
    pinTask: (taskId: string) => Promise<void>;
    unpinTask: (taskId: string) => Promise<void>;
    getTaskTitle: (taskId: string) => string;
  },
): Promise<CommandExecutionResult> {
  const taskIdToUndo = input.taskId;

  try {
    await helpers.pinTask(input.taskId);

    return {
      success: true,
      message: `Pinned "${helpers.getTaskTitle(input.taskId)}" to your Master List`,
      undo: async () => {
        await helpers.unpinTask(taskIdToUndo);
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeCompleteEntry(
  input: CompleteEntryInput,
  helpers: {
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    getTaskTitle: (taskId: string) => string;
  },
): Promise<CommandExecutionResult> {
  const taskIdToUndo = input.taskId;
  const today = getLocalDateString();

  try {
    await helpers.updateTask(input.taskId, {
      status: "completed",
      completionType: "as_of",
      completionDate: today,
    });

    return {
      success: true,
      message: `Marked "${helpers.getTaskTitle(input.taskId)}" as complete`,
      undo: async () => {
        await helpers.updateTask(taskIdToUndo, {
          status: "pending",
          completionType: null,
          completionDate: undefined,
        });
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeCompleteEntryUntil(
  input: CompleteEntryUntilInput,
  helpers: {
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    getTask: (taskId: string) => Task | undefined;
    getEvents: () => CalendarEvent[];
    addEvent: (event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
  },
): Promise<CommandExecutionResult> {
  const taskIdToUndo = input.taskId;
  const taskSnapshot = helpers.getTask(input.taskId);
  const untilDate = input.untilDate;

  try {
    await helpers.updateTask(input.taskId, {
      completionType: "until",
      completionDate: untilDate,
      status: "pending",
    });

    if (taskSnapshot) {
      await syncCompleteUntilReminder({
        task: taskSnapshot,
        completeUntilDate: untilDate,
        events: helpers.getEvents(),
        addEvent: helpers.addEvent,
        updateEvent: helpers.updateEvent,
        deleteEvent: helpers.deleteEvent,
      });
    }

    const taskTitle = taskSnapshot?.title ?? "entry";

    return {
      success: true,
      message: `Marked "${taskTitle}" complete until ${formatCommandDate(untilDate)}`,
      undo: async () => {
        await helpers.updateTask(taskIdToUndo, {
          status: "pending",
          completionType: null,
          completionDate: undefined,
        });
        if (taskSnapshot) {
          await syncCompleteUntilReminder({
            task: taskSnapshot,
            completeUntilDate: null,
            events: helpers.getEvents(),
            addEvent: helpers.addEvent,
            updateEvent: helpers.updateEvent,
            deleteEvent: helpers.deleteEvent,
          });
        }
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeUpdateEntry(
  input: UpdateEntryInput,
  helpers: {
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    getTask: (taskId: string) => Task | undefined;
    categories: LifeCategory[];
  },
): Promise<CommandExecutionResult> {
  const task = helpers.getTask(input.taskId);
  if (!task) {
    return { success: false, message: "", undo: null, error: "Task not found" };
  }

  const updates: Partial<Task> = {};
  const changes: string[] = [];

  if (input.title !== undefined && input.title !== task.title) {
    updates.title = input.title;
    changes.push(`renamed to "${input.title}"`);
  }
  if (input.type !== undefined && input.type !== task.type) {
    updates.type = input.type;
    const typeLabel =
      TASK_TYPES.find((t) => t.value === input.type)?.label ?? input.type;
    changes.push(`changed to ${typeLabel}`);
  }
  if (input.categoryId !== undefined && input.categoryId !== task.categoryId) {
    updates.categoryId = input.categoryId;
    const categoryName =
      helpers.categories.find((c) => c.id === input.categoryId)?.name ?? "Unsorted";
    changes.push(`moved to ${categoryName}`);
  }
  if (input.priority !== undefined && input.priority !== task.priority) {
    updates.priority = input.priority;
    updates.isPinned = input.priority === "high";
    updates.excludeFromPlan = input.priority === "low";
    changes.push(`priority set to ${input.priority}`);
  }
  if (input.dueDate !== undefined && input.dueDate !== task.deadline) {
    updates.deadline = input.dueDate;
    changes.push(`deadline set to ${formatCommandDate(input.dueDate)}`);
  }
  if (input.description !== undefined && input.description !== task.description) {
    updates.description = input.description;
    changes.push("description updated");
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: "", undo: null, error: "No fields to update" };
  }

  try {
    await helpers.updateTask(input.taskId, updates);
    const displayTitle = updates.title ?? task.title;
    return {
      success: true,
      message: `Updated "${displayTitle}" — ${changes.join(", ")}`,
      undo: null,
      trackedEntity: { id: input.taskId, kind: "task", title: displayTitle },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeUpdateEvent(
  input: UpdateEventInput,
  helpers: {
    updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
    getEvent: (eventId: string) => CalendarEvent | undefined;
    categories: LifeCategory[];
  },
): Promise<CommandExecutionResult> {
  const event = helpers.getEvent(input.eventId);
  if (!event) {
    return { success: false, message: "", undo: null, error: "Event not found" };
  }

  const updates: Partial<CalendarEvent> = {};
  const changes: string[] = [];

  if (input.title !== undefined && input.title !== event.title) {
    updates.title = input.title;
    changes.push(`renamed to "${input.title}"`);
  }
  if (input.categoryId !== undefined && input.categoryId !== event.categoryId) {
    updates.categoryId = input.categoryId;
    const categoryName =
      helpers.categories.find((c) => c.id === input.categoryId)?.name ?? "Unsorted";
    changes.push(`moved to ${categoryName}`);
  }
  if (input.eventType !== undefined && input.eventType !== event.eventType) {
    updates.eventType = input.eventType;
    const eventTypeLabel =
      EVENT_TYPES.find((t) => t.value === input.eventType)?.label ?? input.eventType;
    changes.push(`changed to ${eventTypeLabel}`);
  }
  if (input.startDate !== undefined && input.startDate !== event.startDate) {
    updates.startDate = input.startDate;
    changes.push(`date set to ${formatCommandDate(input.startDate)}`);
  }
  if (input.startTime !== undefined) {
    const normalized = normalizeTimeTo24h(input.startTime);
    if (normalized !== event.startTime) {
      updates.startTime = normalized;
      changes.push(`time set to ${formatCommandTime(normalized)}`);
    }
  }
  if (input.endDate !== undefined && input.endDate !== event.endDate) {
    updates.endDate = input.endDate;
    changes.push(`end date set to ${formatCommandDate(input.endDate)}`);
  }
  if (input.endTime !== undefined) {
    const normalized = normalizeTimeTo24h(input.endTime);
    if (normalized !== event.endTime) {
      updates.endTime = normalized;
      changes.push(`end time set to ${formatCommandTime(normalized)}`);
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: "", undo: null, error: "No fields to update" };
  }

  try {
    await helpers.updateEvent(input.eventId, updates);
    const displayTitle = updates.title ?? event.title;
    return {
      success: true,
      message: `Updated "${displayTitle}" — ${changes.join(", ")}`,
      undo: null,
      trackedEntity: { id: input.eventId, kind: "event", title: displayTitle },
    };
  } catch (error) {
    return {
      success: false,
      message: "",
      undo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
