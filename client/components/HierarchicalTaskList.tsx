import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Task, TaskHierarchy, TASK_TYPES, getTaskTypeInfo } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface HierarchicalTaskListProps {
  tasks: Task[];
  showCategory?: boolean;
}

export function HierarchicalTaskList({ tasks, showCategory = false }: HierarchicalTaskListProps) {
  const { categories } = useApp();

  const hierarchy = useMemo(() => {
    const buildHierarchy = (parentId: string | null): TaskHierarchy[] => {
      return tasks
        .filter((t) => t.parentId === parentId)
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
    return buildHierarchy(null);
  }, [tasks]);

  if (hierarchy.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={48} color="rgba(128,128,128,0.3)" />
        <ThemedText style={styles.emptyText}>No entries yet</ThemedText>
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
}

function TaskItem({ task, depth, showCategory, categories }: TaskItemProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { updateTask, deleteTask } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const rotation = useSharedValue(0);

  const typeInfo = getTaskTypeInfo(task.type);
  const category = categories.find((c) => c.id === task.categoryId);
  const hasChildren = task.children.length > 0;

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
    navigation.navigate("AddTask", { task });
    setShowDetails(false);
  }, [navigation, task]);

  const handleDelete = useCallback(async () => {
    await deleteTask(task.id);
  }, [task.id, deleteTask]);

  const handleAddSubtask = useCallback(() => {
    navigation.navigate("AddTask", { categoryId: task.categoryId, parentTaskId: task.id });
    setShowDetails(false);
  }, [navigation, task.categoryId, task.id]);

  const priorityColor = task.priority === "high" ? theme.error : 
                        task.priority === "medium" ? theme.warning : theme.success;

  return (
    <View style={[styles.itemContainer, { marginLeft: depth * Spacing.lg }]}>
      <Pressable
        style={[
          styles.item,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          task.status === "completed" && styles.itemCompleted,
        ]}
        onPress={() => setShowDetails(!showDetails)}
      >
        <View style={styles.itemHeader}>
          {hasChildren ? (
            <Pressable onPress={toggleExpand} hitSlop={8}>
              <Animated.View style={chevronStyle}>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Animated.View>
            </Pressable>
          ) : (
            <View style={styles.chevronPlaceholder} />
          )}

          <Pressable onPress={handleToggleComplete} hitSlop={8}>
            <Feather
              name={task.status === "completed" ? "check-circle" : "circle"}
              size={22}
              color={task.status === "completed" ? theme.success : theme.textSecondary}
            />
          </Pressable>

          <View style={styles.itemContent}>
            <View style={styles.titleRow}>
              <Feather
                name={typeInfo.icon as any}
                size={14}
                color={theme.textSecondary}
                style={styles.typeIcon}
              />
              <ThemedText
                style={[
                  styles.title,
                  task.status === "completed" && styles.titleCompleted,
                ]}
                numberOfLines={1}
              >
                {task.title}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {typeInfo.label}
              </ThemedText>
              {showCategory && category ? (
                <>
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {category.name}
                  </ThemedText>
                </>
              ) : null}
              {task.dueDate ? (
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {task.dueDate}
                </ThemedText>
              ) : null}
              {hasChildren ? (
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {task.children.length} sub-entries
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        {showDetails ? (
          <View style={[styles.details, { borderTopColor: theme.border }]}>
            {task.description ? (
              <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
                {task.description}
              </ThemedText>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.primary + "20" }]}
                onPress={handleEdit}
              >
                <Feather name="edit-2" size={16} color={theme.primary} />
                <ThemedText style={[styles.actionText, { color: theme.primary }]}>Edit</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.secondary + "20" }]}
                onPress={handleAddSubtask}
              >
                <Feather name="plus" size={16} color={theme.secondary} />
                <ThemedText style={[styles.actionText, { color: theme.secondary }]}>Add Sub-entry</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.error + "20" }]}
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
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    opacity: 0.5,
  },
  itemContainer: {
    marginBottom: Spacing.xs,
  },
  item: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  itemCompleted: {
    opacity: 0.7,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  chevronPlaceholder: {
    width: 18,
  },
  itemContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    marginRight: Spacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
  },
  details: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  description: {
    fontSize: 14,
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
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  children: {
    marginTop: Spacing.xs,
  },
});
