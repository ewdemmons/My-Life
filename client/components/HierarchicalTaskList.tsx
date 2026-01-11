import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, Platform, Modal, Dimensions, TextInput } from "react-native";
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
} from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ClickableDescription } from "@/components/ClickableDescription";
import { SchedulingModal } from "@/components/SchedulingModal";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { AddHabitModal } from "@/components/AddHabitModal";
import { PeopleAvatars } from "@/components/PeopleSelector";
import { useApp } from "@/context/AppContext";
import { Task, TaskHierarchy, TaskType, TASK_TYPES, getTaskTypeInfo } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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

interface HierarchicalTaskListProps {
  tasks: Task[];
  showCategory?: boolean;
  filterType?: TaskType | null;
  highlightedTaskId?: string | null;
  onHighlightCleared?: () => void;
}

export function HierarchicalTaskList({ 
  tasks, 
  showCategory = false, 
  filterType = null,
  highlightedTaskId = null,
  onHighlightCleared,
}: HierarchicalTaskListProps) {
  const { categories, moveTaskToParent, reorderTasks } = useApp();
  const { theme } = useTheme();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ taskId: string; targetId: string } | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{ taskId: string; targetId: string } | null>(null);

  const hierarchy = useMemo(() => {
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
        .sort((a, b) => {
          if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
            return a.orderIndex - b.orderIndex;
          }
          const typeOrder = TASK_TYPES.findIndex((t) => t.value === a.type) - 
                           TASK_TYPES.findIndex((t) => t.value === b.type);
          if (typeOrder !== 0) return typeOrder;
          return a.createdAt - b.createdAt;
        });
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
  }, [tasks, filterType]);

  const tasksMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

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

  if (hierarchy.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={56} color="rgba(128,128,128,0.25)" />
        <ThemedText style={styles.emptyText}>No entries yet</ThemedText>
        <ThemedText style={styles.emptyHint}>Tap + to add your first entry</ThemedText>
      </View>
    );
  }

  const clearHighlight = useCallback(() => {
    onHighlightCleared?.();
  }, [onHighlightCleared]);

  return (
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
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
          {hierarchy.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              depth={0}
              showCategory={showCategory}
              categories={categories}
              parentColor={null}
            />
          ))}
        </View>

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
      </GestureHandlerRootView>
    </DragContext.Provider>
  );
}

interface TaskItemProps {
  task: TaskHierarchy;
  depth: number;
  showCategory: boolean;
  categories: { id: string; name: string; color: string }[];
  parentColor: string | null;
}

