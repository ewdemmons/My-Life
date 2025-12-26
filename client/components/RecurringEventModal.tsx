import React from "react";
import { Modal, View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { CalendarEvent } from "@/types";

interface RecurringEventModalProps {
  visible: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onEditInstance: () => void;
  onEditSeries: () => void;
  onDeleteInstance: () => void;
  onDeleteSeries: () => void;
}

export function RecurringEventModal({
  visible,
  event,
  onClose,
  onEditInstance,
  onEditSeries,
  onDeleteInstance,
  onDeleteSeries,
}: RecurringEventModalProps) {
  const { theme } = useTheme();

  if (!event) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.header}>
            <View style={[styles.repeatIcon, { backgroundColor: theme.success + "20" }]}>
              <Feather name="repeat" size={20} color={theme.success} />
            </View>
            <ThemedText style={styles.title}>Recurring Event</ThemedText>
          </View>
          
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            This is part of a recurring series
          </ThemedText>

          <View style={styles.eventInfo}>
            <ThemedText style={styles.eventTitle} numberOfLines={1}>
              {event.title}
            </ThemedText>
            <ThemedText style={[styles.eventDate, { color: theme.textSecondary }]}>
              {formatDate(event.startDate)}
            </ThemedText>
          </View>

          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Edit
          </ThemedText>

          <Pressable 
            style={[styles.option, { backgroundColor: theme.backgroundDefault }]}
            onPress={onEditInstance}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="edit-2" size={16} color={theme.primary} />
            </View>
            <View style={styles.optionContent}>
              <ThemedText style={styles.optionTitle}>Edit this instance only</ThemedText>
              <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Changes will only apply to this occurrence
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>

          <Pressable 
            style={[styles.option, { backgroundColor: theme.backgroundDefault }]}
            onPress={onEditSeries}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.success + "20" }]}>
              <Feather name="edit-3" size={16} color={theme.success} />
            </View>
            <View style={styles.optionContent}>
              <ThemedText style={styles.optionTitle}>Edit entire series</ThemedText>
              <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Changes will apply to all occurrences
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Delete
          </ThemedText>

          <Pressable 
            style={[styles.option, { backgroundColor: theme.backgroundDefault }]}
            onPress={onDeleteInstance}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.warning + "20" }]}>
              <Feather name="trash" size={16} color={theme.warning} />
            </View>
            <View style={styles.optionContent}>
              <ThemedText style={styles.optionTitle}>Delete this instance</ThemedText>
              <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Remove only this occurrence
              </ThemedText>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.option, { backgroundColor: theme.backgroundDefault }]}
            onPress={onDeleteSeries}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.error + "20" }]}>
              <Feather name="trash-2" size={16} color={theme.error} />
            </View>
            <View style={styles.optionContent}>
              <ThemedText style={[styles.optionTitle, { color: theme.error }]}>Delete entire series</ThemedText>
              <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Remove all occurrences
              </ThemedText>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={onClose}
          >
            <ThemedText style={[styles.cancelText, { color: theme.primary }]}>Cancel</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  container: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  repeatIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.h3,
  },
  subtitle: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  eventInfo: {
    marginBottom: Spacing.md,
  },
  eventTitle: {
    ...Typography.h3,
    marginBottom: 2,
  },
  eventDate: {
    ...Typography.caption,
  },
  separator: {
    height: 1,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.body,
    fontWeight: "500",
  },
  optionDescription: {
    ...Typography.caption,
  },
  cancelButton: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  cancelText: {
    ...Typography.body,
    fontWeight: "500",
  },
});
