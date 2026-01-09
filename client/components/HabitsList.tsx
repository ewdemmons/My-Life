import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, FlatList, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Habit, HABIT_TYPES, GOAL_FREQUENCIES, Occurrence } from "@/types";
import { AddHabitModal } from "@/components/AddHabitModal";
import { HabitProgressChart } from "@/components/HabitProgressChart";
import { OccurrenceLogModal } from "@/components/OccurrenceLogModal";

interface HabitsListProps {
  categoryId: string;
}

type ViewMode = "week" | "month" | "year";

export function HabitsList({ categoryId }: HabitsListProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { habits, addOccurrence, getOccurrencesForItem, deleteOccurrence } = useApp();

  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showLogModal, setShowLogModal] = useState(false);
  const [logModalHabit, setLogModalHabit] = useState<Habit | null>(null);
  const [logModalDate, setLogModalDate] = useState<string | undefined>(undefined);

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

  const getPeriodCount = (habit: Habit) => {
    const occurrences = getOccurrencesForItem(habit.id, "habit");
    const now = new Date();
    
    if (habit.goalFrequency === "daily") {
      const today = getTodayDateString();
      return occurrences.filter((o) => o.occurredDate === today).length;
    } else if (habit.goalFrequency === "weekly") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return occurrences.filter((o) => {
        const [y, m, d] = o.occurredDate.split("-").map(Number);
        const occDate = new Date(y, m - 1, d);
        return occDate >= startOfWeek;
      }).length;
    } else {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return occurrences.filter((o) => {
        const [y, m, d] = o.occurredDate.split("-").map(Number);
        const occDate = new Date(y, m - 1, d);
        return occDate >= startOfMonth;
      }).length;
    }
  };

  const getPeriodLabel = (frequency: string) => {
    switch (frequency) {
      case "daily": return "Today";
      case "weekly": return "This Week";
      case "monthly": return "This Month";
      default: return "Today";
    }
  };

  const getOccurrenceCounts = (habit: Habit) => {
    const occurrences = getOccurrencesForItem(habit.id, "habit");
    const now = new Date();
    const today = getTodayDateString();
    
    const todayCount = occurrences.filter((o) => o.occurredDate === today).length;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekCount = occurrences.filter((o) => {
      const [y, m, d] = o.occurredDate.split("-").map(Number);
      const occDate = new Date(y, m - 1, d);
      return occDate >= startOfWeek;
    }).length;
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = occurrences.filter((o) => {
      const [y, m, d] = o.occurredDate.split("-").map(Number);
      const occDate = new Date(y, m - 1, d);
      return occDate >= startOfMonth;
    }).length;
    
    return { todayCount, weekCount, monthCount };
  };

  const handleDecrement = async (habit: Habit) => {
    const occurrences = getOccurrencesForItem(habit.id, "habit");
    const now = new Date();
    
    let periodOccurrences: Occurrence[] = [];
    
    if (habit.goalFrequency === "daily") {
      const today = getTodayDateString();
      periodOccurrences = occurrences.filter((o) => o.occurredDate === today);
    } else if (habit.goalFrequency === "weekly") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      periodOccurrences = occurrences.filter((o) => {
        const [y, m, d] = o.occurredDate.split("-").map(Number);
        const occDate = new Date(y, m - 1, d);
        return occDate >= startOfWeek;
      });
    } else {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      periodOccurrences = occurrences.filter((o) => {
        const [y, m, d] = o.occurredDate.split("-").map(Number);
        const occDate = new Date(y, m - 1, d);
        return occDate >= startOfMonth;
      });
    }
    
    if (periodOccurrences.length === 0) return;
    
    const lastOccurrence = periodOccurrences.sort((a, b) => b.occurredAt - a.occurredAt)[0];
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await deleteOccurrence(lastOccurrence.id);
    } catch (error) {
      Alert.alert("Error", "Failed to remove occurrence. Please try again.");
    }
  };

  const handleBarPress = (habit: Habit, dateKey: string, count: number) => {
    setLogModalHabit(habit);
    setLogModalDate(dateKey);
    setShowLogModal(true);
  };

  const handleViewAllLogs = (habit: Habit) => {
    setLogModalHabit(habit);
    setLogModalDate(undefined);
    setShowLogModal(true);
  };

  const renderViewModeToggle = () => (
    <View style={[styles.viewModeToggle, { backgroundColor: theme.backgroundDefault }]}>
      {(["week", "month", "year"] as ViewMode[]).map((mode) => (
        <Pressable
          key={mode}
          style={[
            styles.viewModeBtn,
            viewMode === mode && { backgroundColor: theme.primary },
          ]}
          onPress={() => setViewMode(mode)}
        >
          <ThemedText
            style={[
              styles.viewModeBtnText,
              { color: viewMode === mode ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderProgressBar = (habit: Habit) => {
    const periodCount = getPeriodCount(habit);
    const goal = habit.goalCount;
    const isNegative = habit.habitType === "negative";
    const progressPercent = goal > 0 ? Math.min((periodCount / goal) * 100, 100) : 0;
    const goalLinePercent = 100;
    
    const barColor = isNegative ? theme.error : theme.success;
    const periodLabel = getPeriodLabel(habit.goalFrequency);

    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                backgroundColor: barColor,
                width: `${progressPercent}%`,
              }
            ]} 
          />
          <View 
            style={[
              styles.goalLine,
              { 
                left: `${goalLinePercent}%`,
                borderColor: theme.textSecondary,
              }
            ]}
          />
        </View>
        <ThemedText style={[styles.progressLabel, { color: theme.textSecondary }]}>
          {periodLabel}: {periodCount}/{goal}
        </ThemedText>
      </View>
    );
  };

  const renderHabitItem = ({ item }: { item: Habit }) => {
    const typeInfo = getHabitTypeInfo(item.habitType);
    const periodCount = getPeriodCount(item);
    const goalMet = periodCount >= item.goalCount;
    const counts = getOccurrenceCounts(item);
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
          
          {renderProgressBar(item)}
          
          <View style={styles.countsRow}>
            <ThemedText style={[styles.countText, { color: theme.textSecondary }]}>
              Today: {counts.todayCount}
            </ThemedText>
            <ThemedText style={[styles.countText, { color: theme.textSecondary }]}>
              This Week: {counts.weekCount}
            </ThemedText>
            <ThemedText style={[styles.countText, { color: theme.textSecondary }]}>
              This Month: {counts.monthCount}
            </ThemedText>
          </View>
          
          {isExpanded ? (
            <View style={styles.expandedContent}>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.chartSection}>
                <ThemedText style={[styles.chartTitle, { color: theme.textSecondary }]}>
                  Progress Chart
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <HabitProgressChart
                    habit={item}
                    occurrences={getOccurrencesForItem(item.id, "habit")}
                    viewMode={viewMode}
                    onBarPress={(dateKey, count) => handleBarPress(item, dateKey, count)}
                  />
                </ScrollView>
              </View>

              <View style={styles.actionButtons}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
                  onPress={() => handleViewAllLogs(item)}
                >
                  <Feather name="list" size={14} color={theme.primary} />
                  <ThemedText style={[styles.actionButtonText, { color: theme.primary }]}>
                    View Logs
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
                  onPress={() => handleEditHabit(item)}
                >
                  <Feather name="edit-2" size={14} color={theme.primary} />
                  <ThemedText style={[styles.actionButtonText, { color: theme.primary }]}>
                    Edit Habit
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.logButtonsContainer}>
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
          {isExpanded ? (
            <Pressable
              style={[
                styles.decrementButton,
                { backgroundColor: periodCount > 0 ? theme.error + "15" : theme.border },
              ]}
              onPress={() => handleDecrement(item)}
              disabled={periodCount === 0}
              hitSlop={8}
            >
              <Feather
                name="minus"
                size={24}
                color={periodCount > 0 ? theme.error : theme.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>
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
      <View style={[styles.stickyHeader, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={[styles.addButtonSmall, { backgroundColor: theme.primary }]}
            onPress={() => {
              setEditingHabit(null);
              setShowAddHabitModal(true);
            }}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <ThemedText style={styles.addButtonSmallText}>Add Habit</ThemedText>
          </Pressable>
          {renderViewModeToggle()}
        </View>
      </View>
      
      {categoryHabits.length > 0 ? (
        <FlatList
          data={categoryHabits}
          keyExtractor={(item) => item.id}
          renderItem={renderHabitItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          extraData={[expandedHabitId, viewMode]}
        />
      ) : (
        renderEmptyState()
      )}

      <AddHabitModal
        visible={showAddHabitModal}
        onClose={() => {
          setShowAddHabitModal(false);
          setEditingHabit(null);
        }}
        categoryId={categoryId}
        editingHabit={editingHabit}
      />

      <OccurrenceLogModal
        visible={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setLogModalHabit(null);
          setLogModalDate(undefined);
        }}
        habit={logModalHabit}
        occurrences={logModalHabit ? getOccurrencesForItem(logModalHabit.id, "habit") : []}
        onDeleteOccurrence={deleteOccurrence}
        filterDate={logModalDate}
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
  expandedContent: {
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
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
  viewModeToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.full,
    padding: 4,
  },
  viewModeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.full,
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartSection: {
    marginTop: Spacing.md,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressBarContainer: {
    marginTop: Spacing.md,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  goalLine: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 0,
    borderRightWidth: 2,
    borderStyle: "dashed",
    marginLeft: -2,
  },
  progressLabel: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  logButtonsContainer: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  decrementButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  stickyHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  addButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  addButtonSmallText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  countsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  countText: {
    fontSize: 11,
  },
});
