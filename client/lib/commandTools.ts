import { EVENT_TYPES, GOAL_FREQUENCIES, TASK_TYPES } from "@/types";

const TASK_TYPE_VALUES = TASK_TYPES.map((t) => t.value);
const EVENT_TYPE_VALUES = EVENT_TYPES.map((t) => t.value);
const GOAL_FREQUENCY_VALUES = GOAL_FREQUENCIES.map((f) => f.value);

export const COMMAND_TOOLS = [
  {
    name: "createEntry",
    description:
      "Create a new entry (task, goal, idea, note, project, etc.) in the user's life management app. Use this when the user wants to add, create, or remember something to do.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: {
          type: "string",
          enum: TASK_TYPE_VALUES,
        },
        categoryId: {
          type: "string",
          description:
            "Life Area ID matched from the provided list. Omit if no clear match.",
        },
        dueDate: {
          type: "string",
          description:
            "ISO date YYYY-MM-DD. Compute from relative phrases like 'tomorrow' using the provided current date.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        estimatedMinutes: { type: "number" },
        description: { type: "string" },
      },
      required: ["title", "type"],
    },
  },
  {
    name: "scheduleEvent",
    description:
      "Schedule a calendar event, appointment, or meeting. Use this when the user wants to schedule, book, or set up a time-specific occurrence.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        startDate: {
          type: "string",
          description: "ISO date YYYY-MM-DD",
        },
        startTime: {
          type: "string",
          description: "HH:MM 24-hour format",
        },
        endDate: { type: "string" },
        endTime: { type: "string" },
        eventType: {
          type: "string",
          enum: EVENT_TYPE_VALUES,
        },
        categoryId: { type: "string" },
        peopleIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Person IDs matched from the provided people list, if mentioned by name.",
        },
      },
      required: ["title", "startDate", "startTime"],
    },
  },
  {
    name: "createHabit",
    description:
      "Create a new habit to track regularly. Use when the user wants to start tracking, build, or monitor a recurring behavior.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        frequency: {
          type: "string",
          enum: GOAL_FREQUENCY_VALUES,
        },
        categoryId: { type: "string" },
        targetValue: {
          type: "number",
          description: "Optional numeric target, e.g. 20 for '20 minutes'",
        },
        unit: {
          type: "string",
          description: "Optional unit, e.g. 'minutes', 'glasses', 'pages'",
        },
      },
      required: ["title", "frequency"],
    },
  },
  {
    name: "logHabit",
    description:
      "Log an EXISTING habit by creating occurrence rows toward its goal count. Each log is one occurrence row (like tapping the log button). Use when the user reports doing a habit they already track.",
    input_schema: {
      type: "object",
      properties: {
        habitId: {
          type: "string",
          description:
            "Exact habit ID matched from the provided habits list. Use requestClarification if no clear match.",
        },
        value: {
          type: "number",
          description:
            "Number of times to log (creates that many occurrence rows toward the daily/weekly/monthly goal). Default 1. E.g. 'log 5 times' or 'log 5 glasses' → value: 5. Do NOT store duration in notes.",
        },
        date: {
          type: "string",
          description:
            "ISO date YYYY-MM-DD for when the habit was done. REQUIRED whenever the user mentions a specific date (e.g. '6/19', 'June 19', 'yesterday'). Convert using today's date from the system prompt and current year unless year is specified. Omit only when logging for today with no date mentioned.",
        },
      },
      required: ["habitId"],
    },
  },
  {
    name: "pinEntry",
    description:
      "Pin an EXISTING entry to the Master List for quick access. Use when the user wants to pin, star, prioritize, or add an existing task/goal/entry to their master list. Also use for follow-up requests like 'pin that', 'add that to my master list', 'pin it', or 'put it on my master list' when the referent is clear from recent conversation context or the Recently created/mentioned entities list.",
    input_schema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description:
            "Exact task ID matched from the provided pending tasks list OR the Recently created/mentioned entities list for follow-up references. Use requestClarification if no clear match.",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "completeEntry",
    description:
      "Permanently mark an EXISTING entry as done/completed. Use when the user says they finished, completed, or did something already on their list. Do NOT use for 'complete until', 'done until', or temporary completion — use completeEntryUntil instead.",
    input_schema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description:
            "Exact task ID matched from the provided pending tasks list. Use requestClarification if no clear match or multiple matches.",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "completeEntryUntil",
    description:
      "Mark an EXISTING entry as complete until a future date, after which it will automatically reopen. Use when the user says 'complete until', 'done until', or wants to mark something complete but have it come back on a future date.",
    input_schema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description:
            "Exact task ID matched from the provided pending tasks list. Use requestClarification if no clear match or multiple matches.",
        },
        untilDate: {
          type: "string",
          description:
            "ISO date YYYY-MM-DD when the entry should reopen. Convert relative or shorthand dates (e.g. '6/21', 'next Monday') using the current date provided.",
        },
      },
      required: ["taskId", "untilDate"],
    },
  },
  {
    name: "updateEntry",
    description:
      "Modify an EXISTING entry's fields — change its Life Area, type, title, priority, due date, or description. Use when the user wants to edit, change, move, or correct something already created. Match against the provided pending tasks list.",
    input_schema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description:
            "Exact task ID matched from the provided pending tasks list. Use requestClarification if no clear match or multiple matches.",
        },
        title: { type: "string" },
        type: {
          type: "string",
          enum: TASK_TYPE_VALUES,
        },
        categoryId: { type: "string" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        dueDate: {
          type: "string",
          description: "ISO date YYYY-MM-DD",
        },
        description: { type: "string" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "updateEvent",
    description:
      "Modify an EXISTING calendar event's fields — change its Life Area, event type, time, date, or title. Use when the user wants to edit, change, move, or correct an event already scheduled. Match against recently created/mentioned events in conversation context.",
    input_schema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description:
            "Exact event ID. If not directly known from context, use requestClarification.",
        },
        title: { type: "string" },
        categoryId: { type: "string" },
        eventType: {
          type: "string",
          enum: EVENT_TYPE_VALUES,
        },
        startDate: { type: "string" },
        startTime: { type: "string" },
        endDate: { type: "string" },
        endTime: { type: "string" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "requestClarification",
    description:
      "Use this ONLY when the command is ambiguous, missing critical information, or could match multiple things (e.g. multiple people with the same name). Do not guess.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional tappable options if the ambiguity is a choice between known items",
        },
      },
      required: ["question"],
    },
  },
];
