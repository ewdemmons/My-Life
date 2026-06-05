import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

const SHEET_HEIGHT = 320;
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const ITEM_HEIGHT = 36;
const WHEEL_PADDING = 2 * ITEM_HEIGHT;
const SCROLL_VIEWPORT_HEIGHT = 18 + 22 + 40 + 22 + 18;
const SCROLL_CYCLES = 3;

export interface AppTimePickerProps {
  visible: boolean;
  value: string;
  title?: string;
  onConfirm: (timeStr: string) => void;
  onCancel: () => void;
}

function roundToNearest15(date: Date): { hour: number; minute: number } {
  const m = date.getMinutes();
  const rounded = Math.round(m / 15) * 15;
  const d = new Date(date);
  d.setMinutes(rounded >= 60 ? 0 : rounded);
  if (rounded >= 60) d.setHours(d.getHours() + 1);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function parseTime24(value: string): { hour12: number; minute: string; isPm: boolean } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) {
    const { hour, minute } = roundToNearest15(new Date());
    return from24Hour(hour, minute);
  }
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    const rounded = roundToNearestNearest15FromDate();
    return rounded;
  }
  const snapped = Math.round(m / 5) * 5;
  const minuteStr = String(snapped >= 60 ? 0 : snapped).padStart(2, "0");
  const hourAdj = snapped >= 60 ? (h + 1) % 24 : h;
  return from24Hour(hourAdj, parseInt(minuteStr, 10));
}

function roundToNearestNearest15FromDate(): { hour12: number; minute: string; isPm: boolean } {
  const { hour, minute } = roundToNearest15(new Date());
  return from24Hour(hour, minute);
}

function from24Hour(hour24: number, minute: number): { hour12: number; minute: string; isPm: boolean } {
  const isPm = hour24 >= 12;
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  const snapped = Math.round(minute / 5) * 5;
  const minuteStr = String(snapped >= 60 ? 0 : snapped).padStart(2, "0");
  return { hour12, minute: minuteStr, isPm };
}

