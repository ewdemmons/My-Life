import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PlanTimeBlock {
  time: string;
  title: string;
  type: "event" | "entry" | "habit" | "suggestion";
  lifeArea: string;
  source: "scheduled" | "pinned" | "habit" | "suggested" | "coach";
  durationMinutes: number;
  id: string | null;
  completed: boolean;
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
