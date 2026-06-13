import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
  ScaleDecorator,
  ShadowDecorator,
} from "react-native-draggable-flatlist";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { BriefToast } from "@/components/BriefToast";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { canModifyEntryInLifeArea } from "@/lib/permissions";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getTaskTypeInfo, getEventTypeInfo, Task, Habit } from "@/types";
import { MasterListSortSheet } from "@/components/MasterListSortSheet";
import { MasterListFilterSheet } from "@/components/MasterListFilterSheet";
import {
  applyMasterListFilters,
  applyMasterListHabitFilters,
  buildMasterListFlatData,
  countActiveFilters,
  DEFAULT_MASTERLIST_FILTERS,
  formatLocalDateYYYYMMDD,
  getLocalTodayDate,
  MASTERLIST_SORT_KEY,
  MasterListFilters,
  MasterListItem,
  MasterListSortOption,
  MasterListTaskSection,
  processMasterListDragEnd,
  shouldShowPinnedEntries,
  shouldShowPinnedHabits,
  sortMasterListTasks,
} from "@/utils/masterListUtils";

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

function groupPinnedTasks(tasks: Task[]): MasterListTaskSection[] {
  const hasAnyDeadline = tasks.some((t) => !!t.deadline);

  if (!hasAnyDeadline) {
    return tasks.length > 0
      ? [{ key: "pinned", label: "Pinned", tasks }]
      : [];
  }

  const todayStr = formatLocalDateYYYYMMDD(getLocalTodayDate());
  const todayDate = getLocalTodayDate();
  const weekEnd = new Date(todayDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayTasks: Task[] = [];
  const thisWeekTasks: Task[] = [];
  const laterTasks: Task[] = [];

  for (const task of tasks) {
    if (task.deadline === todayStr) {
      todayTasks.push(task);
    } else if (task.priority === "high" && !task.deadline) {
      todayTasks.push(task);
    } else if (task.deadline) {
      const deadlineDate = parseLocalDate(task.deadline);
      if (deadlineDate < todayDate) {
        todayTasks.push(task);
      } else if (deadlineDate > todayDate && deadlineDate <= weekEnd) {
        thisWeekTasks.push(task);
      } else {
        laterTasks.push(task);
      }
    } else {
      laterTasks.push(task);
    }
  }

  const sections: MasterListTaskSection[] = [];
  if (todayTasks.length > 0) sections.push({ key: "today", label: "Today", tasks: todayTasks });
  if (thisWeekTasks.length > 0) sections.push({ key: "thisWeek", label: "This Week", tasks: thisWeekTasks });
  if (laterTasks.length > 0) sections.push({ key: "later", label: "Later", tasks: laterTasks });
  return sections;
}

function getStatusColor(status: Task["status"], theme: ReturnType<typeof useTheme>["theme"]): string {
  if (status === "completed") return theme.success;
  if (status === "in_progress") return theme.primary;
  return theme.textSecondary;
}

export function DashboardTab() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const {
    pinnedTasks,
    pinnedHabits,
    tasks,
    unpinTask,
    unpinHabit,
    updateTask,
    updatePinnedTasksBatch,
    categories,
    events,
    isLoading,
  } = useApp();
  const { toastState: saveToastState, toastMessage: saveToastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 300 });

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

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sortOption, setSortOption] = useState<MasterListSortOption>("manual");
  const [filters, setFilters] = useState<MasterListFilters>(DEFAULT_MASTERLIST_FILTERS);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [localFlatData, setLocalFlatData] = useState<MasterListItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const isDraggingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(MASTERLIST_SORT_KEY).then((stored) => {
      if (
        stored === "manual" ||
        stored === "priority" ||
        stored === "deadline" ||
        stored === "lifeArea" ||
        stored === "recentlyAdded"
      ) {
        setSortOption(stored);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToastMessage(null);
    }, 2500);
  }, []);

  const handleSortSelect = useCallback(async (option: MasterListSortOption) => {
    setSortOption(option);
    await AsyncStorage.setItem(MASTERLIST_SORT_KEY, option);
  }, []);

  const activeFilterCount = countActiveFilters(filters);
  const isManualSort = sortOption === "manual";
  const dragEnabled = isManualSort && !isLoading && !isSavingOrder;

  const showPinnedEntries = shouldShowPinnedEntries(filters);
  const showPinnedHabitsList = shouldShowPinnedHabits(filters);

  const filteredTasks = useMemo(
    () => (showPinnedEntries ? applyMasterListFilters(pinnedTasks, filters) : []),
    [pinnedTasks, filters, showPinnedEntries],
  );

  const filteredHabits = useMemo(
    () => (showPinnedHabitsList ? applyMasterListHabitFilters(pinnedHabits, filters) : []),
    [pinnedHabits, filters, showPinnedHabitsList],
  );

  const hasAnyPinned = pinnedTasks.length > 0 || pinnedHabits.length > 0;
  const masterListCount = filteredTasks.length + filteredHabits.length;

  const taskSections = useMemo(() => {
    const sections = groupPinnedTasks(filteredTasks);
    return sections.map((section) => ({
      ...section,
      tasks: sortMasterListTasks(section.tasks, sortOption, categories),
    }));
  }, [filteredTasks, sortOption, categories]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalFlatData(buildMasterListFlatData(taskSections, collapsedSections));
    }
  }, [taskSections, collapsedSections]);

  const childEntriesByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const parent of filteredTasks) {
      const children = tasks
        .filter((t) => t.parentId === parent.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      if (children.length > 0) {
        map.set(parent.id, children);
      }
    }
    return map;
  }, [filteredTasks, tasks]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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
    async (task: Task) => {
      if (!canModifyTask(task)) return;
      const newStatus = task.status === "completed" ? "pending" : "completed";
      const performToggle = async () => {
        await updateTask(task.id, { status: newStatus });
      };
      setRetry(() => {
        void performToggle();
      });
      await withSaveIndicator(performToggle);
    },
    [canModifyTask, updateTask, withSaveIndicator, setRetry],
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

  const handleDragEnd = useCallback(
    async ({ data }: { data: MasterListItem[] }) => {
      isDraggingRef.current = false;
      setLocalFlatData(data);

      const hasAnyDeadline = filteredTasks.some((t) => !!t.deadline);
      const { batchUpdates, toastMessage: sectionToast } = processMasterListDragEnd(
        data,
        taskSections,
        pinnedTasks,
        hasAnyDeadline,
      );

      setIsSavingOrder(true);

      const performDragSave = async () => {
        const success = await updatePinnedTasksBatch(batchUpdates);
        if (!success) throw new Error("Failed to save order");
      };

      setRetry(() => {
        void performDragSave();
      });
      const result = await withSaveIndicator(performDragSave, {
        successMessage: "Order saved",
      });

      setIsSavingOrder(false);

      if (result === null) {
        setLocalFlatData(buildMasterListFlatData(taskSections, collapsedSections));
        return;
      }

      if (sectionToast) showToast(sectionToast);
    },
    [
      filteredTasks,
      taskSections,
      pinnedTasks,
      updatePinnedTasksBatch,
      collapsedSections,
      showToast,
      withSaveIndicator,
      setRetry,
    ],
  );

  const handleDragBegin = useCallback(() => {
    isDraggingRef.current = true;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleNonManualLongPress = useCallback(() => {
    showToast("Switch to Manual sort to reorder");
  }, [showToast]);

  const upcomingEvents = useMemo(() => {
    const today = getLocalTodayDate();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);

    return events
      .filter((event) => {
        const eventDate = parseLocalDate(event.startDate);
        return eventDate >= today && eventDate <= endDate;
      })
      .sort((a, b) => {
        const dateCompare = a.startDate.localeCompare(b.startDate);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 10);
  }, [events]);

  const formatEventDate = (dateStr: string) => {
    const eventDate = parseLocalDate(dateStr);
    const today = getLocalTodayDate();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (eventDate.getTime() === today.getTime()) return "Today";
    if (eventDate.getTime() === tomorrow.getTime()) return "Tomorrow";
    return eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const renderSectionHeader = (section: MasterListTaskSection) => {
    const isCollapsed = !!collapsedSections[section.key];
    const headerStyles = {
      today: { label: styles.sectionLabelToday, color: theme.text },
      thisWeek: { label: styles.sectionLabelThisWeek, color: theme.textSecondary },
      later: { label: styles.sectionLabelLater, color: theme.textSecondary },
      pinned: { label: styles.sectionLabelToday, color: theme.text },
      habits: { label: styles.sectionLabelLater, color: theme.textSecondary },
    };
    const style = headerStyles[section.key];

    return (
      <Pressable
        style={styles.groupHeader}
        onPress={() => toggleSection(section.key)}
      >
        <View style={styles.groupHeaderRow}>
          <ThemedText style={[style.label, { color: style.color }]}>{section.label}</ThemedText>
          <Feather
            name={isCollapsed ? "chevron-down" : "chevron-up"}
            size={18}
            color={theme.textSecondary}
          />
        </View>
        <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
      </Pressable>
    );
  };

  const renderFlatSectionHeader = (item: Extract<MasterListItem, { kind: "header" }>) => {
    const isCollapsed = !!collapsedSections[item.sectionKey];
    const headerStyles = {
      today: { label: styles.sectionLabelToday, color: theme.text },
      thisWeek: { label: styles.sectionLabelThisWeek, color: theme.textSecondary },
      later: { label: styles.sectionLabelLater, color: theme.textSecondary },
      pinned: { label: styles.sectionLabelToday, color: theme.text },
      habits: { label: styles.sectionLabelLater, color: theme.textSecondary },
    };
    const style = headerStyles[item.sectionKey];

    return (
      <Pressable
        style={styles.groupHeader}
        onPress={() => toggleSection(item.sectionKey)}
      >
        <View style={styles.groupHeaderRow}>
          <ThemedText style={[style.label, { color: style.color }]}>{item.label}</ThemedText>
          <Feather
            name={isCollapsed ? "chevron-down" : "chevron-up"}
            size={18}
            color={theme.textSecondary}
          />
        </View>
        <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
      </Pressable>
    );
  };

  const renderSubEntries = (parentTask: Task) => {
    const children = childEntriesByParent.get(parentTask.id);
    if (!children || children.length === 0) return null;

    const visibleChildren = children.slice(0, 3);
    const remaining = children.length - visibleChildren.length;

    return (
      <View style={styles.subEntriesContainer}>
        {visibleChildren.map((child) => (
          <Pressable
            key={child.id}
            style={styles.subEntryRow}
            onPress={() => navigateToTask(child)}
          >
            <Feather
              name="circle"
              size={8}
              color={getStatusColor(child.status, theme)}
              style={styles.subEntryDot}
            />
            <ThemedText
              style={[
                styles.subEntryTitle,
                { color: theme.textSecondary },
                child.status === "completed" && styles.subEntryCompleted,
              ]}
              numberOfLines={1}
            >
              {child.title}
            </ThemedText>
          </Pressable>
        ))}
        {remaining > 0 ? (
          <Pressable
            style={styles.viewAllEntriesBtn}
            onPress={() => navigateToTask(parentTask)}
          >
            <ThemedText style={[styles.viewAllEntriesText, { color: theme.link }]}>
              View all {children.length} entries →
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderTaskCardContent = (task: Task, isActive = false) => {
    const category = categories.find((c) => c.id === task.categoryId);
    const typeInfo = getTaskTypeInfo(task.type);

    return (
      <View
        style={[
          styles.taskCard,
          {
            backgroundColor: isActive ? theme.backgroundSecondary : theme.backgroundDefault,
          },
          isActive && styles.taskCardDragging,
        ]}
      >
        <Pressable
          onPress={() => handleToggleComplete(task)}
          disabled={!canModifyTask(task)}
          hitSlop={8}
          style={styles.checkBtn}
        >
          <Feather
            name={task.status === "completed" ? "check-circle" : "circle"}
            size={22}
            color={task.status === "completed" ? theme.success : theme.textSecondary}
          />
        </Pressable>

        <View style={styles.taskContent}>
          <ThemedText
            style={[
              styles.taskTitle,
              task.status === "completed" && styles.completedText,
            ]}
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
              <Feather name={typeInfo.icon as keyof typeof Feather.glyphMap} size={10} color={theme.textSecondary} />
              <ThemedText style={[styles.typeText, { color: theme.textSecondary }]}>
                {typeInfo.label}
              </ThemedText>
            </View>
            {task.priority === "high" ? (
              <View style={[styles.priorityBadge, { backgroundColor: theme.error + "20" }]}>
                <Feather name="alert-circle" size={10} color={theme.error} />
              </View>
            ) : null}
          </View>
        </View>

        {canModifyTask(task) ? (
        <Pressable
          onPress={() => handleUnpinTask(task.id)}
          hitSlop={8}
          style={styles.unpinBtn}
        >
          <Feather name="star" size={18} color="#F59E0B" />
        </Pressable>
        ) : null}
      </View>
    );
  };

  const renderHabitCardContent = (habit: Habit) => {
    const category = categories.find((c) => c.id === habit.categoryId);

    return (
      <View style={[styles.taskCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.checkBtn}>
          <Feather name="circle" size={22} color={theme.textSecondary} />
        </View>

        <View style={styles.taskContent}>
          <ThemedText style={styles.taskTitle} numberOfLines={1}>
            {habit.name}
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
              <Feather name="activity" size={10} color={theme.textSecondary} />
              <ThemedText style={[styles.typeText, { color: theme.textSecondary }]}>
                Habit
              </ThemedText>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => handleUnpinHabit(habit.id)}
          hitSlop={8}
          style={styles.unpinBtn}
        >
          <Feather name="star" size={18} color="#F59E0B" />
        </Pressable>
      </View>
    );
  };

  const renderStaticHabitCard = (habit: Habit) => (
    <View key={habit.id} style={styles.taskCardWrapper}>
      <Pressable onPress={() => navigateToHabit(habit)}>
        {renderHabitCardContent(habit)}
      </Pressable>
    </View>
  );

  const renderHabitsSection = () => {
    if (filteredHabits.length === 0) return null;

    const isCollapsed = !!collapsedSections.habits;

    return (
      <View style={styles.taskSection}>
        <Pressable
          style={styles.groupHeader}
          onPress={() => toggleSection("habits")}
        >
          <View style={styles.groupHeaderRow}>
            <ThemedText style={[styles.sectionLabelLater, { color: theme.textSecondary }]}>
              Habits
            </ThemedText>
            <Feather
              name={isCollapsed ? "chevron-down" : "chevron-up"}
              size={18}
              color={theme.textSecondary}
            />
          </View>
          <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
        </Pressable>
        {!isCollapsed ? filteredHabits.map((habit) => renderStaticHabitCard(habit)) : null}
      </View>
    );
  };

  const renderStaticTaskCard = (task: Task) => (
    <View key={task.id} style={styles.taskCardWrapper}>
      <Pressable
        onPress={() => navigateToTask(task)}
        onLongPress={handleNonManualLongPress}
        delayLongPress={500}
      >
        {renderTaskCardContent(task)}
      </Pressable>
      {renderSubEntries(task)}
    </View>
  );

  const renderDraggableItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<MasterListItem>) => {
      if (item.kind === "header") {
        return renderFlatSectionHeader(item);
      }

      return (
        <ScaleDecorator activeScale={1.03}>
          <ShadowDecorator>
            <View style={styles.taskCardWrapper}>
              <Pressable
                onPress={() => {
                  if (!isActive) navigateToTask(item.task);
                }}
                onLongPress={() => {
                  if (!dragEnabled) {
                    if (!isManualSort) handleNonManualLongPress();
                    return;
                  }
                  handleDragBegin();
                  drag();
                }}
                delayLongPress={500}
                disabled={isActive}
              >
                {renderTaskCardContent(item.task, isActive)}
              </Pressable>
              {!isActive ? renderSubEntries(item.task) : null}
            </View>
          </ShadowDecorator>
        </ScaleDecorator>
      );
    },
    [
      dragEnabled,
      isManualSort,
      handleNonManualLongPress,
      handleDragBegin,
      navigateToTask,
      collapsedSections,
      theme,
      categories,
      childEntriesByParent,
    ],
  );

  const renderMasterListContent = () => {
    if (!hasAnyPinned) {
      return (
        <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="star" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No pinned tasks yet
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
            Pin important tasks from any bubble to see them here
          </ThemedText>
        </View>
      );
    }

    if (masterListCount === 0) {
      return (
        <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="filter" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No matching pinned tasks
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
            Try adjusting your filters to see more items
          </ThemedText>
        </View>
      );
    }

    if (isManualSort) {
      return (
        <>
          {isSavingOrder ? (
            <ThemedText style={[styles.sortHint, { color: theme.textSecondary }]}>
              Saving order…
            </ThemedText>
          ) : null}
          {filteredTasks.length > 0 ? (
            <NestableDraggableFlatList
              data={localFlatData}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              onDragBegin={handleDragBegin}
              onDragEnd={handleDragEnd}
              renderItem={renderDraggableItem}
              activationDistance={8}
            />
          ) : null}
          {renderHabitsSection()}
        </>
      );
    }

    return (
      <>
        <ThemedText style={[styles.sortHint, { color: theme.textSecondary }]}>
          Drag reordering available in Manual sort mode.
        </ThemedText>
        {taskSections.map((section) => (
          <View key={section.key} style={styles.taskSection}>
            {renderSectionHeader(section)}
            {!collapsedSections[section.key]
              ? section.tasks.map((task) => renderStaticTaskCard(task))
              : null}
          </View>
        ))}
        {renderHabitsSection()}
      </>
    );
  };

  return (
    <>
      <NestableScrollContainer
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xxl,
        }}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="star" size={20} color="#F59E0B" />
            <ThemedText style={styles.sectionTitle}>Master To Do</ThemedText>
            <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
              <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                {masterListCount}
              </ThemedText>
            </View>
          </View>

          {hasAnyPinned ? (
            <View style={styles.controlsRow}>
              <Pressable
                style={[styles.controlButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setShowSortSheet(true)}
              >
                <Feather name="sliders" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.controlButtonText, { color: theme.text }]}>
                  Sort
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.controlButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setShowFilterSheet(true)}
              >
                <Feather name="filter" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.controlButtonText, { color: theme.text }]}>
                  {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : "Filter"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {renderMasterListContent()}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="calendar" size={20} color="#3B82F6" />
            <ThemedText style={styles.sectionTitle}>Upcoming Events</ThemedText>
            <View style={[styles.badge, { backgroundColor: "#3B82F6" + "20" }]}>
              <ThemedText style={[styles.badgeText, { color: "#3B82F6" }]}>
                Next 7 days
              </ThemedText>
            </View>
          </View>

          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => {
              const category = categories.find((c) => c.id === event.categoryId);
              const eventTypeInfo = getEventTypeInfo(event.eventType);
              return (
                <Pressable
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: theme.backgroundDefault }]}
                  onPress={() => {
                    if (category) {
                      navigation.navigate("CategoryDetail", {
                        category,
                        initialEventId: event.id,
                      });
                    }
                  }}
                >
                  <View style={[styles.eventTimeCol, { borderRightColor: theme.border }]}>
                    <ThemedText style={[styles.eventDate, { color: theme.primary }]}>
                      {formatEventDate(event.startDate)}
                    </ThemedText>
                    <ThemedText style={[styles.eventTime, { color: theme.textSecondary }]}>
                      {formatTime(event.startTime)}
                    </ThemedText>
                  </View>

                  <View style={styles.eventContent}>
                    <View style={styles.eventTitleRow}>
                      <View style={[styles.eventTypeDot, { backgroundColor: eventTypeInfo.color }]} />
                      <ThemedText style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </ThemedText>
                    </View>
                    {category ? (
                      <View style={styles.categoryBadge}>
                        <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                          {category.name}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="calendar" size={32} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No upcoming events
              </ThemedText>
              <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
                Schedule events in your bubbles to see them here
              </ThemedText>
            </View>
          )}
        </View>
      </NestableScrollContainer>

      <BriefToast message={toastMessage} visible={toastVisible} />

      <SaveToast
        state={saveToastState}
        message={saveToastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
      />

      <MasterListSortSheet
        visible={showSortSheet}
        selected={sortOption}
        onSelect={handleSortSelect}
        onClose={() => setShowSortSheet(false)}
      />

      <MasterListFilterSheet
        visible={showFilterSheet}
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onClose={() => setShowFilterSheet(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  controlsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sortHint: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
  taskSection: {
    marginBottom: Spacing.sm,
  },
  groupHeader: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  groupSeparator: {
    height: 1,
    width: "100%",
  },
  sectionLabelToday: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionLabelThisWeek: {
    fontSize: 15,
    fontWeight: "600",
  },
  sectionLabelLater: {
    fontSize: 14,
    fontWeight: "500",
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
  taskCardDragging: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  checkBtn: {
    padding: 2,
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
  unpinBtn: {
    padding: 4,
  },
  subEntriesContainer: {
    paddingLeft: 16,
    paddingTop: Spacing.xs,
    gap: 4,
  },
  subEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    gap: Spacing.sm,
  },
  subEntryDot: {
    marginTop: 1,
  },
  subEntryTitle: {
    fontSize: 13,
    flex: 1,
  },
  subEntryCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  viewAllEntriesBtn: {
    paddingVertical: 4,
  },
  viewAllEntriesText: {
    fontSize: 12,
    fontWeight: "500",
  },
  eventCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  eventTimeCol: {
    width: 80,
    padding: Spacing.md,
    borderRightWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventDate: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  eventTime: {
    fontSize: 11,
    marginTop: 2,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  eventTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: Spacing.md,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
