import {
  getActivePlanDates,
  getLocalDateString,
  loadPlanForDate,
} from "@/utils/planUtils";
import { calculateStreak, getLast7DaysStatus } from "@/utils/habitStreaks";
import type {
  CalendarEvent,
  Habit,
  LifeAreaProfile,
  LifeCategory,
  Occurrence,
  Task,
} from "@/types";
import type { LifeAreaActivityWatermark } from "@/types";

const PLANNING_TYPES = new Set(["goal", "objective", "project", "idea"]);

export interface LifeAreaInsightsDataSources {
  category: LifeCategory;
  profile: LifeAreaProfile;
  tasks: Task[];
  habits: Habit[];
  occurrences: Occurrence[];
  events: CalendarEvent[];
}

export interface LifeAreaInsightsContext {
  contextText: string;
  watermark: LifeAreaActivityWatermark;
  knownHabitIds: Set<string>;
  knownTaskIds: Set<string>;
}

function parseDateMs(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const ms = new Date(dateStr).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function daysSince(isoDate: string | undefined): number | null {
  if (!isoDate) return null;
  const then = new Date(isoDate).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

export async function computeDailyPlanPresenceHash(
  lifeAreaName: string,
): Promise<string> {
  const dates = await getActivePlanDates();
  const parts: string[] = [];
  for (const date of dates) {
    const plan = await loadPlanForDate(date);
    if (!plan) continue;
    const blocksForArea = plan.timeBlocks.filter((b) => b.lifeArea === lifeAreaName);
    parts.push(`${date}:${blocksForArea.length}`);
  }
  return parts.join("|") || "none";
}

export async function buildLifeAreaInsightsContext(
  sources: LifeAreaInsightsDataSources,
): Promise<LifeAreaInsightsContext> {
  const { category, profile, tasks, habits, occurrences, events } = sources;
  const today = getLocalDateString();
  const activeHabits = habits.filter((h) => h.isActive);
  const categoryEvents = events.filter((e) => e.categoryId === category.id);

  const childCountByParent = new Map<string, number>();
  for (const t of tasks) {
    if (t.parentId) {
      childCountByParent.set(t.parentId, (childCountByParent.get(t.parentId) ?? 0) + 1);
    }
  }

  const overdue = tasks.filter(
    (t) => t.deadline && t.deadline < today && t.status !== "completed",
  );
  const completed = tasks.filter((t) => t.status === "completed");
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentlyCompleted = tasks.filter(
    (t) =>
      t.status === "completed" &&
      (t.completionDate ? parseDateMs(t.completionDate) : t.createdAt) >= sevenDaysAgo,
  );

  const shallowHierarchy = tasks.filter(
    (t) => PLANNING_TYPES.has(t.type) && (childCountByParent.get(t.id) ?? 0) === 0,
  );

  const typeCounts: Record<string, number> = {};
  for (const t of tasks) {
    typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
  }

  const habitOccurrences = new Map<string, Occurrence[]>();
  for (const h of activeHabits) {
    habitOccurrences.set(
      h.id,
      occurrences.filter((o) => o.itemId === h.id && o.itemType === "habit"),
    );
  }

  let latestTaskMs = 0;
  for (const t of tasks) {
    latestTaskMs = Math.max(latestTaskMs, t.createdAt);
    if (t.completionDate) {
      latestTaskMs = Math.max(latestTaskMs, parseDateMs(t.completionDate));
    }
  }

  let latestOccurrenceMs = 0;
  for (const h of activeHabits) {
    for (const o of habitOccurrences.get(h.id) ?? []) {
      latestOccurrenceMs = Math.max(latestOccurrenceMs, o.occurredAt);
    }
  }

  let latestEventMs = 0;
  const upcomingEvents7d: CalendarEvent[] = [];
  const upcomingEnd = new Date();
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);
  const upcomingEndStr = getLocalDateString(upcomingEnd);

  for (const e of categoryEvents) {
    latestEventMs = Math.max(latestEventMs, parseDateMs(e.startDate));
    if (e.startDate >= today && e.startDate <= upcomingEndStr) {
      upcomingEvents7d.push(e);
    }
  }

  const upcomingDeadlines = tasks.filter(
    (t) =>
      t.deadline &&
      t.deadline >= today &&
      t.deadline <= upcomingEndStr &&
      t.status !== "completed",
  );

  const dailyPlanPresenceHash = await computeDailyPlanPresenceHash(category.name);
  const activePlanDatesWithArea: string[] = [];
  const dates = await getActivePlanDates();
  for (const date of dates) {
    const plan = await loadPlanForDate(date);
    if (plan?.timeBlocks.some((b) => b.lifeArea === category.name)) {
      activePlanDatesWithArea.push(date);
    }
  }

  const profileUpdatedMs = parseDateMs(profile.updatedAt);
  const daysSinceAssessed = daysSince(profile.assessedAt);

  const watermark: LifeAreaActivityWatermark = {
    entryCount: tasks.length,
    activeHabitCount: activeHabits.length,
    latestTaskMs,
    latestOccurrenceMs,
    latestEventMs,
    profileUpdatedMs,
    dailyPlanPresenceHash,
  };

  const habitLines = activeHabits.map((h) => {
    const occs = habitOccurrences.get(h.id) ?? [];
    const streak = calculateStreak(occs, h.goalFrequency, h.goalCount);
    const last7 = getLast7DaysStatus(occs, h.goalCount);
    const metDays = last7.filter((d) => d.met).length;
    const lastLogged = occs.length > 0
      ? [...occs].sort((a, b) => b.occurredAt - a.occurredAt)[0].occurredDate
      : "never";
    return `- id: ${h.id} | "${h.name}" | streak: ${streak.currentStreak} | last logged: ${lastLogged} | met goal ${metDays}/7 days`;
  });

  const entryLines = tasks.slice(0, 30).map(
    (t) =>
      `- id: ${t.id} | "${t.title}" | type: ${t.type} | status: ${t.status} | children: ${childCountByParent.get(t.id) ?? 0}${t.deadline ? ` | deadline: ${t.deadline}` : ""}`,
  );

  const shallowLines = shallowHierarchy.map(
    (t) => `- id: ${t.id} | "${t.title}" | type: ${t.type}`,
  );

  const contextText = `
LIFE AREA: "${category.name}" (id: ${category.id})
${category.description?.trim() ? `Description: ${category.description.trim()}` : "No description."}

COACH PROFILE:
Primary Goal: ${profile.primaryGoal || "Not set"}
Current Focus: ${profile.currentFocus.length > 0 ? profile.currentFocus.join(", ") : "None"}
Known Obstacles: ${profile.knownObstacles.length > 0 ? profile.knownObstacles.join(", ") : "None"}
Current State: ${profile.currentState || "Not set"}
Motivations: ${profile.motivations || "Not set"}
Success Criteria: ${profile.successCriteria || "Not set"}
Days since assessment: ${daysSinceAssessed ?? "unknown"}

SPARSITY SIGNAL:
Total entries: ${tasks.length}
Active habits: ${activeHabits.length}
Entry types: ${Object.entries(typeCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}
Completion rate: ${tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0}%
Overdue entries: ${overdue.length}
Recently completed (7d): ${recentlyCompleted.length}

SHALLOW HIERARCHY (candidates for detail planning):
${shallowLines.length > 0 ? shallowLines.join("\n") : "None"}

ENTRIES (up to 30):
${entryLines.length > 0 ? entryLines.join("\n") : "None"}

HABITS:
${habitLines.length > 0 ? habitLines.join("\n") : "None"}

DAILY PLANNING SIGNAL:
Active daily plans including this Life Area: ${activePlanDatesWithArea.length > 0 ? activePlanDatesWithArea.join(", ") : "none in recent active plans"}
Upcoming events (7d) in this Life Area: ${upcomingEvents7d.length}
Upcoming deadlines (7d): ${upcomingDeadlines.length}
Underrepresented in daily plans: ${activePlanDatesWithArea.length === 0 && upcomingEvents7d.length === 0 ? "likely yes" : "possibly no"}
`.trim();

  return {
    contextText,
    watermark,
    knownHabitIds: new Set(activeHabits.map((h) => h.id)),
    knownTaskIds: new Set(tasks.map((t) => t.id)),
  };
}
