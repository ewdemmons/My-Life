import React from "react";
import { View, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { WEEK_PREVIEW_DAYS, timeToMinutes } from "@/utils/scheduleTimeUtils";
import type { PendingScheduleBlock } from "@/types";

interface LifeAreaScheduleWeekPreviewProps {
  blocks: PendingScheduleBlock[];
  accentColor: string;
}

const MINUTES_IN_DAY = 24 * 60;

export function LifeAreaScheduleWeekPreview({
  blocks,
  accentColor,
}: LifeAreaScheduleWeekPreviewProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.title, { color: theme.textSecondary }]}>
        Week preview
      </ThemedText>
      {WEEK_PREVIEW_DAYS.map(({ index, label }) => {
        const dayBlocks = blocks.filter((b) => b.daysOfWeek.includes(index));
        return (
          <View key={index} style={styles.row}>
            <ThemedText style={[styles.dayLabel, { color: theme.textSecondary }]}>
              {label}
            </ThemedText>
            <View
              style={[
                styles.bar,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              {dayBlocks.map((block) => {
                const startMin = timeToMinutes(block.startTime);
                const endMin = timeToMinutes(block.endTime);
                if (endMin <= startMin) return null;
                const leftPct = (startMin / MINUTES_IN_DAY) * 100;
                const widthPct = ((endMin - startMin) / MINUTES_IN_DAY) * 100;
                return (
                  <View
                    key={block.clientKey}
                    style={[
                      styles.segment,
                      {
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: accentColor,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  dayLabel: {
    width: 32,
    fontSize: 11,
    fontWeight: "500",
  },
  bar: {
    flex: 1,
    height: 10,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    position: "relative",
  },
  segment: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: BorderRadius.full,
    opacity: 0.85,
  },
});
