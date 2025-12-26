import React, { useState, useLayoutEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { HierarchicalTaskList } from "@/components/HierarchicalTaskList";
import { SchedulingModal } from "@/components/SchedulingModal";
import { RecurringEventModal } from "@/components/RecurringEventModal";
import { TASK_TYPES, TaskType, EVENT_TYPES, CalendarEvent } from "@/types";
import { isRecurringEvent } from "@/utils/recurrence";

type RouteParams = RouteProp<RootStackParamList, "CategoryDetail">;

export default function CategoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { getTasksByCategory, events, deleteEvent, deleteEventSeries } = useApp();

  const category = route.params.category;
  const [segment, setSegment] = useState<"tasks" | "calendar">("tasks");
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingAsInstance, setEditingAsInstance] = useState(false);
  const categoryTasks = getTasksByCategory(category.id);

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find(e => e.value === type) || EVENT_TYPES[0];
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleEventPress = (event: CalendarEvent) => {
    setEditingEvent(event);
    if (isRecurringEvent(event)) {
      setShowRecurringModal(true);
    } else {
      setShowSchedulingModal(true);
    }
  };

  const handleEditInstance = () => {
    setShowRecurringModal(false);
    setEditingAsInstance(true);
    setShowSchedulingModal(true);
  };

  const handleEditSeries = () => {
    setShowRecurringModal(false);
    setEditingAsInstance(false);
    setShowSchedulingModal(true);
  };

  const handleDeleteInstance = async () => {
    if (editingEvent) {
      await deleteEvent(editingEvent.id);
      setShowRecurringModal(false);
      setEditingEvent(null);
    }
  };

  const handleDeleteSeriesEvent = async () => {
    if (editingEvent?.seriesId) {
      await deleteEventSeries(editingEvent.seriesId);
      setShowRecurringModal(false);
      setEditingEvent(null);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setShowSchedulingModal(true);
  };

  const categoryEvents = useMemo(() => 
    events.filter(e => e.categoryId === category.id),
    [events, category.id]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, { marked: boolean; dotColor: string }> = {};
    categoryEvents.forEach((event) => {
      marks[event.startDate] = {
        marked: true,
        dotColor: category.color,
      };
    });
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: category.color,
      } as any;
    }
    return marks;
  }, [categoryEvents, category.color, selectedDate]);

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

  const stats = useMemo(() => {
    const total = categoryTasks.length;
    const completed = categoryTasks.filter((t) => t.status === "completed").length;
    const pending = categoryTasks.filter((t) => t.status === "pending").length;
    const inProgress = categoryTasks.filter((t) => t.status === "in_progress").length;
    return { total, completed, pending, inProgress };
  }, [categoryTasks]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={[styles.colorBar, { backgroundColor: category.color, marginTop: headerHeight }]} />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: category.color }]}>{stats.total}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.success }]}>{stats.completed}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Done</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.warning }]}>{stats.inProgress}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Active</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.textSecondary }]}>{stats.pending}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</ThemedText>
        </View>
      </View>

      <View style={styles.segmentContainer}>
        <View style={[styles.segmentControl, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            style={[styles.segment, segment === "tasks" && { backgroundColor: theme.backgroundRoot }]}
            onPress={() => setSegment("tasks")}
          >
            <ThemedText style={[styles.segmentText, segment === "tasks" && { fontWeight: "600" }]}>
              Entries
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.segment, segment === "calendar" && { backgroundColor: theme.backgroundRoot }]}
            onPress={() => setSegment("calendar")}
          >
            <ThemedText style={[styles.segmentText, segment === "calendar" && { fontWeight: "600" }]}>
              Calendar
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {segment === "tasks" ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.typeFilters}
            contentContainerStyle={styles.typeFiltersContent}
          >
            <Pressable
              style={[
                styles.typeChip,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                !selectedType && { borderColor: category.color },
              ]}
              onPress={() => setSelectedType(null)}
            >
              <ThemedText style={[styles.typeChipText, !selectedType && { color: category.color }]}>
                All
              </ThemedText>
            </Pressable>
            {TASK_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[
                  styles.typeChip,
                  { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  selectedType === t.value && { borderColor: category.color, backgroundColor: category.color + "15" },
                ]}
                onPress={() => setSelectedType(selectedType === t.value ? null : t.value)}
              >
                <Feather name={t.icon as any} size={14} color={selectedType === t.value ? category.color : theme.textSecondary} />
                <ThemedText style={[styles.typeChipText, selectedType === t.value && { color: category.color }]}>
                  {t.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView
            style={styles.taskList}
            contentContainerStyle={{
              paddingHorizontal: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xxl + 60,
            }}
          >
            <HierarchicalTaskList tasks={categoryTasks} filterType={selectedType} />
          </ScrollView>
        </>
      ) : (
        <ScrollView
          style={styles.calendarContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl + 60 }}
        >
          <Calendar
            theme={{
              backgroundColor: theme.backgroundRoot,
              calendarBackground: theme.backgroundRoot,
              textSectionTitleColor: theme.textSecondary,
              selectedDayBackgroundColor: category.color,
              selectedDayTextColor: "#FFFFFF",
              todayTextColor: category.color,
              dayTextColor: theme.text,
              textDisabledColor: theme.textSecondary,
              monthTextColor: theme.text,
              arrowColor: category.color,
            }}
            markedDates={markedDates}
            onDayPress={(day: { dateString: string }) => {
              setSelectedDate(selectedDate === day.dateString ? null : day.dateString);
            }}
          />
          {selectedDate ? (
            <View style={styles.selectedDateSection}>
              <ThemedText style={styles.selectedDateTitle}>Events for {selectedDate}</ThemedText>
              {categoryEvents.filter(e => e.startDate === selectedDate).length > 0 ? (
                <View style={styles.eventsList}>
                  {categoryEvents.filter(e => e.startDate === selectedDate).map(event => {
                    const eventTypeInfo = getEventTypeInfo(event.eventType);
                    const isTimedEvent = event.eventType === "appointment" || event.eventType === "meeting";
                    return (
                      <Pressable 
                        key={event.id} 
                        style={[styles.eventCard, { backgroundColor: theme.backgroundDefault }]}
                        onPress={() => handleEventPress(event)}
                      >
                        <View style={[styles.eventTimeBar, { backgroundColor: eventTypeInfo.color }]} />
                        <View style={styles.eventCardContent}>
                          <View style={styles.eventHeader}>
                            <View style={styles.eventBadgeRow}>
                              <View style={[styles.eventTypeBadge, { backgroundColor: eventTypeInfo.color + "20" }]}>
                                <Feather name={eventTypeInfo.icon as any} size={12} color={eventTypeInfo.color} />
                                <ThemedText style={[styles.eventTypeText, { color: eventTypeInfo.color }]}>
                                  {eventTypeInfo.label}
                                </ThemedText>
                              </View>
                              {isRecurringEvent(event) ? (
                                <View style={[styles.repeatBadge, { backgroundColor: theme.success + "20" }]}>
                                  <Feather name="repeat" size={10} color={theme.success} />
                                </View>
                              ) : null}
                            </View>
                            {isTimedEvent ? (
                              <ThemedText style={[styles.eventTimeText, { color: theme.textSecondary }]}>
                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                              </ThemedText>
                            ) : (
                              <ThemedText style={[styles.eventTimeText, { color: theme.textSecondary }]}>
                                {formatTime(event.startTime)}
                              </ThemedText>
                            )}
                          </View>
                          <ThemedText style={styles.eventCardTitle} numberOfLines={1}>
                            {event.title}
                          </ThemedText>
                          {event.description ? (
                            <ThemedText style={[styles.eventDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                              {event.description}
                            </ThemedText>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <ThemedText style={[styles.noEventsText, { color: theme.textSecondary }]}>
                  No events scheduled for this date
                </ThemedText>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}

      <View style={[styles.actionRow, { bottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: category.color }]}
          onPress={() => navigation.navigate("AddTask", { categoryId: category.id })}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Add Entry</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.success }]}
          onPress={handleAddEvent}
        >
          <Feather name="calendar" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Schedule</ThemedText>
        </Pressable>
      </View>

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => {
          setShowSchedulingModal(false);
          setEditingEvent(null);
          setEditingAsInstance(false);
        }}
        initialDate={selectedDate || undefined}
        lockedCategoryId={category.id}
        editingEvent={editingEvent}
        editingAsInstance={editingAsInstance}
      />
      <RecurringEventModal
        visible={showRecurringModal}
        event={editingEvent}
        onClose={() => {
          setShowRecurringModal(false);
          setEditingEvent(null);
        }}
        onEditInstance={handleEditInstance}
        onEditSeries={handleEditSeries}
        onDeleteInstance={handleDeleteInstance}
        onDeleteSeries={handleDeleteSeriesEvent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  colorBar: {
    height: 4,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  segmentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
  typeFilters: {
    maxHeight: 40,
    marginBottom: Spacing.sm,
  },
  typeFiltersContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  typeChipText: {
    fontSize: 13,
  },
  taskList: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  selectedDateSection: {
    marginTop: Spacing.lg,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  eventsList: {
    gap: Spacing.sm,
  },
  eventCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  eventTimeBar: {
    width: 4,
  },
  eventCardContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  eventTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  repeatBadge: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  eventTimeText: {
    fontSize: 12,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  eventDescription: {
    fontSize: 13,
  },
  noEventsText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  actionRow: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
