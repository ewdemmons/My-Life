import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

const SHEET_HEIGHT = 420;
const SWIPE_THRESHOLD = 50;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface AppDatePickerProps {
  visible: boolean;
  value: string;
  title?: string;
  minDate?: string;
  maxDate?: string;
  onConfirm: (dateStr: string) => void;
  onCancel: () => void;
  events?: Array<{
    date: string;
    color: string;
  }>;
}

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return getTodayString();
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return getTodayString();
  }
  return value;
}

function compareDateStr(a: string, b: string): number {
  return a.localeCompare(b);
}

function dateStrFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseToYearMonth(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 };
}

interface CalendarCell {
  dateStr: string;
  day: number;
  inMonth: boolean;
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({
      dateStr: dateStrFromParts(y, m, day),
      day,
      inMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: dateStrFromParts(year, month, d),
      day: d,
      inMonth: true,
    });
  }

  let nextDay = 1;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  while (cells.length < 42) {
    cells.push({
      dateStr: dateStrFromParts(nextYear, nextMonth, nextDay),
      day: nextDay,
      inMonth: false,
    });
    nextDay++;
  }

  return cells;
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export default function AppDatePicker({
  visible,
  value,
  title = "Select Date",
  minDate,
  maxDate,
  onConfirm,
  onCancel,
  events,
}: AppDatePickerProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const todayStr = getTodayString();

  const [present, setPresent] = useState(visible);
  const [selectedDate, setSelectedDate] = useState(() => parseDateStr(value));
  const [displayYear, setDisplayYear] = useState(() => parseToYearMonth(parseDateStr(value)).year);
  const [displayMonth, setDisplayMonth] = useState(() => parseToYearMonth(parseDateStr(value)).month);

  useEffect(() => {
    if (visible) {
      const parsed = parseDateStr(value);
      setSelectedDate(parsed);
      const { year, month } = parseToYearMonth(parsed);
      setDisplayYear(year);
      setDisplayMonth(month);
      setPresent(true);
      slideAnim.setValue(SHEET_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, value, slideAnim]);

  const closeSheet = useCallback(
    (callback: () => void) => {
      Animated.spring(slideAnim, {
        toValue: SHEET_HEIGHT,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start(() => {
        setPresent(false);
        callback();
      });
    },
    [slideAnim],
  );

  const handleCancel = () => closeSheet(onCancel);
  const handleConfirm = () => closeSheet(() => onConfirm(selectedDate));

  const goToMonth = useCallback((delta: number) => {
    const next = addMonths(displayYear, displayMonth, delta);
    setDisplayYear(next.year);
    setDisplayMonth(next.month);
  }, [displayYear, displayMonth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD) goToMonth(-1);
          else if (g.dx < -SWIPE_THRESHOLD) goToMonth(1);
        },
      }),
    [goToMonth],
  );

  const cells = useMemo(
    () => buildMonthGrid(displayYear, displayMonth),
    [displayYear, displayMonth],
  );

  const dotsByDate = useMemo(() => {
    if (!events?.length) return null;
    const map: Record<string, string[]> = {};
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      if (map[e.date].length < 3) map[e.date].push(e.color);
    }
    return map;
  }, [events]);

  const isDisabled = (dateStr: string) => {
    if (minDate && compareDateStr(dateStr, minDate) < 0) return true;
    if (maxDate && compareDateStr(dateStr, maxDate) > 0) return true;
    return false;
  };

  const monthLabel = `${MONTH_NAMES[displayMonth]} ${displayYear}`;

  if (!present && !visible) return null;

  return (
    <Modal visible={present} transparent animationType="none" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={handleCancel} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundDefault,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.backgroundTertiary }]} />
          </View>

          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable onPress={handleCancel} hitSlop={8}>
              <Text style={[styles.headerSide, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
            <Pressable onPress={handleConfirm} hitSlop={8}>
              <Text style={[styles.headerDone, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable
              style={[styles.navCircle, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => goToMonth(-1)}
            >
              <Text style={[styles.navArrow, { color: theme.text }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: theme.text }]}>{monthLabel}</Text>
            <View style={styles.monthNavRight}>
              <Pressable
                style={[styles.todayPill, { backgroundColor: theme.primary }]}
                onPress={() => setSelectedDate(todayStr)}
              >
                <Text style={[styles.todayText, { color: theme.buttonText }]}>Today</Text>
              </Pressable>
              <Pressable
                style={[styles.navCircle, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => goToMonth(1)}
              >
                <Text style={[styles.navArrow, { color: theme.text }]}>›</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.dayHeaders}>
            {DAY_LABELS.map((label, i) => (
              <Text
                key={`${label}-${i}`}
                style={[styles.dayHeader, { color: theme.textSecondary }]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid} {...panResponder.panHandlers}>
            {cells.map((cell) => {
              const disabled = isDisabled(cell.dateStr);
              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === todayStr;
              const dots = dotsByDate?.[cell.dateStr];

              let dayColor = theme.textSecondary;
              if (!cell.inMonth) dayColor = theme.backgroundTertiary;
              else if (disabled) dayColor = theme.backgroundTertiary;
              else if (isToday && !isSelected) dayColor = theme.primary;

              return (
                <Pressable
                  key={`${cell.dateStr}-${cell.day}-${cell.inMonth}`}
                  style={styles.cell}
                  disabled={disabled}
                  onPress={() => setSelectedDate(cell.dateStr)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && { backgroundColor: theme.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        { color: isSelected ? theme.buttonText : dayColor },
                        (isSelected || (isToday && !disabled)) && styles.dayNumBold,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                  {dots && dots.length > 0 ? (
                    <View style={styles.dotsRow}>
                      {dots.map((color, idx) => (
                        <View
                          key={idx}
                          style={[styles.dot, { backgroundColor: color }]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.dotsPlaceholder} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const CELL_WIDTH = (Dimensions.get("window").width - 20) / 7;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  overlayPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerSide: {
    fontSize: 15,
    minWidth: 56,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerDone: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 56,
    textAlign: "right",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  navArrow: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: -2,
  },
  monthLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  monthNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  todayText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dayHeaders: {
    flexDirection: "row",
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  dayHeader: {
    width: CELL_WIDTH,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  cell: {
    width: CELL_WIDTH,
    alignItems: "center",
    paddingVertical: 4,
  },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: {
    fontSize: 11,
  },
  dayNumBold: {
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: 5,
    alignItems: "center",
  },
  dotsPlaceholder: {
    height: 7,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
