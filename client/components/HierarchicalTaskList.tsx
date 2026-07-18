import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, Platform, Modal, Dimensions, TextInput, Text, Animated as RNAnimated, FlatList, StyleProp, ViewStyle, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { 
  Gesture, 
  GestureDetector,
  GestureHandlerRootView,
  TouchableOpacity,
} from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import AppDatePicker from "@/components/AppDatePicker";

import { useTheme } from "@/hooks/useTheme";
import useDisplayDensity from "@/hooks/useDisplayDensity";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SchedulingModal } from "@/components/SchedulingModal";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { AddHabitModal } from "@/components/AddHabitModal";
import { PeopleAvatars } from "@/components/PeopleSelector";
import { useApp } from "@/context/AppContext";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { Task, TaskHierarchy, TaskType, TASK_TYPES, getTaskTypeInfo } from "@/types";
import { RootStackParamList, EntryContext } from "@/navigation/RootStackNavigator";
import { syncCompleteUntilReminder } from "@/utils/completeUntilUtils";
import { getLocalDateString } from "@/utils/planUtils";
import { parseDescriptionLinks } from "@/utils/noteMarkdown";

function isTemporarilyComplete(task: Task): boolean {
  if (task.completionType !== "until" || !task.completionDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const untilDate = new Date(task.completionDate);
  untilDate.setHours(0, 0, 0, 0);
  return untilDate > today;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
}

const ESTIMATED_TIME_ENTRY_TYPES: TaskType[] = ["task", "goal", "project", "objective", "subtask"];

function formatEstimatedTime(minutes: number): string {
  if (minutes >= 240) return "4h+";
  if (minutes < 60) return `${minutes}m`;
  if (minutes === 90) return "1.5h";
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function showsEstimatedTime(task: Task): boolean {
  return (
    task.estimatedMinutes != null &&
    ESTIMATED_TIME_ENTRY_TYPES.includes(task.type)
  );
}

function formatScheduleDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const daysAway = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  if (daysAway > 0 && daysAway <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isScheduleDatePastDue(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function formatDateForStorage(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCompleteUntilDateFromTask(task: Task): Date | null {
  if (task.completionType !== "until" || !task.completionDate) {
    return null;
  }
  return parseDateString(task.completionDate);
}

const TYPE_COLORS: Record<TaskType, string> = {
  goal: "#8B5CF6",
  objective: "#F97316",
  project: "#3B82F6",
  task: "#10B981",
  subtask: "#6B7280",
  appointment: "#EC4899",
  idea: "#EAB308",
  list: "#06B6D4",
  item: "#9CA3AF",
  resource: "#8B5CF6",
};

interface DragContextType {
  draggedTaskId: string | null;
  targetTaskId: string | null;
  highlightedTaskId: string | null;
  setDraggedTaskId: (id: string | null) => void;
  handleTaskTap: (taskId: string, toggleDetails: () => void) => void;
  cancelDrag: () => void;
  clearHighlight: () => void;
}

const DragContext = createContext<DragContextType>({
  draggedTaskId: null,
  targetTaskId: null,
  highlightedTaskId: null,
  setDraggedTaskId: () => {},
  handleTaskTap: () => {},
  cancelDrag: () => {},
  clearHighlight: () => {},
});

interface SaveIndicatorContextType {
  withSaveIndicator: ReturnType<typeof useSaveIndicator>["withSaveIndicator"];
  setRetry: ReturnType<typeof useSaveIndicator>["setRetry"];
}

const SaveIndicatorContext = createContext<SaveIndicatorContextType | null>(null);

function sortSiblings(a: TaskHierarchy, b: TaskHierarchy, parentId: string | null): number {
  if (parentId === null) {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.createdAt - b.createdAt;
  }
  if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
    return a.orderIndex - b.orderIndex;
  }
  const typeOrder =
    TASK_TYPES.findIndex((t) => t.value === a.type) -
    TASK_TYPES.findIndex((t) => t.value === b.type);
  if (typeOrder !== 0) return typeOrder;
  return a.createdAt - b.createdAt;
}

interface FlatListItem {
  id: string;
  task: TaskHierarchy;
  depth: number;
  parentId: string | null;
  isHeader: boolean;
  siblingGroup: string;
  siblingIndex: number;
}

function buildFlatList(
  tasks: TaskHierarchy[],
  expandedIds: Set<string>,
  depth: number = 0,
  parentId: string | null = null,
): FlatListItem[] {
  const result: FlatListItem[] = [];
  const siblingGroup = parentId ?? "root";

  tasks.forEach((task, index) => {
    const hasVisibleChildren =
      expandedIds.has(task.id) && task.children.length > 0;

    result.push({
      id: task.id,
      task,
      depth,
      parentId,
      isHeader: hasVisibleChildren,
      siblingGroup,
      siblingIndex: index,
    });

    if (hasVisibleChildren) {
      result.push(
        ...buildFlatList(task.children, expandedIds, depth + 1, task.id),
      );
    }
  });

  return result;
}

function getGroupLeaves(data: FlatListItem[], siblingGroup: string): FlatListItem[] {
  return data.filter((item) => !item.isHeader && item.siblingGroup === siblingGroup);
}

function isSameIdSet(a: FlatListItem[], b: FlatListItem[]): boolean {
  if (a.length !== b.length) return false;
  const idsA = new Set(a.map((i) => i.id));
  return b.every((i) => idsA.has(i.id));
}

function isContiguousGroup(data: FlatListItem[], leaves: FlatListItem[]): boolean {
  if (leaves.length === 0) return false;
  const indices = leaves.map((leaf) => data.findIndex((d) => d.id === leaf.id));
  return indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
}

function inferNewParentId(
  data: FlatListItem[],
  draggedIndex: number,
  draggedDepth: number,
  draggedOriginalParentId: string | null,
): string | null {
  const itemAbove = draggedIndex > 0 ? data[draggedIndex - 1] : null;
  const itemBelow =
    draggedIndex < data.length - 1 ? data[draggedIndex + 1] : null;

  if (
    itemAbove &&
    itemAbove.id === draggedOriginalParentId &&
    itemBelow &&
    itemBelow.depth === 0 &&
    itemBelow.parentId === null
  ) {
    return null;
  }

  if (itemAbove && itemAbove.id === draggedOriginalParentId && !itemBelow) {
    return null;
  }

  if (
    itemAbove &&
    itemAbove.id === draggedOriginalParentId &&
    itemBelow &&
    itemBelow.depth < draggedDepth &&
    itemBelow.parentId === null
  ) {
    return null;
  }

  if (
    itemAbove?.isHeader &&
    itemBelow &&
    itemBelow.parentId === itemAbove.id
  ) {
    return itemAbove.id;
  }

  if (
    itemAbove?.isHeader &&
    itemBelow &&
    itemBelow.depth > itemAbove.depth + 1
  ) {
    return itemAbove.id;
  }

  if (itemAbove?.isHeader) {
    if (
      itemBelow?.parentId === itemAbove.id ||
      !itemBelow ||
      itemBelow.depth <= itemAbove.depth
    ) {
      return itemAbove.id;
    }
  }

  if (
    itemAbove &&
    itemAbove.depth > draggedDepth &&
    itemAbove.parentId !== null
  ) {
    const targetDepth = draggedDepth;
    for (let i = draggedIndex - 1; i >= 0; i--) {
      const row = data[i];
      if (row.depth === targetDepth && row.isHeader) {
        return row.id;
      }
      if (row.depth < targetDepth) {
        break;
      }
    }
    return itemAbove.parentId;
  }

  if (
    itemBelow &&
    itemBelow.depth > draggedDepth &&
    itemBelow.parentId !== null
  ) {
    const targetDepth = draggedDepth;
    for (let i = draggedIndex - 1; i >= 0; i--) {
      const row = data[i];
      if (row.depth === targetDepth && row.isHeader) {
        return row.id;
      }
      if (row.depth < targetDepth) {
        break;
      }
    }
    return itemBelow.parentId;
  }

  if (
    itemAbove &&
    itemAbove.parentId === draggedOriginalParentId &&
    itemBelow &&
    itemBelow.depth < draggedDepth &&
    itemBelow.parentId === null &&
    draggedOriginalParentId !== null
  ) {
    return null;
  }

  if (
    draggedDepth > 0 &&
    itemAbove &&
    itemAbove.parentId === draggedOriginalParentId &&
    !itemBelow
  ) {
    return null;
  }

  if (
    itemAbove &&
    itemBelow &&
    itemAbove.parentId !== null &&
    itemAbove.parentId === itemBelow.parentId &&
    itemAbove.parentId !== draggedOriginalParentId
  ) {
    return itemAbove.parentId;
  }

  if (
    itemAbove &&
    !itemAbove.isHeader &&
    itemAbove.depth === draggedDepth &&
    itemAbove.parentId !== null &&
    itemAbove.parentId !== draggedOriginalParentId
  ) {
    if (
      !itemBelow ||
      itemBelow.parentId === itemAbove.parentId ||
      itemBelow.depth < draggedDepth
    ) {
      return itemAbove.parentId;
    }
  }

  if (
    itemAbove &&
    itemAbove.depth < draggedDepth &&
    itemAbove.parentId === null &&
    (!itemBelow ||
      (itemBelow.depth < draggedDepth && itemBelow.parentId === null))
  ) {
    return null;
  }

  if (
    itemAbove &&
    itemAbove.depth < draggedDepth &&
    itemAbove.parentId === null &&
    !itemBelow
  ) {
    return null;
  }

  if (
    itemAbove?.parentId === null &&
    itemBelow?.parentId === null &&
    draggedOriginalParentId !== null
  ) {
    return null;
  }

  if (
    draggedDepth > 0 &&
    (itemAbove?.depth === 0 || !itemAbove) &&
    (itemBelow?.depth === 0 || !itemBelow) &&
    draggedOriginalParentId !== null
  ) {
    return null;
  }

  return draggedOriginalParentId;
}

function computeCrossIndex(
  data: FlatListItem[],
  draggedIndex: number,
  newParentId: string | null,
  itemAbove: FlatListItem | null,
  itemBelow: FlatListItem | null,
): number {
  if (itemAbove?.id === newParentId) {
    return 0;
  }

  if (
    itemAbove &&
    itemAbove.parentId === newParentId &&
    !itemAbove.isHeader
  ) {
    const existingGroup = data.filter(
      (row) => row.parentId === newParentId && !row.isHeader,
    );
    const aboveIdx = existingGroup.findIndex((r) => r.id === itemAbove.id);
    return aboveIdx >= 0 ? aboveIdx + 1 : 0;
  }

  if (
    itemBelow &&
    itemBelow.parentId === newParentId &&
    !itemBelow.isHeader
  ) {
    const existingGroup = data.filter(
      (row) => row.parentId === newParentId && !row.isHeader,
    );
    const belowIdx = existingGroup.findIndex((r) => r.id === itemBelow.id);
    return belowIdx >= 0 ? belowIdx : 0;
  }

  if (
    !itemBelow ||
    (itemBelow.depth !== undefined &&
      itemBelow.depth < (itemAbove?.depth ?? 0))
  ) {
    const existingGroup = data.filter(
      (row) => row.parentId === newParentId && !row.isHeader,
    );
    return existingGroup.length;
  }

  return 0;
}

function isDescendant(
  ancestorId: string,
  targetId: string,
  tasksMap: Map<string, Task>,
): boolean {
  let current = tasksMap.get(targetId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = tasksMap.get(current.parentId);
  }
  return false;
}

function buildCrossMoveMessage(
  draggedTask: Task,
  oldParentId: string | null,
  newParentId: string | null,
  tasksMap: Map<string, Task>,
): string {
  const oldParentTask = oldParentId ? tasksMap.get(oldParentId) : null;
  const newParentTask = newParentId ? tasksMap.get(newParentId) : null;

  if (oldParentTask && newParentTask) {
    return `Move "${draggedTask.title}" from "${oldParentTask.title}" to "${newParentTask.title}"?`;
  }
  if (!oldParentTask && newParentTask) {
    return `Move "${draggedTask.title}" into "${newParentTask.title}" as a sub-entry?`;
  }
  if (oldParentTask && !newParentTask) {
    return `Move "${draggedTask.title}" out of "${oldParentTask.title}" to the top level?`;
  }
  return `Move "${draggedTask.title}"?`;
}

function getTypeWarning(task: Task, newParentId: string | null): string {
  if (
    newParentId === null &&
    (task.type === "item" || task.type === "subtask")
  ) {
    return "\n\nNote: This entry type is unusual at the top level.";
  }
  return "";
}

function sortTasksBySiblingOrder(a: Task, b: Task, parentId: string | null): number {
  if (parentId === null) {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }
  return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
}

interface HierarchicalTaskListProps {
  tasks: Task[];
  showCategory?: boolean;
  filterType?: TaskType | null;
  flatSearchResults?: {
    tasks: Task[];
    breadcrumbs: Record<string, string>;
  };
  highlightedTaskId?: string | null;
  onHighlightCleared?: () => void;
  canModifyEntries?: boolean;
  onQuickList?: (entry: Task) => void;
  enableDrag?: boolean;
  headerComponent?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

export function HierarchicalTaskList({
  tasks,
  showCategory = false,
  filterType = null,
  flatSearchResults,
  highlightedTaskId = null,
  onHighlightCleared,
  canModifyEntries = true,
  onQuickList,
  enableDrag = true,
  headerComponent,
  contentContainerStyle,
  style,
}: HierarchicalTaskListProps) {
  const { categories, moveTaskToParent, reorderTasks, updateTask } = useApp();
  const { theme } = useTheme();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 300, successMessage: "Saved" });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ taskId: string; targetId: string } | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{ taskId: string; targetId: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dragKey, setDragKey] = useState(0);
  const draggedItemRef = useRef<FlatListItem | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof DraggableFlatList<FlatListItem>>>(null);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const hierarchy = useMemo(() => {
    if (flatSearchResults) {
      return flatSearchResults.tasks.map((task) => ({
        ...task,
        children: [],
      }));
    }

    const getDescendantIds = (taskId: string): Set<string> => {
      const descendants = new Set<string>();
      const addDescendants = (id: string) => {
        tasks.filter((t) => t.parentId === id).forEach((child) => {
          descendants.add(child.id);
          addDescendants(child.id);
        });
      };
      addDescendants(taskId);
      return descendants;
    };

    const filteredTaskIds = new Set<string>();
    if (filterType) {
      tasks.filter((t) => t.type === filterType).forEach((t) => {
        filteredTaskIds.add(t.id);
        getDescendantIds(t.id).forEach((id) => filteredTaskIds.add(id));
      });
    }

    const buildHierarchy = (parentId: string | null): TaskHierarchy[] => {
      return tasks
        .filter((t) => {
          if (t.parentId !== parentId) return false;
          if (filterType && !filteredTaskIds.has(t.id)) return false;
          return true;
        })
        .map((task) => ({
          ...task,
          children: buildHierarchy(task.id),
        }))
        .sort((a, b) => sortSiblings(a, b, parentId));
    };

    if (filterType) {
      const matchingTasks = tasks.filter((t) => t.type === filterType);
      return matchingTasks.map((task) => ({
        ...task,
        children: buildHierarchy(task.id),
      })).sort((a, b) => {
        if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
          return a.orderIndex - b.orderIndex;
        }
        const typeOrder = TASK_TYPES.findIndex((t) => t.value === a.type) - 
                         TASK_TYPES.findIndex((t) => t.value === b.type);
        if (typeOrder !== 0) return typeOrder;
        return a.createdAt - b.createdAt;
      });
    }

    return buildHierarchy(null);
  }, [tasks, filterType, flatSearchResults]);

  const searchBreadcrumbs = flatSearchResults?.breadcrumbs ?? {};

  const tasksMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const flatList = useMemo(
    () => buildFlatList(hierarchy, expandedIds),
    [hierarchy, expandedIds],
  );

  useEffect(() => {
    if (!highlightedTaskId) return;
    const ancestors: string[] = [];
    let current = tasksMap.get(highlightedTaskId);
    while (current?.parentId) {
      ancestors.push(current.parentId);
      current = tasksMap.get(current.parentId);
    }
    if (ancestors.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
  }, [highlightedTaskId, tasksMap]);

  const confirmCrossMove = useCallback(
    async (
      draggedItem: FlatListItem,
      newParentId: string | null,
      newIndex: number,
    ) => {
      const performCrossMove = async () => {
        const newParent = newParentId ? tasksMap.get(newParentId) : null;
        const oldParentId = draggedItem.parentId;

        if (newParentId === null) {
          await updateTask(draggedItem.id, {
            parentId: null,
            orderIndex: 0,
          });
        } else {
          await updateTask(draggedItem.id, {
            parentId: newParentId,
            ...(newParent?.categoryId ? { categoryId: newParent.categoryId } : {}),
          });
        }

        const existingSiblings = tasks
          .filter((t) => t.parentId === newParentId && t.id !== draggedItem.id)
          .sort((a, b) => {
            if (newParentId === null) {
              return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            }
            return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
          });
        const newOrder = [
          ...existingSiblings.slice(0, newIndex),
          draggedItem,
          ...existingSiblings.slice(newIndex),
        ];
        for (let i = 0; i < newOrder.length; i++) {
          if (newParentId === null) {
            await updateTask(newOrder[i].id, { sortOrder: i * 10 });
          } else {
            await updateTask(newOrder[i].id, { orderIndex: i * 10 });
          }
        }

        const oldSiblings = tasks
          .filter((t) => t.parentId === oldParentId && t.id !== draggedItem.id)
          .sort((a, b) => sortTasksBySiblingOrder(a, b, oldParentId));
        for (let i = 0; i < oldSiblings.length; i++) {
          if (oldParentId === null) {
            await updateTask(oldSiblings[i].id, { sortOrder: i * 10 });
          } else {
            await updateTask(oldSiblings[i].id, { orderIndex: i * 10 });
          }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      };

      setRetry(() => {
        void performCrossMove();
      });
      await withSaveIndicator(performCrossMove, { successMessage: "Moved" });
    },
    [tasks, tasksMap, updateTask, withSaveIndicator, setRetry],
  );

  const handleFlatDragEnd = useCallback(
    async ({ data }: { data: FlatListItem[] }) => {
      const draggedItem = draggedItemRef.current;
      if (!draggedItem) return;

      const original = flatList.find((i) => i.id === draggedItem.id);
      if (!original || original.isHeader) {
        draggedItemRef.current = null;
        return;
      }
      draggedItemRef.current = null;

      const draggedIndex = data.findIndex((i) => i.id === draggedItem.id);
      const oldParentId = original.parentId;
      const itemAbove = draggedIndex > 0 ? data[draggedIndex - 1] : null;
      const itemBelow =
        draggedIndex < data.length - 1 ? data[draggedIndex + 1] : null;
      const newParentId = inferNewParentId(
        data,
        draggedIndex,
        original.depth,
        original.parentId,
      );

      console.log(
        "[DragEnd] draggedItem:",
        original.task.title,
        "depth:",
        original.depth,
        "oldParent:",
        oldParentId,
      );
      console.log(
        "[DragEnd] itemAbove:",
        itemAbove?.task.title,
        "depth:",
        itemAbove?.depth,
        "isHeader:",
        itemAbove?.isHeader,
        "parentId:",
        itemAbove?.parentId,
      );
      console.log(
        "[DragEnd] itemBelow:",
        itemBelow?.task.title,
        "depth:",
        itemBelow?.depth,
        "isHeader:",
        itemBelow?.isHeader,
        "parentId:",
        itemBelow?.parentId,
      );

      const isCrossMove = newParentId !== oldParentId;
      console.log(
        "[DragEnd] newParentId:",
        newParentId,
        "isCrossMove:",
        isCrossMove,
      );

      if (!isCrossMove) {
        const newLeaves = getGroupLeaves(data, original.siblingGroup);
        const oldLeaves = getGroupLeaves(flatList, original.siblingGroup);

        if (
          isSameIdSet(newLeaves, oldLeaves) &&
          isContiguousGroup(data, newLeaves)
        ) {
          const performReorder = async () => {
            for (let i = 0; i < newLeaves.length; i++) {
              const item = newLeaves[i];
              if (item.siblingGroup === "root") {
                await updateTask(item.id, { sortOrder: i * 10 });
              } else {
                await updateTask(item.id, { orderIndex: i * 10 });
              }
            }
          };

          setRetry(() => {
            void performReorder();
          });
          await withSaveIndicator(performReorder, { successMessage: "Order saved" });
        }
        return;
      }

      if (newParentId && isDescendant(original.id, newParentId, tasksMap)) {
        return;
      }

      const draggedTask = original.task;
      const oldParent = oldParentId ? tasksMap.get(oldParentId) : null;
      const newParent = newParentId ? tasksMap.get(newParentId) : null;

      let message = "";
      if (oldParent && newParent) {
        message =
          `Move "${draggedTask.title}" ` +
          `out of "${oldParent.title}" ` +
          `and into "${newParent.title}"?`;
      } else if (!oldParent && newParent) {
        message = `Move "${draggedTask.title}" under "${newParent.title}"?`;
      } else if (oldParent && !newParent) {
        message = `Move "${draggedTask.title}" out of "${oldParent.title}"?`;
      } else {
        message = `Move "${draggedTask.title}" to the top level?`;
      }

      console.log("[DragEnd] message:", message);

      const newIndex = computeCrossIndex(
        data,
        draggedIndex,
        newParentId,
        itemAbove,
        itemBelow,
      );

      console.log(
        "[DragEnd] computedCrossIndex:",
        newIndex,
        "itemAbove:",
        itemAbove?.task.title,
        "itemBelow:",
        itemBelow?.task.title,
      );

      Alert.alert("Move Entry", message, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            setDragKey((k) => k + 1);
          },
        },
        {
          text: "Move",
          onPress: () => {
            void confirmCrossMove(original, newParentId, newIndex);
          },
        },
      ]);
    },
    [flatList, updateTask, tasksMap, confirmCrossMove, withSaveIndicator, setRetry],
  );

  const renderFlatItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<FlatListItem>) => (
      <ScaleDecorator>
        <FlatTaskItem
          flatItem={item}
          drag={item.isHeader || !canModifyEntries ? undefined : drag}
          isActive={isActive}
          isExpanded={expandedIds.has(item.id)}
          showCategory={showCategory}
          categories={categories}
          tasksMap={tasksMap}
          canModifyEntries={canModifyEntries}
          onQuickList={onQuickList}
          onToggleExpand={toggleExpanded}
          parentBreadcrumb={searchBreadcrumbs[item.id]}
          enableDrag={enableDrag}
        />
      </ScaleDecorator>
    ),
    [showCategory, categories, tasksMap, canModifyEntries, onQuickList, toggleExpanded, expandedIds, searchBreadcrumbs, enableDrag],
  );

  const renderStaticFlatItem = useCallback(
    ({ item }: { item: FlatListItem }) => (
      <FlatTaskItem
        flatItem={item}
        isExpanded={expandedIds.has(item.id)}
        showCategory={showCategory}
        categories={categories}
        tasksMap={tasksMap}
        canModifyEntries={canModifyEntries}
        onQuickList={onQuickList}
        onToggleExpand={toggleExpanded}
        parentBreadcrumb={searchBreadcrumbs[item.id]}
        enableDrag={enableDrag}
      />
    ),
    [showCategory, categories, tasksMap, canModifyEntries, onQuickList, toggleExpanded, expandedIds, searchBreadcrumbs, enableDrag],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={56} color="rgba(128,128,128,0.25)" />
        <ThemedText style={styles.emptyText}>No entries yet</ThemedText>
        <ThemedText style={styles.emptyHint}>Tap + to add your first entry</ThemedText>
      </View>
    ),
    [],
  );

  const mergedContentContainerStyle = useMemo(
    () => [styles.listContent, contentContainerStyle],
    [contentContainerStyle],
  );

  const getDescendantIds = useCallback((taskId: string): Set<string> => {
    const descendants = new Set<string>();
    const addDescendants = (id: string) => {
      tasks.filter((t) => t.parentId === id).forEach((child) => {
        descendants.add(child.id);
        addDescendants(child.id);
      });
    };
    addDescendants(taskId);
    return descendants;
  }, [tasks]);

  const cancelDrag = useCallback(() => {
    setDraggedTaskId(null);
    setTargetTaskId(null);
  }, []);

  const handleTaskTap = useCallback((taskId: string, toggleDetails: () => void) => {
    if (!draggedTaskId) {
      toggleDetails();
      return;
    }

    if (draggedTaskId === taskId) {
      cancelDrag();
      return;
    }

    const draggedTask = tasksMap.get(draggedTaskId);
    const targetTask = tasksMap.get(taskId);

    if (!draggedTask || !targetTask) {
      cancelDrag();
      return;
    }

    const descendants = getDescendantIds(draggedTaskId);
    if (descendants.has(taskId)) {
      Alert.alert("Invalid Move", "Cannot move an entry under its own sub-entry.");
      cancelDrag();
      return;
    }

    if (draggedTask.parentId === taskId) {
      Alert.alert("Already There", "This entry is already under the selected parent.");
      cancelDrag();
      return;
    }

    if (draggedTask.parentId === targetTask.parentId) {
      setTargetTaskId(taskId);
      setPendingReorder({ taskId: draggedTaskId, targetId: taskId });
      setShowReorderModal(true);
      return;
    }

    setTargetTaskId(taskId);
    setPendingMove({ taskId: draggedTaskId, targetId: taskId });
    setShowMoveModal(true);
  }, [draggedTaskId, tasksMap, getDescendantIds, cancelDrag]);

  const confirmMove = useCallback(async () => {
    if (!pendingMove) return;
    
    const targetTask = tasksMap.get(pendingMove.targetId);
    await moveTaskToParent(pendingMove.taskId, pendingMove.targetId, targetTask?.categoryId);
    
    setShowMoveModal(false);
    setPendingMove(null);
    setDraggedTaskId(null);
    setTargetTaskId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingMove, tasksMap, moveTaskToParent]);

  const cancelMove = useCallback(() => {
    setShowMoveModal(false);
    setPendingMove(null);
    setDraggedTaskId(null);
    setTargetTaskId(null);
  }, []);

  const confirmReorder = useCallback(async (position: "before" | "after") => {
    if (!pendingReorder) return;
    
    const draggedTask = tasksMap.get(pendingReorder.taskId);
    const targetTask = tasksMap.get(pendingReorder.targetId);
    
    if (!draggedTask || !targetTask) return;
    
    const parentId = draggedTask.parentId || null;
    const siblings = tasks.filter(t => t.parentId === parentId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
    const siblingIds = siblings.map(t => t.id);
    const filteredIds = siblingIds.filter(id => id !== pendingReorder.taskId);
    
    const targetIndex = filteredIds.indexOf(pendingReorder.targetId);
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    
    filteredIds.splice(insertIndex, 0, pendingReorder.taskId);
    
    await reorderTasks(filteredIds, parentId);
    
    setShowReorderModal(false);
    setPendingReorder(null);
    setDraggedTaskId(null);
    setTargetTaskId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingReorder, tasksMap, tasks, reorderTasks]);

  const cancelReorder = useCallback(() => {
    setShowReorderModal(false);
    setPendingReorder(null);
    setDraggedTaskId(null);
    setTargetTaskId(null);
  }, []);

  const draggedTaskTitle = pendingMove ? tasksMap.get(pendingMove.taskId)?.title : "";
  const targetTaskTitle = pendingMove ? tasksMap.get(pendingMove.targetId)?.title : "";
  const reorderDraggedTitle = pendingReorder ? tasksMap.get(pendingReorder.taskId)?.title : "";
  const reorderTargetTitle = pendingReorder ? tasksMap.get(pendingReorder.targetId)?.title : "";

  const clearHighlight = useCallback(() => {
    onHighlightCleared?.();
  }, [onHighlightCleared]);

  return (
    <SaveIndicatorContext.Provider value={{ withSaveIndicator, setRetry }}>
    <DragContext.Provider
      value={{
        draggedTaskId,
        targetTaskId,
        highlightedTaskId,
        setDraggedTaskId,
        handleTaskTap,
        cancelDrag,
        clearHighlight,
      }}
    >
      <GestureHandlerRootView style={[styles.gestureRoot, style]}>
        {!filterType && !flatSearchResults ? (
          <DraggableFlatList
            key={dragKey}
            ref={scrollRef}
            data={flatList}
            keyExtractor={(item) => item.id}
            renderItem={renderFlatItem}
            onDragBegin={(index) => {
              draggedItemRef.current = flatList[index] ?? null;
            }}
            onDragEnd={handleFlatDragEnd}
            ListHeaderComponent={headerComponent ? () => <>{headerComponent}</> : undefined}
            ListEmptyComponent={listEmptyComponent}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            containerStyle={styles.container}
            contentContainerStyle={mergedContentContainerStyle}
            activationDistance={30}
            autoscrollThreshold={80}
            autoscrollSpeed={150}
            dragItemOverflow
            simultaneousHandlers={scrollRef}
          />
        ) : (
          <FlatList
            data={flatList}
            keyExtractor={(item) => item.id}
            renderItem={renderStaticFlatItem}
            ListHeaderComponent={headerComponent ? () => <>{headerComponent}</> : undefined}
            ListEmptyComponent={listEmptyComponent}
            showsVerticalScrollIndicator={false}
            style={styles.container}
            contentContainerStyle={mergedContentContainerStyle}
          />
        )}

        <Modal
          visible={showMoveModal}
          transparent
          animationType="fade"
          onRequestClose={cancelMove}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.modalTitle}>Move Entry</ThemedText>
              <ThemedText style={[styles.modalText, { color: theme.textSecondary }]}>
                Move "{draggedTaskTitle}" as a sub-entry under "{targetTaskTitle}"?
              </ThemedText>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.border }]}
                  onPress={cancelMove}
                >
                  <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.primary }]}
                  onPress={confirmMove}
                >
                  <ThemedText style={[styles.modalButtonText, { color: "#FFFFFF" }]}>Move</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showReorderModal}
          transparent
          animationType="fade"
          onRequestClose={cancelReorder}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.modalTitle}>Reorder Entry</ThemedText>
              <ThemedText style={[styles.modalText, { color: theme.textSecondary }]}>
                Place "{reorderDraggedTitle}" relative to "{reorderTargetTitle}"?
              </ThemedText>
              <View style={styles.reorderButtons}>
                <Pressable
                  style={[styles.reorderButton, { backgroundColor: theme.primary + "15" }]}
                  onPress={() => confirmReorder("before")}
                >
                  <Feather name="arrow-up" size={18} color={theme.primary} />
                  <ThemedText style={[styles.reorderButtonText, { color: theme.primary }]}>Place Before</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.reorderButton, { backgroundColor: theme.primary + "15" }]}
                  onPress={() => confirmReorder("after")}
                >
                  <Feather name="arrow-down" size={18} color={theme.primary} />
                  <ThemedText style={[styles.reorderButtonText, { color: theme.primary }]}>Place After</ThemedText>
                </Pressable>
              </View>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.border, marginTop: Spacing.md }]}
                onPress={cancelReorder}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        <SaveToast
          state={toastState}
          message={toastMessage}
          onRetry={retryFn ?? undefined}
          onDismiss={dismiss}
        />
      </GestureHandlerRootView>
    </DragContext.Provider>
    </SaveIndicatorContext.Provider>
  );
}

