import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Habit, Occurrence } from "@/types";
import { calculateStreak } from "@/utils/habitStreaks";

interface HabitsSummaryHeaderProps {
  habits: Habit[];
  getOccurrencesForItem: (itemId: string, itemType: "habit") => Occurrence[];
}

export function HabitsSummaryHeader({
  habits,
  getOccurrencesForItem,
}: HabitsSummaryHeaderProps) {
  const { theme } = useTheme();

  const stats = useMemo(() => {
    if (habits.length === 0) {
      return {
        avgStreak: 0,
        weeklyCompletion: 0,
        monthlyCompletion: 0,
        topHabits: [],
      };
    }

    let totalStreak = 0;
    let weeklyMet = 0;
    let weeklyTotal = 0;
    let monthlyMet = 0;
    let monthlyTotal = 0;

    const habitScores: { habit: Habit; score: number; streak: number }[] = [];

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    habits.forEach((habit) => {
      const occurrences = getOccurrencesForItem(habit.id, "habit");
      const streakInfo = calculateStreak(occurrences, habit.goalFrequency, habit.goalCount);
      totalStreak += streakInfo.currentStreak;

      const occByDate: Map<string, number> = new Map();
      occurrences.forEach((o) => {
        occByDate.set(o.occurredDate, (occByDate.get(o.occurredDate) || 0) + 1);
      });

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = formatDateStr(date);
        const count = occByDate.get(dateStr) || 0;
        if (habit.goalFrequency === "daily") {
          weeklyTotal++;
          if (count >= habit.goalCount) weeklyMet++;
        }
      }

      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = formatDateStr(date);
        const count = occByDate.get(dateStr) || 0;
        if (habit.goalFrequency === "daily") {
          monthlyTotal++;
          if (count >= habit.goalCount) monthlyMet++;
        }
      }

      const recentOccurrences = occurrences.filter((o) => {
        const occDate = parseLocalDate(o.occurredDate);
        return occDate >= weekAgo;
      }).length;

      habitScores.push({
        habit,
        score: recentOccurrences + streakInfo.currentStreak * 2,
        streak: streakInfo.currentStreak,
      });
    });

    const avgStreak = Math.round(totalStreak / habits.length);
    const weeklyCompletion = weeklyTotal > 0 ? Math.round((weeklyMet / weeklyTotal) * 100) : 0;
    const monthlyCompletion = monthlyTotal > 0 ? Math.round((monthlyMet / monthlyTotal) * 100) : 0;

    const topHabits = habitScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((h) => ({ name: h.habit.name, streak: h.streak }));

    return { avgStreak, weeklyCompletion, monthlyCompletion, topHabits };
  }, [habits, getOccurrencesForItem]);

  if (habits.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: theme.warning + "20" }]}>
            <Feather name="zap" size={16} color={theme.warning} />
          </View>
          <View>
            <ThemedText style={styles.statValue}>{stats.avgStreak}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Avg Streak
            </ThemedText>
          </View>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: theme.success + "20" }]}>
            <Feather name="check-circle" size={16} color={theme.success} />
          </View>
          <View>
            <ThemedText style={styles.statValue}>{stats.weeklyCompletion}%</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Week
            </ThemedText>
          </View>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="calendar" size={16} color={theme.primary} />
          </View>
          <View>
            <ThemedText style={styles.statValue}>{stats.monthlyCompletion}%</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Month
            </ThemedText>
          </View>
        </View>
      </View>

      {stats.topHabits.length > 0 ? (
        <View style={styles.topHabitsSection}>
          <ThemedText style={[styles.topHabitsTitle, { color: theme.textSecondary }]}>
            Top Performers
          </ThemedText>
          <View style={styles.topHabitsList}>
            {stats.topHabits.map((h, index) => (
              <View key={index} style={styles.topHabitItem}>
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(index, theme) }]}>
                  <ThemedText style={styles.rankText}>{index + 1}</ThemedText>
                </View>
                <ThemedText style={styles.topHabitName} numberOfLines={1}>
                  {h.name}
                </ThemedText>
                {h.streak > 0 ? (
                  <View style={styles.miniStreak}>
                    <Feather name="zap" size={10} color={theme.warning} />
                    <ThemedText style={[styles.miniStreakText, { color: theme.warning }]}>
                      {h.streak}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getRankColor(index: number, theme: any): string {
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  return colors[index] || theme.primary;
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
  },
  topHabitsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  topHabitsTitle: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  topHabitsList: {
    gap: Spacing.xs,
  },
  topHabitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rankBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#000",
  },
  topHabitName: {
    fontSize: 13,
    flex: 1,
  },
  miniStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  miniStreakText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