function toTime24(hour12: number, minute: string, isPm: boolean): string {
  let h: number;
  if (isPm) {
    h = hour12 === 12 ? 12 : hour12 + 12;
  } else {
    h = hour12 === 12 ? 0 : hour12;
  }
  const m = parseInt(minute, 10);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function cycleIndex(current: number, delta: number, length: number): number {
  return (current + delta + length) % length;
}

function buildScrollValues(values: (string | number)[]): (string | number)[] {
  const repeated: (string | number)[] = [];
  for (let i = 0; i < SCROLL_CYCLES; i++) {
    repeated.push(...values);
  }
  return repeated;
}

function scrollYForIndex(index: number, valuesLength: number): number {
  return WHEEL_PADDING + (valuesLength + index) * ITEM_HEIGHT;
}

function mergeScrollRefs(
  internalRef: React.RefObject<ScrollView | null>,
  externalRef?: React.RefObject<ScrollView | null>,
) {
  return (node: ScrollView | null) => {
    (internalRef as React.MutableRefObject<ScrollView | null>).current = node;
    if (externalRef) {
      (externalRef as React.MutableRefObject<ScrollView | null>).current = node;
    }
  };
}

interface StepperColumnProps {
  values: (string | number)[];
  selectedIndex: number;
  onChangeIndex: (index: number) => void;
  formatValue?: (v: string | number) => string;
  theme: ReturnType<typeof useTheme>["theme"];
  scrollKey: string;
  scrollRef?: React.RefObject<ScrollView | null>;
}

function StepperColumn({
  values,
  selectedIndex,
  onChangeIndex,
  formatValue = (v) => String(v),
  theme,
  scrollKey,
  scrollRef: externalScrollRef,
}: StepperColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const setScrollRef = useCallback(mergeScrollRefs(scrollRef, externalScrollRef), [externalScrollRef]);
  const isProgrammaticScroll = useRef(false);
  const lastScrolledIndex = useRef(selectedIndex);
  const scrollValues = buildScrollValues(values);
  const tier1Above = cycleIndex(selectedIndex, -1, values.length);
  const tier1Below = cycleIndex(selectedIndex, 1, values.length);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      isProgrammaticScroll.current = true;
      scrollRef.current?.scrollTo({
        y: scrollYForIndex(index, values.length),
        animated,
      });
      if (!animated) {
        isProgrammaticScroll.current = false;
      } else {
        setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 350);
      }
    },
    [values.length],
  );

  useEffect(() => {
    if (lastScrolledIndex.current === selectedIndex) return;
    lastScrolledIndex.current = selectedIndex;
    scrollToIndex(selectedIndex, true);
  }, [selectedIndex, scrollToIndex]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammaticScroll.current) return;

    const offset = e.nativeEvent.contentOffset.y;
    const adjusted = offset - WHEEL_PADDING;
    if (adjusted < 0) return;
    const rawIndex = Math.round(adjusted / ITEM_HEIGHT);
    const wrapped = ((rawIndex % values.length) + values.length) % values.length;
    lastScrolledIndex.current = wrapped;

    if (wrapped !== selectedIndex) {
      onChangeIndex(wrapped);
    }

    const targetY = scrollYForIndex(wrapped, values.length);
    if (Math.abs(offset - targetY) > 1) {
      isProgrammaticScroll.current = true;
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      isProgrammaticScroll.current = false;
    }
  };

  const getItemStyle = (valueIndex: number) => {
    const dist = Math.abs(valueIndex - selectedIndex);
    const wrapDist = Math.min(dist, values.length - dist);
    if (wrapDist === 0) {
      return [styles.selectedText, { color: theme.text }];
    }
    if (wrapDist === 1) {
      return [styles.tierMid, { color: theme.textSecondary }];
    }
    return [styles.tierMuted, { color: theme.backgroundTertiary }];
  };

  return (
    <View style={styles.column}>
      <Pressable
        onPress={() => onChangeIndex(tier1Above)}
        style={styles.chevronBtn}
        hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}
      >
        <Feather name="chevron-up" size={20} color={theme.textSecondary} />
      </Pressable>

      <ScrollView
        ref={setScrollRef}
        style={[styles.scrollViewport, { height: SCROLL_VIEWPORT_HEIGHT }]}
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled={Platform.OS === "android"}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleMomentumScrollEnd}
      >
        {scrollValues.map((val, itemIndex) => {
          const valueIndex = itemIndex % values.length;
          const isSelected = valueIndex === selectedIndex;
          return (
            <View key={`${scrollKey}-${itemIndex}`} style={styles.scrollItem}>
              {isSelected ? (
                <View
                  style={[
                    styles.selectedRow,
                    styles.selectedRowInScroll,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Text style={[styles.selectedText, { color: theme.text }]}>
                    {formatValue(val)}
                  </Text>
                </View>
              ) : (
                <Text style={getItemStyle(valueIndex)}>{formatValue(val)}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => onChangeIndex(tier1Below)}
        style={styles.chevronBtn}
        hitSlop={{ top: 4, bottom: 8, left: 12, right: 12 }}
      >
        <Feather name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

export default function AppTimePicker({
  visible,
  value,
  title = "Select Time",
  onConfirm,
  onCancel,
}: AppTimePickerProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const openKeyRef = useRef(0);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const [present, setPresent] = useState(visible);
  const [hour12, setHour12] = useState(12);
  const [minute, setMinute] = useState("00");
  const [isPm, setIsPm] = useState(false);

  const syncFromValue = useCallback((timeValue: string) => {
    const parsed = parseTime24(timeValue);
    setHour12(parsed.hour12);
    setMinute(parsed.minute);
    setIsPm(parsed.isPm);
  }, []);

  useEffect(() => {
    if (visible) {
      syncFromValue(value);
      openKeyRef.current += 1;
      setPresent(true);
      slideAnim.setValue(SHEET_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, value, slideAnim, syncFromValue]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      const parsed = parseTime24(value);
      const hourIndex = Math.max(0, HOURS.indexOf(parsed.hour12));
      const minuteIndex = Math.max(0, MINUTES.indexOf(parsed.minute));

      hourScrollRef.current?.scrollTo({
        y: scrollYForIndex(hourIndex, HOURS.length),
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: scrollYForIndex(minuteIndex, MINUTES.length),
        animated: false,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [visible, value]);

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
  const handleConfirm = () => {
    const timeStr = toTime24(hour12, minute, isPm);
    closeSheet(() => onConfirm(timeStr));
  };

  const hourIndex = Math.max(0, HOURS.indexOf(hour12));
  const minuteIndex = Math.max(0, MINUTES.indexOf(minute));
  const scrollKey = `open-${openKeyRef.current}`;

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

          <View style={styles.wheelRow}>
            <StepperColumn
              values={HOURS}
              selectedIndex={hourIndex}
              onChangeIndex={(idx) => setHour12(HOURS[idx])}
              theme={theme}
              scrollKey={`hour-${scrollKey}`}
              scrollRef={hourScrollRef}
            />
            <Text style={[styles.separator, { color: theme.textSecondary }]}>:</Text>
            <StepperColumn
              values={MINUTES}
              selectedIndex={minuteIndex}
              onChangeIndex={(idx) => setMinute(MINUTES[idx])}
              theme={theme}
              scrollKey={`minute-${scrollKey}`}
              scrollRef={minuteScrollRef}
            />
            <View style={styles.ampmCol}>
              <Pressable
                style={[
                  styles.ampmBtn,
                  {
                    backgroundColor: !isPm ? theme.primary : theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setIsPm(false)}
              >
                <Text
                  style={[
                    styles.ampmText,
                    { color: !isPm ? theme.buttonText : theme.textSecondary },
                  ]}
                >
                  AM
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.ampmBtn,
                  {
                    backgroundColor: isPm ? theme.primary : theme.backgroundSecondary,
                    borderColor: theme.border,
                    marginTop: 4,
                  },
                ]}
                onPress={() => setIsPm(true)}
              >
                <Text
                  style={[
                    styles.ampmText,
                    { color: isPm ? theme.buttonText : theme.textSecondary },
                  ]}
                >
                  PM
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

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
    paddingBottom: 32,
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
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  column: {
    width: 52,
    alignItems: "center",
  },
  chevronBtn: {
    paddingVertical: 4,
  },
  scrollViewport: {
    width: 52,
  },
  scrollItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  tierMuted: {
    fontSize: 13,
    height: 18,
    lineHeight: 18,
    textAlign: "center",
  },
  tierMid: {
    fontSize: 13,
    height: 22,
    lineHeight: 22,
    textAlign: "center",
  },
  selectedRow: {
    width: 52,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  selectedRowInScroll: {
    marginVertical: 0,
  },
  selectedText: {
    fontSize: 20,
    fontWeight: "700",
  },
  separator: {
    fontSize: 20,
    fontWeight: "600",
    marginHorizontal: 4,
    marginBottom: 4,
  },
  ampmCol: {
    marginLeft: 6,
    justifyContent: "center",
  },
  ampmBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
  },
  ampmText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
