import React, { useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Calendar, DateData } from "react-native-calendars";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Task } from "@/types";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { tasks, categories, updateTask } = useApp();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};
    tasks.forEach((task) => {
      if (task.dueDate) {
        const category = categories.find((c) => c.id === task.categoryId);
        if (!marks[task.dueDate]) {
          marks[task.dueDate] = { dots: [] };
        }
        if (marks[task.dueDate].dots.length < 3) {
          marks[task.dueDate].dots.push({
            key: task.id,
            color: category?.color || theme.primary,
          });
        }
      }
    });
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: theme.primary,
    };
    return marks;
  }, [tasks, categories, selectedDate, theme]);

  const selectedTasks = tasks.filter((t) => t.dueDate === selectedDate);

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask(task.id, { status: newStatus });
  };

  const renderTask = ({ item }: { item: Task }) => {
    const category = categories.find((c) => c.id === item.categoryId);
    return (
      <View style={[styles.taskItem, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          style={[
            styles.checkbox,
            { borderColor: category?.color || theme.primary },
            item.status === "completed" && { backgroundColor: category?.color || theme.primary },
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
          <View style={styles.taskMeta}>
            <View style={[styles.categoryTag, { backgroundColor: (category?.color || theme.primary) + "20" }]}>
              <ThemedText style={[styles.categoryText, { color: category?.color || theme.primary }]}>
                {category?.name || "Unknown"}
              </ThemedText>
            </View>
            <View
              style={[
                styles.priorityDot,
                {
                  backgroundColor:
                    item.priority === "high"
                      ? theme.error
                      : item.priority === "medium"
                      ? theme.warning
                      : theme.success,
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={{ paddingTop: headerHeight }}>
        <Calendar
          current={selectedDate}
          onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
          markingType="multi-dot"
          markedDates={markedDates}
          theme={{
            backgroundColor: theme.backgroundRoot,
            calendarBackground: theme.backgroundRoot,
            textSectionTitleColor: theme.textSecondary,
            selectedDayBackgroundColor: theme.primary,
            selectedDayTextColor: "#ffffff",
            todayTextColor: theme.primary,
            dayTextColor: theme.text,
            textDisabledColor: theme.textSecondary + "60",
            monthTextColor: theme.text,
            arrowColor: theme.primary,
            textMonthFontWeight: "600",
            textDayFontWeight: "400",
            textDayHeaderFontWeight: "500",
          }}
          style={styles.calendar}
        />
      </View>

      <View style={[styles.tasksHeader, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.tasksTitle}>
          {selectedDate === today ? "Today" : selectedDate}
        </ThemedText>
        <ThemedText style={[styles.tasksCount, { color: theme.textSecondary }]}>
          {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
        </ThemedText>
      </View>

      <FlatList
        data={selectedTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="sun" size={40} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No tasks scheduled for this day
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    paddingBottom: Spacing.md,
  },
  tasksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  tasksTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  tasksCount: {
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
    fontSize: 15,
    fontWeight: "500",
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: Spacing.sm,
  },
  categoryTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "500",
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
    textAlign: "center",
  },
});
