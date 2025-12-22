import React, { useState, useLayoutEffect } from "react";
import { View, StyleSheet, Pressable, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Task } from "@/types";

type RouteParams = RouteProp<RootStackParamList, "CategoryDetail">;

export default function CategoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { getTasksByCategory, updateTask, deleteTask } = useApp();

  const category = route.params.category;
  const [segment, setSegment] = useState<"tasks" | "calendar">("tasks");
  const categoryTasks = getTasksByCategory(category.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: category.name,
      headerRight: () => (
        <HeaderButton onPress={() => navigation.navigate("AddCategory", { category })}>
          <Feather name="edit-2" size={20} color={theme.primary} />
        </HeaderButton>
      ),
    });
  }, [navigation, category, theme]);

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask(task.id, { status: newStatus });
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View style={[styles.taskItem, { backgroundColor: theme.backgroundDefault }]}>
      <Pressable
        style={[
          styles.checkbox,
          { borderColor: category.color },
          item.status === "completed" && { backgroundColor: category.color },
        ]}
        onPress={() => toggleTaskStatus(item)}
      >
        {item.status === "completed" ? (
          <Feather name="check" size={14} color="#FFFFFF" />
        ) : null}
      </Pressable>
      <View style={styles.taskContent}>
        <ThemedText
          style={[
            styles.taskTitle,
            item.status === "completed" && { textDecorationLine: "line-through", opacity: 0.6 },
          ]}
        >
          {item.title}
        </ThemedText>
        {item.dueDate ? (
          <ThemedText style={[styles.taskDue, { color: theme.textSecondary }]}>
            Due: {item.dueDate}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.priorityBadge,
          {
            backgroundColor:
              item.priority === "high"
                ? theme.error + "20"
                : item.priority === "medium"
                ? theme.warning + "20"
                : theme.success + "20",
          },
        ]}
      >
        <ThemedText
          style={[
            styles.priorityText,
            {
              color:
                item.priority === "high"
                  ? theme.error
                  : item.priority === "medium"
                  ? theme.warning
                  : theme.success,
            },
          ]}
        >
          {item.priority}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View
        style={[
          styles.colorBar,
          { backgroundColor: category.color, marginTop: headerHeight },
        ]}
      />
      <View style={styles.segmentContainer}>
        <View style={[styles.segmentControl, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            style={[
              styles.segment,
              segment === "tasks" && { backgroundColor: theme.backgroundRoot },
            ]}
            onPress={() => setSegment("tasks")}
          >
            <ThemedText
              style={[styles.segmentText, segment === "tasks" && { fontWeight: "600" }]}
            >
              Tasks
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.segment,
              segment === "calendar" && { backgroundColor: theme.backgroundRoot },
            ]}
            onPress={() => setSegment("calendar")}
          >
            <ThemedText
              style={[styles.segmentText, segment === "calendar" && { fontWeight: "600" }]}
            >
              Calendar
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {segment === "tasks" ? (
        <FlatList
          data={categoryTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="check-circle" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No tasks in this category
              </ThemedText>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        />
      ) : (
        <View style={[styles.calendarPlaceholder, { paddingBottom: insets.bottom }]}>
          <Feather name="calendar" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Calendar view for {category.name}
          </ThemedText>
        </View>
      )}

      <Pressable
        style={[styles.addButton, { backgroundColor: category.color, bottom: insets.bottom + Spacing.lg }]}
        onPress={() => navigation.navigate("AddTask", { categoryId: category.id })}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
        <ThemedText style={styles.addButtonText}>Add Task</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  colorBar: {
    height: 4,
  },
  segmentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  segmentControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.xs - 2,
  },
  segmentText: {
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: "500",
  },
  taskDue: {
    fontSize: 12,
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  calendarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
