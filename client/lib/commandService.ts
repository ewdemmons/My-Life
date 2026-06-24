import { COMMAND_TOOLS } from "@/lib/commandTools";
import { EventType, GoalFrequency, TaskType } from "@/types";
import { getLocalDateString } from "@/utils/planUtils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export interface CreateEntryInput {
  title: string;
  type: TaskType;
  categoryId?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  estimatedMinutes?: number;
  description?: string;
}

export interface ScheduleEventInput {
  title: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  eventType?: EventType;
  categoryId?: string;
  peopleIds?: string[];
}

export interface CreateHabitInput {
  title: string;
  frequency: GoalFrequency;
  categoryId?: string;
  targetValue?: number;
  unit?: string;
}

export interface LogHabitInput {
  habitId: string;
  value?: number;
  date?: string;
}

export interface PinEntryInput {
  taskId: string;
}

export interface CompleteEntryInput {
  taskId: string;
}

export interface CompleteEntryUntilInput {
  taskId: string;
  untilDate: string;
}

export interface UpdateEntryInput {
  taskId: string;
  title?: string;
  type?: TaskType;
  categoryId?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  description?: string;
}

export interface UpdateEventInput {
  eventId: string;
  title?: string;
  categoryId?: string;
  eventType?: EventType;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

export interface ClarificationInput {
  question: string;
  options?: string[];
}

export type ParseCommandResult =
  | { type: "createEntry"; input: CreateEntryInput }
  | { type: "scheduleEvent"; input: ScheduleEventInput }
  | { type: "createHabit"; input: CreateHabitInput }
  | { type: "logHabit"; input: LogHabitInput }
  | { type: "pinEntry"; input: PinEntryInput }
  | { type: "completeEntry"; input: CompleteEntryInput }
  | { type: "completeEntryUntil"; input: CompleteEntryUntilInput }
  | { type: "updateEntry"; input: UpdateEntryInput }
  | { type: "updateEvent"; input: UpdateEventInput }
  | { type: "clarification"; question: string; options?: string[] }
  | { type: "error"; message: string };

export interface CommandContext {
  categories: { id: string; name: string }[];
  people: { id: string; name: string }[];
  pendingTasks: { id: string; title: string; categoryName: string }[];
  habits: { id: string; title: string }[];
  recentEntities?: Array<{ id: string; kind: "task" | "event"; title: string }>;
}

function buildCommandSystemPrompt(
  context: {
    categories: { id: string; name: string }[];
    people: { id: string; name: string }[];
    pendingTasks: { id: string; title: string; categoryName: string }[];
    habits: { id: string; title: string }[];
    recentEntities?: Array<{ id: string; kind: "task" | "event"; title: string }>;
    todayDate: string;
  },
  options?: { allowConversation?: boolean },
): string {
  const terminalRule = options?.allowConversation
    ? "- If the message is conversational, a question, or seeking advice/coaching rather than a clear action request, respond with plain text instead of calling a tool."
    : "- Always call exactly one tool. Never respond with plain text only.";

  const recentEntitiesSection =
    context.recentEntities && context.recentEntities.length > 0
      ? `\nRecently created/mentioned in this conversation (use these IDs if the user refers to "that", "it", or the item by name without specifying further):\n${context.recentEntities.map((e) => `- ${e.kind} "${e.title}": ${e.id}`).join("\n")}\n`
      : "";

  return `You are a command parser for a personal life management app. Today's date is ${context.todayDate}.

Available Life Areas (match by name, use exact id):
${context.categories.map((c) => `- ${c.name}: ${c.id}`).join("\n")}

Available People (match by name, use exact id):
${context.people.map((p) => `- ${p.name}: ${p.id}`).join("\n")}

Existing pending tasks/entries (match by title, use exact id — if title alone matches more than one, use requestClarification and ask which Life Area):
${context.pendingTasks.map((t) => `- "${t.title}" (${t.categoryName}): ${t.id}`).join("\n")}

Existing habits (match by title, use exact id):
${context.habits.map((h) => `- "${h.title}": ${h.id}`).join("\n")}
${recentEntitiesSection}
Rules:
- If the command clearly maps to an action with all required information, call that tool directly. Do not ask for confirmation.
- Compute relative dates (tomorrow, next Tuesday, in 3 days) into exact ISO dates using today's date above.
- If a Life Area or person is mentioned but ambiguous or has no match, use requestClarification instead of guessing.
- If multiple people share a similar name, use requestClarification with their names as options.
- For logHabit, pinEntry, completeEntry, and completeEntryUntil, you MUST match against the lists above. Never invent an id.
- logHabit: value is the number of occurrence rows to create (count toward goal), not duration text. Always set date when the user mentions a specific calendar date; convert shorthand dates like '6/19' or 'June 19' to ISO YYYY-MM-DD using today's date and current year unless year is specified.
- completeEntryUntil vs completeEntry: phrases like 'complete until', 'done until', 'good until' → completeEntryUntil; permanent 'mark done/finished/completed' → completeEntry.
- If a task title matches multiple entries, use requestClarification and list the Life Area for each as the options (e.g. "Home version" vs "Work version") so the user can pick by Life Area.
- For createEntry: if the user does not explicitly state or clearly imply a Life Area, use requestClarification to ask which Life Area before creating it (e.g. "Should I add this in Home, or would you prefer a different Life Area?"). Do not guess a Life Area silently.
- For createEntry: if the user does not explicitly state or clearly imply an entry type (task, goal, idea, note, etc.), use requestClarification to ask (e.g. "Would you like this as a task, or another entry type?"). Default to "task" ONLY if the phrasing is genuinely just a to-do with no ambiguity (e.g. "add buy milk to my list" is clearly a task; "I want to start a business plan" is ambiguous between goal/project).
- For scheduleEvent: if the user does not explicitly state or clearly imply both a Life Area AND an event type (appointment/meeting/reminder/due_date), use requestClarification to ask about whichever is missing (e.g. "Would you like this as an appointment or another event type?" and/or "Which Life Area should this go in?"). You may ask about both in a single clarification if both are missing.
- Confirmation-worthy responses should always result in exactly one tool call — never explain your reasoning in plain text.
${terminalRule}`;
}

function mapToolUseToResult(toolUse: {
  name: string;
  input: unknown;
}): ParseCommandResult {
  if (toolUse.name === "requestClarification") {
    const input = toolUse.input as ClarificationInput;
    return {
      type: "clarification",
      question: input.question,
      options: input.options,
    };
  }

  if (toolUse.name === "createEntry") {
    return {
      type: "createEntry",
      input: toolUse.input as CreateEntryInput,
    };
  }

  if (toolUse.name === "scheduleEvent") {
    return {
      type: "scheduleEvent",
      input: toolUse.input as ScheduleEventInput,
    };
  }

  if (toolUse.name === "createHabit") {
    return {
      type: "createHabit",
      input: toolUse.input as CreateHabitInput,
    };
  }

  if (toolUse.name === "logHabit") {
    return {
      type: "logHabit",
      input: toolUse.input as LogHabitInput,
    };
  }

  if (toolUse.name === "pinEntry") {
    return {
      type: "pinEntry",
      input: toolUse.input as PinEntryInput,
    };
  }

  if (toolUse.name === "completeEntry") {
    return {
      type: "completeEntry",
      input: toolUse.input as CompleteEntryInput,
    };
  }

  if (toolUse.name === "completeEntryUntil") {
    return {
      type: "completeEntryUntil",
      input: toolUse.input as CompleteEntryUntilInput,
    };
  }

  if (toolUse.name === "updateEntry") {
    return {
      type: "updateEntry",
      input: toolUse.input as UpdateEntryInput,
    };
  }

  if (toolUse.name === "updateEvent") {
    return {
      type: "updateEvent",
      input: toolUse.input as UpdateEventInput,
    };
  }

  return {
    type: "error",
    message: "Could not understand that command.",
  };
}

export async function parseCommand(
  text: string,
  context: CommandContext,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<ParseCommandResult> {
  const todayDate = getLocalDateString();
  const systemPrompt = buildCommandSystemPrompt({ ...context, todayDate });

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      type: "error",
      message:
        "Anthropic API key is not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file.",
    };
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [...conversationHistory, { role: "user", content: text }],
        tools: COMMAND_TOOLS,
        tool_choice: { type: "any" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: "error",
        message: `Anthropic API error (${response.status}): ${errorText || response.statusText}`,
      };
    }

