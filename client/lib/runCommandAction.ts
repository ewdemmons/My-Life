import {
  executeCompleteEntry,
  executeCompleteEntryUntil,
  executeCreateEntry,
  executeCreateHabit,
  executeLogHabit,
  executePinEntry,
  executeScheduleEvent,
  executeUpdateEntry,
  executeUpdateEvent,
  CommandExecutionResult,
} from "@/lib/commandExecutor";
import {
  CommandAction,
  CreateEntryInput,
} from "@/lib/commandService";
import type { CoachInsightCommand } from "@/types";
import type {
  CalendarEvent,
  Habit,
  LifeCategory,
  Task,
} from "@/types";

export interface CommandActionHelpers {
  categories: LifeCategory[];
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getEventsByDate: (date: string) => CalendarEvent[];
  addHabit: (habit: Omit<Habit, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addOccurrence: (occurrence: {
    itemId: string;
    itemType: "habit";
    occurredAt: number;
    occurredDate: string;
  }) => Promise<{ id: string } | null>;
  deleteOccurrence: (id: string) => Promise<void>;
  pinTask: (taskId: string) => Promise<void>;
  unpinTask: (taskId: string) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  applyCreateEntryDefaults?: (input: CreateEntryInput) => CreateEntryInput;
}

export async function runCommandAction(
  action: CommandAction,
  helpers: CommandActionHelpers,
): Promise<CommandExecutionResult> {
  const {
    categories,
    tasks,
    habits,
    events,
    addTask,
    deleteTask,
    addEvent,
    deleteEvent,
    getEventsByDate,
    addHabit,
    deleteHabit,
    addOccurrence,
    deleteOccurrence,
    pinTask,
    unpinTask,
    updateTask,
    updateEvent,
    applyCreateEntryDefaults,
  } = helpers;

  const wrapCreateEntry = (input: CreateEntryInput) =>
    applyCreateEntryDefaults ? applyCreateEntryDefaults(input) : input;

  switch (action.type) {
    case "createEntry":
      return executeCreateEntry(wrapCreateEntry(action.input), {
        addTask,
        deleteTask,
        categories,
      });
    case "scheduleEvent":
      return executeScheduleEvent(action.input, {
        addEvent,
        deleteEvent,
        getEventsByDate,
        categories,
      });
    case "createHabit":
      return executeCreateHabit(action.input, {
        addHabit,
        deleteHabit,
        getHabits: () => habits,
        categories,
      });
    case "logHabit":
      return executeLogHabit(action.input, {
        addOccurrence,
        deleteOccurrence,
        getHabitName: (id) => habits.find((h) => h.id === id)?.name ?? "habit",
      });
    case "pinEntry":
      return executePinEntry(action.input, {
        pinTask,
        unpinTask,
        getTaskTitle: (id) => tasks.find((t) => t.id === id)?.title ?? "entry",
      });
    case "completeEntry":
      return executeCompleteEntry(action.input, {
        updateTask,
        getTaskTitle: (id) => tasks.find((t) => t.id === id)?.title ?? "entry",
      });
    case "completeEntryUntil":
      return executeCompleteEntryUntil(action.input, {
        updateTask,
        getTask: (id) => tasks.find((t) => t.id === id),
        getEvents: () => events,
        addEvent,
        updateEvent,
        deleteEvent,
      });
    case "updateEntry":
      return executeUpdateEntry(action.input, {
        updateTask,
        getTask: (id) => tasks.find((t) => t.id === id),
        categories,
      });
    case "updateEvent":
      return executeUpdateEvent(action.input, {
        updateEvent,
        getEvent: (id) => events.find((e) => e.id === id),
        categories,
      });
    default:
      return {
        success: false,
        message: "",
        undo: null,
        error: "Unknown command type",
      };
  }
}

export function coachCommandToAction(
  command: CoachInsightCommand,
): CommandAction {
  return { type: command.type, input: command.input } as unknown as CommandAction;
}
