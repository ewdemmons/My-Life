import React, { useMemo, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { MasterListPinnedTaskCard } from "@/components/MasterListPinnedTaskCard";
import { MasterListPinnedHabitCard } from "@/components/MasterListPinnedHabitCard";
import { MasterListSectionHeader } from "@/components/MasterListSectionHeader";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { canModifyEntryInLifeArea } from "@/lib/permissions";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { groupPinnedTasks } from "@/utils/masterListUtils";
import { Habit, Task } from "@/types";

export function AgendaMasterListView() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { pinnedTasks, pinnedHabits, categories, unpinTask, unpinHabit, updateTask } = useApp();

  const visiblePinnedTasks = useMemo(
    () => pinnedTasks.filter((task) => task.status !== "completed"),
    [pinnedTasks],
  );
  const taskSections = useMemo(() => groupPinnedTasks(visiblePinnedTasks), [visiblePinnedTasks]);
  const hasAnyPinned = visiblePinnedTasks.length > 0 || pinnedHabits.length > 0;

  const canModifyTask = useCallback(
    (task: Task) => {
      if (!user) return false;
      return canModifyEntryInLifeArea(
        user.id,
        task.userId ?? user.id,
        task.categoryId || null,
        categories,
      );
    },
    [user, categories],
  );

  const navigateToTask = useCallback(
    (task: Task) => {
      const category = categories.find((c) => c.id === task.categoryId);
      if (category) {
        navigation.navigate("CategoryDetail", {
          category,
          initialTaskId: task.id,
        });
      }
    },
    [categories, navigation],
  );

  const navigateToHabit = useCallback(
    (habit: Habit) => {
      if (!habit.categoryId) return;
      const category = categories.find((c) => c.id === habit.categoryId);
      if (category) {
        navigation.navigate("CategoryDetail", { category });
      }
    },
    [categories, navigation],
  );

  const handleToggleComplete = useCallback(
    (task: Task) => {
      if (!canModifyTask(task)) return;
      const newStatus = task.status === "completed" ? "pending" : "completed";
      updateTask(task.id, { status: newStatus });
    },
    [canModifyTask, updateTask],
  );

  return (
    <View style={styles.container}>
      {!hasAnyPinned ? (
        <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="star" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No pinned tasks yet
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
            Pin important tasks from any bubble to see them here
          </ThemedText>
        </View>
      ) : (
        <View style={styles.sections}>
          {taskSections.map((section) => (
            <View key={section.key} style={styles.section}>
              <MasterListSectionHeader label={section.label} />
              {section.tasks.map((task) => (
                <MasterListPinnedTaskCard
                  key={task.id}
                  task={task}
                  category={categories.find((c) => c.id === task.categoryId)}
                  onPress={() => navigateToTask(task)}
                  onToggleComplete={() => handleToggleComplete(task)}
                  onUnpin={() => unpinTask(task.id)}
                  canModify={canModifyTask(task)}
                />
              ))}
            </View>
          ))}

          {pinnedHabits.length > 0 ? (
            <View style={styles.section}>
              <MasterListSectionHeader label="Habits" />
              {pinnedHabits.map((habit) => (
                <MasterListPinnedHabitCard
                  key={habit.id}
                  habit={habit}
                  category={categories.find((c) => c.id === habit.categoryId)}
                  onPress={() => navigateToHabit(habit)}
                  onUnpin={() => unpinHabit(habit.id)}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.lg,
  },
  sections: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xxl,
    marginHorizontal: Spacing.lg,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
