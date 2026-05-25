/**
 * Keyword groups for auto-assigning Life Areas from user text.
 * Keys are normalized category name patterns; values are keywords to match in text.
 */
const KEYWORD_GROUPS: Record<string, string[]> = {
  health: [
    "gym", "workout", "exercise", "health", "doctor", "medical", "dentist", "therapy",
    "diet", "nutrition", "sleep", "fitness", "run", "yoga", "mental", "wellness",
  ],
  fitness: [
    "gym", "workout", "exercise", "health", "doctor", "medical", "dentist", "therapy",
    "diet", "nutrition", "sleep", "fitness", "run", "yoga", "mental", "wellness",
  ],
  work: [
    "work", "job", "meeting", "report", "project", "deadline", "boss", "client",
    "office", "career", "business", "presentation", "email", "colleague",
  ],
  career: [
    "work", "job", "meeting", "report", "project", "deadline", "boss", "client",
    "office", "career", "business", "presentation", "email", "colleague",
  ],
  family: [
    "family", "kids", "children", "parents", "mom", "dad", "spouse", "partner",
    "husband", "wife", "sister", "brother", "grandma", "grandpa", "school", "pickup",
  ],
  finance: [
    "money", "bank", "bills", "budget", "savings", "invest", "tax", "insurance",
    "rent", "mortgage", "salary", "expense", "finance", "debt", "credit",
  ],
  finances: [
    "money", "bank", "bills", "budget", "savings", "invest", "tax", "insurance",
    "rent", "mortgage", "salary", "expense", "finance", "debt", "credit",
  ],
  money: [
    "money", "bank", "bills", "budget", "savings", "invest", "tax", "insurance",
    "rent", "mortgage", "salary", "expense", "finance", "debt", "credit",
  ],
  home: [
    "home", "house", "clean", "repair", "maintenance", "garden", "groceries",
    "shopping", "chores", "landlord", "apartment",
  ],
  hobbies: [
    "hobby", "music", "art", "sport", "game", "travel", "book", "read", "cook",
    "photography", "creative", "learn", "course",
  ],
  relationships: [
    "friend", "date", "social", "party", "event", "relationship", "connect",
    "catch up", "coffee", "dinner",
  ],
  "personal growth": [
    "goal", "habit", "improve", "learn", "skill", "growth", "develop", "practice",
    "mindset", "journal",
  ],
  growth: [
    "goal", "habit", "improve", "learn", "skill", "growth", "develop", "practice",
    "mindset", "journal",
  ],
  education: [
    "learn", "course", "education", "study", "class", "school",
  ],
  learning: [
    "learn", "course", "education", "study", "class", "school",
  ],
};

function getKeywordsForCategoryName(categoryName: string): string[] {
  const normalized = categoryName.toLowerCase().trim();
  return KEYWORD_GROUPS[normalized] ?? [];
}

export type CategoryForAutoSelect = { id: string; name: string };

/**
 * Returns the best matching category id for the given text using keyword matching.
 * Matches the user's Life Area names (e.g. "Career") to keyword groups (e.g. Work keywords).
 * Falls back to the first category if no keyword matches.
 */
export function autoSelectLifeArea(
  text: string,
  categories: CategoryForAutoSelect[]
): string {
  if (!text.trim() || categories.length === 0) {
    return categories[0]?.id ?? "";
  }
  const lower = text.toLowerCase();
  let bestId = categories[0].id;
  let bestCount = 0;

  for (const cat of categories) {
    const keywords = getKeywordsForCategoryName(cat.name);
    const count = keywords.filter((kw) => lower.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      bestId = cat.id;
    }
  }
  return bestId;
}

/**
 * Feather icon name for Life Area name (Step 1).
 * Used when creating categories in onboarding.
 */
export const LIFE_AREA_ICON_MAP: Record<string, string> = {
  home: "home",
  family: "heart",
  health: "activity",
  work: "briefcase",
  career: "briefcase",
  finance: "dollar-sign",
  finances: "dollar-sign",
  money: "dollar-sign",
  hobbies: "star",
  fitness: "zap",
  relationships: "heart",
  "personal growth": "trending-up",
  growth: "trending-up",
  education: "book",
  learning: "book",
  spirituality: "sun",
  travel: "map",
  social: "coffee",
  pets: "feather",
};

