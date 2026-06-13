import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppTimePicker from "@/components/AppTimePicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SchedulingModal } from "@/components/SchedulingModal";
import { RecurringEventModal } from "@/components/RecurringEventModal";
import { PeopleAvatars } from "@/components/PeopleSelector";
import { useApp } from "@/context/AppContext";
import { CalendarEvent, getEventTypeInfo, LifeCategory, EVENT_TYPES, EventType } from "@/types";
import { isRecurringEvent } from "@/utils/recurrence";
import { timeToMinutes } from "@/utils/scheduleTimeUtils";
import { useAuth } from "@/context/AuthContext";
import { canModifyEntriesInCategory, canModifyEntryInLifeArea } from "@/lib/permissions";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import MonthView from "@/components/calendar/MonthView";

type CalendarTab = "upcoming" | "month" | "day";
type ColorMode = "lifeArea" | "eventType";
type EventTypeFilter = "all" | EventType;
type UpcomingListItem =
  | { id: string; type: "header"; title: string; range: string }
  | { id: string; type: "event"; event: CalendarEvent };

interface CalendarScreenProps {
  categoryFilter?: LifeCategory;
  categoryId?: string;
  colorMode?: ColorMode;
}

const HOUR_ROW_HEIGHT = 52;
const TIME_LABEL_WIDTH = 44;
const EVENT_LEFT_OFFSET = 48;
const EVENT_RIGHT_OFFSET = 8;
const EVENTS_COLUMN_FLEX = 0.65;
const REMINDERS_COLUMN_FLEX = 0.35;
const REMINDER_TAG_HEIGHT = 18;
const REMINDER_TAG_GAP = 2;
const DEFAULT_EVENT_COLOR = "#6B7FFF";
const EVENT_TYPE_COLORS: Record<string, string> = {
  appointment: "#3B82F6",
  meeting: "#10B981",
  reminder: "#F59E0B",
  deadline: "#EF4444",
  due_date: "#EF4444",
};

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);

const formatDateHeader = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

const getMinutesIntoDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

type MonthCell = {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
};

const buildMonthCells = (viewMonth: Date, selectedDate: string, today: string): MonthCell[] => {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const startDate = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateKey = formatDateKey(date);
    return {
      dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === today,
      isSelected: dateKey === selectedDate,
    };
  });
};

