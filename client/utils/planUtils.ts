import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CalendarEvent,
  Habit,
  LifeAreaInsightsCache,
  LifeAreaProfile,
  LifeCategory,
  Task,
} from "@/types";

export interface PlanTimeBlock {
  time: string;
  title: string;
  type: "event" | "entry" | "habit" | "suggestion";
  lifeArea: string;
  source: "scheduled" | "pinned" | "habit" | "suggested" | "coach";
  durationMinutes: number;
  id: string | null;
  completed: boolean;
  agendaOnly?: boolean;
  description?: string;
  isPlanTomorrow?: boolean;
}

export interface DailyPlanMeta {
  approved: boolean;
  generatedAt: number;
  date: string;
  itemCount: number;
  completedCount: number;
  timeBlocks: PlanTimeBlock[];
}

const ACTIVE_PLANS_KEY = "@active_plans";
const MAX_ACTIVE_PLANS = 3;
const PLAN_LIMIT_ERROR = "3-plan limit reached";

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPlanStorageKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return getPlanStorageKeyForDate(`${year}-${month}-${day}`);
}

export function getPlanStorageKeyForDate(dateStr: string): string {
  return `@plan_meta_${dateStr}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [hoursStr, minutesStr] = time.split(":");
  const total = parseInt(hoursStr, 10) * 60 + parseInt(minutesStr, 10) + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function parseDailyPlanFromResponse(content: string): DailyPlanMeta | null {
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\{[\s\S]*"dailyPlan"[\s\S]*\})/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[1].trim());
      const dp = parsed.dailyPlan || parsed;
      if (!dp?.timeBlocks) continue;
      return {
        approved: false,
        generatedAt: Date.now(),
        date: dp.date || getLocalDateString(),
        itemCount: dp.timeBlocks.length,
        completedCount: 0,
        timeBlocks: (dp.timeBlocks || []).map((b: PlanTimeBlock) => ({
          ...b,
          completed: false,
        })),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function stripJsonFromResponse(content: string): string {
  return content
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

export async function hasPlanForToday(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(getPlanStorageKeyForDate(getLocalDateString()));
  if (!raw) return false;
  try {
    const meta = JSON.parse(raw) as { approved?: boolean };
    return meta.approved === true;
  } catch {
    return false;
  }
}

export async function loadPlanForDate(dateStr: string): Promise<DailyPlanMeta | null> {
  const raw = await AsyncStorage.getItem(getPlanStorageKeyForDate(dateStr));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyPlanMeta;
  } catch {
    return null;
  }
}

export async function loadPlanForToday(): Promise<DailyPlanMeta | null> {
  const plan = await loadPlanForDate(getLocalDateString());
  if (!plan?.approved) return null;
  return plan;
}

export async function savePlan(plan: DailyPlanMeta): Promise<void> {
  await AsyncStorage.setItem(getPlanStorageKeyForDate(plan.date), JSON.stringify(plan));
  await addActivePlanDate(plan.date);
}

export async function savePlanForToday(plan: DailyPlanMeta): Promise<void> {
  await savePlan(plan);
}

export async function clearPlanForToday(): Promise<void> {
  await AsyncStorage.removeItem(getPlanStorageKeyForDate(getLocalDateString()));
}

export async function clearPlanForDate(dateStr: string): Promise<void> {
  await AsyncStorage.removeItem(getPlanStorageKeyForDate(dateStr));
}

export async function getActivePlanDates(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ACTIVE_PLANS_KEY);
  const today = getLocalDateString();
  let dates: string[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        dates = parsed.filter((d): d is string => typeof d === "string");
      }
    } catch {
      dates = [];
    }
  }

  const deduped = Array.from(new Set(dates));
  const cleaned = deduped.filter((d) => d >= today);
  await AsyncStorage.setItem(ACTIVE_PLANS_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export async function addActivePlanDate(dateStr: string): Promise<void> {
  const dates = await getActivePlanDates();
  if (dates.includes(dateStr)) return;
  if (dates.length >= MAX_ACTIVE_PLANS) {
    throw new Error(PLAN_LIMIT_ERROR);
  }
  const updated = [...dates, dateStr].sort();
  await AsyncStorage.setItem(ACTIVE_PLANS_KEY, JSON.stringify(updated));
}

export async function removeActivePlanDate(dateStr: string): Promise<void> {
  const dates = await getActivePlanDates();
  const updated = dates.filter((d) => d !== dateStr);
  await AsyncStorage.setItem(ACTIVE_PLANS_KEY, JSON.stringify(updated));
  await clearPlanForDate(dateStr);
}

export async function cleanupPastPlans(): Promise<void> {
  await getActivePlanDates();
}

export interface CoachSuggestion {
  type:
    | "coach_assessment"
    | "detail_planning"
    | "habit_building"
    | "event_planning"
    | "life_area_coach"
    | "mindfulness"
    | "plan_tomorrow";
  title: string;
  description: string;
  lifeArea: string;
  durationMinutes: number;
  agendaOnly: boolean;
  isPlanTomorrow: boolean;
}

export interface BuildCoachSuggestionsInput {
  categories: LifeCategory[];
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  lifeAreaProfiles: LifeAreaProfile[];
  lifeAreaInsights: LifeAreaInsightsCache[];
  selectedDate: string;
  excludedCategoryIds: Set<string>;
}

export interface BuildCoachSuggestionsResult {
  coachSuggestions: CoachSuggestion[];
  planTomorrow: CoachSuggestion;
}

const PLANNING_ENTRY_TYPES = new Set(["goal", "project", "objective", "idea"]);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isAreaIncluded(categoryId: string, excluded: Set<string>): boolean {
  return !excluded.has(categoryId);
}

function blockOverlapsSlot(
  block: PlanTimeBlock,
  slotStartMins: number,
  slotDuration: number,
): boolean {
  const blockStart = timeToMinutes(block.time);
  const blockEnd = blockStart + (block.durationMinutes || 30);
  const slotEnd = slotStartMins + slotDuration;
  return slotStartMins < blockEnd && slotEnd > blockStart;
}

export function buildCoachSuggestions(
  input: BuildCoachSuggestionsInput,
): BuildCoachSuggestionsResult {
  const {
    categories,
    tasks,
    habits,
    events,
    lifeAreaProfiles,
    lifeAreaInsights,
    selectedDate,
    excludedCategoryIds,
  } = input;

  const defaultLifeArea = categories[0]?.name ?? "General";
  const coachSuggestions: CoachSuggestion[] = [];

  for (const cat of categories) {
    if (!isAreaIncluded(cat.id, excludedCategoryIds)) continue;
    const profile = lifeAreaProfiles.find((p) => p.categoryId === cat.id);
    if (!profile || profile.status !== "completed") {
      coachSuggestions.push({
        type: "coach_assessment",
        title: `Set up your ${cat.name} Coach profile`,
        description:
          `Open the ${cat.name} tab → tap Coach ⚡️ → Start Assessment to help Coach understand your goals and give you personalized guidance.`,
        lifeArea: cat.name,
        durationMinutes: 20,
        agendaOnly: false,
        isPlanTomorrow: false,
      });
      break;
    }
  }

  let detailCount = 0;
  for (const task of tasks) {
    if (detailCount >= 2) break;
    if (!PLANNING_ENTRY_TYPES.has(task.type)) continue;
    if (task.status === "completed" || task.isPinned) continue;
    if (!isAreaIncluded(task.categoryId, excludedCategoryIds)) continue;
    const childCount = tasks.filter((t) => t.parentId === task.id).length;
    if (childCount > 0) continue;
    const lifeArea = categories.find((c) => c.id === task.categoryId)?.name ?? defaultLifeArea;
    coachSuggestions.push({
      type: "detail_planning",
      title: `Detail planning: ${task.title}`,
      description:
        `Open Coach chat → say "Help me plan ${task.title}" to break this down into actionable steps.`,
      lifeArea,
      durationMinutes: 30,
      agendaOnly: false,
      isPlanTomorrow: false,
    });
    detailCount += 1;
  }

  for (const cat of categories) {
    if (!isAreaIncluded(cat.id, excludedCategoryIds)) continue;
    const profile = lifeAreaProfiles.find(
      (p) => p.categoryId === cat.id && p.status === "completed",
    );
    if (!profile || profile.currentFocus.length === 0) continue;
    const hasActiveHabit = habits.some(
      (h) =>
        h.categoryId === cat.id &&
        h.isActive &&
        h.habitType !== "negative",
    );
    if (hasActiveHabit) continue;
    coachSuggestions.push({
      type: "habit_building",
      title: `Build a habit for ${cat.name}`,
      description:
        `Open the Habits tab → tap Add Habit to start tracking a behavior that supports your ${cat.name} goals.`,
      lifeArea: cat.name,
      durationMinutes: 20,
      agendaOnly: false,
      isPlanTomorrow: false,
    });
    break;
  }

  const endDateStr = addDaysToDateStr(selectedDate, 14);
  const hasUpcomingEvents = events.some(
    (e) => e.startDate >= selectedDate && e.startDate <= endDateStr,
  );
  if (!hasUpcomingEvents) {
    coachSuggestions.push({
      type: "event_planning",
      title: "Plan upcoming events",
      description:
        "Open Coach chat → say \"Help me plan my upcoming schedule\" or open the Calendar tab to add events for the weeks ahead.",
      lifeArea: defaultLifeArea,
      durationMinutes: 20,
      agendaOnly: false,
      isPlanTomorrow: false,
    });
  }

  for (const cat of categories) {
    if (!isAreaIncluded(cat.id, excludedCategoryIds)) continue;
    const profile = lifeAreaProfiles.find(
      (p) => p.categoryId === cat.id && p.status === "completed",
    );
    if (!profile) continue;
    const insight = lifeAreaInsights.find((i) => i.categoryId === cat.id);
    const profileStale =
      Date.now() - new Date(profile.updatedAt).getTime() > THIRTY_DAYS_MS;
    const insightsStale =
      !insight ||
      Date.now() - new Date(insight.generatedAt).getTime() > THIRTY_DAYS_MS;
    if (profileStale || insightsStale) {
      coachSuggestions.push({
        type: "life_area_coach",
        title: `Check in with your ${cat.name} Coach`,
        description:
          `Open the ${cat.name} tab → Coach ⚡️ → Chat with Coach to review your progress and get personalized guidance.`,
        lifeArea: cat.name,
        durationMinutes: 20,
        agendaOnly: false,
        isPlanTomorrow: false,
      });
      break;
    }
  }

  coachSuggestions.push({
    type: "mindfulness",
    title: "Meditation & gratitude practice",
    description:
      "Take 15 minutes for mindfulness. Try a short meditation, write 3 things you're grateful for, or simply sit quietly and breathe.",
    lifeArea: defaultLifeArea,
    durationMinutes: 15,
    agendaOnly: true,
    isPlanTomorrow: false,
  });

  const planTomorrow: CoachSuggestion = {
    type: "plan_tomorrow",
    title: "Plan tomorrow",
    description:
      "Open the Daily Plan Generator in My Life to set up tomorrow's schedule. Tap the calendar icon on the Home screen or navigate to Daily Plan in the menu.",
    lifeArea: defaultLifeArea,
    durationMinutes: 15,
    agendaOnly: false,
    isPlanTomorrow: true,
  };

  return { coachSuggestions, planTomorrow };
}

export function deduplicateHabitBlocks(plan: DailyPlanMeta): DailyPlanMeta {
  const seenHabitTitles = new Set<string>();
  const timeBlocks = plan.timeBlocks.filter((block) => {
    if (block.type === "habit") {
      if (seenHabitTitles.has(block.title)) return false;
      seenHabitTitles.add(block.title);
    }
    return true;
  });
  return { ...plan, timeBlocks, itemCount: timeBlocks.length };
}

export function ensurePlanTomorrowBlock(
  plan: DailyPlanMeta,
  startTime: string,
  endTime: string,
  planTomorrow: CoachSuggestion,
): DailyPlanMeta {
  const hasPlanTomorrow = plan.timeBlocks.some(
    (b) =>
      b.isPlanTomorrow === true ||
      b.title.toLowerCase() === planTomorrow.title.toLowerCase(),
  );
  if (hasPlanTomorrow) return plan;

  const windowEnd = timeToMinutes(endTime);
  const windowStart = Math.max(timeToMinutes(startTime), windowEnd - 120);
  const duration = planTomorrow.durationMinutes;

  let slotTime: string | null = null;
  for (let mins = windowStart; mins + duration <= windowEnd; mins += 15) {
    const overlaps = plan.timeBlocks.some((b) => blockOverlapsSlot(b, mins, duration));
    if (!overlaps) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      slotTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      break;
    }
  }

  if (!slotTime) {
    const sorted = [...plan.timeBlocks].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );
    const last = sorted[sorted.length - 1];
    if (last) {
      slotTime = addMinutesToTime(last.time, last.durationMinutes || 30);
    } else {
      slotTime = addMinutesToTime(startTime, 0);
    }
  }

  const newBlock: PlanTimeBlock = {
    time: slotTime,
    title: planTomorrow.title,
    type: "suggestion",
    lifeArea: planTomorrow.lifeArea,
    source: "coach",
    durationMinutes: planTomorrow.durationMinutes,
    id: null,
    completed: false,
    agendaOnly: planTomorrow.agendaOnly,
    description: planTomorrow.description,
    isPlanTomorrow: true,
  };

  const timeBlocks = [...plan.timeBlocks, newBlock].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
  );

  return { ...plan, timeBlocks, itemCount: timeBlocks.length };
}

export interface PostProcessPlanOptions {
  startTime: string;
  endTime: string;
  planTomorrow?: CoachSuggestion | null;
  includeCoachPicks?: boolean;
}

export function postProcessPlan(
  plan: DailyPlanMeta,
  options: PostProcessPlanOptions,
): DailyPlanMeta {
  let processed = deduplicateHabitBlocks(plan);
  if (options.includeCoachPicks && options.planTomorrow) {
    processed = ensurePlanTomorrowBlock(
      processed,
      options.startTime,
      options.endTime,
      options.planTomorrow,
    );
  }
  return processed;
}
