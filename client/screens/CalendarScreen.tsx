import React, { useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Calendar, DateData } from "react-native-calendars";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SchedulingModal } from "@/components/SchedulingModal";
import { useApp } from "@/context/AppContext";
import { Task, CalendarEvent, EVENT_TYPES, getEventTypeInfo } from "@/types";

type ListItem = { type: "task"; data: Task } | { type: "event"; data: CalendarEvent };

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { tasks, categories, events, updateTask, deleteEvent } = useApp();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};

    events.forEach((event) => {
      const eventTypeInfo = getEventTypeInfo(event.eventType);
      if (!marks[event.startDate]) {
        marks[event.startDate] = { dots: [] };
      }
      if (marks[event.startDate].dots.length < 4) {
        marks[event.startDate].dots.push({
          key: event.id,
          color: eventTypeInfo.color,
        });
      }
    });

    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: theme.primary,
    };
    return marks;
  }, [events, selectedDate, theme]);

  const selectedEvents = useMemo(() =>
    events.filter((e) => e.startDate === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedDate]
  );

  const listItems: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    selectedEvents.forEach(e => items.push({ type: "event", data: e }));
    return items;
  }, [selectedEvents]);

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask(task.id, { status: newStatus });
  };

  const handleEventPress = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowSchedulingModal(true);
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setShowSchedulingModal(true);
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "event") {
      const event = item.data;
      const eventTypeInfo = getEventTypeInfo(event.eventType);
      const linkedTask = event.linkedTaskId 
        ? tasks.find(t => t.id === event.linkedTaskId) 
        : null;
      const eventCategory = event.categoryId 
        ? categories.find(c => c.id === event.categoryId)
        : linkedTask 
          ? categories.find(c => c.id === linkedTask.categoryId) 
          : null;

      const isTimedEvent = event.eventType === "appointment" || event.eventType === "meeting";

      return (
        <Pressable 
          style={[styles.eventItem, { backgroundColor: theme.backgroundDefault }]}
          onPress={() => handleEventPress(event)}
        >
          <View style={[styles.eventTimeBar, { backgroundColor: eventTypeInfo.color }]} />
          <View style={styles.eventContent}>
            <View style={styles.eventHeader}>
              <View style={[styles.eventTypeBadge, { backgroundColor: eventTypeInfo.color + "20" }]}>
                <Feather name={eventTypeInfo.icon as any} size={12} color={eventTypeInfo.color} />
                <ThemedText style={[styles.eventTypeText, { color: eventTypeInfo.color }]}>
                  {eventTypeInfo.label}
                </ThemedText>
              </View>
              {isTimedEvent ? (
                <ThemedText style={[styles.eventTime, { color: theme.textSecondary }]}>
                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.eventTime, { color: theme.textSecondary }]}>
                  {formatTime(event.startTime)}
                </ThemedText>
              )}
            </View>
            <ThemedText style={styles.eventTitle} numberOfLines={1}>
              {event.title}
            </ThemedText>
            {event.description ? (
              <ThemedText style={[styles.eventDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                {event.description}
              </ThemedText>
            ) : null}
            {eventCategory ? (
              <View style={[styles.categoryTag, { backgroundColor: eventCategory.color + "20" }]}>
                <ThemedText style={[styles.categoryText, { color: eventCategory.color }]}>
                  {eventCategory.name}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Pressable>
      );
    }

    const task = item.data;
    const category = categories.find((c) => c.id === task.categoryId);
    return (
      <View style={[styles.taskItem, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          style={[
            styles.checkbox,
            { borderColor: category?.color || theme.primary },
            task.status === "completed" && { backgroundColor: category?.color || theme.primary },
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
      </View>
    );
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const itemCount = selectedEvents.length;

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
          {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
        </ThemedText>
      </View>

      <FlatList
        data={listItems}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl + 60,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="sun" size={40} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No events or tasks for this day
            </ThemedText>
            <Pressable
              style={[styles.addEventButton, { backgroundColor: theme.primary }]}
              onPress={handleAddEvent}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <ThemedText style={styles.addEventButtonText}>Add Event</ThemedText>
            </Pressable>
          </View>
        }
      />

      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg }]}
        onPress={handleAddEvent}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => {
          setShowSchedulingModal(false);
          setEditingEvent(null);
        }}
        initialDate={selectedDate}
        editingEvent={editingEvent}
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
  eventItem: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  eventTimeBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  eventTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  eventTime: {
    fontSize: 12,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  eventDescription: {
    fontSize: 13,
    marginTop: 2,
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
    marginTop: 4,
    alignSelf: "flex-start",
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
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
  addEventButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  addEventButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