function TaskItem({ task, depth, showCategory, categories, parentColor }: TaskItemProps) {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateTask, deleteTask, getEventsByTask, getOccurrencesForItem, deleteOccurrence, updateOccurrence, habits, pinTask, unpinTask } = useApp();
  const [editingOccurrence, setEditingOccurrence] = useState<{ id: string; notes: string; date: Date } | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const tempComplete = isTemporarilyComplete(task);
  const showAsComplete = task.status === "completed" || tempComplete;
  const linkedHabit = habits.find(h => h.linkedTaskId === task.id);
  const taskOccurrences = getOccurrencesForItem(task.id, "task");
  const { draggedTaskId, targetTaskId, highlightedTaskId, setDraggedTaskId, handleTaskTap, cancelDrag, clearHighlight } = useContext(DragContext);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(() => highlightedTaskId === task.id);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = draggedTaskId === task.id;
  const isValidDropTarget = draggedTaskId !== null && draggedTaskId !== task.id;
  const isSelectedTarget = targetTaskId === task.id;
  const isHighlighted = highlightedTaskId === task.id;

  const typeInfo = getTaskTypeInfo(task.type);
  const category = categories.find((c) => c.id === task.categoryId);
  const hasChildren = task.children.length > 0;
  const typeColor = TYPE_COLORS[task.type];
  const categoryColor = category?.color || theme.primary;

  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
    rotation.value = withTiming(isExpanded ? 0 : 90, { duration: 200 });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const itemAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isDragging ? 0.5 : 1,
  }));

  const handleToggleComplete = useCallback(async () => {
    if (task.status === "completed") {
      await updateTask(task.id, { status: "pending" });
    } else {
      setShowCompletionModal(true);
    }
  }, [task.id, task.status, updateTask]);

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
            await deleteTask(task.id);
            setShowDetails(false);
          }
        },
      ]
    );
  }, [task, deleteTask]);

  const handleAddSubtask = useCallback(() => {
    navigation.navigate("AddTask", { categoryId: task.categoryId, parentTaskId: task.id });
    setShowDetails(false);
  }, [navigation, task.categoryId, task.id]);

  const handleSchedule = useCallback(() => {
    setShowSchedulingModal(true);
    setShowDetails(false);
  }, []);

  const taskEvents = getEventsByTask(task.id);
  const hasScheduledEvents = taskEvents.length > 0;
  const linkedEventType = taskEvents.length > 0 ? taskEvents[0].eventType : null;

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

  const startDrag = useCallback(() => {
    setDraggedTaskId(task.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [task.id, setDraggedTaskId]);

  const toggleDetails = useCallback(() => {
    setShowDetails(!showDetails);
    if (isHighlighted) {
      clearHighlight();
    }
  }, [showDetails, isHighlighted, clearHighlight]);

  const onTapHandler = useCallback(() => {
    handleTaskTap(task.id, toggleDetails);
  }, [task.id, handleTaskTap, toggleDetails]);

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onEnd((_event, success) => {
      if (success) {
        scale.value = withSpring(1.02);
        runOnJS(startDrag)();
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(onTapHandler)();
    });

  const composed = Gesture.Race(longPressGesture, tapGesture);

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
      <View style={[styles.itemContainer, { marginLeft: depth * 20 }]}>
        <GestureDetector gesture={composed}>
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
              },
              showAsComplete && styles.itemCompleted,
            ]}
          >
            <View style={styles.itemHeader}>
              <View style={styles.leftSection}>
                <View style={styles.leftColumn}>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
                    <Feather name={typeInfo.icon as any} size={12} color={typeColor} />
                    <ThemedText style={[styles.typeBadgeText, { color: typeColor }]}>
                      {typeInfo.label}
                    </ThemedText>
                  </View>
                  {hasChildren ? (
                    <Pressable onPress={toggleExpand} hitSlop={12} style={styles.expandButton}>
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
                <View style={styles.titleRow}>
                  <ThemedText
                    style={[
                      styles.title,
                      { color: isDark ? "#FFFFFF" : theme.text },
                      showAsComplete && styles.titleCompleted,
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </ThemedText>
                  <Pressable onPress={handleToggleComplete} hitSlop={14} style={styles.checkboxButton}>
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
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
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

                  {linkedEventType === "reminder" ? (
                    <View style={styles.scheduleIcon}>
                      <Feather name="bell" size={16} color="#F59E0B" />
                    </View>
                  ) : linkedEventType === "appointment" ? (
                    <View style={styles.scheduleIcon}>
                      <Feather name="calendar" size={16} color="#3B82F6" />
                    </View>
                  ) : linkedEventType === "meeting" ? (
                    <View style={styles.scheduleIcon}>
                      <Feather name="users" size={16} color="#A855F7" />
                    </View>
                  ) : linkedEventType === "due_date" ? (
                    <View style={styles.scheduleIcon}>
                      <Feather name="flag" size={16} color={theme.error} />
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
                      <ThemedText style={[styles.sharedBadgeText, { color: theme.primary }]}>
                        {task.sharedWith.length}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                {showCategory && category ? (
                  <View style={styles.categoryBadge}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      {category.name}
                    </ThemedText>
                  </View>
                ) : null}

                {isDragging ? (
                  <View style={styles.dragHint}>
                    <Feather name="move" size={14} color={theme.primary} />
                    <ThemedText style={[styles.dragHintText, { color: theme.primary }]}>
                      Tap another entry to move under it
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            {showDetails ? (
              <View style={[styles.details, { borderTopColor: theme.border }]}>
                {task.description ? (
                  <ClickableDescription 
                    text={task.description} 
                    style={[styles.description, { color: isDark ? "#9CA3AF" : "#6B7280" }]}
                  />
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
                    onPress={handleEdit}
                  >
                    <Feather name="edit-2" size={14} color={theme.primary} />
                    <ThemedText style={[styles.actionText, { color: theme.primary }]}>Edit</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: "#3B82F6" + "15" }]}
                    onPress={handleSchedule}
                  >
                    <Feather name="calendar" size={14} color="#3B82F6" />
                    <ThemedText style={[styles.actionText, { color: "#3B82F6" }]}>Schedule</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: task.isPinned ? "#F59E0B" + "25" : "#F59E0B" + "15" }]}
                    onPress={() => task.isPinned ? unpinTask(task.id) : pinTask(task.id)}
                  >
                    <Feather name="star" size={14} color="#F59E0B" style={{ opacity: task.isPinned ? 1 : 0.7 }} />
                    <ThemedText style={[styles.actionText, { color: "#F59E0B" }]}>
                      {task.isPinned ? "Unpin" : "Pin"}
                    </ThemedText>
                  </Pressable>
                  {linkedHabit ? (
                    <View style={[styles.actionButton, { backgroundColor: "#22C55E" + "15" }]}>
                      <Feather name="activity" size={14} color="#22C55E" />
                      <ThemedText style={[styles.actionText, { color: "#22C55E" }]}>Habit Linked</ThemedText>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.actionButton, { backgroundColor: "#A855F7" + "15" }]}
                      onPress={() => setShowHabitModal(true)}
                    >
                      <Feather name="activity" size={14} color="#A855F7" />
                      <ThemedText style={[styles.actionText, { color: "#A855F7" }]}>Make Habit</ThemedText>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: typeColor + "15" }]}
                    onPress={handleAddSubtask}
                  >
                    <Feather name="plus" size={14} color={typeColor} />
                    <ThemedText style={[styles.actionText, { color: typeColor }]}>+ Sub-entry</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.error + "15" }]}
                    onPress={handleDelete}
                  >
                    <Feather name="trash-2" size={14} color={theme.error} />
                    <ThemedText style={[styles.actionText, { color: theme.error }]}>Delete</ThemedText>
                  </Pressable>
                </View>

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
                            onPress={() => setEditingOccurrence({ 
                              id: occ.id, 
                              notes: occ.notes || "", 
                              date: new Date(occ.occurredAt) 
                            })}
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
                                    onPress: () => deleteOccurrence(occ.id)
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
          </Animated.View>
        </GestureDetector>

        {isExpanded && hasChildren ? (
          <View style={styles.children}>
            {task.children.map((child) => (
              <TaskItem
                key={child.id}
                task={child}
                depth={depth + 1}
                showCategory={showCategory}
                categories={categories}
                parentColor={categoryColor}
              />
            ))}
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
        visible={editingOccurrence !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setEditingOccurrence(null); setShowEditDatePicker(false); }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setEditingOccurrence(null); setShowEditDatePicker(false); }}>
          <Pressable 
            style={[styles.editNotesModal, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.editNotesHeader}>
              <ThemedText style={styles.editNotesTitle}>Edit Completion</ThemedText>
              <Pressable onPress={() => { setEditingOccurrence(null); setShowEditDatePicker(false); }} hitSlop={10}>
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
                {editingOccurrence?.date.toLocaleDateString("en-US", { 
                  month: "short", 
                  day: "numeric", 
                  year: "numeric" 
                })}
              </ThemedText>
            </Pressable>
            {showEditDatePicker ? (
              <DateTimePicker
                value={editingOccurrence?.date || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  if (Platform.OS !== "ios") {
                    setShowEditDatePicker(false);
                  }
                  if (selectedDate) {
                    setEditingOccurrence(prev => prev ? { ...prev, date: selectedDate } : null);
                  }
                }}
                maximumDate={new Date()}
              />
            ) : null}
            {Platform.OS === "ios" && showEditDatePicker ? (
              <Pressable 
                style={[styles.editDateDoneBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowEditDatePicker(false)}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Done</ThemedText>
              </Pressable>
            ) : null}

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
                onPress={() => { setEditingOccurrence(null); setShowEditDatePicker(false); }}
              >
                <ThemedText style={styles.editNotesBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.editNotesSaveBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  if (editingOccurrence) {
                    const dateStr = editingOccurrence.date.toISOString().split("T")[0];
                    updateOccurrence(editingOccurrence.id, { 
                      notes: editingOccurrence.notes || undefined,
                      occurredAt: editingOccurrence.date.getTime(),
                      occurredDate: dateStr,
                    });
                    setEditingOccurrence(null);
                    setShowEditDatePicker(false);
                  }
                }}
              >
                <ThemedText style={[styles.editNotesBtnText, { color: "#FFFFFF" }]}>Save</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    gap: Spacing.sm,
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
    padding: Spacing.sm,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
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
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  actions: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: 4,
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
  editDateDoneBtn: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
});
