import React, { useState } from "react";
import { View, StyleSheet, Pressable, FlatList, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Task } from "@/types";

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { tasks, categories, updateTask, deleteTask } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = showCompleted ? true : task.status !== "completed";
    return matchesSearch && matchesStatus;
  });

  const groupedTasks = categories.map((cat) => ({
    category: cat,
    tasks: filteredTasks.filter((t) => t.categoryId === cat.id),
  })).filter((group) => group.tasks.length > 0);

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask(task.id, { status: newStatus });
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert(
      "Delete Task",
      `Are you sure you want to delete "${task.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteTask(task.id) },
      ]
    );
  };

  const renderTask = (task: Task, categoryColor: string) => (
    <Pressable
      key={task.id}
      style={[styles.taskItem, { backgroundColor: theme.backgroundDefault }]}
      onLongPress={() => handleDeleteTask(task)}
    >
      <Pressable
        style={[
          styles.checkbox,
          { borderColor: categoryColor },
          task.status === "completed" && { backgroundColor: categoryColor },
        ]}
        onPress={() => toggleTaskStatus(task)}
      >
        {task.status === "completed" ? (
          <Feather name="check" size={14} color="#FFFFFF" />
        ) : null}
      </Pressable>
      <View style={styles.taskContent}>
        <ThemedText
          style={[
            styles.taskTitle,
            task.status === "completed" && { textDecorationLine: "line-through", opacity: 0.6 },
          ]}
        >
          {task.title}
        </ThemedText>
        <View style={styles.taskMeta}>
          {task.dueDate ? (
            <View style={styles.dueBadge}>
              <Feather name="calendar" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.dueText, { color: theme.textSecondary }]}>
                {task.dueDate}
              </ThemedText>
            </View>
          ) : null}
          <View
            style={[
              styles.priorityDot,
              {
                backgroundColor:
                  task.priority === "high"
                    ? theme.error
                    : task.priority === "medium"
                    ? theme.warning
                    : theme.success,
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View
        style={[
          styles.searchContainer,
          { paddingTop: headerHeight + Spacing.md, backgroundColor: theme.backgroundRoot },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search tasks..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: showCompleted ? theme.primary + "20" : theme.backgroundDefault },
          ]}
          onPress={() => setShowCompleted(!showCompleted)}
        >
          <Feather
            name="check-circle"
            size={20}
            color={showCompleted ? theme.primary : theme.textSecondary}
          />
        </Pressable>
      </View>

      <FlatList
        data={groupedTasks}
        keyExtractor={(item) => item.category.id}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xxl + Spacing.fabSize,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        renderItem={({ item }) => (
          <View style={styles.categoryGroup}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryDot, { backgroundColor: item.category.color }]} />
              <ThemedText style={styles.categoryTitle}>{item.category.name}</ThemedText>
              <ThemedText style={[styles.taskCount, { color: theme.textSecondary }]}>
                {item.tasks.length}
              </ThemedText>
            </View>
            <View style={styles.tasksList}>
              {item.tasks.map((task) => renderTask(task, item.category.color))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {searchQuery ? "No tasks match your search" : "No tasks yet"}
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryGroup: {
    marginBottom: Spacing.xl,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  taskCount: {
    fontSize: 14,
  },
  tasksList: {
    gap: Spacing.sm,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: Spacing.sm,
  },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dueText: {
    fontSize: 12,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.md,
  },
});
