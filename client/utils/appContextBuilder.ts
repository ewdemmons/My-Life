import { Plan } from "@/components/PlanPreview";
import { EntryContext } from "@/navigation/RootStackNavigator";
import {
  CalendarEvent,
  Habit,
  LifeCategory,
  Occurrence,
  Person,
  SchedulePreference,
  Task,
} from "@/types";

export interface RefinementContextState {
  isActive: boolean;
  implementedPlan?: Plan;
  createdTaskIds?: string[];
  currentBranch?: "scheduling" | "habits" | "assignments" | null;
}

export interface BuildAppContextParams {
  categories: LifeCategory[];
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  people: Person[];
  occurrences: Occurrence[];
  schedulePreferences: SchedulePreference[];
  refinementState?: RefinementContextState;
  entryContext?: EntryContext | null;
  /** When true, limits unpinned suggestion data to Task-type entries only (daily plan generator). */
  forDailyPlan?: boolean;
}

function buildSuggestedTasksSection(tasks: Task[], categories: LifeCategory[]): string {
  const lines = tasks
    .filter((t) => !t.isPinned && t.type === "task" && t.status !== "completed" && !t.excludeFromPlan)
    .slice(0, 10)
    .map((t) => {
      const category = categories.find((c) => c.id === t.categoryId);
      return `- "${t.title}" | Life Area: ${category?.name ?? "Unassigned"} | Priority: ${t.priority}`;
    });
  return lines.length > 0 ? lines.join("\n") : "None available";
}