    const data = await response.json();
    const toolUse = data.content?.find(
      (block: { type: string }) => block.type === "tool_use",
    );

    if (!toolUse) {
      return {
        type: "error",
        message: "Could not understand that command.",
      };
    }

    return mapToolUseToResult(toolUse);
  } catch (error) {
    console.error("Command parse error:", error);
    return {
      type: "error",
      message: "Something went wrong. Please try again.",
    };
  }
}

export async function parseChatMessage(
  text: string,
  context: CommandContext,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<ParseCommandResult | { type: "conversation"; text: string }> {
  const todayDate = getLocalDateString();
  const systemPrompt = buildCommandSystemPrompt(
    { ...context, todayDate },
    { allowConversation: true },
  );

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      type: "error",
      message:
        "Anthropic API key is not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file.",
    };
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [...conversationHistory, { role: "user", content: text }],
        tools: COMMAND_TOOLS,
        tool_choice: { type: "auto" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: "error",
        message: `Anthropic API error (${response.status}): ${errorText || response.statusText}`,
      };
    }

    const data = await response.json();
    const contentBlocks: Array<{ type: string; text?: string; name?: string; input?: unknown }> =
      data.content ?? [];

    const toolUse = contentBlocks.find((block) => block.type === "tool_use");

    if (toolUse) {
      return mapToolUseToResult(toolUse as { name: string; input: unknown });
    }

    const textBlocks = contentBlocks
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text as string);

    if (textBlocks.length > 0) {
      return { type: "conversation", text: textBlocks.join("\n") };
    }

    return {
      type: "error",
      message: "Could not understand that command.",
    };
  } catch (error) {
    console.error("Command parse error:", error);
    return {
      type: "error",
      message: "Something went wrong. Please try again.",
    };
  }
}
