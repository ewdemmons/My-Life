import type {
  CoachInsight,
  CoachInsightAction,
  CoachInsightCommandType,
  CoachInsightType,
} from "@/types";

const VALID_INSIGHT_TYPES = new Set<CoachInsightType>([
  "positive_trend",
  "gap_or_drop_off",
  "accountability_nudge",
  "sparse_area_prompt",
  "detail_planning_suggestion",
  "daily_planning_tie_in",
]);

const VALID_COMMAND_TYPES = new Set<CoachInsightCommandType>([
  "createEntry",
  "scheduleEvent",
  "createHabit",
  "logHabit",
  "pinEntry",
  "completeEntry",
]);

function stripInvalidCommand(
  action: CoachInsightAction,
  knownHabitIds: Set<string>,
  knownTaskIds: Set<string>,
): CoachInsightAction | undefined {
  if (action.actionType !== "command" || !action.command) return undefined;

  const { type, input } = action.command;
  if (!VALID_COMMAND_TYPES.has(type)) return undefined;

  if (type === "logHabit") {
    const habitId = String(input.habitId ?? "");
    if (!knownHabitIds.has(habitId)) return undefined;
  }

  if (type === "pinEntry" || type === "completeEntry") {
    const taskId = String(input.taskId ?? "");
    if (!knownTaskIds.has(taskId)) return undefined;
  }

  if (type === "createEntry" && input.title == null) return undefined;
  if (type === "scheduleEvent") {
    if (!input.title || !input.startDate || !input.startTime) return undefined;
  }
  if (type === "createHabit" && !input.title) return undefined;

  return action;
}

function sanitizeAction(
  raw: unknown,
  knownHabitIds: Set<string>,
  knownTaskIds: Set<string>,
): CoachInsightAction | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const actionType = a.actionType as string;
  const label = typeof a.label === "string" ? a.label.trim() : "";
  if (!label) return undefined;

  if (actionType === "navigate_chat") {
    const initialPrompt = typeof a.initialPrompt === "string" ? a.initialPrompt.trim() : "";
    if (!initialPrompt) return undefined;
    return {
      actionType: "navigate_chat",
      label,
      initialPrompt,
      openPlanningSession: a.openPlanningSession === true,
    };
  }

  if (actionType === "navigate_plan_generator") {
    return {
      actionType: "navigate_plan_generator",
      label,
      initialDate: typeof a.initialDate === "string" ? a.initialDate : undefined,
    };
  }

  if (actionType === "command" && a.command && typeof a.command === "object") {
    const cmd = a.command as Record<string, unknown>;
    const type = cmd.type as CoachInsightCommandType;
    const input = (cmd.input as Record<string, unknown>) ?? {};
    const validated = stripInvalidCommand(
      { actionType: "command", label, command: { type, input } },
      knownHabitIds,
      knownTaskIds,
    );
    return validated;
  }

  return undefined;
}

export function validateInsights(
  rawInsights: unknown[],
  knownHabitIds: Set<string>,
  knownTaskIds: Set<string>,
): CoachInsight[] {
  const results: CoachInsight[] = [];

  for (const raw of rawInsights.slice(0, 4)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const type = item.type as CoachInsightType;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!VALID_INSIGHT_TYPES.has(type) || !text) continue;

    const action = item.action
      ? sanitizeAction(item.action, knownHabitIds, knownTaskIds)
      : undefined;

    results.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      text,
      action,
      relatedEntryIds: Array.isArray(item.relatedEntryIds)
        ? item.relatedEntryIds.map(String).filter((id) => knownTaskIds.has(id))
        : undefined,
      relatedHabitIds: Array.isArray(item.relatedHabitIds)
        ? item.relatedHabitIds.map(String).filter((id) => knownHabitIds.has(id))
        : undefined,
    });
  }

  return results;
}