export function getLifeAreaIcon(lifeAreaName: string): string {
  const normalized = lifeAreaName.toLowerCase().trim();
  return LIFE_AREA_ICON_MAP[normalized] ?? "circle";
}

/**
 * Entry type keyword groups for auto-select (Step 2 tasks).
 * Order matters: first match wins (more specific first).
 * Returns TaskType; "note" maps to "task" (no note type in schema).
 */
const ENTRY_TYPE_KEYWORDS: { type: "goal" | "objective" | "project" | "subtask" | "task" | "idea" | "list" | "resource"; keywords: string[] }[] = [
  { type: "goal", keywords: ["want to", "achieve", "someday", "dream", "aspire", "accomplish", "long term", "one day"] },
  { type: "objective", keywords: ["milestone", "checkpoint", "measure", "target", "track", "progress toward"] },
  { type: "project", keywords: ["launch", "build", "create", "develop", "campaign", "set up", "establish", "design", "produce"] },
  { type: "subtask", keywords: ["step", "action", "next", "first thing", "start by"] },
  { type: "task", keywords: ["note", "write", "remember", "memo", "jot", "record"] },
  { type: "idea", keywords: ["idea", "what if", "imagine", "concept", "thinking about", "brainstorm"] },
  { type: "list", keywords: ["list", "shopping", "packing", "groceries", "items", "collection"] },
  { type: "resource", keywords: ["link", "resource", "reference", "article", "website", "document", "file", "read"] },
];

export type TaskType =
  | "task"
  | "subtask"
  | "project"
  | "objective"
  | "goal"
  | "idea"
  | "list"
  | "item"
  | "resource"
  | "appointment";

/**
 * Returns the best matching entry type for the given text. Default: "task".
 */
export function autoSelectEntryType(text: string): TaskType {
  if (!text.trim()) return "task";
  const lower = text.toLowerCase();
  for (const { type, keywords } of ENTRY_TYPE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "task";
}

/** Label and emoji for display chip for each TaskType. */
export const ENTRY_TYPE_CHIP_LABELS: Record<TaskType, string> = {
  goal: "🎯 Goal",
  objective: "🎯 Objective",
  project: "📁 Project",
  subtask: "📋 Step",
  task: "📋 Task",
  idea: "💡 Idea",
  list: "📝 List",
  item: "📋 Item",
  resource: "🔗 Resource",
  appointment: "📅 Appointment",
};

/**
 * Event type keyword groups for auto-select (Step 3 events).
 * First match wins. Default: "appointment".
 */
const EVENT_TYPE_KEYWORDS: { type: "reminder" | "appointment" | "meeting" | "due_date"; keywords: string[] }[] = [
  { type: "reminder", keywords: ["remind", "forget", "check", "follow up", "pick up", "call back", "confirm", "pay", "renew", "review"] },
  { type: "meeting", keywords: ["meeting", "standup", "team", "group", "sync", "conference", "workshop", "webinar", "call with", "catch up", "huddle", "retrospective"] },
  { type: "due_date", keywords: ["due", "submit", "deadline", "deliver", "finish by", "hand in", "complete by", "launch", "release", "publish"] },
  { type: "appointment", keywords: ["doctor", "dentist", "appointment", "checkup", "interview", "lunch", "coffee", "visit", "session", "meet with", "haircut", "vet", "consultation"] },
];

export type EventType = "reminder" | "appointment" | "meeting" | "due_date";

/**
 * Returns the best matching event type for the given text. Default: "appointment".
 */
export function autoSelectEventType(text: string): EventType {
  if (!text.trim()) return "appointment";
  const lower = text.toLowerCase();
  for (const { type, keywords } of EVENT_TYPE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "appointment";
}

/** Label and emoji for display chip for each EventType. */
export const EVENT_TYPE_CHIP_LABELS: Record<EventType, string> = {
  reminder: "🔔 Reminder",
  appointment: "📅 Appointment",
  meeting: "👥 Meeting",
  due_date: "📅 Deadline",
};
