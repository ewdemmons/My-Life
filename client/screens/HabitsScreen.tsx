import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, FlatList, Alert, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Habit, HABIT_TYPES, GOAL_FREQUENCIES, LifeCategory } from "@/types";
import { AddHabitModal } from "@/components/AddHabitModal";
import { HabitProgressChart } from "@/components/HabitProgressChart";
import { OccurrenceLogModal } from "@/components/OccurrenceLogModal";

type SortMode = "bubble" | "streak" | "completion";
type ViewMode = "week" | "month" | "year";

interface HabitSection {
  title: string;
  color: string;
  categoryId: string;
  data: Habit[];
}

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { habits, categories, addOccurrence, getOccurrencesForItem, deleteOccurrence } = useApp();

  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("bubble");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showLogModal, setShowLogModal] = useState(false);
  const [logModalHabit, setLogModalHabit] = useState<Habit | null>(null);
  const [logModalDate, setLogModalDate] = useState<string | undefined>(undefined);

  const activeHabits = useMemo(
    () => habits.filter((h) => h.isActive),
    [habits]
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

  const getCompletionPercentage = (habit: Habit) => {
    const count = getPeriodCount(habit);
    return Math.min(100, Math.round((count / habit.goalCount) * 100));
  };

  const getStreak = (habit: Habit) => {
    const occurrences = getOccurrencesForItem(habit.id, "habit");
    if (occurrences.length === 0) return 0;

    const sortedDates = [...new Set(occurrences.map((o) => o.occurredDate))].sort().reverse();
    let streak = 0;
    const today = getTodayDateString();
    let currentDate = new Date(today + "T00:00:00");

    for (let i = 0; i < 365; i++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
      if (sortedDates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (i === 0) {
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const habitSections = useMemo(() => {
    const sections: HabitSection[] = [];
    const categoryMap = new Map<string, LifeCategory>();
    categories.forEach((c) => categoryMap.set(c.id, c));

    const groupedHabits: Record<string, Habit[]> = {};
    activeHabits.forEach((habit) => {
      const catId = habit.categoryId;
      if (catId) {
        if (!groupedHabits[catId]) {
          groupedHabits[catId] = [];
        }
        groupedHabits[catId].push(habit);
      }
    });

    Object.entries(groupedHabits).forEach(([categoryId, habits]) => {
      const category = categoryMap.get(categoryId);
      if (category) {
        let sortedHabits = [...habits];
        if (sortMode === "streak") {
          sortedHabits.sort((a, b) => getStreak(b) - getStreak(a));
        } else if (sortMode === "completion") {
          sortedHabits.sort((a, b) => getCompletionPercentage(b) - getCompletionPercentage(a));
        }
        sections.push({
          title: category.name,
          color: category.color,
          categoryId: category.id,
          data: sortedHabits,
        });
      }
    });

    sections.sort((a, b) => a.title.localeCompare(b.title));
    return sections;
  }, [activeHabits, categories, sortMode]);

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
    setSelectedCategoryId(habit.categoryId);
    setShowAddHabitModal(true);
  };

  const handleAddHabit = (categoryId?: string) => {
    setEditingHabit(null);
    setSelectedCategoryId(categoryId || (categories.length > 0 ? categories[0].id : null));
    setShowAddHabitModal(true);
  };

  const toggleSection = (categoryId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId);
    } else {
      newCollapsed.add(categoryId);
    }
    setCollapsedSections(newCollapsed);
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

  const renderHabitCard = ({ item: habit }: { item: Habit }) => {
    const typeInfo = getHabitTypeInfo(habit.habitType);
    const isExpanded = expandedHabitId === habit.id;
    const periodCount = getPeriodCount(habit);
    const progress = Math.min(1, periodCount / habit.goalCount);
    const isPositive = habit.habitType === "positive";
    const occurrenceCounts = getOccurrenceCounts(habit);

    return (
      <View style={[styles.habitCard, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable style={styles.habitCardMain} onPress={() => handleHabitPress(habit)}>
          <View style={styles.habitHeader}>
            <View style={styles.habitInfo}>
              <View style={[styles.habitTypeBadge, { backgroundColor: typeInfo.color + "20" }]}>
                <Feather
                  name={isPositive ? "trending-up" : "trending-down"}
                  size={14}
                  color={typeInfo.color}
                />
              </View>
              <View style={styles.habitNameContainer}>
                <ThemedText style={styles.habitName} numberOfLines={1}>
                  {habit.name}
                </ThemedText>
                <ThemedText style={[styles.habitGoal, { color: theme.textSecondary }]}>
                  {getFrequencyLabel(habit.goalFrequency)} goal: {habit.goalCount}
                </ThemedText>
              </View>
            </View>
            <View style={styles.habitActions}>
              <Pressable
                style={[
                  styles.logButton,
                  { backgroundColor: isPositive ? theme.success + "20" : theme.error + "20" },
                ]}
                onPress={() => handleQuickLog(habit)}
              >
                <Feather
                  name={isPositive ? "plus" : "minus"}
                  size={18}
                  color={isPositive ? theme.success : theme.error}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.countRow}>
            <View style={styles.countItem}>
              <ThemedText style={[styles.countValue, { color: isPositive ? theme.success : theme.error }]}>
                {occurrenceCounts.todayCount}
              </ThemedText>
              <ThemedText style={[styles.countLabel, { color: theme.textSecondary }]}>Today</ThemedText>
            </View>
            <View style={[styles.countDivider, { backgroundColor: theme.border }]} />
            <View style={styles.countItem}>
              <ThemedText style={[styles.countValue, { color: isPositive ? theme.success : theme.error }]}>
                {occurrenceCounts.weekCount}
              </ThemedText>
              <ThemedText style={[styles.countLabel, { color: theme.textSecondary }]}>This Week</ThemedText>
            </View>
            <View style={[styles.countDivider, { backgroundColor: theme.border }]} />
            <View style={styles.countItem}>
              <ThemedText style={[styles.countValue, { color: isPositive ? theme.success : theme.error }]}>
                {occurrenceCounts.monthCount}
              </ThemedText>
              <ThemedText style={[styles.countLabel, { color: theme.textSecondary }]}>This Month</ThemedText>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: isPositive ? theme.success : theme.error,
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
              {periodCount}/{habit.goalCount}
            </ThemedText>
          </View>
        </Pressable>

        {isExpanded ? (
          <View style={[styles.expandedSection, { borderTopColor: theme.border }]}>
            <View style={styles.chartSection}>
              <View style={styles.viewModeToggle}>
                {(["week", "month", "year"] as ViewMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={[
                      styles.viewModeBtn,
                      viewMode === mode && { backgroundColor: theme.primary + "20" },
                    ]}
                    onPress={() => setViewMode(mode)}
                  >
                    <ThemedText
                      style={[
                        styles.viewModeBtnText,
                        { color: viewMode === mode ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <HabitProgressChart
                habit={habit}
                occurrences={getOccurrencesForItem(habit.id, "habit")}
                viewMode={viewMode}
                onBarPress={(date: string) => {
                  setLogModalHabit(habit);
                  setLogModalDate(date);
                  setShowLogModal(true);
                }}
              />
            </View>
            <View style={styles.expandedActions}>
              <Pressable
                style={[styles.expandedBtn, { backgroundColor: theme.primary + "20" }]}
                onPress={() => handleEditHabit(habit)}
              >
                <Feather name="edit-2" size={14} color={theme.primary} />
                <ThemedText style={[styles.expandedBtnText, { color: theme.primary }]}>
                  Edit
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.expandedBtn, { backgroundColor: theme.success + "20" }]}
                onPress={() => {
                  setLogModalHabit(habit);
                  setLogModalDate(undefined);
                  setShowLogModal(true);
                }}
              >
                <Feather name="plus-circle" size={14} color={theme.success} />
                <ThemedText style={[styles.expandedBtnText, { color: theme.success }]}>
                  Log
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: HabitSection }) => {
    const isCollapsed = collapsedSections.has(section.categoryId);
    return (
      <Pressable
        style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}
        onPress={() => toggleSection(section.categoryId)}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.bubbleDot, { backgroundColor: section.color }]} />
          <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
          <View style={[styles.countBadge, { backgroundColor: section.color + "20" }]}>
            <ThemedText style={[styles.countBadgeText, { color: section.color }]}>
              {section.data.length}
            </ThemedText>
          </View>
        </View>
        <Feather
          name={isCollapsed ? "chevron-down" : "chevron-up"}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="activity" size={64} color={theme.textSecondary} />
      <ThemedText style={styles.emptyTitle}>No Habits Yet</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Start building positive routines by adding your first habit
      </ThemedText>
      <Pressable
        style={[styles.addHabitCta, { backgroundColor: theme.primary }]}
        onPress={() => handleAddHabit()}
      >
        <Feather name="plus" size={18} color="#FFFFFF" />
        <ThemedText style={styles.addHabitCtaText}>Add Habit</ThemedText>
      </Pressable>
    </View>
  );

  const filteredSections = habitSections.map((section) => ({
    ...section,
    data: collapsedSections.has(section.categoryId) ? [] : section.data,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.sm }]}>
        <View style={styles.sortContainer}>
          <ThemedText style={[styles.sortLabel, { color: theme.textSecondary }]}>Sort by:</ThemedText>
          <View style={[styles.sortToggle, { backgroundColor: theme.backgroundDefault }]}>
            {(["bubble", "streak", "completion"] as SortMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.sortBtn,
                  sortMode === mode && { backgroundColor: theme.primary },
                ]}
                onPress={() => setSortMode(mode)}
              >
                <ThemedText
                  style={[
                    styles.sortBtnText,
                    { color: sortMode === mode ? "#FFFFFF" : theme.textSecondary },
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {activeHabits.length > 0 ? (
        <SectionList
          sections={filteredSections}
          keyExtractor={(item) => item.id}
          renderItem={renderHabitCard}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + 100,
          }}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          SectionSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        />
      ) : (
        renderEmptyState()
      )}

      {selectedCategoryId ? (
        <AddHabitModal
          visible={showAddHabitModal}
          onClose={() => {
            setShowAddHabitModal(false);
            setEditingHabit(null);
            setSelectedCategoryId(null);
          }}
          categoryId={selectedCategoryId}
          editingHabit={editingHabit}
        />
      ) : null}

      {logModalHabit ? (
        <OccurrenceLogModal
          visible={showLogModal}
          onClose={() => {
            setShowLogModal(false);
            setLogModalHabit(null);
            setLogModalDate(undefined);
          }}
          habit={logModalHabit}
          occurrences={getOccurrencesForItem(logModalHabit.id, "habit")}
          onDeleteOccurrence={deleteOccurrence}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sortContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sortLabel: {
    fontSize: 13,
  },
  sortToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 4,
    flex: 1,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.xs,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  bubbleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  habitCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  habitCardMain: {
    padding: Spacing.md,
  },
  habitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  habitInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  habitTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  habitNameContainer: {
    flex: 1,
  },
  habitName: {
    fontSize: 15,
    fontWeight: "600",
  },
  habitGoal: {
    fontSize: 12,
    marginTop: 2,
  },
  habitActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  logButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  countItem: {
    flex: 1,
    alignItems: "center",
  },
  countValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  countLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  countDivider: {
    width: 1,
    height: 24,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "500",
    minWidth: 40,
    textAlign: "right",
  },
  expandedSection: {
    borderTopWidth: 1,
    padding: Spacing.md,
  },
  chartSection: {
    marginBottom: Spacing.md,
  },
  viewModeToggle: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  viewModeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: "500",
  },
  expandedActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  expandedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  expandedBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  addHabitCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  addHabitCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