type ActionLayout = "goal_idea" | "item_step" | "default";

function getActionLayout(type: TaskType): ActionLayout {
  if (type === "goal" || type === "idea") return "goal_idea";
  if (type === "item" || type === "subtask") return "item_step";
  return "default";
}

interface FlatTaskItemProps {
  flatItem: FlatListItem;
  showCategory: boolean;
  categories: { id: string; name: string; color: string }[];
  tasksMap: Map<string, Task>;
  canModifyEntries: boolean;
  onQuickList?: (entry: Task) => void;
  onToggleExpand: (id: string) => void;
  isExpanded: boolean;
  parentBreadcrumb?: string;
  enableDrag?: boolean;
  drag?: () => void;
  isActive?: boolean;
}

function FlatTaskItem({
  flatItem,
  showCategory,
  categories,
  tasksMap,
  canModifyEntries,
  onQuickList,
  onToggleExpand,
  isExpanded,
  parentBreadcrumb,
  enableDrag = true,
  drag,
  isActive,
}: FlatTaskItemProps) {
  const { task, depth, isHeader } = flatItem;
  const parentTask = flatItem.parentId ? tasksMap.get(flatItem.parentId) : null;
  const parentCategory = parentTask
    ? categories.find((c) => c.id === parentTask.categoryId)
    : null;
  const parentColor = parentCategory?.color ?? null;

  return (
    <View style={{ paddingLeft: depth * 20 }}>
      <TaskItem
        task={task}
        depth={depth}
        suppressDepthMargin
        showCategory={showCategory}
        categories={categories}
        parentColor={parentColor}
        tasksMap={tasksMap}
        canModifyEntries={canModifyEntries}
        onQuickList={onQuickList}
        drag={drag}
        isActive={isActive}
        isHeaderMode={isHeader}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        parentBreadcrumb={parentBreadcrumb}
        enableDrag={enableDrag}
      />
    </View>
  );
}

