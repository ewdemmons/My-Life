import { Habit, LifeCategory, Task } from "@/types";

export type MasterListSortOption =
  | "manual"
  | "priority"
  | "deadline"
  | "lifeArea"
  | "recentlyAdded"
  | "titleAZ";

export interface MasterListFilters {
  lifeAreaIds: string[];
  priority: "all" | "high" | "medium" | "low";
  status: "all" | "pending" | "in_progress" | "completed";
  entryTypes: string[];
}

export const MASTERLIST_SORT_KEY = "@masterlist_sort";

export const DEFAULT_MASTERLIST_FILTERS: MasterListFilters = {
  lifeAreaIds: [],
  priority: "all",
  status: "all",
  entryTypes: [],
};

export const SORT_OPTIONS: { value: MasterListSortOption; label: string }[] = [
  { value: "manual", label: "Manual order" },
  { value: "priority", label: "Priority" },
  { value: "deadline", label: "Deadline" },
  { value: "lifeArea", label: "Life Area" },
  { value: "recentlyAdded", label: "Recently added" },
  { value: "titleAZ", label: "Title A-Z" },
];

export const FILTER_ENTRY_TYPES: { value: string; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "goal", label: "Goal" },
  { value: "project", label: "Project" },
  { value: "objective", label: "Objective" },
  { value: "note", label: "Note" },
  { value: "idea", label: "Idea" },
  { value: "list", label: "List" },
  { value: "resource", label: "Resource" },
  { value: "habit", label: "Habit" },
];

const PRIORITY_RANK: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function countActiveFilters(filters: MasterListFilters): number {
  let count = 0;
  if (filters.lifeAreaIds.length > 0) count += 1;
  if (filters.priority !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.entryTypes.length > 0) count += 1;
  return count;
}

export function shouldShowPinnedEntries(filters: MasterListFilters): boolean {
  return !(filters.entryTypes.length === 1 && filters.entryTypes[0] === "habit");
}

export function shouldShowPinnedHabits(filters: MasterListFilters): boolean {
  if (filters.entryTypes.length === 0) return true;
  return filters.entryTypes.length === 1 && filters.entryTypes[0] === "habit";
}

export function applyMasterListHabitFilters(
  habits: Habit[],
  filters: MasterListFilters,
): Habit[] {
  return habits.filter((habit) => {
    if (
      filters.lifeAreaIds.length > 0 &&
      (!habit.categoryId || !filters.lifeAreaIds.includes(habit.categoryId))
    ) {
      return false;
    }
    return true;
  });
}

export function applyMasterListFilters(
  tasks: Task[],
  filters: MasterListFilters,
): Task[] {
  return tasks.filter((task) => {
    if (task.status === "completed") return false;

    if (
      filters.lifeAreaIds.length > 0 &&
      !filters.lifeAreaIds.includes(task.categoryId)
    ) {
      return false;
    }

    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }

    if (filters.status !== "all" && task.status !== filters.status) {
      return false;
    }

    if (
      filters.entryTypes.length > 0 &&
      !filters.entryTypes.includes(task.type)
    ) {
      return false;
    }

    return true;
  });
}

export function applyEntriesFilters(
  tasks: Task[],
  filters: MasterListFilters,
): Task[] {
  return tasks.filter((task) => {
    if (
      filters.lifeAreaIds.length > 0 &&
      !filters.lifeAreaIds.includes(task.categoryId)
    ) {
      return false;
    }

    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }

    if (filters.status !== "all" && task.status !== filters.status) {
      return false;
    }

    if (
      filters.entryTypes.length > 0 &&
      !filters.entryTypes.includes(task.type)
    ) {
      return false;
    }

    return true;
  });
}

export type MasterListSectionKey = "today" | "thisWeek" | "later" | "pinned" | "habits";

export type MasterListItem =
  | { kind: "header"; id: string; sectionKey: MasterListSectionKey; label: string }
  | { kind: "task"; id: string; task: Task; sectionKey: MasterListSectionKey };

export interface MasterListTaskSection {
  key: MasterListSectionKey;
  label: string;
  tasks: Task[];
}

export function buildMasterListFlatData(
  sections: MasterListTaskSection[],
  collapsed: Record<string, boolean>,
): MasterListItem[] {
  const items: MasterListItem[] = [];
  for (const section of sections) {
    items.push({
      kind: "header",
      id: `header-${section.key}`,
      sectionKey: section.key,
      label: section.label,
    });
    if (!collapsed[section.key]) {
      for (const task of section.tasks) {
        items.push({
          kind: "task",
          id: task.id,
          task,
          sectionKey: section.key,
        });
      }
    }
  }
  return items;
}

export function getTaskSectionKey(
  taskId: string,
  sections: MasterListTaskSection[],
): MasterListSectionKey {
  for (const section of sections) {
    if (section.tasks.some((t) => t.id === taskId)) {
      return section.key;
    }
  }
  return "pinned";
}

