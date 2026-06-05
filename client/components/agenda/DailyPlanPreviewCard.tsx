import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { DailyPlanMeta, PlanTimeBlock } from "@/utils/planUtils";
import { LifeCategory } from "@/types";

const PREVIEW_BG = "#13131e";
const DEFAULT_LIFE_AREA_COLOR = "#6B7FFF";

type TimePeriod = "morning" | "afternoon" | "evening";

const PERIOD_CONFIG: Record<TimePeriod, { emoji: string; label: string; range: string }> = {
  morning: { emoji: "🌅", label: "Morning", range: "7:00 AM – 12:00 PM" },
  afternoon: { emoji: "☀️", label: "Afternoon", range: "12:00 PM – 5:00 PM" },
  evening: { emoji: "🌙", label: "Evening", range: "5:00 PM – 10:00 PM" },
};

function getTimePeriod(time: string): TimePeriod {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

function formatCompactTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}`;
}

function getLifeAreaColor(categories: LifeCategory[], lifeAreaName: string): string {
  return categories.find((c) => c.name === lifeAreaName)?.color ?? DEFAULT_LIFE_AREA_COLOR;
}

interface DailyPlanPreviewCardProps {
  plan: DailyPlanMeta;
  categories: LifeCategory[];
}

export function DailyPlanPreviewCard({ plan, categories }: DailyPlanPreviewCardProps) {
  const { theme } = useTheme();

  const groupedBlocks = useMemo(() => {
    const groups: Record<TimePeriod, PlanTimeBlock[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const block of plan.timeBlocks) {
      groups[getTimePeriod(block.time)].push(block);
    }
    return groups;
  }, [plan.timeBlocks]);

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.title, { color: theme.buttonText }]}>
        Plan Preview — {plan.itemCount} items
      </ThemedText>
      {(Object.keys(PERIOD_CONFIG) as TimePeriod[]).map((period) => {
        const blocks = groupedBlocks[period];
        if (blocks.length === 0) return null;
        const config = PERIOD_CONFIG[period];

        return (
          <View key={period} style={styles.periodSection}>
            <ThemedText style={[styles.periodHeader, { color: theme.textSecondary }]}>
              {config.emoji} {config.label}
            </ThemedText>
            {blocks.map((block, index) => {
              const lifeAreaColor = getLifeAreaColor(categories, block.lifeArea);
              return (
                <View key={`${block.time}-${index}`} style={styles.row}>
                  <Text style={[styles.time, { color: theme.textSecondary }]}>
                    {formatCompactTime(block.time)}
                  </Text>
                  <ThemedText style={styles.itemTitle} numberOfLines={1}>
                    {block.title}
                  </ThemedText>
                  <View style={[styles.badge, { backgroundColor: lifeAreaColor + "33" }]}>
                    <Text style={[styles.badgeText, { color: lifeAreaColor }]}>
                      {block.lifeArea}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PREVIEW_BG,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  periodSection: {
    marginBottom: Spacing.sm,
  },
  periodHeader: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  time: {
    fontSize: 10,
    width: 36,
  },
  itemTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 64,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "600",
  },
});