const hexToRgba = (hexColor: string, alpha: number) => {
  const hex = hexColor.replace("#", "");
  const safeHex = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const num = Number.parseInt(safeHex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatHour12 = (hour: number) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
};

const hourToHhmm = (hour: number) =>
  `${String(hour).padStart(2, "0")}:00`;

const hhmmToHour = (timeStr: string) =>
  parseInt(timeStr.split(":")[0], 10);

export default function CalendarScreen({ categoryFilter, categoryId, colorMode }: CalendarScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { categories, events, deleteEvent, deleteEventSeries } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500 });

  const nowDate = new Date();
  const [currentTime, setCurrentTime] = useState(nowDate);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(nowDate));
  const [viewMode, setViewMode] = useState<CalendarTab>("upcoming");
  const [dayHoursRange, setDayHoursRange] = useState({ start: 0, end: 23 });
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [selectedLifeAreaFilterId, setSelectedLifeAreaFilterId] = useState<string | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<"start" | "end" | null>(null);
  const [hoursRangeError, setHoursRangeError] = useState(false);
  const lastValidHoursRef = useRef({ start: 0, end: 23 });
  const [newEventSeed, setNewEventSeed] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingAsInstance, setEditingAsInstance] = useState(false);
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));
  const [monthGridMeasuredHeight, setMonthGridMeasuredHeight] = useState(0);

  const eventsScrollRef = useRef<ScrollView>(null);
  const remindersScrollRef = useRef<ScrollView>(null);
  const scrollSyncingRef = useRef(false);
  const dateStripScrollRef = useRef<ScrollView>(null);
  const transitionX = useRef(new Animated.Value(0)).current;
  const monthExpandAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;
  const dateItemWidth = 52;

  const effectiveCategoryFilter = useMemo(() => {
    if (categoryFilter) return categoryFilter;
    if (selectedLifeAreaFilterId) {
      return categories.find((category) => category.id === selectedLifeAreaFilterId);
    }
    if (!categoryId) return undefined;
    return categories.find((category) => category.id === categoryId);
  }, [categoryFilter, selectedLifeAreaFilterId, categoryId, categories]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!categoryFilter && selectedLifeAreaFilterId) count += 1;
    if (eventTypeFilter !== "all") count += 1;
    return count;
  }, [categoryFilter, selectedLifeAreaFilterId, eventTypeFilter]);

  const effectiveColorMode: ColorMode = colorMode || (categoryId ? "eventType" : "lifeArea");

  const canModifyEvent = useCallback(
    (event: CalendarEvent) => {
      if (!user) return false;
      if (effectiveCategoryFilter) return canModifyEntriesInCategory(effectiveCategoryFilter);
      return canModifyEntryInLifeArea(
        user.id,
        event.userId ?? user.id,
        event.categoryId,
        categories,
      );
    },
    [user, effectiveCategoryFilter, categories],
  );

  const canAddEvents = effectiveCategoryFilter
    ? canModifyEntriesInCategory(effectiveCategoryFilter)
    : true;

  const today = formatDateKey(currentTime);
  const tomorrowDate = useMemo(() => {
    const date = new Date(today + "T00:00:00");
    date.setDate(date.getDate() + 1);
    return formatDateKey(date);
  }, [today]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      setEventTypeFilter("all");
      setSelectedLifeAreaFilterId(null);
    };
  }, []);

  useEffect(() => {
    const loadHourSettings = async () => {
      try {
        const [storedStart, storedEnd] = await Promise.all([
          AsyncStorage.getItem("@calendar_hours_start"),
          AsyncStorage.getItem("@calendar_hours_end"),
        ]);
        const start = Number.parseInt(storedStart || "0", 10);
        const end = Number.parseInt(storedEnd || "23", 10);
        const safeStart = Number.isFinite(start) ? Math.min(23, Math.max(0, start)) : 0;
        const safeEnd = Number.isFinite(end) ? Math.min(23, Math.max(0, end)) : 23;
        const nextRange = safeEnd <= safeStart
          ? { start: safeStart, end: Math.min(23, safeStart + 1) }
          : { start: safeStart, end: safeEnd };
        setDayHoursRange(nextRange);
        lastValidHoursRef.current = nextRange;
      } catch {
        setDayHoursRange({ start: 0, end: 23 });
      }
    };
    loadHourSettings();
  }, []);

  const filteredEvents = useMemo(() => {
    if (effectiveCategoryFilter) {
      return events.filter((event) => event.categoryId === effectiveCategoryFilter.id);
    }
    return events;
  }, [events, effectiveCategoryFilter]);

  const upcomingEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => event.startDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime)),
    [filteredEvents, today]
  );

  const selectedDayEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => event.startDate <= selectedDate && event.endDate >= selectedDate)
        .sort((a, b) => {
          const aStart = a.startDate < selectedDate ? "00:00" : a.startTime;
          const bStart = b.startDate < selectedDate ? "00:00" : b.startTime;
          return aStart.localeCompare(bStart);
        }),
    [filteredEvents, selectedDate]
  );

  const applyEventTypeFilter = useCallback((eventList: CalendarEvent[]) => {
    if (eventTypeFilter === "all") return eventList;
    return eventList.filter((event) => event.eventType === eventTypeFilter);
  }, [eventTypeFilter]);

  const filteredUpcomingEvents = useMemo(
    () => applyEventTypeFilter(upcomingEvents),
    [upcomingEvents, applyEventTypeFilter],
  );
  const filteredSelectedDayEvents = useMemo(
    () => applyEventTypeFilter(selectedDayEvents),
    [selectedDayEvents, applyEventTypeFilter],
  );
  const monthTabEvents = useMemo(
    () => applyEventTypeFilter(filteredEvents),
    [filteredEvents, applyEventTypeFilter],
  );

  const displayedEvents = useMemo(() => {
    if (viewMode === "upcoming") return filteredUpcomingEvents;
    return filteredSelectedDayEvents;
  }, [viewMode, filteredUpcomingEvents, filteredSelectedDayEvents]);

  const unfilteredCountForCurrentView = useMemo(() => {
    const baseEvents = categoryFilter
      ? events.filter((event) => event.categoryId === categoryFilter.id)
      : events;
    if (viewMode === "upcoming") {
      return baseEvents.filter((event) => event.startDate >= today).length;
    }
    return baseEvents.filter(
      (event) => event.startDate <= selectedDate && event.endDate >= selectedDate,
    ).length;
  }, [events, categoryFilter, viewMode, today, selectedDate]);
  const filteredCountForCurrentView = displayedEvents.length;

  const dayStripDates = useMemo(() => {
    const base = new Date(selectedDate + "T00:00:00");
    return Array.from({ length: 31 }, (_, index) => {
      const date = new Date(base);
      date.setDate(base.getDate() + index - 15);
      return formatDateKey(date);
    });
  }, [selectedDate]);

  const dayHours = useMemo(() => {
    const length = dayHoursRange.end - dayHoursRange.start + 1;
    return Array.from({ length }, (_, index) => dayHoursRange.start + index);
  }, [dayHoursRange]);

  const dayTimelineHeight = dayHours.length * HOUR_ROW_HEIGHT;

  const getHourLabel = (hour: number) => {
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12} ${ampm}`;
  };

  const getEventColor = useCallback((event: CalendarEvent) => {
    if (effectiveColorMode === "eventType") {
      return EVENT_TYPE_COLORS[event.eventType] || DEFAULT_EVENT_COLOR;
    }
    const eventCategory = categories.find((category) => category.id === event.categoryId);
    return eventCategory?.color || DEFAULT_EVENT_COLOR;
  }, [effectiveColorMode, categories]);

  const getReminderTagColor = useCallback((event: CalendarEvent) => {
    if (effectiveColorMode === "eventType") {
      return EVENT_TYPE_COLORS[event.eventType] || DEFAULT_EVENT_COLOR;
    }
    return getEventColor(event);
  }, [effectiveColorMode, getEventColor]);

  const timedDayEvents = useMemo(
    () => filteredSelectedDayEvents.filter(
      (event) => event.eventType === "appointment" || event.eventType === "meeting",
    ),
    [filteredSelectedDayEvents],
  );

  const reminderDayEvents = useMemo(
    () => filteredSelectedDayEvents.filter(
      (event) => event.eventType === "reminder" || event.eventType === "due_date",
    ),
    [filteredSelectedDayEvents],
  );

  const timelineEvents = useMemo(() => {
    return timedDayEvents
      .map((event) => {
        const startBoundary = new Date(selectedDate + "T00:00:00");
        const endBoundary = new Date(selectedDate + "T23:59:59");
        const eventStart = parseDateTime(event.startDate, event.startTime);
        const eventEnd = parseDateTime(event.endDate, event.endTime);
        const clippedStart = eventStart < startBoundary ? startBoundary : eventStart;
        const clippedEnd = eventEnd > endBoundary ? endBoundary : eventEnd;
        const startMinutes = getMinutesIntoDay(clippedStart);
        const endMinutes = Math.max(startMinutes + 1, getMinutesIntoDay(clippedEnd));
        const top = ((startMinutes - dayHoursRange.start * 60) / 60) * HOUR_ROW_HEIGHT;
        const height = Math.max(44, ((endMinutes - startMinutes) / 60) * HOUR_ROW_HEIGHT);
        return { event, top, height, startMinutes, endMinutes };
      })
      .filter((item) => item.endMinutes > dayHoursRange.start * 60 && item.startMinutes < (dayHoursRange.end + 1) * 60);
  }, [timedDayEvents, selectedDate, dayHoursRange]);

  const remindersByHour = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    const startBoundary = new Date(selectedDate + "T00:00:00");
    reminderDayEvents.forEach((event) => {
      const eventStart = parseDateTime(event.startDate, event.startTime);
      const clippedStart = eventStart < startBoundary ? startBoundary : eventStart;
      const hour = clippedStart.getHours();
      if (hour < dayHoursRange.start || hour > dayHoursRange.end) return;
      if (!map[hour]) map[hour] = [];
      map[hour].push(event);
    });
    Object.values(map).forEach((events) => {
      events.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [reminderDayEvents, selectedDate, dayHoursRange]);

  const getDotsForDate = useCallback(
    (date: string) => {
      const dayEvents = filteredEvents.filter(
        (event) => event.startDate <= date && event.endDate >= date,
      );
      return dayEvents.slice(0, 3).map((event) => getEventColor(event));
    },
    [filteredEvents, getEventColor],
  );

  const dateStripEventDots = useMemo(() => {
    const dotsByDate: Record<string, string[]> = {};
    dayStripDates.forEach((date) => {
      dotsByDate[date] = getDotsForDate(date);
    });
    return dotsByDate;
  }, [dayStripDates, getDotsForDate]);

  const monthCells = useMemo(
    () => buildMonthCells(viewMonth, selectedDate, today),
    [viewMonth, selectedDate, today],
  );

  const getDatePlusDays = useCallback((days: number) => {
    const date = new Date(today + "T00:00:00");
    date.setDate(date.getDate() + days);
    return date;
  }, [today]);

  const getDayDiffFromToday = useCallback((dateKey: string) => {
    const target = new Date(dateKey + "T00:00:00").getTime();
    const base = new Date(today + "T00:00:00").getTime();
    return Math.floor((target - base) / (24 * 60 * 60 * 1000));
  }, [today]);

  const upcomingListItems = useMemo<UpcomingListItem[]>(() => {
    const buckets: Record<string, CalendarEvent[]> = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      nextWeek: [],
      nextMonth: [],
      later: [],
    };
    filteredUpcomingEvents.forEach((event) => {
      const diff = getDayDiffFromToday(event.startDate);
      if (diff <= 0) buckets.today.push(event);
      else if (diff === 1) buckets.tomorrow.push(event);
      else if (diff <= 7) buckets.thisWeek.push(event);
      else if (diff <= 14) buckets.nextWeek.push(event);
      else if (diff <= 60) buckets.nextMonth.push(event);
      else buckets.later.push(event);
    });

    const config: Array<{ key: keyof typeof buckets; title: string; range: string }> = [
      { key: "today", title: "Today", range: formatDateHeader(today) },
      { key: "tomorrow", title: "Tomorrow", range: formatDateHeader(tomorrowDate) },
      {
        key: "thisWeek",
        title: "This Week",
        range: `${formatDateHeader(formatDateKey(getDatePlusDays(3)))} - ${formatDateHeader(formatDateKey(getDatePlusDays(7)))}`,
      },
      {
        key: "nextWeek",
        title: "Next Week",
        range: `${formatDateHeader(formatDateKey(getDatePlusDays(8)))} - ${formatDateHeader(formatDateKey(getDatePlusDays(14)))}`,
      },
      {
        key: "nextMonth",
        title: "Next Month",
        range: `${formatDateHeader(formatDateKey(getDatePlusDays(15)))} - ${formatDateHeader(formatDateKey(getDatePlusDays(60)))}`,
      },
      { key: "later", title: "Later", range: `After ${formatDateHeader(formatDateKey(getDatePlusDays(60)))}` },
    ];

    const items: UpcomingListItem[] = [];
    config.forEach((section) => {
      if (buckets[section.key].length === 0) return;
      items.push({
        id: `header-${section.key}`,
        type: "header",
        title: section.title,
        range: section.range,
      });
      buckets[section.key].forEach((event) => {
        items.push({
          id: `event-${event.id}`,
          type: "event",
          event,
        });
      });
    });
    return items;
  }, [filteredUpcomingEvents, getDayDiffFromToday, today, tomorrowDate, getDatePlusDays]);

  const handleEventPress = (event: CalendarEvent) => {
    if (!canModifyEvent(event)) return;
    setNewEventSeed(null);
    setEditingEvent(event);
    if (isRecurringEvent(event)) {
      setShowRecurringModal(true);
    } else {
      setShowSchedulingModal(true);
    }
  };

  const handleAddEvent = () => {
    setNewEventSeed(null);
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
    if (!editingEvent) return;

    const performDelete = async () => {
      await deleteEvent(editingEvent.id);
      setShowRecurringModal(false);
      setEditingEvent(null);
    };

    setRetry(() => {
      void handleDeleteInstance();
    });
    await withSaveIndicator(performDelete, { showSuccess: false });
  };

  const handleDeleteSeries = async () => {
    if (!editingEvent?.seriesId) return;

    const performDelete = async () => {
      await deleteEventSeries(editingEvent.seriesId!);
      setShowRecurringModal(false);
      setEditingEvent(null);
    };

    setRetry(() => {
      void handleDeleteSeries();
    });
    await withSaveIndicator(performDelete, { showSuccess: false });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = Number.parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getViewTitle = () => "Upcoming Events";

  const renderEventCard = ({ item }: { item: CalendarEvent }) => {
    const eventTypeInfo = getEventTypeInfo(item.eventType);
    const eventCategory = categories.find((category) => category.id === item.categoryId);
    const borderColor = getEventColor(item);
    const isTimedEvent = item.eventType === "appointment" || item.eventType === "meeting";
    const showDate = viewMode === "upcoming";

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

  const applyDayHoursRange = useCallback(async (start: number, end: number) => {
    const safeStart = Math.min(23, Math.max(0, start));
    const safeEnd = Math.min(23, Math.max(0, end));
    const nextRange = { start: safeStart, end: safeEnd };
    setDayHoursRange(nextRange);
    lastValidHoursRef.current = nextRange;
    setHoursRangeError(false);
    await AsyncStorage.multiSet([
      ["@calendar_hours_start", String(safeStart)],
      ["@calendar_hours_end", String(safeEnd)],
    ]);
  }, []);

  const handleStartHourConfirm = useCallback(
    (timeStr: string) => {
      const newStart = hhmmToHour(timeStr);
      if (dayHoursRange.end <= newStart) {
        setHoursRangeError(true);
        setDayHoursRange(lastValidHoursRef.current);
        setActiveTimePicker(null);
        return;
      }
      applyDayHoursRange(newStart, dayHoursRange.end);
      setActiveTimePicker(null);
    },
    [dayHoursRange.end, applyDayHoursRange],
  );

  const handleEndHourConfirm = useCallback(
    (timeStr: string) => {
      const newEnd = hhmmToHour(timeStr);
      if (newEnd <= dayHoursRange.start) {
        setHoursRangeError(true);
        setDayHoursRange(lastValidHoursRef.current);
        setActiveTimePicker(null);
        return;
      }
      applyDayHoursRange(dayHoursRange.start, newEnd);
      setActiveTimePicker(null);
    },
    [dayHoursRange.start, applyDayHoursRange],
  );

  const resetDayHoursToFullDay = useCallback(async () => {
    await applyDayHoursRange(0, 23);
  }, [applyDayHoursRange]);

  const handleMonthDayPress = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode("day");
  }, []);

  const renderViewToggleAndFilter = () => {
    const filterActive = activeFilterCount > 0;
    return (
      <View style={styles.headerControlsRow}>
        <View style={[styles.viewToggleContainer, { backgroundColor: theme.backgroundDefault }]}>
          {(["upcoming", "month", "day"] as CalendarTab[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.viewToggleBtn,
                viewMode === mode && { backgroundColor: effectiveCategoryFilter?.color || theme.primary },
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
        <Pressable
          style={[
            styles.filterControlButton,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: filterActive ? "#6B7FFF" : theme.border,
            },
          ]}
          onPress={() => setShowFilterSheet(true)}
        >
          <Feather name="filter" size={14} color={filterActive ? "#6B7FFF" : theme.textSecondary} />
          <ThemedText
            style={[
              styles.filterControlButtonText,
              { color: filterActive ? "#6B7FFF" : theme.text },
            ]}
          >
            {filterActive ? `Filter · ${activeFilterCount}` : "Filter"}
          </ThemedText>
        </Pressable>
      </View>
    );
  };

  const renderFilterSheet = () => (
    <Modal
      visible={showFilterSheet && activeTimePicker === null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setShowFilterSheet(false);
        setActiveTimePicker(null);
        setHoursRangeError(false);
      }}
    >
      <View style={[styles.filterSheetContainer, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.filterSheetHeader, { borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => {
              setShowFilterSheet(false);
              setActiveTimePicker(null);
              setHoursRangeError(false);
            }}
            hitSlop={12}
          >
            <ThemedText style={[styles.filterSheetClose, { color: theme.textSecondary }]}>
              Close
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.filterSheetTitle}>Filter</ThemedText>
          <View style={styles.filterSheetHeaderSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.filterSheetContent,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!categoryFilter ? (
            <View style={styles.filterSheetSection}>
              <ThemedText style={[styles.filterSheetSectionTitle, { color: theme.textSecondary }]}>
                Life Area
              </ThemedText>
              <Pressable
                style={[
                  styles.filterSheetRow,
                  { borderBottomColor: theme.border },
                  selectedLifeAreaFilterId === null && { backgroundColor: theme.primary + "10" },
                ]}
                onPress={() => setSelectedLifeAreaFilterId(null)}
              >
                <ThemedText style={styles.filterSheetRowText}>All Life Areas</ThemedText>
                {selectedLifeAreaFilterId === null ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
              {categories.map((category) => {
                const isSelected = selectedLifeAreaFilterId === category.id;
                return (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.filterSheetRow,
                      { borderBottomColor: theme.border },
                      isSelected && { backgroundColor: theme.primary + "10" },
                    ]}
                    onPress={() => setSelectedLifeAreaFilterId(category.id)}
                  >
                    <View style={styles.filterSheetRowLeft}>
                      <View style={[styles.filterSheetRowDot, { backgroundColor: category.color }]} />
                      <ThemedText style={styles.filterSheetRowText}>{category.name}</ThemedText>
                    </View>
                    {isSelected ? <Feather name="check" size={18} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.filterSheetSection}>
            <ThemedText style={[styles.filterSheetSectionTitle, { color: theme.textSecondary }]}>
              Event Type
            </ThemedText>
            <Pressable
              style={[
                styles.filterSheetRow,
                { borderBottomColor: theme.border },
                eventTypeFilter === "all" && { backgroundColor: theme.primary + "10" },
              ]}
              onPress={() => setEventTypeFilter("all")}
            >
              <ThemedText style={styles.filterSheetRowText}>All Types</ThemedText>
              {eventTypeFilter === "all" ? (
                <Feather name="check" size={18} color={theme.primary} />
              ) : null}
            </Pressable>
            {EVENT_TYPES.map((eventType) => {
              const isSelected = eventTypeFilter === eventType.value;
              return (
                <Pressable
                  key={eventType.value}
                  style={[
                    styles.filterSheetRow,
                    { borderBottomColor: theme.border },
                    isSelected && { backgroundColor: theme.primary + "10" },
                  ]}
                  onPress={() => setEventTypeFilter(eventType.value)}
                >
                  <View style={styles.filterSheetRowLeft}>
                    <Feather name={eventType.icon as any} size={16} color={eventType.color} />
                    <ThemedText style={styles.filterSheetRowText}>{eventType.label}</ThemedText>
                  </View>
                  {isSelected ? <Feather name="check" size={18} color={theme.primary} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.filterSheetSection}>
            <ThemedText style={[styles.filterSheetSectionTitle, { color: theme.textSecondary }]}>
              Day View Hours
            </ThemedText>
            <ThemedText style={[styles.filterSheetSectionSubtext, { color: theme.textSecondary }]}>
              Adjust the visible time range for the Day View
            </ThemedText>
            <View style={[styles.filterSheetRow, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.filterSheetRowText}>Start time</ThemedText>
              <Pressable
                style={styles.dayHoursPill}
                onPress={() => setActiveTimePicker("start")}
              >
                <ThemedText style={styles.dayHoursPillText}>
                  {formatHour12(dayHoursRange.start)}
                </ThemedText>
              </Pressable>
            </View>
            <View style={[styles.filterSheetRow, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.filterSheetRowText}>End time</ThemedText>
              <Pressable
                style={styles.dayHoursPill}
                onPress={() => setActiveTimePicker("end")}
              >
                <ThemedText style={styles.dayHoursPillText}>
                  {formatHour12(dayHoursRange.end)}
                </ThemedText>
              </Pressable>
            </View>
            {hoursRangeError ? (
              <ThemedText style={styles.dayHoursErrorText}>
                End time must be after start time
              </ThemedText>
            ) : null}
            <Pressable onPress={resetDayHoursToFullDay}>
              <ThemedText style={[styles.dayHoursResetLink, { color: theme.textSecondary }]}>
                Reset to full day
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            style={[styles.filterSheetClearButton, { borderColor: theme.border }]}
            onPress={() => {
              setSelectedLifeAreaFilterId(null);
              setEventTypeFilter("all");
            }}
          >
            <Feather name="x-circle" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.filterSheetClearText, { color: theme.textSecondary }]}>
              Clear all filters
            </ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );

  const accentColor = effectiveCategoryFilter?.color || theme.primary;

  const renderNavigation = () => (
    <View style={styles.navigationRow}>
      <ThemedText style={styles.viewTitle}>{getViewTitle()}</ThemedText>
    </View>
  );

  const toggleMonthExpanded = useCallback(
    (expanded: boolean) => {
      setIsMonthExpanded(expanded);
      Animated.spring(monthExpandAnim, {
        toValue: expanded ? 1 : 0,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      }).start();
    },
    [monthExpandAnim],
  );

  const changeViewMonth = useCallback((delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }, []);

  const handleMonthDateSelect = useCallback(
    (dateKey: string) => {
      setSelectedDate(dateKey);
      toggleMonthExpanded(false);
    },
    [toggleMonthExpanded],
  );

  const handleMonthToday = useCallback(() => {
    setSelectedDate(today);
    setViewMonth(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));
    toggleMonthExpanded(false);
  }, [today, nowDate, toggleMonthExpanded]);

  const monthPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 24,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 50) changeViewMonth(-1);
          else if (gestureState.dx < -50) changeViewMonth(1);
        },
      }),
    [changeViewMonth],
  );

  const effectiveMonthGridHeight = monthGridMeasuredHeight > 0 ? monthGridMeasuredHeight : 280;
  const animatedGridHeight = monthExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, effectiveMonthGridHeight],
  });

  const renderEventDots = (dots: string[], gap: number) => (
    <View style={[styles.eventDotsRow, { gap }]}>
      {dots.map((dotColor, dotIndex) => (
        <View
          key={`dot-${dotIndex}`}
          style={[styles.dateStripDot, { backgroundColor: dotColor }]}
        />
      ))}
    </View>
  );

  const renderMonthToggleChevron = (onPress: () => void) => (
    <Pressable style={styles.dragHandleRow} onPress={onPress} accessibilityRole="button">
      <View style={styles.chevronCircle}>
        <Feather
          name={isMonthExpanded ? "chevron-up" : "chevron-down"}
          size={36}
          color="#aaaaaa"
        />
      </View>
    </Pressable>
  );

  const renderMonthGrid = () => {
    const monthTitle = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const weeks: MonthCell[][] = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      weeks.push(monthCells.slice(i, i + 7));
    }

    return (
      <View
        style={styles.monthGridInner}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0 && height !== monthGridMeasuredHeight) {
            setMonthGridMeasuredHeight(height);
          }
        }}
        {...monthPanResponder.panHandlers}
      >
        <View style={styles.monthGridHeader}>
          <View style={styles.monthGridHeaderSide}>
            <Pressable
              style={[styles.monthNavButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => changeViewMonth(-1)}
            >
              <Feather name="chevron-left" size={16} color={theme.text} />
            </Pressable>
          </View>
          <ThemedText style={[styles.monthGridTitle, { color: theme.text }]}>{monthTitle}</ThemedText>
          <View style={[styles.monthGridHeaderSide, styles.monthGridHeaderSideRight]}>
            <Pressable style={styles.monthTodayButton} onPress={handleMonthToday}>
              <ThemedText style={styles.monthTodayButtonText}>Today</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.monthNavButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => changeViewMonth(1)}
            >
              <Feather name="chevron-right" size={16} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.monthWeekdayRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
            <View key={`${label}-${index}`} style={styles.monthWeekdayCell}>
              <ThemedText style={[styles.monthWeekdayLabel, { color: theme.textSecondary }]}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.monthWeekRow}>
            {week.map((cell) => {
              const dots = getDotsForDate(cell.dateKey);
              const numberColor = cell.isSelected
                ? "#FFFFFF"
                : cell.isToday
                  ? "#6B7FFF"
                  : cell.isCurrentMonth
                    ? "#777777"
                    : "#333333";
              return (
                <Pressable
                  key={cell.dateKey}
                  style={styles.monthDayCell}
                  onPress={() => handleMonthDateSelect(cell.dateKey)}
                >
                  <View
                    style={[
                      styles.monthDayNumberWrap,
                      cell.isSelected && styles.monthDayNumberSelected,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.monthDayNumber,
                        { color: numberColor },
                        cell.isToday && !cell.isSelected && styles.monthDayNumberToday,
                      ]}
                    >
                      {cell.dayNumber}
                    </ThemedText>
                  </View>
                  <View style={styles.monthDayDotsRow}>
                    {renderEventDots(dots, 1.5)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderDayDateSelector = () => (
    <View>
      {!isMonthExpanded ? (
        <ScrollView
          ref={dateStripScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStripContent}
        >
          {dayStripDates.map((date) => {
            const dateObj = new Date(date + "T00:00:00");
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const eventDots = dateStripEventDots[date] || [];
            const showEventDots = !(isToday && eventDots.length === 0);
            return (
              <Pressable key={date} style={styles.dateItem} onPress={() => setSelectedDate(date)}>
                <ThemedText style={[styles.dateItemDay, { color: theme.textSecondary }]}>
                  {dateObj.toLocaleDateString("en-US", { weekday: "narrow" })}
                </ThemedText>
                <View
                  style={[
                    styles.dateNumberCircle,
                    { borderColor: theme.border, backgroundColor: "transparent" },
                    isSelected && { backgroundColor: accentColor, borderColor: accentColor },
                  ]}
                >
                  <ThemedText style={[styles.dateItemNumber, { color: isSelected ? "#FFFFFF" : theme.text }]}>
                    {dateObj.getDate()}
                  </ThemedText>
                </View>
                {isToday && !isSelected ? <View style={[styles.todayDot, { backgroundColor: accentColor }]} /> : null}
                <View style={styles.dateStripDotsRow}>
                  {showEventDots ? renderEventDots(eventDots, 2) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        renderMonthGrid()
      )}

      {renderMonthToggleChevron(() => toggleMonthExpanded(!isMonthExpanded))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Feather name="calendar" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {viewMode === "upcoming"
          ? "No upcoming events scheduled"
          : "No events for this day"}
      </ThemedText>
      <Pressable
        style={[styles.addEventButton, { backgroundColor: effectiveCategoryFilter?.color || theme.primary }]}
        onPress={handleAddEvent}
      >
        <Feather name="plus" size={16} color="#FFFFFF" />
        <ThemedText style={styles.addEventButtonText}>Add Event</ThemedText>
      </Pressable>
    </View>
  );

  const handleSlotPress = (hour: number) => {
    const startHour = Math.max(0, Math.min(23, hour));
    const endHour = Math.max(0, Math.min(23, startHour + 1));
    setEditingEvent(null);
    setEditingAsInstance(false);
    setNewEventSeed({
      date: selectedDate,
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(endHour).padStart(2, "0")}:00`,
    });
    setShowSchedulingModal(true);
  };

  const handleTimelineScroll = useCallback((source: "events" | "reminders") => {
    return (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (scrollSyncingRef.current) return;
      scrollSyncingRef.current = true;
      const y = event.nativeEvent.contentOffset.y;
      const targetRef = source === "events" ? remindersScrollRef : eventsScrollRef;
      targetRef.current?.scrollTo({ y, animated: false });
      requestAnimationFrame(() => {
        scrollSyncingRef.current = false;
      });
    };
  }, []);

  const scrollBothTimelinesTo = useCallback((y: number, animated: boolean) => {
    eventsScrollRef.current?.scrollTo({ y, animated });
    remindersScrollRef.current?.scrollTo({ y, animated });
  }, []);

  const renderReminderHourCell = (hour: number, index: number) => {
    const hourEvents = remindersByHour[hour] || [];
    const maxTagsInRow = Math.floor(HOUR_ROW_HEIGHT / (REMINDER_TAG_HEIGHT + REMINDER_TAG_GAP));
    let visibleEvents = hourEvents;
    let overflowCount = 0;
    if (hourEvents.length > maxTagsInRow) {
      const maxWithLabel = Math.max(1, maxTagsInRow - 1);
      visibleEvents = hourEvents.slice(0, maxWithLabel);
      overflowCount = hourEvents.length - maxWithLabel;
    }

    return (
      <View
        key={`reminder-hour-${hour}`}
        style={[styles.reminderHourCell, { top: index * HOUR_ROW_HEIGHT, height: HOUR_ROW_HEIGHT }]}
      >
        {visibleEvents.map((event) => {
          const color = getReminderTagColor(event);
          const iconName = event.eventType === "due_date" ? "flag" : "bell";
          return (
            <Pressable
              key={event.id}
              style={[
                styles.reminderTag,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderLeftColor: color,
                },
              ]}
              onPress={() => handleEventPress(event)}
            >
              <Feather name={iconName} size={9} color={color} />
              <ThemedText numberOfLines={1} style={[styles.reminderTagText, { color }]}>
                {event.title}
              </ThemedText>
            </Pressable>
          );
        })}
        {overflowCount > 0 ? (
          <ThemedText style={[styles.reminderOverflowLabel, { color: theme.textSecondary }]}>
            {`+${overflowCount} more`}
          </ThemedText>
        ) : null}
      </View>
    );
  };

  const dayScrollContentPadding = {
    paddingBottom: tabBarHeight + Spacing.xl + 60,
  };

  useEffect(() => {
    setMonthGridMeasuredHeight(0);
  }, [viewMonth]);

  useEffect(() => {
    if (viewMode !== "day") return;
    const selectedIndex = dayStripDates.findIndex((date) => date === selectedDate);
    if (selectedIndex < 0) return;
    const targetX = Math.max(0, selectedIndex * dateItemWidth - screenWidth / 2 + dateItemWidth / 2);
    requestAnimationFrame(() => {
      dateStripScrollRef.current?.scrollTo({ x: targetX, animated: true });
    });
  }, [viewMode, selectedDate, dayStripDates, screenWidth]);

  useEffect(() => {
    if (viewMode !== "day") return;
    const timelineStartMinutes = dayHoursRange.start * 60;
    const dayStart = new Date(selectedDate + "T00:00:00");
    const isFutureDate = dayStart > new Date(today + "T00:00:00");
    const anchorMinutes = selectedDate === today
      ? getMinutesIntoDay(currentTime)
      : isFutureDate
        ? 8 * 60
        : 8 * 60;
    const y = ((anchorMinutes - timelineStartMinutes) / 60) * HOUR_ROW_HEIGHT - HOUR_ROW_HEIGHT * 1.2;
    const maxY = Math.max(0, dayTimelineHeight - HOUR_ROW_HEIGHT);
    const nextY = Math.max(0, Math.min(maxY, y));
    requestAnimationFrame(() => {
      scrollBothTimelinesTo(nextY, true);
    });
  }, [viewMode, selectedDate, today, currentTime, dayHoursRange.start, dayTimelineHeight, scrollBothTimelinesTo]);

  useEffect(() => {
    Animated.spring(transitionX, {
      toValue: viewMode === "day" ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 220,
      mass: 0.5,
    }).start();
  }, [viewMode, transitionX]);

  const currentLinePosition = ((getMinutesIntoDay(currentTime) - dayHoursRange.start * 60) / 60) * HOUR_ROW_HEIGHT;
  const showCurrentTimeIndicator = viewMode === "day"
    && selectedDate === today
    && currentLinePosition >= 0
    && currentLinePosition <= dayTimelineHeight;

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={[styles.headerSection, { paddingTop: headerHeight + Spacing.sm }]}>
        {renderViewToggleAndFilter()}
        {viewMode === "upcoming" ? renderNavigation() : null}
        {viewMode === "day" ? renderDayDateSelector() : null}
        {viewMode === "day" ? (
          <View style={styles.dayColumnHeaderRow}>
            <View style={styles.dayColumnHeaderEventsWrap}>
              <View style={{ width: TIME_LABEL_WIDTH }} />
              <ThemedText style={[styles.dayColumnHeaderLabel, { color: theme.textSecondary }]}>
                EVENTS
              </ThemedText>
            </View>
            <View style={[styles.dayColumnHeaderRemindersWrap, { borderLeftColor: theme.border }]}>
              <ThemedText style={[styles.dayColumnHeaderLabel, { color: theme.textSecondary }]}>
                REMINDERS
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      <Animated.View
        style={{
          flex: 1,
          transform: [
            {
              translateX: transitionX.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 0],
              }),
            },
          ],
        }}
      >
        {viewMode !== "month" ? (
          <View style={[styles.eventListHeader, { borderTopColor: theme.border, borderTopWidth: 0 }]}>
            <ThemedText style={styles.eventListTitle}>
              {activeFilterCount === 0
                ? `${filteredCountForCurrentView} event${filteredCountForCurrentView !== 1 ? "s" : ""}`
                : `${filteredCountForCurrentView} of ${unfilteredCountForCurrentView} events`}
            </ThemedText>
          </View>
        ) : null}

        {viewMode === "month" ? (
          <MonthView
            events={monthTabEvents}
            categories={categories}
            selectedDate={selectedDate}
            onDayPress={handleMonthDayPress}
          />
        ) : viewMode === "day" ? (
          <View style={styles.dayTimelineRow}>
            <View style={styles.dayEventsColumnWrap}>
              <ScrollView
                ref={eventsScrollRef}
                style={styles.dayEventsScroll}
                contentContainerStyle={dayScrollContentPadding}
                scrollIndicatorInsets={{ bottom: insets.bottom }}
                scrollEventThrottle={16}
                onScroll={handleTimelineScroll("events")}
                showsVerticalScrollIndicator
              >
              <View style={[styles.timelineCanvas, { height: dayTimelineHeight }]}>
                {dayHours.map((hour, index) => (
                  <View key={hour} style={[styles.hourRow, { top: index * HOUR_ROW_HEIGHT, height: HOUR_ROW_HEIGHT }]}>
                    <View style={styles.timeCell}>
                      <ThemedText style={[styles.timeLabel, { color: theme.textSecondary }]}>{getHourLabel(hour)}</ThemedText>
                    </View>
                    <Pressable
                      style={styles.hourContent}
                      onPress={() => handleSlotPress(hour)}
                      android_ripple={{ color: theme.primary + "12" }}
                    >
                      <View style={[styles.hourDivider, { backgroundColor: theme.border }]} />
                      <View style={[styles.halfHourDivider, { backgroundColor: theme.border + "80" }]} />
                    </Pressable>
                  </View>
                ))}

                {timelineEvents.map(({ event, top, height }) => {
                  const color = getEventColor(event);
                  const eventType = getEventTypeInfo(event.eventType);
                  const eventCategory = categories.find((category) => category.id === event.categoryId);
                  const isAppointment =
                    event.eventType === "appointment" || event.eventType === "meeting";
                  const textColor = isAppointment ? "#FFFFFF" : color;
                  const startLabel = event.startDate < selectedDate ? "12:00 AM" : formatTime(event.startTime);
                  const endLabel = event.endDate > selectedDate ? "11:59 PM" : formatTime(event.endTime);
                  return (
                    <Pressable
                      key={event.id}
                      style={[
                        styles.timelineEventBlock,
                        {
                          top,
                          height,
                          borderLeftColor: color,
                          backgroundColor: isAppointment ? `${color}CC` : `${color}33`,
                        },
                      ]}
                      onPress={() => handleEventPress(event)}
                    >
                      <ThemedText numberOfLines={1} style={[styles.timelineEventTitle, { color: textColor }]}>
                        {event.title}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.timelineEventTime,
                          { color: isAppointment ? "#FFFFFF" : hexToRgba(color, 0.72) },
                        ]}
                      >
                        {`${startLabel} - ${endLabel}`}
                      </ThemedText>
                      <View
                        style={[
                          styles.timelineBadge,
                          { backgroundColor: isAppointment ? "#FFFFFF33" : hexToRgba(color, 0.2) },
                        ]}
                      >
                        <ThemedText style={[styles.timelineBadgeText, { color: textColor }]}>
                          {(eventCategory?.name || "General") + " · " + eventType.label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}

                {showCurrentTimeIndicator ? (
                  <View style={[styles.currentTimeContainer, { top: currentLinePosition }]}>
                    <View style={styles.currentTimeLine} />
                    <View style={styles.currentTimeDot} />
                  </View>
              ) : null}
            </View>
              </ScrollView>
            </View>

            <View style={[styles.columnDivider, { backgroundColor: theme.border }]} />

            <View style={styles.dayRemindersColumnWrap}>
              <ScrollView
                ref={remindersScrollRef}
                style={styles.dayRemindersScroll}
                contentContainerStyle={dayScrollContentPadding}
                scrollIndicatorInsets={{ bottom: insets.bottom }}
                scrollEventThrottle={16}
                onScroll={handleTimelineScroll("reminders")}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.remindersCanvas, { height: dayTimelineHeight }]}>
                  {dayHours.map((hour, index) => renderReminderHourCell(hour, index))}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : (
          <FlatList
            data={upcomingListItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.type === "header") {
                return (
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderTitleRow}>
                      <ThemedText style={styles.sectionHeaderTitle}>{item.title}</ThemedText>
                      <ThemedText style={styles.sectionHeaderRange}>{` — ${item.range}`}</ThemedText>
                    </View>
                    <View style={[styles.sectionHeaderDivider, { backgroundColor: theme.border }]} />
                  </View>
                );
              }
              return <View style={styles.sectionEventWrap}>{renderEventCard({ item: item.event })}</View>;
            }}
            contentContainerStyle={{
              paddingBottom: tabBarHeight + Spacing.xl + 60,
              flexGrow: 1,
            }}
            scrollIndicatorInsets={{ bottom: insets.bottom }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            ListEmptyComponent={renderEmptyState}
          />
        )}
      </Animated.View>

      {canAddEvents ? (
        <Pressable
          style={[styles.fab, { backgroundColor: accentColor, bottom: tabBarHeight + Spacing.lg }]}
          onPress={handleAddEvent}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => {
          setShowSchedulingModal(false);
          setEditingEvent(null);
          setEditingAsInstance(false);
          setNewEventSeed(null);
        }}
        initialDate={newEventSeed?.date || selectedDate}
        initialStartTime={newEventSeed?.startTime}
        initialEndTime={newEventSeed?.endTime}
        editingEvent={editingEvent}
        editingAsInstance={editingAsInstance}
        preselectedCategoryId={effectiveCategoryFilter?.id}
        readOnly={editingEvent ? !canModifyEvent(editingEvent) : false}
        canDelete={editingEvent ? canModifyEvent(editingEvent) : false}
      />
      <RecurringEventModal
        visible={showRecurringModal && (editingEvent ? canModifyEvent(editingEvent) : false)}
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
      <AppTimePicker
        visible={activeTimePicker === "start"}
        value={hourToHhmm(dayHoursRange.start)}
        title="Start time"
        onConfirm={handleStartHourConfirm}
        onCancel={() => setActiveTimePicker(null)}
      />
      <AppTimePicker
        visible={activeTimePicker === "end"}
        value={hourToHhmm(dayHoursRange.end)}
        title="End time"
        onConfirm={handleEndHourConfirm}
        onCancel={() => setActiveTimePicker(null)}
      />
      {renderFilterSheet()}

      <SaveToast
        state={toastState}
        message={toastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  headerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  viewToggleContainer: {
    flex: 1,
    flexDirection: "row",
    borderRadius: BorderRadius.full,
    padding: 3,
  },
  filterControlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterControlButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  filterSheetContainer: {
    flex: 1,
  },
  filterSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  filterSheetClose: {
    fontSize: 16,
    minWidth: 50,
  },
  filterSheetTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  filterSheetHeaderSpacer: {
    minWidth: 50,
  },
  filterSheetContent: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  filterSheetSection: {
    gap: Spacing.sm,
  },
  filterSheetSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterSheetSectionSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  dayHoursPill: {
    backgroundColor: "#1c1c26",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  dayHoursPillText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  dayHoursErrorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: Spacing.xs,
  },
  dayHoursResetLink: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: Spacing.xs,
  },
  filterSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
  },
  filterSheetRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  filterSheetRowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterSheetRowText: {
    fontSize: 15,
  },
  filterSheetClearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  filterSheetClearText: {
    fontSize: 15,
    fontWeight: "500",
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
  dateStripContent: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  dateItem: {
    width: 44,
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  dateItemDay: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: "500",
  },
  dateNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateItemNumber: {
    fontSize: 13,
    fontWeight: "600",
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
  },
  dateStripDotsRow: {
    minHeight: 6,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  eventDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dateStripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dragHandleRow: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthGridAnimatedWrap: {
    overflow: "hidden",
  },
  monthGridInner: {
    paddingBottom: Spacing.xs,
  },
  monthGridHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  monthNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  monthGridHeaderSide: {
    width: 88,
    flexDirection: "row",
    alignItems: "center",
  },
  monthGridHeaderSideRight: {
    justifyContent: "flex-end",
    gap: Spacing.xs,
  },
  monthGridTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
  },
  monthTodayButton: {
    backgroundColor: "#6B7FFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  monthTodayButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  monthWeekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  monthWeekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  monthWeekdayLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  monthWeekRow: {
    flexDirection: "row",
  },
  monthDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  monthDayNumberWrap: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  monthDayNumberSelected: {
    backgroundColor: "#6B7FFF",
  },
  monthDayNumber: {
    fontSize: 11,
    fontWeight: "400",
  },
  monthDayNumberToday: {
    fontWeight: "700",
  },
  monthDayDotsRow: {
    minHeight: 6,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayColumnHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 4,
  },
  dayColumnHeaderEventsWrap: {
    flex: EVENTS_COLUMN_FLEX,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  dayColumnHeaderRemindersWrap: {
    flex: REMINDERS_COLUMN_FLEX,
    flexBasis: 0,
    minWidth: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.sm,
    justifyContent: "center",
  },
  dayColumnHeaderLabel: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dayTimelineRow: {
    flex: 1,
    flexDirection: "row",
  },
  dayEventsColumnWrap: {
    flex: EVENTS_COLUMN_FLEX,
    flexBasis: 0,
    minWidth: 0,
  },
  dayEventsScroll: {
    flex: 1,
  },
  dayRemindersColumnWrap: {
    flex: REMINDERS_COLUMN_FLEX,
    flexBasis: 0,
    minWidth: 0,
  },
  dayRemindersScroll: {
    flex: 1,
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
  },
  remindersCanvas: {
    position: "relative",
  },
  reminderHourCell: {
    position: "absolute",
    left: 8,
    right: 8,
    gap: REMINDER_TAG_GAP,
    overflow: "hidden",
  },
  reminderTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    borderLeftWidth: 2,
    paddingVertical: 3,
    paddingHorizontal: 5,
    height: REMINDER_TAG_HEIGHT,
  },
  reminderTagText: {
    flex: 1,
    fontSize: 9,
    fontWeight: "600",
  },
  reminderOverflowLabel: {
    fontSize: 8,
    fontWeight: "500",
    marginTop: 1,
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
  sectionHeaderRow: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeaderRange: {
    color: "#888888",
    fontSize: 12,
    marginLeft: 2,
  },
  sectionHeaderDivider: {
    marginTop: 6,
    height: StyleSheet.hairlineWidth,
  },
  sectionEventWrap: {
    paddingHorizontal: Spacing.lg,
  },
  timelineCanvas: {
    position: "relative",
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  timeCell: {
    width: TIME_LABEL_WIDTH,
    paddingRight: 6,
    alignItems: "flex-end",
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: -6,
  },
  hourContent: {
    flex: 1,
    marginLeft: 4,
  },
  hourDivider: {
    height: 1,
  },
  halfHourDivider: {
    position: "absolute",
    top: HOUR_ROW_HEIGHT / 2,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  timelineEventBlock: {
    position: "absolute",
    left: EVENT_LEFT_OFFSET,
    right: EVENT_RIGHT_OFFSET,
    borderRadius: 6,
    borderLeftWidth: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    zIndex: 5,
  },
  timelineEventTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  timelineEventTime: {
    fontSize: 10,
    marginTop: 1,
  },
  timelineBadge: {
    alignSelf: "flex-start",
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
  },
  timelineBadgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  currentTimeContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  currentTimeLine: {
    height: 1.5,
    backgroundColor: "#EF4444",
    flex: 1,
  },
  currentTimeDot: {
    position: "absolute",
    left: TIME_LABEL_WIDTH - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
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
