import {
  CommandAction,
  ScheduleEventInput,
  CreateEntryInput,
} from "@/lib/commandService";
import { LifeCategory, TASK_TYPES } from "@/types";

export type BatchItemIcon = "calendar" | "file-text" | "check";
export type BatchSummaryKind = "scheduleEvent" | "createEntry" | "mixed";

export interface BatchItemResult {
  id: string;
  success: boolean;
  label: string;
  detail?: string;
  error?: string;
  undone?: boolean;
  canUndo?: boolean;
  icon?: BatchItemIcon;
}

export interface BatchExecutionResult {
  total: number;
  succeeded: number;
  failed: number;
  items: BatchItemResult[];
  categoryName?: string;
  actionLabel: string;
  summary: string;
  summaryKind?: BatchSummaryKind;
}

const MAX_BATCH_SIZE = 50;

export function getMaxBatchSize(): number {
  return MAX_BATCH_SIZE;
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

export function getBatchItemIcon(action: CommandAction): BatchItemIcon {
  if (action.type === "scheduleEvent") return "calendar";
  if (action.type === "createEntry") return "file-text";
  return "check";
}

export function getBatchItemDisplay(
  action: CommandAction,
  categories: LifeCategory[],
): { label: string; detail?: string } {
  switch (action.type) {
    case "scheduleEvent": {
      const input = action.input as ScheduleEventInput;
      return {
        label: input.title,
        detail: `${formatCommandDate(input.startDate)} at ${formatCommandTime(input.startTime)}`,
      };
    }
    case "createEntry": {
      const input = action.input as CreateEntryInput;
      const typeLabel =
        TASK_TYPES.find((t) => t.value === input.type)?.label ?? input.type;
      const categoryName =
        categories.find((c) => c.id === input.categoryId)?.name ?? "Unsorted";
      return {
        label: input.title,
        detail: `${typeLabel} in ${categoryName}`,
      };
    }
    default:
      return {
        label:
          "input" in action &&
          action.input &&
          typeof action.input === "object" &&
          "title" in action.input
            ? String((action.input as { title?: string }).title ?? "Item")
            : "Item",
      };
  }
}

export function inferBatchCategoryName(
  actions: CommandAction[],
  categories: LifeCategory[],
): string | undefined {
  for (const action of actions) {
    if (action.type === "scheduleEvent" && action.input.categoryId) {
      return categories.find((c) => c.id === action.input.categoryId)?.name;
    }
    if (action.type === "createEntry" && action.input.categoryId) {
      return categories.find((c) => c.id === action.input.categoryId)?.name;
    }
  }
  return undefined;
}

export function inferBatchActionLabel(actions: CommandAction[]): string {
  const types = new Set(actions.map((a) => a.type));
  if (types.size === 1 && types.has("scheduleEvent")) return "events";
  if (types.size === 1 && types.has("createEntry")) {
    const allResources = actions.every(
      (a) => a.type === "createEntry" && a.input.type === "resource",
    );
    return allResources ? "resources" : "entries";
  }
  return "items";
}

export function inferBatchSummaryKind(actions: CommandAction[]): BatchSummaryKind {
  const types = new Set(actions.map((a) => a.type));
  if (types.size === 1 && types.has("scheduleEvent")) return "scheduleEvent";
  if (types.size === 1 && types.has("createEntry")) return "createEntry";
  return "mixed";
}

export function buildBatchSummary(
  result: Pick<
    BatchExecutionResult,
    "succeeded" | "failed" | "total" | "actionLabel" | "categoryName" | "summaryKind"
  >,
): string {
  const { succeeded, failed, total, actionLabel, categoryName, summaryKind } =
    result;
  const areaSuffix = categoryName ? ` in ${categoryName}` : "";

  if (succeeded === 0) {
    return `Couldn't add any ${actionLabel}${areaSuffix} — please try again.`;
  }

  const successPhrase =
    summaryKind === "scheduleEvent"
      ? `Added ${succeeded} ${actionLabel} to your calendar${areaSuffix}.`
      : `Added ${succeeded} ${actionLabel}${areaSuffix}.`;

  if (failed === 0) {
    return successPhrase;
  }
  return `Added ${succeeded} of ${total} ${actionLabel}${areaSuffix} (${failed} failed).`;
}
