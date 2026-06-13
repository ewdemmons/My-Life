import React, { useMemo, useState } from "react";
import { View, StyleSheet, Modal, Pressable, FlatList, Alert, Platform } from "react-native";
import AppDatePicker from "@/components/AppDatePicker";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Habit, Occurrence } from "@/types";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";

interface OccurrenceLogModalProps {
  visible: boolean;
  onClose: () => void;
  habit: Habit | null;
  occurrences: Occurrence[];
  onDeleteOccurrence?: (id: string) => void;
  onUpdateOccurrence?: (id: string, updates: Partial<Occurrence>) => Promise<void>;
  onAddOccurrence?: (occurrence: Omit<Occurrence, "id" | "createdAt">) => Promise<Occurrence | null>;
  filterDate?: string;
}

export function OccurrenceLogModal({
  visible,
  onClose,
  habit,
  occurrences,
  onDeleteOccurrence,
  onUpdateOccurrence,
  onAddOccurrence,
  filterDate,
}: OccurrenceLogModalProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 300, successMessage: "Saved" });
  const [editingGroup, setEditingGroup] = useState<{ date: string; items: Occurrence[] } | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editCount, setEditCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const getTodayDateString = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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

  const openEdit = (occurrence: Occurrence) => {
    const items = filteredOccurrences.filter((o) => o.occurredDate === occurrence.occurredDate);
    if (!items.length || !onUpdateOccurrence || !onAddOccurrence) return;
    setEditingGroup({
      date: occurrence.occurredDate,
      items: [...items].sort((a, b) => a.occurredAt - b.occurredAt),
    });
    setEditDate(occurrence.occurredDate);
    setEditCount(items.length);
  };

  const handleSaveEdit = async () => {
    if (!editingGroup || !habit || !onUpdateOccurrence || !onAddOccurrence) return;

    const performSaveEdit = async () => {
      setSaving(true);
      try {
        const newDate = editDate;
        const currentCount = editingGroup.items.length;
        const baseTime = new Date(newDate + "T12:00:00").getTime();

        if (newDate !== editingGroup.date) {
          for (let i = 0; i < editingGroup.items.length; i++) {
            await onUpdateOccurrence(editingGroup.items[i].id, {
              occurredDate: newDate,
              occurredAt: baseTime + i * 60000,
            });
          }
        }

        if (editCount > currentCount) {
          for (let i = 0; i < editCount - currentCount; i++) {
            await onAddOccurrence({
              itemId: habit.id,
              itemType: "habit",
              occurredAt: baseTime + (currentCount + i) * 60000,
              occurredDate: newDate,
            });
          }
        } else if (editCount < currentCount) {
          const toDelete = currentCount - editCount;
          const sorted = [...editingGroup.items].sort((a, b) => b.occurredAt - a.occurredAt);
          for (let i = 0; i < toDelete && i < sorted.length; i++) {
            await onDeleteOccurrence?.(sorted[i].id);
          }
        }

        setEditingGroup(null);
      } finally {
        setSaving(false);
      }
    };

    setRetry(() => {
      void performSaveEdit();
    });
    await withSaveIndicator(performSaveEdit);
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
      <View style={styles.occurrenceActions}>
        {onUpdateOccurrence && onAddOccurrence ? (
          <Pressable onPress={() => openEdit(occurrence)} hitSlop={8} style={styles.editBtn}>
            <Feather name="edit-2" size={16} color={theme.primary} />
          </Pressable>
        ) : null}
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

  const editModalVisible = editingGroup !== null;

  return (
    <>
    <Modal
      visible={visible && !showEditDatePicker}
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

        {editModalVisible && editingGroup ? (
          <View style={styles.editOverlay}>
            <Pressable style={styles.editBackdrop} onPress={() => setEditingGroup(null)} />
            <View style={[styles.editSheet, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={[styles.editTitle, { color: theme.text }]}>Edit log entries</ThemedText>
              <ThemedText style={[styles.editLabel, { color: theme.textSecondary }]}>Date</ThemedText>
              <Pressable
                style={[styles.editDateRow, { borderColor: theme.border }]}
                onPress={() => setShowEditDatePicker(true)}
              >
                <ThemedText style={{ color: theme.text }}>{formatDate(editDate)}</ThemedText>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
              <ThemedText style={[styles.editLabel, { color: theme.textSecondary }]}>
                Number of occurrences
              </ThemedText>
              <View style={[styles.countStepper, { borderColor: theme.border }]}>
                <Pressable
                  style={[styles.stepperBtn, { backgroundColor: theme.border }]}
                  onPress={() => setEditCount((c) => Math.max(1, c - 1))}
                  disabled={editCount <= 1}
                >
                  <Feather name="minus" size={18} color={theme.text} />
                </Pressable>
                <ThemedText style={[styles.stepperValue, { color: theme.text }]}>{editCount}</ThemedText>
                <Pressable
                  style={[styles.stepperBtn, { backgroundColor: theme.primary }]}
                  onPress={() => setEditCount((c) => c + 1)}
                >
                  <Feather name="plus" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
              <View style={styles.editActions}>
                <Pressable
                  style={[styles.editActionBtn, { backgroundColor: theme.border }]}
                  onPress={() => setEditingGroup(null)}
                >
                  <ThemedText style={[styles.editActionBtnText, { color: theme.text }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.editActionBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  <ThemedText style={styles.editActionBtnTextPrimary}>Save</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <SaveToast
          state={toastState}
          message={toastMessage}
          onRetry={retryFn ?? undefined}
          onDismiss={dismiss}
        />
      </BlurView>
    </Modal>

    <AppDatePicker
      visible={showEditDatePicker && editingGroup !== null}
      value={editDate}
      title="Log date"
      maxDate={getTodayDateString()}
      onConfirm={(dateStr) => {
        setEditDate(dateStr);
        setShowEditDatePicker(false);
      }}
      onCancel={() => setShowEditDatePicker(false)}
    />
    </>
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
  occurrenceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  editBtn: {
    padding: Spacing.xs,
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  editBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  editSheet: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minWidth: 280,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  editDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  countStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  stepperBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "center",
  },
  editActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  editActionBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  editActionBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  editActionBtnTextPrimary: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
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
