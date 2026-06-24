import React, { useMemo, useCallback, useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Text, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { MasterListPinnedHabitCard } from "@/components/MasterListPinnedHabitCard";
import { MasterListSectionHeader } from "@/components/MasterListSectionHeader";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { canModifyEntryInLifeArea } from "@/lib/permissions";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  groupPinnedTasks,
  buildMasterListFlatData,
  sortMasterListTasks,
  MasterListItem,
} from "@/utils/masterListUtils";
import { getTaskTypeInfo, Habit, Task } from "@/types";
import { getLocalDateString } from "@/utils/planUtils";

export function AgendaMasterListView() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const {
    pinnedTasks,
    pinnedHabits,
    tasks,
    categories,
    unpinTask,
    unpinHabit,
    updateTask,
  } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 300 });

  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());
  const [localFlatData, setLocalFlatData] = useState<MasterListItem[]>([]);

  const markRecentlyCompleted = useCallback((taskId: string) => {
    setRecentlyCompleted((prev) => new Set([...prev, taskId]));
    setTimeout(() => {
      setRecentlyCompleted((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, 1500);
  }, []);

  const toggleEntryExpanded = useCallback((id: string) => {
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const displayTasks = useMemo(() => {
    const active = pinnedTasks.filter((t) => t.status !== "completed");
    const fading = pinnedTasks.filter(
      (t) => recentlyCompleted.has(t.id) && t.status === "completed",
    );
    const activeIds = new Set(active.map((t) => t.id));
    return [...active, ...fading.filter((t) => !activeIds.has(t.id))];
  }, [pinnedTasks, recentlyCompleted]);

  const taskSections = useMemo(() => {
    const sections = groupPinnedTasks(displayTasks);
    return sections.map((section) => ({
      ...section,
      tasks: sortMasterListTasks(section.tasks, "manual", categories),
    }));
  }, [displayTasks, categories]);

  const hasAnyPinned = pinnedTasks.length > 0 || pinnedHabits.length > 0;

  useEffect(() => {
    setLocalFlatData(buildMasterListFlatData(taskSections, {}));
  }, [taskSections]);

  const childEntriesByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of pinnedTasks) {
      const children = tasks
        .filter((t) => t.parentId === task.id && t.status !== "completed")
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      if (children.length > 0) {
        map.set(task.id, children);
      }
    }
    return map;
  }, [pinnedTasks, tasks]);

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

  const handleCheckboxComplete = useCallback(
    async (task: Task) => {
      if (!canModifyTask(task)) return;

      if (task.status !== "completed" && task.type !== "item" && task.type !== "subtask") {
        setCompletionTask(task);
        return;
      }

      const performToggle = async () => {
        if (task.status === "completed") {
          await updateTask(task.id, {
            status: "pending",
            completionType: null,
            completionDate: undefined,
          });
        } else {
          await updateTask(task.id, {
            status: "completed",
            completionType: "as_of",
            completionDate: getLocalDateString(),
          });
          markRecentlyCompleted(task.id);
        }
      };

      setRetry(() => {
        void performToggle();
      });
      await withSaveIndicator(performToggle);
    },
    [canModifyTask, updateTask, withSaveIndicator, setRetry, markRecentlyCompleted],
  );

  const handleUnpinTask = useCallback(
    async (taskId: string) => {
      const performUnpin = async () => {
        await unpinTask(taskId);
      };
      setRetry(() => {
        void performUnpin();
      });
      await withSaveIndicator(performUnpin, { showSuccess: false });
    },
    [unpinTask, withSaveIndicator, setRetry],
  );

  const handleUnpinHabit = useCallback(
    async (habitId: string) => {
      const performUnpin = async () => {
        await unpinHabit(habitId);
      };
      setRetry(() => {
        void performUnpin();
      });
      await withSaveIndicator(performUnpin, { showSuccess: false });
    },
    [unpinHabit, withSaveIndicator, setRetry],
  );

  const renderExpandedChildren = (parentTask: Task) => {
    const children = childEntriesByParent.get(parentTask.id) ?? [];
    const isExpanded = expandedEntryIds.has(parentTask.id);
    if (!isExpanded || children.length === 0) return null;

    return children.map((child) => (
      <View
        key={child.id}
        style={[styles.childEntryRow, { borderTopColor: theme.border }]}
      >
        <Pressable
          onPress={() => handleCheckboxComplete(child)}
          disabled={!canModifyTask(child)}
          style={styles.childCheckbox}
        >
          <View
            style={[
              styles.childCheckboxInner,
              { borderColor: theme.border },
              child.status === "completed" && { backgroundColor: theme.success },
            ]}
          />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigateToTask(child)}>
          <ThemedText
            style={[
              styles.childEntryTitle,
              { color: theme.text },
              child.status === "completed" && {
                textDecorationLine: "line-through",
                color: theme.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {child.title}
          </ThemedText>
        </Pressable>
      </View>
    ));
  };

  const renderTaskCardWrapper = (task: Task) => {
    const category = categories.find((c) => c.id === task.categoryId);
    const typeInfo = getTaskTypeInfo(task.type);
    const children = childEntriesByParent.get(task.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedEntryIds.has(task.id);
    const isComplete = task.status === "completed";

    return (
      <View style={{ opacity: recentlyCompleted.has(task.id) ? 0.4 : 1 }}>
        <View
          style={[
            styles.taskCard,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <Pressable
            style={styles.taskContent}
            onPress={() => navigateToTask(task)}
          >
            <ThemedText
              style={[styles.taskTitle, isComplete && styles.completedText]}
              numberOfLines={1}
            >
              {task.title}
            </ThemedText>
            <View style={styles.taskMeta}>
              {category ? (
                <View style={styles.categoryBadge}>
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {category.name}
                  </ThemedText>
                </View>
              ) : null}
              <View style={[styles.typeBadge, { backgroundColor: "#6B7280" + "20" }]}>
                <Feather
                  name={typeInfo.icon as keyof typeof Feather.glyphMap}
                  size={10}
                  color={theme.textSecondary}
                />
                <ThemedText style={[styles.typeText, { color: theme.textSecondary }]}>
                  {typeInfo.label}
                </ThemedText>
              </View>
              {hasChildren ? (
                <Pressable onPress={() => toggleEntryExpanded(task.id)} hitSlop={8}>
                  <Feather
                    name={isExpanded ? "chevron-down" : "chevron-right"}
                    size={15}
                    color={theme.textSecondary}
                  />
                </Pressable>
              ) : null}
              {task.priority === "high" ? (
                <View style={[styles.priorityBadge, { backgroundColor: theme.error + "20" }]}>
                  <Feather name="alert-circle" size={10} color={theme.error} />
                </View>
              ) : null}
            </View>
          </Pressable>

          {canModifyTask(task) ? (
            <Pressable
              onPress={() => handleUnpinTask(task.id)}
              hitSlop={8}
              style={styles.masterListActionBtn}
            >
              <Feather name="star" size={16} color="#F59E0B" />
              <Text
                style={{
                  fontSize: 9,
                  color: theme.textSecondary,
                  fontWeight: "500",
                }}
              >
                Unpin
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => handleCheckboxComplete(task)}
            disabled={!canModifyTask(task)}
            hitSlop={8}
            style={styles.masterListActionBtn}
          >
            <View
              style={[
                styles.completeCheckbox,
                { borderColor: theme.border },
                isComplete && {
                  backgroundColor: theme.success,
                  borderColor: theme.success,
                },
              ]}
            />
            <Text
              style={{
                fontSize: 9,
                color: theme.textSecondary,
                fontWeight: "500",
              }}
            >
              Complete
            </Text>
          </Pressable>
        </View>
        {renderExpandedChildren(task)}
      </View>
    );
  };

  const renderStaticItem = (item: MasterListItem) => {
    if (item.kind === "header") {
      return <MasterListSectionHeader label={item.label} />;
    }

    return (
      <View style={styles.taskCardWrapper}>
        {renderTaskCardWrapper(item.task)}
      </View>
    );
  };

  return (
    <>
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
            {displayTasks.length > 0 ? (
              <FlatList
                data={localFlatData}
                keyExtractor={(item) =>
                  item.kind === "task" ? item.task.id : item.id
                }
                renderItem={({ item }) => renderStaticItem(item)}
                scrollEnabled={false}
              />
            ) : null}

            {pinnedHabits.length > 0 ? (
              <View style={styles.section}>
                <MasterListSectionHeader label="Habits" />
                {pinnedHabits.map((habit) => (
                  <MasterListPinnedHabitCard
                    key={habit.id}
                    habit={habit}
                    category={categories.find((c) => c.id === habit.categoryId)}
                    onPress={() => navigateToHabit(habit)}
                    onUnpin={() => handleUnpinHabit(habit.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      {completionTask ? (
        <TaskCompletionModal
          visible
          task={completionTask}
          onClose={() => setCompletionTask(null)}
          onComplete={() => {
            markRecentlyCompleted(completionTask.id);
            setCompletionTask(null);
          }}
        />
      ) : null}

      <SaveToast
        state={toastState}
        message={toastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
      />
    </>
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
  taskCardWrapper: {
    marginBottom: Spacing.sm,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  masterListActionBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 8,
    alignSelf: "stretch",
  },
  completeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
  },
  priorityBadge: {
    padding: 4,
    borderRadius: 4,
  },
  childEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  childCheckbox: {
    marginRight: 8,
  },
  childCheckboxInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  childEntryTitle: {
    fontSize: 12,
    flex: 1,
  },
});
