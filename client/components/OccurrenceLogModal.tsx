import React, { useMemo } from "react";
import { View, StyleSheet, Modal, Pressable, FlatList, Alert } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Habit, Occurrence } from "@/types";

interface OccurrenceLogModalProps {
  visible: boolean;
  onClose: () => void;
  habit: Habit | null;
  occurrences: Occurrence[];
  onDeleteOccurrence?: (id: string) => void;
  filterDate?: string;
}

export function OccurrenceLogModal({
  visible,
  onClose,
  habit,
  occurrences,
  onDeleteOccurrence,
  filterDate,
}: OccurrenceLogModalProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const filteredOccurrences = useMemo(() => {
    let filtered = [...occurrences];
    if (filterDate) {
      filtered = filtered.filter((o) => o.occurredDate === filterDate);
    }
    return filtered.sort((a, b) => b.occurredAt - a.occurredAt);
  }, [occurrences, filterDate]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Occurrence",
      "Are you sure you want to delete this log entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteOccurrence?.(id),
        },
      ]
    );
  };

  const groupedByDate = useMemo(() => {
    const groups: Map<string, Occurrence[]> = new Map();
    filteredOccurrences.forEach((o) => {
      const existing = groups.get(o.occurredDate) || [];
      existing.push(o);
      groups.set(o.occurredDate, existing);
    });
    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [filteredOccurrences]);

  const renderOccurrence = (occurrence: Occurrence) => (
    <View
      key={occurrence.id}
      style={[styles.occurrenceItem, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.occurrenceContent}>
        <ThemedText style={[styles.occurrenceTime, { color: theme.textSecondary }]}>
          {formatTime(occurrence.occurredAt)}
        </ThemedText>
        {occurrence.notes ? (
          <ThemedText style={styles.occurrenceNotes} numberOfLines={2}>
            {occurrence.notes}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.noNotes, { color: theme.textSecondary }]}>
            No notes
          </ThemedText>
        )}
      </View>
      {onDeleteOccurrence ? (
        <Pressable
          onPress={() => handleDelete(occurrence.id)}
          hitSlop={8}
          style={styles.deleteBtn}
        >
          <Feather name="trash-2" size={16} color={theme.error} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderDateSection = ({ item }: { item: { date: string; items: Occurrence[] } }) => (
    <View style={styles.dateSection}>
      <ThemedText style={[styles.dateHeader, { color: theme.textSecondary }]}>
        {formatDate(item.date)}
      </ThemedText>
      {item.items.map(renderOccurrence)}
    </View>
  );

  if (!habit) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={styles.blur}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <ThemedText style={styles.title}>{habit.name}</ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                {filterDate ? `Logs for ${formatDate(filterDate)}` : "All occurrence logs"}
              </ThemedText>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {filteredOccurrences.length > 0 ? (
            <FlatList
              data={groupedByDate}
              keyExtractor={(item) => item.date}
              renderItem={renderDateSection}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="clock" size={40} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {filterDate
                  ? "No occurrences logged for this date"
                  : "No occurrences logged yet"}
              </ThemedText>
            </View>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blur: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(128,128,128,0.4)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  headerContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  dateSection: {
    marginBottom: Spacing.md,
  },
  dateHeader: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  occurrenceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  occurrenceContent: {
    flex: 1,
  },
  occurrenceTime: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  occurrenceNotes: {
    fontSize: 14,
  },
  noNotes: {
    fontSize: 13,
    fontStyle: "italic",
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: "center",
  },
});
