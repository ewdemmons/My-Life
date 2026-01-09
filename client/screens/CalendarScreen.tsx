import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Calendar, DateData } from "react-native-calendars";
import { Feather } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SchedulingModal } from "@/components/SchedulingModal";
import { RecurringEventModal } from "@/components/RecurringEventModal";
import { PeopleAvatars } from "@/components/PeopleSelector";
import { useApp } from "@/context/AppContext";
import { CalendarEvent, getEventTypeInfo, LifeCategory } from "@/types";
import { isRecurringEvent } from "@/utils/recurrence";

type ViewMode = "upcoming" | "day" | "week" | "month";

interface CalendarScreenProps {
  categoryFilter?: LifeCategory;
}

export default function CalendarScreen({ categoryFilter }: CalendarScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { categories, events, deleteEvent, deleteEventSeries } = useApp();

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingAsInstance, setEditingAsInstance] = useState(false);

  const translateX = useSharedValue(0);

  const filteredEvents = useMemo(() => {
    if (categoryFilter) {
      return events.filter(e => e.categoryId === categoryFilter.id);
    }
    return events;
  }, [events, categoryFilter]);

  const getStartOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    const diff = date.getDate() - day;
    const startOfWeek = new Date(date.setDate(diff));
    return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
  };

  const getEndOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    const diff = date.getDate() + (6 - day);
    const endOfWeek = new Date(date.setDate(diff));
    return `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;
  };

  const upcomingEvents = useMemo(() => 
    filteredEvents
      .filter((e) => e.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime)),
    [filteredEvents, today]
  );

  const selectedDayEvents = useMemo(() =>
    filteredEvents
      .filter((e) => e.startDate === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [filteredEvents, selectedDate]
  );

  const selectedWeekEvents = useMemo(() => {
    const weekStart = getStartOfWeek(selectedDate);
    const weekEnd = getEndOfWeek(selectedDate);
    return filteredEvents
      .filter((e) => e.startDate >= weekStart && e.startDate <= weekEnd)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime));
  }, [filteredEvents, selectedDate]);

  const displayedEvents = useMemo(() => {
    switch (viewMode) {
      case "upcoming": return upcomingEvents;
      case "day": return selectedDayEvents;
      case "week": return selectedWeekEvents;
      case "month": return selectedDayEvents;
      default: return [];
    }
  }, [viewMode, upcomingEvents, selectedDayEvents, selectedWeekEvents]);

  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};
    const accentColor = categoryFilter?.color || theme.primary;

    filteredEvents.forEach((event) => {
      const eventCategory = categories.find(c => c.id === event.categoryId);
      const dotColor = eventCategory?.color || getEventTypeInfo(event.eventType).color;
      if (!marks[event.startDate]) {
        marks[event.startDate] = { dots: [] };
      }
      if (marks[event.startDate].dots.length < 4) {
        marks[event.startDate].dots.push({
          key: event.id,
          color: dotColor,
        });
      }
    });

    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: accentColor,
    };
    return marks;
  }, [filteredEvents, selectedDate, theme, categoryFilter, categories]);

  const handleEventPress = (event: CalendarEvent) => {
    setEditingEvent(event);
    if (isRecurringEvent(event)) {
      setShowRecurringModal(true);
    } else {
      setShowSchedulingModal(true);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEditingAsInstance(false);
    setShowSchedulingModal(true);
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

  const handleDeleteSeries = async () => {
    if (editingEvent?.seriesId) {
      await deleteEventSeries(editingEvent.seriesId);
      setShowRecurringModal(false);
      setEditingEvent(null);
    }
  };

  const goToToday = () => {
    setSelectedDate(today);
  };

  const navigatePeriod = useCallback((direction: "prev" | "next") => {
    const date = new Date(selectedDate + "T00:00:00");
    if (viewMode === "day") {
      date.setDate(date.getDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      date.setDate(date.getDate() + (direction === "next" ? 7 : -7));
    } else if (viewMode === "month") {
      date.setMonth(date.getMonth() + (direction === "next" ? 1 : -1));
    }
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSelectedDate(newDate);
  }, [selectedDate, viewMode]);

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > 50) {
        runOnJS(navigatePeriod)("prev");
      } else if (e.translationX < -50) {
        runOnJS(navigatePeriod)("next");
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 0.3 }],
  }));

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const getViewTitle = () => {
    if (viewMode === "upcoming") return "Upcoming Events";
    if (viewMode === "day") return formatDateHeader(selectedDate);
    if (viewMode === "week") {
      const weekStart = getStartOfWeek(selectedDate);
      const weekEnd = getEndOfWeek(selectedDate);
      return `${formatDateHeader(weekStart)} - ${formatDateHeader(weekEnd)}`;
    }
    if (viewMode === "month") {
      const date = new Date(selectedDate + "T00:00:00");
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return "";
  };

  const renderEventCard = ({ item }: { item: CalendarEvent }) => {
    const eventTypeInfo = getEventTypeInfo(item.eventType);
    const eventCategory = categories.find(c => c.id === item.categoryId);
    const borderColor = eventCategory?.color || eventTypeInfo.color;
    const isTimedEvent = item.eventType === "appointment" || item.eventType === "meeting";
    const showDate = viewMode === "upcoming" || viewMode === "week";

    return (
      <Pressable 
        style={[
          styles.eventCard, 
          { 
            backgroundColor: theme.backgroundDefault,
            borderLeftColor: borderColor,
          }
        ]}
        onPress={() => handleEventPress(item)}
      >
        <View style={styles.eventCardHeader}>
          <View style={styles.eventCardBadges}>
            <View style={[styles.eventTypeBadge, { backgroundColor: eventTypeInfo.color + "20" }]}>
              <Feather name={eventTypeInfo.icon as any} size={14} color={eventTypeInfo.color} />
              <ThemedText style={[styles.eventTypeText, { color: eventTypeInfo.color }]}>
                {eventTypeInfo.label}
              </ThemedText>
            </View>
            {isRecurringEvent(item) ? (
              <View style={[styles.repeatBadge, { backgroundColor: theme.success + "20" }]}>
                <Feather name="repeat" size={12} color={theme.success} />
              </View>
            ) : null}
          </View>
          <View style={styles.eventCardTime}>
            {showDate ? (
              <ThemedText style={[styles.eventDate, { color: theme.textSecondary }]}>
                {formatDateHeader(item.startDate)}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.eventTimeText, { color: theme.textSecondary }]}>
              {isTimedEvent ? `${formatTime(item.startTime)} - ${formatTime(item.endTime)}` : formatTime(item.startTime)}
            </ThemedText>
          </View>
        </View>
        
        <ThemedText style={styles.eventCardTitle} numberOfLines={2}>
          {item.title}
        </ThemedText>
        
        {item.description ? (
          <ThemedText style={[styles.eventCardNotes, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.description}
          </ThemedText>
        ) : null}
        
        <View style={styles.eventCardFooter}>
          {eventCategory ? (
            <View style={[styles.categoryTag, { backgroundColor: eventCategory.color + "20" }]}>
              <ThemedText style={[styles.categoryText, { color: eventCategory.color }]}>
                {eventCategory.name}
              </ThemedText>
            </View>
          ) : null}
          {item.attendeeIds && item.attendeeIds.length > 0 ? (
            <PeopleAvatars personIds={item.attendeeIds} maxDisplay={3} size={24} />
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderViewToggle = () => (
    <View style={[styles.viewToggleContainer, { backgroundColor: theme.backgroundDefault }]}>
      {(["upcoming", "day", "week", "month"] as ViewMode[]).map((mode) => (
        <Pressable
          key={mode}
          style={[
            styles.viewToggleBtn,
            viewMode === mode && { backgroundColor: categoryFilter?.color || theme.primary },
          ]}
          onPress={() => setViewMode(mode)}
        >
          <ThemedText
            style={[
              styles.viewToggleBtnText,
              { color: viewMode === mode ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderNavigation = () => (
    <View style={styles.navigationRow}>
      {viewMode !== "upcoming" ? (
        <>
          <Pressable
            style={[styles.navButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => navigatePeriod("prev")}
          >
            <Feather name="chevron-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.viewTitle} numberOfLines={1}>
            {getViewTitle()}
          </ThemedText>
          <Pressable
            style={[styles.navButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => navigatePeriod("next")}
          >
            <Feather name="chevron-right" size={20} color={theme.text} />
          </Pressable>
          <Pressable
            style={[styles.todayButton, { backgroundColor: categoryFilter?.color || theme.primary }]}
            onPress={goToToday}
          >
            <ThemedText style={styles.todayButtonText}>Today</ThemedText>
          </Pressable>
        </>
      ) : (
        <ThemedText style={styles.viewTitle}>{getViewTitle()}</ThemedText>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="calendar" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {viewMode === "upcoming" 
          ? "No upcoming events scheduled" 
          : `No events for this ${viewMode}`}
      </ThemedText>
      <Pressable
        style={[styles.addEventButton, { backgroundColor: categoryFilter?.color || theme.primary }]}
        onPress={handleAddEvent}
      >
        <Feather name="plus" size={16} color="#FFFFFF" />
        <ThemedText style={styles.addEventButtonText}>Add Event</ThemedText>
      </Pressable>
    </View>
  );

  const showCalendarGrid = viewMode === "month" || viewMode === "week";
  const accentColor = categoryFilter?.color || theme.primary;

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={[styles.headerSection, { paddingTop: headerHeight + Spacing.sm }]}>
        {renderViewToggle()}
        {renderNavigation()}
      </View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          {showCalendarGrid ? (
            <View style={styles.calendarGridContainer}>
              <Calendar
                current={selectedDate}
                onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                markingType="multi-dot"
                markedDates={markedDates}
                theme={{
                  backgroundColor: theme.backgroundRoot,
                  calendarBackground: theme.backgroundRoot,
                  textSectionTitleColor: theme.textSecondary,
                  selectedDayBackgroundColor: accentColor,
                  selectedDayTextColor: "#ffffff",
                  todayTextColor: accentColor,
                  dayTextColor: theme.text,
                  textDisabledColor: theme.textSecondary + "60",
                  monthTextColor: theme.text,
                  arrowColor: accentColor,
                  textMonthFontWeight: "600",
                  textDayFontWeight: "400",
                  textDayHeaderFontWeight: "500",
                }}
                style={styles.calendarCompact}
                hideArrows={true}
              />
            </View>
          ) : null}

          <View style={[
            styles.eventListHeader, 
            { borderTopColor: theme.border },
            !showCalendarGrid && { borderTopWidth: 0 }
          ]}>
            <ThemedText style={styles.eventListTitle}>
              {displayedEvents.length} event{displayedEvents.length !== 1 ? "s" : ""}
            </ThemedText>
          </View>

          <FlatList
            data={displayedEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderEventCard}
            contentContainerStyle={{
              paddingHorizontal: Spacing.lg,
              paddingBottom: tabBarHeight + Spacing.xl + 60,
              flexGrow: 1,
            }}
            scrollIndicatorInsets={{ bottom: insets.bottom }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
            ListEmptyComponent={renderEmptyState}
          />
        </Animated.View>
      </GestureDetector>

      <Pressable
        style={[styles.fab, { backgroundColor: accentColor, bottom: tabBarHeight + Spacing.lg }]}
        onPress={handleAddEvent}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => {
          setShowSchedulingModal(false);
          setEditingEvent(null);
          setEditingAsInstance(false);
        }}
        initialDate={selectedDate}
        editingEvent={editingEvent}
        editingAsInstance={editingAsInstance}
        preselectedCategoryId={categoryFilter?.id}
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
        onDeleteSeries={handleDeleteSeries}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  viewToggleContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.full,
    padding: 3,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: BorderRadius.full,
  },
  viewToggleBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  viewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  todayButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  todayButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  calendarGridContainer: {
    maxHeight: Dimensions.get("window").height * 0.38,
  },
  calendarCompact: {
    paddingBottom: Spacing.xs,
  },
  eventListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  eventListTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  eventCard: {
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  eventCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eventCardBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  eventTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  repeatBadge: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  eventCardTime: {
    alignItems: "flex-end",
  },
  eventDate: {
    fontSize: 11,
    marginBottom: 2,
  },
  eventTimeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  eventCardTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  eventCardNotes: {
    fontSize: 13,
    lineHeight: 18,
  },
  eventCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  categoryTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
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
    fontWeight: "600",
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
