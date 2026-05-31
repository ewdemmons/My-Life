import { LifeAreaSchedule, LifeCategory, SchedulePreference } from "@/types";

export function buildSchedulePreferences(
  lifeAreaSchedules: LifeAreaSchedule[],
  categories: LifeCategory[],
): SchedulePreference[] {
  const byCategory = new Map<string, SchedulePreference>();

  for (const schedule of lifeAreaSchedules) {
    if (!schedule.isActive) continue;

    const category = categories.find((c) => c.id === schedule.categoryId);
    if (!byCategory.has(schedule.categoryId)) {
      byCategory.set(schedule.categoryId, {
        categoryName: category?.name || "Life Area",
        categoryColor: category?.color || "#888888",
        blocks: [],
      });
    }

    byCategory.get(schedule.categoryId)!.blocks.push({
      label: schedule.label,
      daysOfWeek: [...schedule.daysOfWeek].sort((a, b) => a - b),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });
  }

  return Array.from(byCategory.values());
}
