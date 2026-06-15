import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { CalendarEvent, LifeCategory } from "@/types";

interface MonthViewProps {
  events: CalendarEvent[];
  categories: LifeCategory[];
  selectedDate: string;
  onDayPress: (date: string) => void;
  embedded?: boolean;
}

type MonthCell = {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseSelectedMonth = (selectedDate: string) => {
  const [year, month] = selectedDate.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

const buildMonthCells = (viewMonth: Date, today: string): MonthCell[] => {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startPad = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startPad);

  const lastOfMonth = new Date(year, month + 1, 0);
  const lastDayOfWeek = (lastOfMonth.getDay() + 6) % 7;
  const endPad = lastDayOfWeek === 6 ? 0 : 6 - lastDayOfWeek;
  const gridEnd = new Date(year, month, lastOfMonth.getDate() + endPad);

  const cells: MonthCell[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateKey = formatDateKey(cursor);
    cells.push({
      dateKey,
      dayNumber: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === month,
      isToday: dateKey === today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
};

function TabBarHeightConsumer({
  onHeight,
}: {
  onHeight: (n: number) => void;
}) {
  const h = useBottomTabBarHeight();
  useEffect(() => {
    onHeight(h);
  }, [h, onHeight]);
  return null;
}

export default function MonthView({
  events,
  categories,
  selectedDate,
  onDayPress,
  embedded = false,
}: MonthViewProps) {
  const { theme } = useTheme();
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const today = formatDateKey(new Date());
  const [viewMonth, setViewMonth] = useState(() => parseSelectedMonth(selectedDate));

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      if (!map[event.startDate]) map[event.startDate] = [];
      map[event.startDate].push(event);
    });
    return map;
  }, [events]);

  const monthCells = useMemo(() => buildMonthCells(viewMonth, today), [viewMonth, today]);

  const weeks = useMemo(() => {
    const rows: MonthCell[][] = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      rows.push(monthCells.slice(i, i + 7));
    }
    return rows;
  }, [monthCells]);

  const monthTitle = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const changeMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const getEventColor = (event: CalendarEvent) => {
    const category = categories.find((c) => c.id === event.categoryId);
    return category?.color ?? theme.primary;
  };

  return (
    <>
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          style={[styles.navButton, { backgroundColor: theme.backgroundDefault }]}
          onPress={() => changeMonth(-1)}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={18} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>{monthTitle}</ThemedText>
        <Pressable
          style={[styles.navButton, { backgroundColor: theme.backgroundDefault }]}
          onPress={() => changeMonth(1)}
          hitSlop={8}
        >
          <Feather name="chevron-right" size={18} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <ThemedText style={[styles.weekdayLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.weekRow}>
          {week.map((cell) => {
            const dayEvents = eventsByDate[cell.dateKey] || [];
            const visibleEvents = dayEvents.slice(0, 2);
            const overflowCount = dayEvents.length - visibleEvents.length;

            return (
              <Pressable
                key={cell.dateKey}
                style={[styles.dayCell, { borderColor: theme.border }]}
                onPress={() => onDayPress(cell.dateKey)}
              >
                <View style={[styles.dayCellInner, !cell.isCurrentMonth && styles.otherMonthCell]}>
                  <View
                    style={[
                      styles.dayNumberWrap,
                      cell.isToday && { backgroundColor: theme.primary },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.dayNumber,
                        { color: cell.isToday ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {cell.dayNumber}
                    </ThemedText>
                  </View>

                  <View style={styles.pillsContainer}>
                    {visibleEvents.map((event) => {
                      const color = getEventColor(event);
                      const isAppointment =
                        event.eventType === "appointment" || event.eventType === "meeting";
                      return (
                        <View
                          key={event.id}
                          style={[
                            styles.eventPill,
                            { backgroundColor: isAppointment ? `${color}99` : `${color}22` },
                          ]}
                        >
                          <ThemedText
                            numberOfLines={1}
                            style={[
                              styles.eventPillText,
                              { color: isAppointment ? "#FFFFFF" : color },
                            ]}
                          >
                            {event.title}
                          </ThemedText>
                        </View>
                      );
                    })}
                    {overflowCount > 0 ? (
                      <ThemedText style={[styles.overflowText, { color: theme.textSecondary }]}>
                        +{overflowCount}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
    {!embedded ? <TabBarHeightConsumer onHeight={setTabBarHeight} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekdayLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayCellInner: {
    flex: 1,
    padding: 2,
    alignItems: "flex-start",
  },
  otherMonthCell: {
    opacity: 0.3,
  },
  dayNumberWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 11,
    fontWeight: "500",
  },
  pillsContainer: {
    width: "100%",
    marginTop: 2,
    gap: 1,
  },
  eventPill: {
    height: 12,
    borderRadius: 3,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  eventPillText: {
    fontSize: 8,
    fontWeight: "600",
  },
  overflowText: {
    fontSize: 8,
    fontWeight: "500",
    marginTop: 1,
  },
});
