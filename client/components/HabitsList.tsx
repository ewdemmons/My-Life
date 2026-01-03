import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, FlatList, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Habit, HABIT_TYPES, GOAL_FREQUENCIES, Occurrence } from "@/types";
import { AddHabitModal } from "@/components/AddHabitModal";
import { calculateStreak, getLast7DaysStatus } from "@/utils/habitStreaks";

interface HabitsListProps {
  categoryId: string;
}

export function HabitsList({ categoryId }: HabitsListProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { habits, addOccurrence, getOccurrencesForItem } = useApp();

  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);

  const categoryHabits = useMemo(
    () => habits.filter((h) => h.categoryId === categoryId && h.isActive),
    [habits, categoryId]
  );

  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getHabitTypeInfo = (type: string) => {
    return HABIT_TYPES.find((t) => t.value === type) || HABIT_TYPES[0];
  };

  const getFrequencyLabel = (freq: string) => {
    return GOAL_FREQUENCIES.find((f) => f.value === freq)?.label || freq;
  };

  const handleQuickLog = async (habit: Habit) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addOccurrence({
        itemId: habit.id,
        itemType: "habit",
        occurredAt: Date.now(),
        occurredDate: getTodayDateString(),
      });
    } catch (error) {
      Alert.alert("Error", "Failed to log occurrence. Please try again.");
    }
  };

  const handleHabitPress = (habit: Habit) => {
    if (expandedHabitId === habit.id) {
      setExpandedHabitId(null);
    } else {
      setExpandedHabitId(habit.id);
    }
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setShowAddHabitModal(true);
  };

  const getTodayCount = (habitId: string) => {
    const today = getTodayDateString();
    const occurrences = getOccurrencesForItem(habitId, "habit");
    return occurrences.filter((o) => o.occurredDate === today).length;
  };

  const getStreakInfo = (habit: Habit) => {
    const occurrences = getOccurrencesForItem(habit.id, "habit");
    return calculateStreak(occurrences, habit.goalFrequency, habit.goalCount);
  };

  const getLast7Days = (habit: Habit) => {
    const occurrences = getOccurrencesForItem(habit.id, "habit");
    return getLast7DaysStatus(occurrences, habit.goalCount);
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    return days[date.getDay()];
  };

  const renderWeeklyDots = (habit: Habit) => {
    const last7Days = getLast7Days(habit);
    const isNegativeHabit = habit.habitType === "negative";

    return (
      <View style={styles.weeklyDotsContainer}>
        {last7Days.map((day, index) => {
          let dotColor = theme.textSecondary + "40";
          
          if (isNegativeHabit) {
            dotColor = day.count === 0 ? theme.success : theme.error;
          } else {
            dotColor = day.met ? theme.success : theme.textSecondary + "40";
          }

          return (
            <View key={day.date} style={styles.dayDotWrapper}>
              <View
                style={[
                  styles.weeklyDot,
                  { backgroundColor: dotColor },
                ]}
              />
              <ThemedText style={[styles.dayLabel, { color: theme.textSecondary }]}>
                {getDayLabel(day.date)}
              </ThemedText>
            </View>
          );
        })}
      </View>
    );
  };

  const renderHabitItem = ({ item }: { item: Habit }) => {
    const typeInfo = getHabitTypeInfo(item.habitType);
    const todayCount = getTodayCount(item.id);
    const goalMet = todayCount >= item.goalCount;
    const streakInfo = getStreakInfo(item);
    const isExpanded = expandedHabitId === item.id;

    return (
      <Pressable
        style={[styles.habitCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => handleHabitPress(item)}
      >
        <View style={styles.habitContent}>
          <View style={styles.habitHeader}>
            <View style={styles.habitTitleRow}>
              <ThemedText style={styles.habitName} numberOfLines={1}>
                {item.name}
              </ThemedText>
              {streakInfo.currentStreak > 0 ? (
                <View style={[styles.streakBadge, { backgroundColor: theme.warning + "20" }]}>
                  <Feather name="zap" size={12} color={theme.warning} />
                  <ThemedText style={[styles.streakText, { color: theme.warning }]}>
                    {streakInfo.currentStreak}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.badges}>
              <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + "20" }]}>
                <Feather name={typeInfo.icon as any} size={12} color={typeInfo.color} />
                <ThemedText style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                  {typeInfo.label}
                </ThemedText>
              </View>
              <View style={[styles.frequencyBadge, { backgroundColor: theme.primary + "15" }]}>
                <ThemedText style={[styles.frequencyBadgeText, { color: theme.primary }]}>
                  {item.goalCount}x {getFrequencyLabel(item.goalFrequency)}
                </ThemedText>
              </View>
            </View>
          </View>
          
          {item.description ? (
            <ThemedText style={[styles.habitDescription, { color: theme.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
              {item.description}
            </ThemedText>
          ) : null}
          
          {renderWeeklyDots(item)}
          
          <View style={styles.progressRow}>
            <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
              Today: {todayCount}/{item.goalCount}
            </ThemedText>
            {goalMet ? (
              <View style={[styles.goalMetBadge, { backgroundColor: theme.success + "20" }]}>
                <Feather name="check" size={12} color={theme.success} />
                <ThemedText style={[styles.goalMetText, { color: theme.success }]}>
                  Goal met
                </ThemedText>
              </View>
            ) : null}
          </View>
          
          {isExpanded ? (
            <View style={styles.expandedContent}>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.streakDetailsRow}>
                <View style={styles.streakDetail}>
                  <Feather name="zap" size={16} color={theme.warning} />
                  <View style={styles.streakDetailText}>
                    <ThemedText style={[styles.streakDetailLabel, { color: theme.textSecondary }]}>
                      Current Streak
                    </ThemedText>
                    <ThemedText style={styles.streakDetailValue}>
                      {streakInfo.currentStreak} {item.goalFrequency === "daily" ? "days" : item.goalFrequency === "weekly" ? "weeks" : "months"}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.streakDetail}>
                  <Feather name="award" size={16} color={theme.primary} />
                  <View style={styles.streakDetailText}>
                    <ThemedText style={[styles.streakDetailLabel, { color: theme.textSecondary }]}>
                      Best Streak
                    </ThemedText>
                    <ThemedText style={styles.streakDetailValue}>
                      {streakInfo.bestStreak} {item.goalFrequency === "daily" ? "days" : item.goalFrequency === "weekly" ? "weeks" : "months"}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <Pressable
                style={[styles.editButton, { backgroundColor: theme.primary + "15" }]}
                onPress={() => handleEditHabit(item)}
              >
                <Feather name="edit-2" size={14} color={theme.primary} />
                <ThemedText style={[styles.editButtonText, { color: theme.primary }]}>
                  Edit Habit
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.quickLogButton,
            { backgroundColor: goalMet ? theme.success + "20" : theme.primary + "15" },
          ]}
          onPress={() => handleQuickLog(item)}
          hitSlop={8}
        >
          <Feather
            name="plus"
            size={24}
            color={goalMet ? theme.success : theme.primary}
          />
        </Pressable>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="activity" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        No habits yet. Start tracking your habits to build better routines.
      </ThemedText>
      <Pressable
        style={[styles.addHabitCta, { backgroundColor: theme.primary }]}
        onPress={() => setShowAddHabitModal(true)}
      >
        <Feather name="plus" size={16} color="#FFFFFF" />
        <ThemedText style={styles.addHabitCtaText}>Add Habit</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {categoryHabits.length > 0 ? (
        <FlatList
          data={categoryHabits}
          keyExtractor={(item) => item.id}
          renderItem={renderHabitItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl + 60 },
          ]}
          showsVerticalScrollIndicator={false}
          extraData={expandedHabitId}
        />
      ) : (
        renderEmptyState()
      )}

      <View style={[styles.addButtonContainer, { bottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            setEditingHabit(null);
            setShowAddHabitModal(true);
          }}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText style={styles.addButtonText}>Add Habit</ThemedText>
        </Pressable>
      </View>

      <AddHabitModal
        visible={showAddHabitModal}
        onClose={() => {
          setShowAddHabitModal(false);
          setEditingHabit(null);
        }}
        categoryId={categoryId}
        editingHabit={editingHabit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  habitCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  habitContent: {
    flex: 1,
    padding: Spacing.md,
  },
  habitHeader: {
    marginBottom: Spacing.xs,
  },
  habitTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  habitName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  streakText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  frequencyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  frequencyBadgeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  habitDescription: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  weeklyDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  dayDotWrapper: {
    alignItems: "center",
    gap: 2,
  },
  weeklyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: "500",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  progressText: {
    fontSize: 12,
  },
  goalMetBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  goalMetText: {
    fontSize: 11,
    fontWeight: "500",
  },
  expandedContent: {
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  streakDetailsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  streakDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  streakDetailText: {
    gap: 2,
  },
  streakDetailLabel: {
    fontSize: 11,
  },
  streakDetailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  quickLogButton: {
    width: 56,
    alignSelf: "stretch",
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  addHabitCta: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  addHabitCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  addButtonContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
