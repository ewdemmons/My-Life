import type { LifeAreaActivityWatermark, LifeAreaInsightsCache } from "@/types";

export const MIN_REGEN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function watermarksEqual(
  a: LifeAreaActivityWatermark,
  b: LifeAreaActivityWatermark,
): boolean {
  return (
    a.entryCount === b.entryCount &&
    a.activeHabitCount === b.activeHabitCount &&
    a.latestTaskMs === b.latestTaskMs &&
    a.latestOccurrenceMs === b.latestOccurrenceMs &&
    a.latestEventMs === b.latestEventMs &&
    a.profileUpdatedMs === b.profileUpdatedMs &&
    a.dailyPlanPresenceHash === b.dailyPlanPresenceHash
  );
}

export function shouldRegenerateInsights(
  cache: LifeAreaInsightsCache | undefined,
  currentWatermark: LifeAreaActivityWatermark,
  options?: { force?: boolean },
): boolean {
  if (options?.force) return true;
  if (!cache) return true;

  const age = Date.now() - new Date(cache.generatedAt).getTime();
  if (age >= MIN_REGEN_INTERVAL_MS) return true;

  return !watermarksEqual(cache.activityWatermark, currentWatermark);
}
