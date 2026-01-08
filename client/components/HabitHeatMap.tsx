import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Habit, Occurrence } from "@/types";

interface HabitHeatMapProps {
  habit: Habit;
  occurrences: Occurrence[];
  weeks?: number;
  onDayPress?: (date: string, count: number) => void;
}

export function HabitHeatMap({
  habit,
  occurrences,
  weeks = 8,
  onDayPress,
}: HabitHeatMapProps) {
  const { theme } = useTheme();

  const heatMapData = useMemo(() => {
    const countsByDate: Map<string, number> = new Map();
    occurrences.forEach((o) => {
      countsByDate.set(o.occurredDate, (countsByDate.get(o.occurredDate) || 0) + 1);
    });

    const days: { date: string; count: number; status: "met" | "partial" | "missed" | "future" }[] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7 - 1));
    startDate.setDate(startDate.getDate() - startDate.getDay());

    for (let i = 0; i < weeks * 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      
      const isFuture = date > today;
      const count = countsByDate.get(dateStr) || 0;

      let status: "met" | "partial" | "missed" | "future" = "future";
      if (!isFuture) {
        if (count >= habit.goalCount) {
          status = "met";
        } else if (count > 0) {
          status = "partial";
        } else {
          status = "missed";
        }
      }

      days.push({ date: dateStr, count, status });
    }

    const weekColumns: typeof days[] = [];
    for (let w = 0; w < weeks; w++) {
      weekColumns.push(days.slice(w * 7, (w + 1) * 7));
    }

    return weekColumns;
  }, [habit, occurrences, weeks]);

  const getStatusColor = (status: "met" | "partial" | "missed" | "future") => {
    const isPositive = habit.habitType === "positive";
    switch (status) {
      case "met":
        return isPositive ? theme.success : theme.error;
      case "partial":
        return theme.warning;
      case "missed":
        return isPositive ? theme.error + "40" : theme.success + "40";
      case "future":
        return theme.textSecondary + "20";
    }
  };

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View style={styles.container}>
      <View style={styles.dayLabelsColumn}>
        {dayLabels.map((label, index) => (
          <ThemedText
            key={index}
            style={[styles.dayLabel, { color: theme.textSecondary }]}
          >
            {label}
          </ThemedText>
        ))}
      </View>
      <View style={styles.heatMapGrid}>
        {heatMapData.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekColumn}>
            {week.map((day) => (
              <Pressable
                key={day.date}
                style={[
                  styles.dayCell,
                  { backgroundColor: getStatusColor(day.status) },
                ]}
                onPress={() => day.status !== "future" && onDayPress?.(day.date, day.count)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

interface HeatMapLegendProps {
  habitType: "positive" | "negative";
}

export function HeatMapLegend({ habitType }: HeatMapLegendProps) {
  const { theme } = useTheme();
  const isPositive = habitType === "positive";

  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: isPositive ? theme.success : theme.error }]} />
        <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Met</ThemedText>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
        <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Partial</ThemedText>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: isPositive ? theme.error + "40" : theme.success + "40" }]} />
        <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Missed</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  dayLabelsColumn: {
    marginRight: Spacing.xs,
  },
  dayLabel: {
    fontSize: 8,
    height: 12,
    lineHeight: 12,
    textAlign: "right",
    width: 10,
  },
  heatMapGrid: {
    flexDirection: "row",
    gap: 3,
  },
  weekColumn: {
    gap: 3,
  },
  dayCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
});