export function formatLocalDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function groupPinnedTasks(tasks: Task[]): MasterListTaskSection[] {
  const hasAnyDeadline = tasks.some((t) => !!t.deadline);

  if (!hasAnyDeadline) {
    return tasks.length > 0
      ? [{ key: "pinned", label: "Pinned", tasks }]
      : [];
  }

  const todayStr = formatLocalDateYYYYMMDD(getLocalTodayDate());
  const todayDate = getLocalTodayDate();
  const weekEnd = new Date(todayDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayTasks: Task[] = [];
  const thisWeekTasks: Task[] = [];
  const laterTasks: Task[] = [];

  for (const task of tasks) {
    if (task.deadline === todayStr) {
      todayTasks.push(task);
    } else if (task.priority === "high" && !task.deadline) {
      todayTasks.push(task);
    } else if (task.deadline) {
      const deadlineDate = parseLocalDate(task.deadline);
      if (deadlineDate < todayDate) {
        todayTasks.push(task);
      } else if (deadlineDate > todayDate && deadlineDate <= weekEnd) {
        thisWeekTasks.push(task);
      } else {
        laterTasks.push(task);
      }
    } else {
      laterTasks.push(task);
    }
  }

  const sections: MasterListTaskSection[] = [];
  if (todayTasks.length > 0) sections.push({ key: "today", label: "Today", tasks: todayTasks });
  if (thisWeekTasks.length > 0) sections.push({ key: "thisWeek", label: "This Week", tasks: thisWeekTasks });
  if (laterTasks.length > 0) sections.push({ key: "later", label: "Later", tasks: laterTasks });
  return sections;
}

export function getLocalTodayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getDeadlineForSection(
  sectionKey: MasterListSectionKey,
  task: Task,
  todayStr: string,
  weekStr: string,
): string | null | undefined {
  if (sectionKey === "pinned") return undefined;
  if (sectionKey === "today") return todayStr;
  if (sectionKey === "thisWeek") return task.deadline ?? weekStr;
  if (sectionKey === "later") return null;
  return undefined;
}

export function computeGlobalPinnedOrder(
  allPinned: Task[],
  visibleOrderedIds: string[],
): string[] {
  const sorted = [...allPinned].sort(
    (a, b) => (a.pinnedOrder || 0) - (b.pinnedOrder || 0),
  );
  const allIds = sorted.map((t) => t.id);
  const visibleSet = new Set(visibleOrderedIds);
  const visibleSlots: number[] = [];
  allIds.forEach((id, idx) => {
    if (visibleSet.has(id)) visibleSlots.push(idx);
  });
  const result = [...allIds];
  visibleOrderedIds.forEach((id, i) => {
    if (visibleSlots[i] !== undefined) {
      result[visibleSlots[i]] = id;
    }
  });
  return result;
}

const SECTION_TOAST_LABEL: Record<MasterListSectionKey, string | null> = {
  today: "Moved to Today",
  thisWeek: "Moved to This Week",
  later: "Moved to Later",
  pinned: null,
  habits: null,
};

export function processMasterListDragEnd(
  data: MasterListItem[],
  previousSections: MasterListTaskSection[],
  allPinned: Task[],
  hasAnyDeadline: boolean,
): {
  batchUpdates: Array<{ id: string; pinnedOrder: number; deadline?: string | null }>;
  toastMessage: string | null;
} {
  const orderedTasks = data
    .filter((item): item is Extract<MasterListItem, { kind: "task" }> => item.kind === "task")
    .map((item) => item.task);

  const taskSectionMap = new Map<string, MasterListSectionKey>();
  let currentSection: MasterListSectionKey = "pinned";
  for (const item of data) {
    if (item.kind === "header") {
      currentSection = item.sectionKey;
    } else {
      taskSectionMap.set(item.id, currentSection);
    }
  }

  const todayStr = formatLocalDateYYYYMMDD(getLocalTodayDate());
  const weekDate = getLocalTodayDate();
  weekDate.setDate(weekDate.getDate() + 7);
  const weekStr = formatLocalDateYYYYMMDD(weekDate);

  const deadlineChanges = new Map<string, string | null>();
  let toastMessage: string | null = null;

  if (hasAnyDeadline) {
    for (const task of orderedTasks) {
      const newSection = taskSectionMap.get(task.id);
      if (!newSection) continue;
      const originalSection = getTaskSectionKey(task.id, previousSections);
      if (newSection !== originalSection) {
        const newDeadline = getDeadlineForSection(newSection, task, todayStr, weekStr);
        if (newDeadline !== undefined) {
          deadlineChanges.set(task.id, newDeadline);
          toastMessage = SECTION_TOAST_LABEL[newSection];
        }
      }
    }
  }

  const visibleOrderedIds = orderedTasks.map((task) => task.id);
  const globalIds = computeGlobalPinnedOrder(allPinned, visibleOrderedIds);
  const batchUpdates = globalIds.map((id, index) => ({
    id,
    pinnedOrder: index + 1,
    ...(deadlineChanges.has(id) ? { deadline: deadlineChanges.get(id) ?? null } : {}),
  }));

  return { batchUpdates, toastMessage };
}

export function sortMasterListTasks(
  tasks: Task[],
  sortOption: MasterListSortOption,
  categories: LifeCategory[],
): Task[] {
  const sorted = [...tasks];

  switch (sortOption) {
    case "manual":
      return sorted.sort((a, b) => (a.pinnedOrder || 0) - (b.pinnedOrder || 0));
    case "priority":
      return sorted.sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      );
    case "deadline":
      return sorted.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
    case "lifeArea":
      return sorted.sort((a, b) => {
        const nameA =
          categories.find((c) => c.id === a.categoryId)?.name ?? "\uffff";
        const nameB =
          categories.find((c) => c.id === b.categoryId)?.name ?? "\uffff";
        return nameA.localeCompare(nameB);
      });
    case "recentlyAdded":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case "titleAZ":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}