export function buildAppContext(params: BuildAppContextParams): string {
  const {
    categories,
    tasks,
    habits,
    events,
    people,
    occurrences,
    schedulePreferences,
    refinementState,
    entryContext,
    forDailyPlan = false,
  } = params;

  const now = new Date();
  const currentDateTime = `Current date: ${now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}
Current time: ${now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  const today = new Date().toISOString().split("T")[0];
  const weekLater = new Date();
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = weekLater.toISOString().split("T")[0];

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const formatScheduleTime12 = (hhmm: string): string => {
    const [hoursStr, minutesStr] = hhmm.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = minutesStr || "00";
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDaysOfWeek = (days: number[]): string => {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 0) return "";
    if (sorted.length === 7) return "Every day";
    if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) {
      return "Mon–Fri";
    }
    if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) {
      return "Sat–Sun";
    }
    const ranges: string[] = [];
    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === rangeEnd + 1) {
        rangeEnd = sorted[i];
        continue;
      }
      if (rangeStart === rangeEnd) {
        ranges.push(DAY_NAMES[rangeStart]);
      } else if (rangeEnd === rangeStart + 1) {
        ranges.push(`${DAY_NAMES[rangeStart]}, ${DAY_NAMES[rangeEnd]}`);
      } else {
        ranges.push(`${DAY_NAMES[rangeStart]}–${DAY_NAMES[rangeEnd]}`);
      }
      if (i < sorted.length) {
        rangeStart = sorted[i];
        rangeEnd = sorted[i];
      }
    }
    return ranges.join(", ");
  };

  const getLifeAreaName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return "Unassigned";
    return categories.find((c) => c.id === categoryId)?.name ?? "Unassigned";
  };

  const formatEntryType = (type: string): string => {
    if (type === "subtask") return "Step";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatHabitType = (habitType: string): string =>
    habitType === "negative" ? "Break" : "Build";

  const formatFrequencyLabel = (freq: string): string =>
    freq.charAt(0).toUpperCase() + freq.slice(1);

  const formatDeadline = (deadline: string | undefined): string => {
    if (!deadline) return "no deadline";
    const [y, m, d] = deadline.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `due ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const getHabitTodayCount = (habitId: string): number =>
    occurrences.filter(
      (o) => o.itemType === "habit" && o.itemId === habitId && o.occurredDate === today,
    ).length;

  const normalizeColor = (color: string): string =>
    color.startsWith("#") ? color : `#${color}`;

  const lifeAreasSection =
    categories.length > 0
      ? categories
          .map((c) => {
            const count = tasks.filter((t) => t.categoryId === c.id).length;
            return `${c.name} (${normalizeColor(c.color)}, ${count} entries)`;
          })
          .join(", ")
      : "None created yet";

  const pinnedEntries = tasks.filter((t) => t.isPinned && !t.excludeFromPlan);
  const masterListSection =
    pinnedEntries.length > 0
      ? pinnedEntries
          .map((t) => {
            const area = getLifeAreaName(t.categoryId);
            const deadline = formatDeadline(t.deadline);
            return `- ${t.title} (${formatEntryType(t.type)}, ${t.priority} priority, ${area}, ${deadline})`;
          })
          .join("\n")
      : "None";

  const pinnedHabits = habits.filter((h) => h.isPinned && h.isActive);
  const pinnedHabitsSection =
    pinnedHabits.length > 0
      ? pinnedHabits
          .map((h) => {
            const todayCount = getHabitTodayCount(h.id);
            return `- ${h.name} (${formatHabitType(h.habitType)}, ${formatFrequencyLabel(h.goalFrequency)}, goal: ${h.goalCount}x, today: ${todayCount})`;
          })
          .join("\n")
      : "None";

  const activeHabits = habits.filter((h) =>
    forDailyPlan ? h.isActive && h.habitType !== "negative" : h.isActive,
  );
  const allHabitsSection =
    activeHabits.length > 0
      ? activeHabits
          .map(
            (h) =>
              `- ${h.name} (${formatHabitType(h.habitType)}, ${formatFrequencyLabel(h.goalFrequency)}, goal: ${h.goalCount}x)`,
          )
          .join("\n")
      : "None";

  const todayEvents = events.filter((e) => e.startDate === today);
  const todayEventsSection =
    todayEvents.length > 0
      ? todayEvents
          .map((e) => {
            const area = getLifeAreaName(e.categoryId);
            return `- ${e.title} (${e.startTime}–${e.endTime}, ${e.eventType}, ${area})`;
          })
          .join("\n")
      : "None";

  const upcomingEvents = events
    .filter((e) => e.startDate > today && e.startDate <= weekLaterStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime))
    .slice(0, 10);
  const upcomingEventsSection =
    upcomingEvents.length > 0
      ? upcomingEvents
          .map((e) => {
            const area = getLifeAreaName(e.categoryId);
            return `- ${e.title} (${e.startDate}, ${e.startTime}, ${area})`;
          })
          .join("\n")
      : "None";

  const pendingCount = tasks.filter((t) =>
    forDailyPlan ? t.type === "task" && t.status === "pending" : t.status === "pending",
  ).length;
  const completedCount = tasks.filter((t) =>
    forDailyPlan ? t.type === "task" && t.status === "completed" : t.status === "completed",
  ).length;
  const goalCount = tasks.filter((t) => t.type === "goal").length;
  const projectCount = tasks.filter((t) => t.type === "project").length;
  const taskSummarySection = forDailyPlan
    ? `${pendingCount} pending tasks, ${completedCount} completed tasks`
    : `${pendingCount} pending tasks, ${completedCount} completed, ${goalCount} goals, ${projectCount} projects`;

  const peopleSection =
    people.length > 0
      ? people.map((p) => `- ${p.name} (${p.relationship || "contact"})`).join("\n")
      : "None";

  let scheduleSection = "";
  if (schedulePreferences.length > 0) {
    const scheduleLines: string[] = [];
    for (const pref of schedulePreferences) {
      for (const block of pref.blocks) {
        const days = formatDaysOfWeek(block.daysOfWeek);
        const timeRange = `${formatScheduleTime12(block.startTime)} – ${formatScheduleTime12(block.endTime)}`;
        const labelSuffix = block.label ? ` (${block.label})` : "";
        scheduleLines.push(`${pref.categoryName}: ${days} ${timeRange}${labelSuffix}`);
      }
    }
    if (scheduleLines.length > 0) {
      scheduleSection = `\n\nSCHEDULE PREFERENCES:\n${scheduleLines.join("\n")}`;
    }
  }

  let refinementContext = "";
  if (refinementState?.isActive && refinementState.implementedPlan) {
    refinementContext = `
ACTIVE REFINEMENT MODE:
Recently implemented plan: "${refinementState.implementedPlan.goal}"
Created tasks: ${refinementState.createdTaskIds?.length || 0} items
Current branch: ${refinementState.currentBranch || "none"}
      `;
  }

  let entryContextInfo = "";
  if (entryContext) {
    const task = entryContext.type === "task" ? tasks.find((t) => t.id === entryContext.id) : null;

    let hierarchy = "";
    if (task) {
      const getParentChain = (taskId: string | null | undefined): string[] => {
        if (!taskId) return [];
        const parent = tasks.find((t) => t.id === taskId);
        if (!parent) return [];
        return [...getParentChain(parent.parentId), `${parent.title} (${parent.type})`];
      };
      const parentChain = getParentChain(task.parentId);
      if (parentChain.length > 0) {
        hierarchy = `\nHierarchy: ${parentChain.join(" > ")} > ${task.title}`;
      }

      const children = tasks.filter((t) => t.parentId === task.id);
      if (children.length > 0) {
        hierarchy += `\nSub-entries (${children.length}): ${children.map((c) => `${c.title} (${c.type})`).join(", ")}`;
      }
    }

    entryContextInfo = `
ENTRY-SPECIFIC ASSISTANCE:
Focused on: "${entryContext.title}" (${entryContext.entryType || entryContext.type})
Bubble: ${entryContext.bubbleName || "Not assigned"}${hierarchy}
Entry ID: ${entryContext.id}

When creating sub-entries or plans for this entry, create them as children under this entry, NOT at the root level.
      `;
  }

  const suggestedTasksBlock = forDailyPlan
    ? `

SUGGESTED TASKS (unpinned Tasks only, for daily plan Step 6):
${buildSuggestedTasksSection(tasks, categories)}
NOTE: Only Task-type entries are listed here. Goals, Projects, Objectives, Ideas, Notes, Lists, Resources, and Items are intentionally excluded.`
    : "";

  return `
${currentDateTime}

LIFE AREAS:
${lifeAreasSection}

MASTER LIST (Pinned Entries):
${masterListSection}

PINNED HABITS:
${pinnedHabitsSection}

ALL HABITS:
${allHabitsSection}${suggestedTasksBlock}

TODAY'S EVENTS:
${todayEventsSection}

UPCOMING EVENTS:
${upcomingEventsSection}

TASK SUMMARY:
${taskSummarySection}

PEOPLE:
${peopleSection}${scheduleSection}
${refinementContext}
${entryContextInfo}
  `.trim();
}
