import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Task, TaskHierarchy, TaskType, TASK_TYPES, getTaskTypeInfo } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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

interface HierarchicalTaskListProps {
  tasks: Task[];
  showCategory?: boolean;
  filterType?: TaskType | null;
}

export function HierarchicalTaskList({ tasks, showCategory = false, filterType = null }: HierarchicalTaskListProps) {
  const { categories } = useApp();

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
        const typeOrder = TASK_TYPES.findIndex((t) => t.value === a.type) - 
                         TASK_TYPES.findIndex((t) => t.value === b.type);
        if (typeOrder !== 0) return typeOrder;
        return a.createdAt - b.createdAt;
      });
    }

    return buildHierarchy(null);
  }, [tasks, filterType]);

  if (hierarchy.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={56} color="rgba(128,128,128,0.25)" />
        <ThemedText style={styles.emptyText}>No entries yet</ThemedText>
        <ThemedText style={styles.emptyHint}>Tap + to add your first entry</ThemedText>
      </View>
    );
  }

  return (
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
  const { updateTask, deleteTask } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const rotation = useSharedValue(0);

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

  const handleToggleComplete = useCallback(async () => {
    await updateTask(task.id, {
      status: task.status === "completed" ? "pending" : "completed",
    });
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

  const getDueDateStatus = useCallback(() => {
    if (!task.dueDate) return { color: theme.success, label: "No due date", showIndicator: true };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { color: theme.error, label: "Overdue", showIndicator: true };
    if (diffDays === 0) return { color: theme.warning, label: "Today", showIndicator: true };
    if (diffDays <= 3) return { color: theme.warning, label: `${diffDays}d left`, showIndicator: true };
    return { color: theme.success, label: task.dueDate, showIndicator: true };
  }, [task.dueDate, theme]);

  const dueDateInfo = getDueDateStatus();
  const priorityColor = task.priority === "high" ? theme.error : 
                        task.priority === "medium" ? theme.warning : theme.success;

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

  return (
    <View style={styles.itemWrapper}>
      {depth > 0 && parentColor ? (
        <View 
          style={[
            styles.hierarchyLine, 
            { 
              backgroundColor: parentColor + "40",
              left: (depth - 1) * 24 + 8,
            }
          ]} 
        />
      ) : null}
      <View style={[styles.itemContainer, { marginLeft: depth * 24 }]}>
        <Pressable
          style={[
            styles.item,
            cardShadow,
            { 
              backgroundColor: isDark ? theme.backgroundDefault : "#FFFFFF",
              borderColor: isDark ? theme.border : "transparent",
            },
            task.status === "completed" && styles.itemCompleted,
          ]}
          onPress={() => setShowDetails(!showDetails)}
        >
          <View style={styles.itemHeader}>
            <View style={styles.leftSection}>
              {hasChildren ? (
                <Pressable onPress={toggleExpand} hitSlop={12} style={styles.expandButton}>
                  <Animated.View style={chevronStyle}>
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  </Animated.View>
                </Pressable>
              ) : (
                <View style={styles.chevronPlaceholder} />
              )}

              <Pressable onPress={handleToggleComplete} hitSlop={12} style={styles.checkboxButton}>
                <View style={[
                  styles.checkbox,
                  { borderColor: task.status === "completed" ? theme.success : theme.textSecondary },
                  task.status === "completed" && { backgroundColor: theme.success }
                ]}>
                  {task.status === "completed" ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>

              <View style={[styles.typeIconContainer, { backgroundColor: typeColor + "20" }]}>
                <Feather
                  name={typeInfo.icon as any}
                  size={24}
                  color={typeColor}
                />
              </View>
            </View>

            <View style={styles.itemContent}>
              <ThemedText
                style={[
                  styles.title,
                  { color: isDark ? "#FFFFFF" : theme.text },
                  task.status === "completed" && styles.titleCompleted,
                ]}
                numberOfLines={2}
              >
                {task.title}
              </ThemedText>
              <View style={styles.metaRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
                  <ThemedText style={[styles.typeBadgeText, { color: typeColor }]}>
                    {typeInfo.label}
                  </ThemedText>
                </View>
                
                {showCategory && category ? (
                  <View style={styles.categoryBadge}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      {category.name}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.dueDateBadge}>
                  <View style={[styles.dueDateDot, { backgroundColor: dueDateInfo.color }]} />
                  <ThemedText style={[styles.metaText, { color: dueDateInfo.color }]}>
                    {dueDateInfo.label}
                  </ThemedText>
                </View>

                {hasChildren ? (
                  <View style={styles.childCountBadge}>
                    <Feather name="layers" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      {task.children.length}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
              </View>
            </View>
          </View>

          {showDetails ? (
            <View style={[styles.details, { borderTopColor: theme.border }]}>
              {task.description ? (
                <ThemedText style={[styles.description, { color: isDark ? "#9CA3AF" : "#6B7280" }]}>
                  {task.description}
                </ThemedText>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
                  onPress={handleEdit}
                >
                  <Feather name="edit-2" size={16} color={theme.primary} />
                  <ThemedText style={[styles.actionText, { color: theme.primary }]}>Edit</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: typeColor + "15" }]}
                  onPress={handleAddSubtask}
                >
                  <Feather name="plus" size={16} color={typeColor} />
                  <ThemedText style={[styles.actionText, { color: typeColor }]}>Add Sub-entry</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.error + "15" }]}
                  onPress={handleDelete}
                >
                  <Feather name="trash-2" size={16} color={theme.error} />
                  <ThemedText style={[styles.actionText, { color: theme.error }]}>Delete</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Pressable>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
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
    padding: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  expandButton: {
    padding: 2,
  },
  chevronPlaceholder: {
    width: 24,
  },
  checkboxButton: {
    padding: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: Spacing.xs,
  },
  titleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
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
  dueDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dueDateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  childCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  priorityIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginLeft: "auto",
  },
  metaText: {
    fontSize: 14,
  },
  details: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  children: {
    marginTop: Spacing.sm,
  },
});
