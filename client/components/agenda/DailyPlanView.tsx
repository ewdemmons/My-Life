import React, { useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import {
  DailyPlanMeta,
  PlanTimeBlock,
  savePlan,
} from "@/utils/planUtils";
import { LifeCategory } from "@/types";

const CURRENT_HIGHLIGHT_BG = "#6B7FFF11";
const CURRENT_HIGHLIGHT_BORDER = "#6B7FFF33";
const CURRENT_TITLE_COLOR = "#6B7FFF";
const COMPLETED_COLOR = "#555";
const DEFAULT_LIFE_AREA_COLOR = "#6B7FFF";
const CHECKBOX_BORDER = "#333";
const CHECKBOX_COMPLETE = "#10B981";

const SOURCE_LABELS: Record<PlanTimeBlock["source"], string> = {
  scheduled: "Scheduled",
  pinned: "Pinned",
  habit: "Habit",
  suggested: "Suggested",
  coach: "Coach",
};

type TimePeriod = "morning" | "afternoon" | "evening";

const PERIOD_CONFIG: Record<
  TimePeriod,
  { emoji: string; label: string; range: string }
> = {
  morning: { emoji: "🌅", label: "Morning", range: "7:00 AM – 12:00 PM" },
  afternoon: { emoji: "☀️", label: "Afternoon", range: "12:00 PM – 5:00 PM" },
  evening: { emoji: "🌙", label: "Evening", range: "5:00 PM – 10:00 PM" },
};

function parseHour(time: string): number {
  const [hours] = time.split(":").map(Number);
  return hours;
}

function getTimePeriod(time: string): TimePeriod {
  const hour = parseHour(time);
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

interface DailyPlanViewProps {
  planDate: string;
  plan: DailyPlanMeta;
  categories: LifeCategory[];
  onPlanChange: (plan: DailyPlanMeta) => void;
  onRegenerate: () => void;
  onOpenLifeCoach: () => void;
}

export function DailyPlanView({
  planDate,
  plan,
  categories,
  onPlanChange,
  onRegenerate,
  onOpenLifeCoach,
}: DailyPlanViewProps) {
  const { theme } = useTheme();

  const currentBlockIndex = useMemo(
    () => plan.timeBlocks.findIndex((block) => !block.completed),
    [plan.timeBlocks],
  );

  const progressPercent = plan.itemCount > 0
    ? Math.round((plan.completedCount / plan.itemCount) * 100)
    : 0;

  const groupedBlocks = useMemo(() => {
    const groups: Record<TimePeriod, Array<{ block: PlanTimeBlock; index: number }>> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    plan.timeBlocks.forEach((block, index) => {
      groups[getTimePeriod(block.time)].push({ block, index });
    });
    return groups;
  }, [plan.timeBlocks]);

  const toggleBlock = useCallback(
    async (index: number) => {
      const block = plan.timeBlocks[index];
      const completed = !block.completed;
      const updatedBlocks = plan.timeBlocks.map((b, i) =>
        i === index ? { ...b, completed } : b,
      );
      const updated: DailyPlanMeta = {
        ...plan,
        date: planDate,
        timeBlocks: updatedBlocks,
        completedCount: plan.completedCount + (completed ? 1 : -1),
      };
      onPlanChange(updated);
      await savePlan(updated);
    },
    [plan, onPlanChange, planDate],
  );

  const renderPlanItem = (block: PlanTimeBlock, index: number) => {
    const isCurrent = index === currentBlockIndex;
    const isCompleted = block.completed;
    const lifeAreaColor = getLifeAreaColor(categories, block.lifeArea);

    return (
      <Pressable
        key={`${block.time}-${index}`}
        onPress={() => toggleBlock(index)}
        style={[
          styles.planItem,
          isCurrent && {
            backgroundColor: CURRENT_HIGHLIGHT_BG,
            borderColor: CURRENT_HIGHLIGHT_BORDER,
            borderWidth: 1,
          },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: isCompleted ? CHECKBOX_COMPLETE : CHECKBOX_BORDER },
            isCompleted && { backgroundColor: CHECKBOX_COMPLETE, borderColor: CHECKBOX_COMPLETE },
          ]}
        >
          {isCompleted ? (
            <Feather name="check" size={10} color="#FFFFFF" />
          ) : null}
        </View>

        <View style={[styles.colorBar, { backgroundColor: lifeAreaColor }]} />

        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
          {formatCompactTime(block.time)}
        </Text>

        <ThemedText
          style={[
            styles.itemTitle,
            isCompleted && { color: COMPLETED_COLOR, textDecorationLine: "line-through" },
            isCurrent && !isCompleted && { color: CURRENT_TITLE_COLOR, fontWeight: "700" },
          ]}
          numberOfLines={1}
        >
          {block.title}
        </ThemedText>

        <View style={[styles.lifeAreaBadge, { backgroundColor: lifeAreaColor + "33" }]}>
          <Text style={[styles.lifeAreaBadgeText, { color: lifeAreaColor }]}>
            {block.lifeArea}
          </Text>
        </View>

        <Text style={[styles.sourceLabel, { color: theme.textSecondary }]}>
          {SOURCE_LABELS[block.source]}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <LinearGradient
            colors={["#6B7FFF", "#10B981"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            {plan.completedCount} of {plan.itemCount} complete
          </Text>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            {progressPercent}%
          </Text>
        </View>
      </View>

      {(Object.keys(PERIOD_CONFIG) as TimePeriod[]).map((period) => {
        const blocks = groupedBlocks[period];
        if (blocks.length === 0) return null;
        const config = PERIOD_CONFIG[period];

        return (
          <View key={period} style={styles.periodSection}>
            <ThemedText style={[styles.periodHeader, { color: theme.buttonText }]}>
              {config.emoji} {config.label} · {config.range}
            </ThemedText>
            {blocks.map(({ block, index }) => renderPlanItem(block, index))}
          </View>
        );
      })}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
          onPress={onOpenLifeCoach}
        >
          <ThemedText style={styles.actionButtonText}>💬 Adjust with Life Coach</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
          onPress={onRegenerate}
        >
          <ThemedText style={styles.actionButtonText}>↺ Regenerate</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
  },
  progressSection: {
    paddingHorizontal: 14,
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  progressText: {
    fontSize: 9,
  },
  periodSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  periodHeader: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  planItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
    gap: 6,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  colorBar: {
    width: 3,
    height: 22,
    borderRadius: 2,
  },
  timeText: {
    fontSize: 9,
    width: 30,
  },
  itemTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  lifeAreaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 72,
  },
  lifeAreaBadgeText: {
    fontSize: 8,
    fontWeight: "600",
  },
  sourceLabel: {
    fontSize: 8,
    width: 52,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