interface TaskItemProps {
  task: TaskHierarchy;
  depth: number;
  showCategory: boolean;
  categories: { id: string; name: string; color: string }[];
  parentColor: string | null;
  tasksMap: Map<string, Task>;
  canModifyEntries: boolean;
  onQuickList?: (entry: Task) => void;
  drag?: () => void;
  isActive?: boolean;
  suppressDepthMargin?: boolean;
  isHeaderMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  parentBreadcrumb?: string;
  enableDrag?: boolean;
}

function TaskItem({
  task,
  depth,
  showCategory,
  categories,
  parentColor,
  tasksMap,
  canModifyEntries,
  onQuickList,
  drag,
  isActive,
  suppressDepthMargin = false,
  isHeaderMode = false,
  isExpanded = false,
  onToggleExpand,
  parentBreadcrumb,
  enableDrag = true,
}: TaskItemProps) {
  const { theme, isDark } = useTheme();
  const { config } = useDisplayDensity();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateTask, deleteTask, getEventsByTask, getOccurrencesForItem, deleteOccurrence, updateOccurrence, habits, pinTask, unpinTask, events, addEvent, updateEvent, deleteEvent } = useApp();
  const saveIndicator = useContext(SaveIndicatorContext);
  const withSaveIndicator = saveIndicator?.withSaveIndicator;
  const setRetry = saveIndicator?.setRetry;
  const [editingOccurrence, setEditingOccurrence] = useState<{ id: string; notes: string; date: Date } | null>(null);
  const [editCompleteUntilDate, setEditCompleteUntilDate] = useState<Date | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditCompleteUntilPicker, setShowEditCompleteUntilPicker] = useState(false);
  const editPickerOpen = showEditDatePicker || showEditCompleteUntilPicker;
  const tempComplete = isTemporarilyComplete(task);
  const showAsComplete = task.status === "completed" || tempComplete;
  const linkedHabit = habits.find(h => h.linkedTaskId === task.id);
  const taskOccurrences = getOccurrencesForItem(task.id, "task");
  const { draggedTaskId, targetTaskId, highlightedTaskId, setDraggedTaskId, handleTaskTap, cancelDrag, clearHighlight } = useContext(DragContext);
  const [showDetails, setShowDetails] = useState(() => highlightedTaskId === task.id);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const cardOpacity = useRef(new RNAnimated.Value(1)).current;
  const isDragging = draggedTaskId === task.id;
  const isValidDropTarget = draggedTaskId !== null && draggedTaskId !== task.id;
  const isSelectedTarget = targetTaskId === task.id;
  const isHighlighted = highlightedTaskId === task.id;

  const typeInfo = getTaskTypeInfo(task.type);
  const actionLayout = getActionLayout(task.type);
  const category = categories.find((c) => c.id === task.categoryId);
  const hasChildren = task.children.length > 0;
  const typeColor = TYPE_COLORS[task.type];
  const categoryColor = category?.color || theme.primary;

  const closeEditCompletionModal = useCallback(() => {
    setEditingOccurrence(null);
    setEditCompleteUntilDate(null);
    setShowEditDatePicker(false);
    setShowEditCompleteUntilPicker(false);
  }, []);

  const openEditCompletion = useCallback((occ: { id: string; notes?: string; occurredAt: number }) => {
    setEditingOccurrence({
      id: occ.id,
      notes: occ.notes || "",
      date: new Date(occ.occurredAt),
    });
    setEditCompleteUntilDate(getCompleteUntilDateFromTask(task));
    setShowEditDatePicker(false);
    setShowEditCompleteUntilPicker(false);
  }, [task]);

  const handleSaveEditCompletion = useCallback(async () => {
    if (!editingOccurrence || !withSaveIndicator || !setRetry) return;

    const performSave = async () => {
      const dateStr = formatDateForStorage(editingOccurrence.date);
      await updateOccurrence(editingOccurrence.id, {
        notes: editingOccurrence.notes || undefined,
        occurredAt: editingOccurrence.date.getTime(),
        occurredDate: dateStr,
      });

      const untilStr = editCompleteUntilDate ? formatDateForStorage(editCompleteUntilDate) : null;
      if (untilStr) {
        await updateTask(task.id, {
          completionType: "until",
          completionDate: untilStr,
          status: "pending",
        });
      } else if (task.completionType === "until") {
        await updateTask(task.id, {
          completionType: null,
          completionDate: undefined,
        });
      }

      if (untilStr || task.completionType === "until") {
        try {
          await syncCompleteUntilReminder({
            task,
            completeUntilDate: untilStr,
            events,
            addEvent,
            updateEvent,
            deleteEvent,
          });
        } catch (reminderError) {
          console.warn("Failed to sync Complete Until reminder:", reminderError);
        }
      }

      closeEditCompletionModal();
    };

    setRetry(() => {
      void performSave();
    });
    await withSaveIndicator(performSave);
  }, [
    editingOccurrence,
    editCompleteUntilDate,
    updateOccurrence,
    updateTask,
    task,
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    closeEditCompletionModal,
    withSaveIndicator,
    setRetry,
  ]);

  const handleDeleteCompletionLog = useCallback(async (occurrenceId: string) => {
    if (!withSaveIndicator || !setRetry) return;

    const remainingCount = taskOccurrences.filter((o) => o.id !== occurrenceId).length;

    const performDelete = async () => {
      await deleteOccurrence(occurrenceId);

      if (remainingCount === 0) {
        try {
          await updateTask(task.id, {
            status: "pending",
            completionType: null,
            completionDate: undefined,
          });
        } catch (updateError) {
          console.warn("Failed to reset task after deleting completion log:", updateError);
        }

        try {
          await syncCompleteUntilReminder({
            task,
            completeUntilDate: null,
            events,
            addEvent,
            updateEvent,
            deleteEvent,
          });
        } catch (reminderError) {
          console.warn("Failed to delete Complete Until reminder:", reminderError);
        }
      }
    };

    setRetry(() => {
      void performDelete();
    });
    await withSaveIndicator(performDelete, { showSuccess: false });
  }, [
    taskOccurrences,
    deleteOccurrence,
    updateTask,
    task,
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    withSaveIndicator,
    setRetry,
  ]);

  const handleChevronPress = useCallback(() => {
    onToggleExpand?.(task.id);
  }, [onToggleExpand, task.id]);

  useEffect(() => {
    rotation.value = withTiming(isExpanded ? 90 : 0, { duration: 200 });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const itemAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isDragging ? 0.5 : 1,
  }));

  const handleToggleComplete = useCallback(async () => {
    if (task.status !== "completed" && task.type !== "item" && task.type !== "subtask") {
      setShowCompletionModal(true);
      return;
    }

    if (!withSaveIndicator || !setRetry) return;

    const performToggle = async () => {
      if (task.status === "completed") {
        await updateTask(task.id, {
          status: "pending",
          completionType: null,
          completionDate: undefined,
        });
        try {
          await syncCompleteUntilReminder({
            task,
            completeUntilDate: null,
            events,
            addEvent,
            updateEvent,
            deleteEvent,
          });
        } catch (reminderError) {
          console.warn("Failed to clear Complete Until reminder:", reminderError);
        }
      } else {
        await updateTask(task.id, {
          status: "completed",
          completionType: "as_of",
          completionDate: getLocalDateString(),
        });
      }
    };

    setRetry(() => {
      void performToggle();
    });
    await withSaveIndicator(performToggle);
  }, [task, events, addEvent, updateEvent, deleteEvent, updateTask, withSaveIndicator, setRetry]);

  const handleEdit = useCallback(() => {
    navigation.navigate("AddTask", { task, categoryId: task.categoryId, parentTaskId: task.parentId || undefined });
    setShowDetails(false);
  }, [navigation, task]);

  const handleDelete = useCallback(() => {
    const childCount = task.children.length;
    const message = childCount > 0 
      ? `This will delete "${task.title}" and ${childCount} sub-${childCount === 1 ? 'entry' : 'entries'}. Items will be moved to Recycle Bin.`
      : `Delete "${task.title}"? It will be moved to Recycle Bin.`;

    Alert.alert(
      "Delete Entry",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            if (!withSaveIndicator || !setRetry) return;

            const performDelete = async () => {
              await deleteTask(task.id);
              setShowDetails(false);
            };

            setRetry(() => {
              void performDelete();
            });
            await withSaveIndicator(performDelete, { showSuccess: false });
          }
        },
      ]
    );
  }, [task, deleteTask, withSaveIndicator, setRetry]);

  const handleTogglePin = useCallback(async () => {
    if (!withSaveIndicator || !setRetry) return;

    const performPin = async () => {
      if (task.isPinned) {
        await unpinTask(task.id);
      } else {
        await pinTask(task.id);
      }
    };

    setRetry(() => {
      void performPin();
    });
    await withSaveIndicator(performPin);
  }, [task.isPinned, task.id, pinTask, unpinTask, withSaveIndicator, setRetry]);

  const handleAddSubtask = useCallback(() => {
    navigation.navigate("AddTask", { categoryId: task.categoryId, parentTaskId: task.id });
    setShowDetails(false);
  }, [navigation, task.categoryId, task.id]);

  const handleQuickList = useCallback(() => {
    onQuickList?.(task);
    setShowDetails(false);
  }, [onQuickList, task]);

  const handleSchedule = useCallback(() => {
    setShowSchedulingModal(true);
    setShowDetails(false);
  }, []);

  const handleAssist = useCallback(() => {
    const parentTask = task.parentId ? tasksMap.get(task.parentId) : null;
    const entryContext: EntryContext = {
      id: task.id,
      title: task.title,
      type: "task",
      entryType: task.type,
      bubbleName: category?.name,
      bubbleId: task.categoryId || undefined,
      parentTitle: parentTask?.title,
      parentId: task.parentId || undefined,
      description: task.description,
    };
    setShowDetails(false);
    navigation.navigate("AssistantChat", { entryContext });
  }, [task, category, navigation, tasksMap]);

  const taskEvents = getEventsByTask(task.id);
  const linkedEventType = taskEvents.length > 0 ? taskEvents[0].eventType : null;
  const scheduleEvent = taskEvents.length > 0 ? taskEvents[0] : null;
  const scheduleDateStr = scheduleEvent?.startDate;
  const schedulePastDue = scheduleDateStr ? isScheduleDatePastDue(scheduleDateStr) : false;

  const depthScale = config.useDepthScaling
    ? Math.max(0.8, 1 - depth * 0.1)
    : 1.0;
  const titleFontSize = Math.round(config.titleFontSize * depthScale);
  const metaFontSize = Math.round(config.metaFontSize * depthScale);
  const headerPaddingVertical = Math.round(config.cardPaddingVertical * depthScale);
  const headerPaddingHorizontal = config.cardPaddingHorizontal;
  const titleLineHeight = Math.round(titleFontSize * (20 / 15));

  const priorityColor = task.priority === "high" ? theme.error : 
                        task.priority === "medium" ? theme.warning : theme.success;

  const prevHighlighted = useRef(isHighlighted);
  useEffect(() => {
    if (isHighlighted && !prevHighlighted.current) {
      setShowDetails(true);
    }
    prevHighlighted.current = isHighlighted;
  }, [isHighlighted]);

  useEffect(() => {
    if (isHighlighted) {
      const timer = setTimeout(() => {
        clearHighlight();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted, clearHighlight]);

  const cardShadow = Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {},
  });

  const toggleDetails = useCallback(() => {
    setShowDetails(!showDetails);
    if (isHighlighted) {
      clearHighlight();
    }
  }, [showDetails, isHighlighted, clearHighlight]);

  const onTapHandler = useCallback(() => {
    handleTaskTap(task.id, toggleDetails);
  }, [task.id, handleTaskTap, toggleDetails]);

  const pulseCardOpacity = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.timing(cardOpacity, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: true,
      }),
      RNAnimated.timing(cardOpacity, {
        toValue: 1.0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity]);

  const onDoubleTapHandler = useCallback(() => {
    if (!canModifyEntries) return;
    pulseCardOpacity();
    handleEdit();
  }, [pulseCardOpacity, handleEdit, canModifyEntries]);

  const startDrag = useCallback(() => {
    if (!canModifyEntries) return;
    setDraggedTaskId(task.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [canModifyEntries, setDraggedTaskId, task.id]);

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(startDrag)();
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      runOnJS(onDoubleTapHandler)();
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onTapHandler)();
    });

  const tapGestures = Gesture.Exclusive(doubleTapGesture, tapGesture);
  const composed = Gesture.Race(longPressGesture, tapGestures);

  const TITLE_DISPLAY_LIMIT = 80;
  const displayTitle = task.title.length > TITLE_DISPLAY_LIMIT
    ? task.title.substring(0, TITLE_DISPLAY_LIMIT).trimEnd() + "…"
    : task.title;

  const headerContent = (
    <View
      style={[
        styles.itemHeader,
        {
          paddingVertical: headerPaddingVertical,
          paddingHorizontal: headerPaddingHorizontal,
        },
      ]}
    >
      <View style={styles.leftSection}>
        <View style={styles.leftColumn}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
            <ThemedText style={[styles.typeBadgeText, { color: typeColor }]}>
              {typeInfo.label}
            </ThemedText>
            <Feather name={typeInfo.icon as any} size={10} color={typeColor} />
          </View>
          {hasChildren ? (
            <Pressable onPress={handleChevronPress} hitSlop={12} style={styles.expandButton}>
              <Animated.View style={chevronStyle}>
                <Feather name="chevron-right" size={24} color={theme.textSecondary} />
              </Animated.View>
            </Pressable>
          ) : (
            <View style={styles.chevronPlaceholder} />
          )}
        </View>
      </View>

      <View style={styles.itemContent}>
        {parentBreadcrumb ? (
          <ThemedText
            style={[styles.parentBreadcrumb, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {parentBreadcrumb}
          </ThemedText>
        ) : null}
        <View style={styles.titleRow}>
          <ThemedText
            style={[
              styles.title,
              {
                color: isDark ? "#FFFFFF" : theme.text,
                fontSize: titleFontSize,
                lineHeight: titleLineHeight,
              },
              showAsComplete && styles.titleCompleted,
            ]}
            numberOfLines={2}
          >
            {displayTitle}
          </ThemedText>
          <Pressable
            onPress={canModifyEntries ? handleToggleComplete : undefined}
            disabled={!canModifyEntries}
            hitSlop={14}
            style={styles.checkboxButton}
          >
            <View style={styles.checkboxContainer}>
              <View style={[
                styles.checkbox,
                { borderColor: showAsComplete ? theme.success : theme.textSecondary },
                showAsComplete && { backgroundColor: theme.success }
              ]}>
                {showAsComplete ? (
                  <Feather name="check" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              {tempComplete && task.completionDate ? (
                <View style={styles.completeUntilIndicator}>
                  <Feather name="refresh-cw" size={10} color={theme.warning} />
                  <ThemedText style={[styles.completeUntilDate, { color: theme.warning }]}>
                    {formatShortDate(task.completionDate)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
        <View style={styles.bottomIndicatorRow}>
          {hasChildren ? (
            <View style={styles.childCountBadge}>
              <Feather name="layers" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary, fontSize: metaFontSize }]}>
                {task.children.length}
              </ThemedText>
            </View>
          ) : null}

          {task.priority === "high" ? (
            <View style={styles.priorityIcon}>
              <Feather name="alert-circle" size={16} color={theme.error} />
            </View>
          ) : task.priority === "low" ? (
            <View style={styles.priorityIcon}>
              <Feather name="arrow-down-circle" size={16} color={theme.success} />
            </View>
          ) : null}

          {linkedEventType && scheduleDateStr ? (
            <View style={styles.scheduleWithDate}>
              {linkedEventType === "reminder" ? (
                <Feather name="bell" size={16} color="#F59E0B" />
              ) : linkedEventType === "appointment" ? (
                <Feather name="calendar" size={16} color="#3B82F6" />
              ) : linkedEventType === "meeting" ? (
                <Feather name="users" size={16} color="#A855F7" />
              ) : (
                <Feather name="flag" size={16} color={theme.error} />
              )}
              <ThemedText
                style={[
                  styles.scheduleDateText,
                  {
                    color: schedulePastDue ? theme.error : theme.textSecondary,
                    fontSize: metaFontSize,
                  },
                ]}
              >
                {formatScheduleDate(scheduleDateStr)}
              </ThemedText>
            </View>
          ) : null}

          {task.isPinned ? (
            <View style={styles.scheduleIcon}>
              <Feather name="star" size={16} color="#F59E0B" />
            </View>
          ) : null}

          {linkedHabit ? (
            <View style={styles.scheduleIcon}>
              <Feather name="activity" size={16} color="#22C55E" />
            </View>
          ) : null}

          {showsEstimatedTime(task) ? (
            <View style={styles.inlineTimeBadge}>
              <Feather name="clock" size={10} color={theme.textSecondary} />
              <ThemedText
                style={[
                  styles.inlineTimeBadgeText,
                  { color: theme.textSecondary, fontSize: metaFontSize },
                ]}
              >
                {formatEstimatedTime(task.estimatedMinutes!)}
              </ThemedText>
            </View>
          ) : null}

          {task.assigneeIds && task.assigneeIds.length > 0 ? (
            <View style={styles.assigneesContainer}>
              <PeopleAvatars personIds={task.assigneeIds} maxDisplay={3} size={20} />
            </View>
          ) : null}

          {task.sharedWith && task.sharedWith.length > 0 ? (
            <View style={[styles.sharedBadge, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="share-2" size={10} color={theme.primary} />
              <ThemedText style={[styles.sharedBadgeText, { color: theme.primary, fontSize: metaFontSize }]}>
                {task.sharedWith.length}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {showCategory && category ? (
          <View style={styles.categoryBadge}>
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
            <ThemedText style={[styles.metaText, { color: theme.textSecondary, fontSize: metaFontSize }]}>
              {category.name}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.itemWrapper}>
      {depth > 0 && parentColor ? (
        <View 
          style={[
            styles.hierarchyLine, 
            { 
              backgroundColor: parentColor + "40",
              left: (depth - 1) * 20 + 6,
            }
          ]} 
        />
      ) : null}
      <View style={[styles.itemContainer, { marginLeft: suppressDepthMargin ? 0 : depth * 20 }]}>
        <Animated.View
          style={[
            styles.item,
            cardShadow,
            itemAnimatedStyle,
            {
              backgroundColor: isHighlighted
                ? theme.primary + "10"
                : isDark ? theme.backgroundDefault : "#FFFFFF",
              borderColor: isHighlighted
                ? theme.primary
                : isSelectedTarget
                  ? theme.primary
                  : isValidDropTarget
                    ? theme.primary + "50"
                    : (isDark ? theme.border : "transparent"),
              borderWidth: isHighlighted ? 2 : isSelectedTarget ? 2 : isValidDropTarget ? 1.5 : 1,
              opacity: isActive ? 0.95 : 1,
            },
            showAsComplete && styles.itemCompleted,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            {enableDrag && drag ? (
              <TouchableOpacity
                onLongPress={drag}
                delayLongPress={600}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={styles.dragHandle}
              >
                <Feather
                  name="menu"
                  size={18}
                  color={theme.textSecondary}
                  style={{ opacity: 0.5 }}
                />
              </TouchableOpacity>
            ) : !enableDrag ? (
              <View style={styles.dragHandlePlaceholder} />
            ) : null}
            <GestureDetector gesture={composed}>
              <RNAnimated.View style={[styles.cardBody, { opacity: cardOpacity }]}>
                {headerContent}
              </RNAnimated.View>
            </GestureDetector>
          </View>
        </Animated.View>

        {showDetails ? (
          <View style={[styles.details, { borderTopColor: theme.border, backgroundColor: isDark ? theme.backgroundDefault : "#FFFFFF", marginTop: -1, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }]}>
            {task.description ? (
              <Text
                selectable
                style={[styles.description, { color: isDark ? "#9CA3AF" : "#6B7280" }]}
              >
                {parseDescriptionLinks(task.description).map((segment, index) =>
                  segment.url ? (
                    <Text
                      key={index}
                      style={[styles.descriptionLink, { color: theme.primary }]}
                      onPress={() => {
                        Linking.openURL(segment.url!).catch(() => {
                          Alert.alert(
                            "Couldn't open link",
                            "This link could not be opened."
                          );
                        });
                      }}
                    >
                      {segment.text}
                    </Text>
                  ) : (
                    <Text key={index}>{segment.text}</Text>
                  )
                )}
              </Text>
            ) : null}
            {canModifyEntries ? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionsMenuButton, styles.actionsRowButton, { backgroundColor: "#F59E0B" + "15" }]}
                onPress={handleTogglePin}
              >
                <Feather name="star" size={18} color="#F59E0B" />
                {task.isPinned ? (
                  <Feather name="check" size={14} color="#F59E0B" />
                ) : null}
              </Pressable>
              {actionLayout === "goal_idea" ? (
                <>
                  <Pressable
                    style={[styles.actionsMenuButton, styles.actionsRowButton, { backgroundColor: typeColor + "15" }]}
                    onPress={handleAddSubtask}
                  >
                    <Feather name="plus" size={18} color={typeColor} />
                  </Pressable>
                  <Pressable
                    style={[styles.actionsMenuButton, styles.actionsRowButton, styles.actionsRowButtonLabeled, { backgroundColor: "#F59E0B" + "15" }]}
                    onPress={handleAssist}
                  >
                    <Feather name="zap" size={14} color="#F59E0B" />
                    <ThemedText style={[styles.actionsRowButtonLabel, { color: "#F59E0B" }]} numberOfLines={1}>
                      Life Coach
                    </ThemedText>
                  </Pressable>
                </>
              ) : actionLayout === "item_step" ? (
                <>
                  <Pressable
                    style={[styles.actionsMenuButton, styles.actionsRowButton, styles.actionsRowButtonLabeled, { backgroundColor: theme.success + "15" }]}
                    onPress={handleToggleComplete}
                  >
                    <Feather name="check-circle" size={14} color={theme.success} />
                    <ThemedText style={[styles.actionsRowButtonLabel, { color: theme.success }]} numberOfLines={1}>
                      Complete
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionsMenuButton, styles.actionsRowButton, styles.actionsRowButtonLabeled, { backgroundColor: theme.error + "15" }]}
                    onPress={handleDelete}
                  >
                    <Feather name="trash-2" size={14} color={theme.error} />
                    <ThemedText style={[styles.actionsRowButtonLabel, { color: theme.error }]} numberOfLines={1}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.actionsMenuButton, styles.actionsRowButton, { backgroundColor: typeColor + "15" }]}
                    onPress={handleAddSubtask}
                  >
                    <Feather name="plus" size={18} color={typeColor} />
                  </Pressable>
                  <Pressable
                    style={[styles.actionsMenuButton, styles.actionsRowButton, { backgroundColor: "#6B7FFF" + "15" }]}
                    onPress={handleQuickList}
                    disabled={!onQuickList}
                  >
                    <Feather name="list" size={18} color="#6B7FFF" />
                  </Pressable>
                </>
              )}
              <Pressable
                style={[styles.actionsMenuButton, styles.actionsRowButton, { backgroundColor: theme.primary + "15" }]}
                onPress={() => setShowActionsMenu(true)}
              >
                <Feather name="more-horizontal" size={18} color={theme.primary} />
                <ThemedText style={[styles.actionsMenuButtonText, { color: theme.primary }]} numberOfLines={1}>
                  Actions
                </ThemedText>
              </Pressable>
            </View>
            ) : null}

            <Modal
              visible={showActionsMenu && canModifyEntries}
              transparent
              animationType="fade"
              onRequestClose={() => setShowActionsMenu(false)}
            >
              <Pressable 
                style={styles.actionsMenuOverlay} 
                onPress={() => setShowActionsMenu(false)}
              >
                <View style={[styles.actionsMenuContent, { backgroundColor: theme.backgroundDefault }]}>
                  <View style={[styles.actionsMenuHeader, { borderBottomColor: theme.border }]}>
                    <ThemedText style={styles.actionsMenuTitle} numberOfLines={1}>
                      {task.title}
                    </ThemedText>
                    <Pressable onPress={() => setShowActionsMenu(false)} hitSlop={10}>
                      <Feather name="x" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                  
                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      handleAddSubtask();
                    }}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: typeColor + "15" }]}>
                      <Feather name="plus" size={18} color={typeColor} />
                    </View>
                    <ThemedText style={styles.actionsMenuItemText}>Add Sub-entry</ThemedText>
                  </Pressable>

                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      handleQuickList();
                    }}
                    disabled={!onQuickList}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: "#6B7FFF" + "15" }]}>
                      <Feather name="list" size={18} color="#6B7FFF" />
                    </View>
                    <ThemedText style={styles.actionsMenuItemText}>Quick List</ThemedText>
                  </Pressable>

                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      handleSchedule();
                    }}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: "#3B82F6" + "15" }]}>
                      <Feather name="calendar" size={18} color="#3B82F6" />
                    </View>
                    <ThemedText style={styles.actionsMenuItemText}>Schedule</ThemedText>
                  </Pressable>

                  {linkedHabit ? (
                    <View style={[styles.actionsMenuItem, { opacity: 0.6 }]}>
                      <View style={[styles.actionsMenuIconWrap, { backgroundColor: "#22C55E" + "15" }]}>
                        <Feather name="activity" size={18} color="#22C55E" />
                      </View>
                      <ThemedText style={styles.actionsMenuItemText}>Habit Linked</ThemedText>
                      <Feather name="check" size={16} color="#22C55E" style={{ marginLeft: "auto" }} />
                    </View>
                  ) : (
                    <Pressable
                      style={styles.actionsMenuItem}
                      onPress={() => {
                        setShowActionsMenu(false);
                        setShowHabitModal(true);
                      }}
                    >
                      <View style={[styles.actionsMenuIconWrap, { backgroundColor: "#A855F7" + "15" }]}>
                        <Feather name="activity" size={18} color="#A855F7" />
                      </View>
                      <ThemedText style={styles.actionsMenuItemText}>Make Habit</ThemedText>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      handleEdit();
                    }}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: theme.primary + "15" }]}>
                      <Feather name="edit-2" size={18} color={theme.primary} />
                    </View>
                    <ThemedText style={styles.actionsMenuItemText}>Edit</ThemedText>
                  </Pressable>

                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      handleDelete();
                    }}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: theme.error + "15" }]}>
                      <Feather name="trash-2" size={18} color={theme.error} />
                    </View>
                    <ThemedText style={[styles.actionsMenuItemText, { color: theme.error }]}>Delete</ThemedText>
                  </Pressable>

                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      void handleTogglePin();
                    }}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: "#F59E0B" + "15" }]}>
                      <Feather name="star" size={18} color="#F59E0B" />
                    </View>
                    <ThemedText style={styles.actionsMenuItemText}>
                      {task.isPinned ? "Unpin from To Do" : "Pin to To Do"}
                    </ThemedText>
                    {task.isPinned ? (
                      <Feather name="check" size={16} color="#F59E0B" style={{ marginLeft: "auto" }} />
                    ) : null}
                  </Pressable>

                  <Pressable
                    style={styles.actionsMenuItem}
                    onPress={() => {
                      setShowActionsMenu(false);
                      handleAssist();
                    }}
                  >
                    <View style={[styles.actionsMenuIconWrap, { backgroundColor: "#FBBF24" + "15" }]}>
                      <Feather name="zap" size={18} color="#FBBF24" />
                    </View>
                    <ThemedText style={styles.actionsMenuItemText}>AI Assist</ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>

            {taskOccurrences.length > 0 ? (
              <View style={[styles.historySection, { borderTopColor: theme.border }]}>
                <ThemedText style={[styles.historyTitle, { color: theme.textSecondary }]}>
                  Completion History ({taskOccurrences.length})
                </ThemedText>
                {taskOccurrences.slice(0, 5).map((occ) => (
                  <View key={occ.id} style={styles.historyItem}>
                    <View style={styles.historyItemContent}>
                      <Feather name="check-circle" size={12} color={theme.success} />
                      <ThemedText style={[styles.historyDate, { color: theme.text }]} numberOfLines={1}>
                        {new Date(occ.occurredAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {occ.notes ? ` - ${occ.notes}` : ""}
                      </ThemedText>
                    </View>
                    <View style={styles.historyItemActions}>
                      <Pressable
                        onPress={() => openEditCompletion(occ)}
                        hitSlop={10}
                        style={styles.historyActionBtn}
                      >
                        <Feather name="edit-2" size={16} color={theme.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            "Delete Entry",
                            "Remove this completion log entry?",
                            [
                              { text: "Cancel", style: "cancel" },
                              { 
                                text: "Delete", 
                                style: "destructive", 
                                onPress: () => handleDeleteCompletionLog(occ.id),
                              },
                            ]
                          );
                        }}
                        hitSlop={10}
                        style={styles.historyActionBtn}
                      >
                        <Feather name="trash-2" size={16} color={theme.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
                {taskOccurrences.length > 5 ? (
                  <ThemedText style={[styles.historyMore, { color: theme.textSecondary }]}>
                    +{taskOccurrences.length - 5} more
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

      </View>

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
        linkedTask={task}
      />

      <TaskCompletionModal
        visible={showCompletionModal}
        task={task}
        onClose={() => setShowCompletionModal(false)}
        onComplete={() => {}}
      />

      <AddHabitModal
        visible={showHabitModal}
        onClose={() => setShowHabitModal(false)}
        categoryId={task.categoryId}
        linkedTask={task}
      />

      <Modal
        visible={editingOccurrence !== null && !editPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEditCompletionModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeEditCompletionModal}>
          <Pressable 
            style={[styles.editNotesModal, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.editNotesHeader}>
              <ThemedText style={styles.editNotesTitle}>Edit Completion</ThemedText>
              <Pressable onPress={closeEditCompletionModal} hitSlop={10}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[styles.editFieldLabel, { color: theme.textSecondary }]}>Completed On</ThemedText>
            <Pressable 
              style={[styles.editDateButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              onPress={() => setShowEditDatePicker(true)}
            >
              <Feather name="calendar" size={16} color={theme.primary} />
              <ThemedText style={{ color: theme.text, marginLeft: Spacing.sm }}>
                {editingOccurrence ? formatDisplayDate(editingOccurrence.date) : ""}
              </ThemedText>
            </Pressable>

            <ThemedText style={[styles.editFieldLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>
              Complete Until (optional)
            </ThemedText>
            <View style={styles.editCompleteUntilRow}>
              <Pressable
                style={[
                  styles.editDateButton,
                  styles.editCompleteUntilButton,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                ]}
                onPress={() => setShowEditCompleteUntilPicker(true)}
              >
                <Feather name="calendar" size={16} color={theme.primary} />
                <ThemedText style={{ color: theme.text, marginLeft: Spacing.sm }}>
                  {editCompleteUntilDate ? formatDisplayDate(editCompleteUntilDate) : "Not set"}
                </ThemedText>
              </Pressable>
              {editCompleteUntilDate ? (
                <Pressable
                  onPress={() => setEditCompleteUntilDate(null)}
                  hitSlop={10}
                  style={[styles.editClearUntilBtn, { borderColor: theme.border }]}
                >
                  <Feather name="x" size={16} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <ThemedText style={[styles.editFieldLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>Notes</ThemedText>
            <TextInput
              style={[styles.editNotesInput, { 
                backgroundColor: theme.backgroundSecondary, 
                color: theme.text,
                borderColor: theme.border 
              }]}
              placeholder="Add completion notes..."
              placeholderTextColor={theme.textSecondary}
              value={editingOccurrence?.notes || ""}
              onChangeText={(text) => setEditingOccurrence(prev => prev ? { ...prev, notes: text } : null)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.editNotesButtons}>
              <Pressable
                style={[styles.editNotesCancelBtn, { backgroundColor: theme.border }]}
                onPress={closeEditCompletionModal}
              >
                <ThemedText style={styles.editNotesBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.editNotesSaveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveEditCompletion}
              >
                <ThemedText style={[styles.editNotesBtnText, { color: "#FFFFFF" }]}>Save</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AppDatePicker
        visible={showEditDatePicker && editingOccurrence !== null}
        value={editingOccurrence ? formatDateForStorage(editingOccurrence.date) : ""}
        title="Completed On"
        maxDate={formatDateForStorage(new Date())}
        onConfirm={(dateStr) => {
          setEditingOccurrence((prev) =>
            prev ? { ...prev, date: parseDateString(dateStr) } : null,
          );
          setShowEditDatePicker(false);
        }}
        onCancel={() => setShowEditDatePicker(false)}
      />
      <AppDatePicker
        visible={showEditCompleteUntilPicker && editingOccurrence !== null}
        value={
          editCompleteUntilDate
            ? formatDateForStorage(editCompleteUntilDate)
            : formatDateForStorage(editingOccurrence?.date ?? new Date())
        }
        title="Complete Until"
        minDate={editingOccurrence ? formatDateForStorage(editingOccurrence.date) : undefined}
        onConfirm={(dateStr) => {
          setEditCompleteUntilDate(parseDateString(dateStr));
          setShowEditCompleteUntilPicker(false);
        }}
        onCancel={() => setShowEditCompleteUntilPicker(false)}
      />
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  cardBody: {
    flex: 1,
  },
  dragHandle: {
    width: 24,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  dragHandlePlaceholder: {
    width: 24,
    height: 44,
    marginRight: 6,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  emptyText: {
    marginTop: Spacing.lg,
    fontSize: 18,
    fontWeight: "600",
    opacity: 0.5,
  },
  emptyHint: {
    marginTop: Spacing.xs,
    fontSize: 14,
    opacity: 0.4,
  },
  itemWrapper: {
    position: "relative",
  },
  hierarchyLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  itemContainer: {
    marginBottom: Spacing.xs,
  },
  item: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  itemCompleted: {
    opacity: 0.65,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftColumn: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  expandButton: {
    padding: 2,
  },
  chevronPlaceholder: {
    width: 28,
    height: 28,
  },
  checkboxButton: {
    padding: 2,
    marginLeft: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
  },
  parentBreadcrumb: {
    fontSize: 11,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginTop: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
    marginTop: 4,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  inlineTimeBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  scheduleWithDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  scheduleDateText: {
    fontSize: 10,
    fontWeight: "500",
  },
  estimatedTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 4,
  },
  estimatedTimeBadgeText: {
    fontSize: 10,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  _placeholder: {
    borderRadius: 4,
  },
  childCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bottomIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: "nowrap",
  },
  priorityIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  assigneesContainer: {
    marginLeft: Spacing.xs,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: Spacing.xs,
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  metaText: {
    fontSize: 12,
  },
  dragHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: BorderRadius.xs,
  },
  dragHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
  details: {
    padding: Spacing.sm,
    borderTopWidth: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  descriptionLink: {
    textDecorationLine: "underline",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "nowrap",
  },
  actionsRowButton: {
    flex: 1,
    minWidth: 0,
    height: 34,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 0,
  },
  actionsRowButtonLabeled: {
    flexDirection: "column",
    gap: 2,
    paddingVertical: 0,
  },
  actionsRowButtonLabel: {
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: 4,
    minWidth: 90,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  historySection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  historyItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  historyItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyActionBtn: {
    padding: 8,
  },
  historyDate: {
    fontSize: 12,
    flex: 1,
  },
  historyMore: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
  },
  checkboxContainer: {
    alignItems: "center",
  },
  completeUntilIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 2,
  },
  completeUntilDate: {
    fontSize: 9,
    fontWeight: "500",
  },
  children: {
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: Math.min(SCREEN_WIDTH - Spacing.xl * 2, 340),
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  reorderButtons: {
    flexDirection: "column",
    gap: Spacing.sm,
  },
  reorderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  reorderButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  editNotesModal: {
    width: Math.min(SCREEN_WIDTH - Spacing.xl * 2, 340),
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  editNotesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  editNotesTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  editNotesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 100,
    fontSize: 14,
  },
  editNotesButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  editNotesCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  editNotesSaveBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  editNotesBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  editFieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  editDateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  editCompleteUntilRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  editCompleteUntilButton: {
    flex: 1,
    marginBottom: 0,
  },
  editClearUntilBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editDateDoneBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  actionsMenuButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  actionsMenuButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionsMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  actionsMenuContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl + 20,
    paddingHorizontal: Spacing.md,
  },
  actionsMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderBottomWidth: 1,
  },
  actionsMenuTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: Spacing.md,
  },
  actionsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
  },
  actionsMenuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsMenuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
