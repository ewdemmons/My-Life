import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { Habit } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { SchedulingModal } from "@/components/SchedulingModal";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { Spacing, BorderRadius } from "@/constants/theme";

interface HabitCardActionsProps {
  habit: Habit;
  categoryColor?: string;
  onEdit: (habit: Habit) => void;
  onLogs: (habit: Habit) => void;
  onAssist: (habit: Habit) => void;
}

export function HabitCardActions({
  habit,
  categoryColor,
  onEdit,
  onLogs,
  onAssist,
}: HabitCardActionsProps) {
  const { theme } = useTheme();
  const { pinHabit, unpinHabit } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 300 });
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);

  const pinColor = categoryColor || theme.primary;

  const handlePinToggle = useCallback(async () => {
    const wasPinned = habit.isPinned;

    const performPinToggle = async () => {
      if (wasPinned) {
        await unpinHabit(habit.id);
      } else {
        await pinHabit(habit.id);
      }
    };

    setRetry(() => {
      void handlePinToggle();
    });
    await withSaveIndicator(performPinToggle, {
      successMessage: wasPinned ? "Removed from Master List" : "Pinned to Master List",
    });
  }, [habit.id, habit.isPinned, pinHabit, unpinHabit, withSaveIndicator, setRetry]);

  const handleSchedule = useCallback(() => {
    setShowSchedulingModal(true);
  }, []);

  return (
    <>
      <View style={styles.actions}>
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: (habit.isPinned ? pinColor : "#F59E0B") + "15" },
          ]}
          onPress={handlePinToggle}
        >
          <View style={styles.iconRow}>
            <Feather
              name="star"
              size={14}
              color={habit.isPinned ? pinColor : theme.textSecondary}
            />
            {habit.isPinned ? (
              <Feather name="check" size={10} color={pinColor} />
            ) : null}
          </View>
          <ThemedText
            style={[
              styles.actionLabel,
              { color: habit.isPinned ? pinColor : theme.textSecondary },
            ]}
            numberOfLines={1}
          >
            Pin
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: "#3B82F6" + "15" }]}
          onPress={handleSchedule}
        >
          <Feather name="calendar" size={14} color="#3B82F6" />
          <ThemedText style={[styles.actionLabel, { color: "#3B82F6" }]} numberOfLines={1}>
            Schedule
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
          onPress={() => onEdit(habit)}
        >
          <Feather name="edit-2" size={14} color={theme.primary} />
          <ThemedText style={[styles.actionLabel, { color: theme.primary }]} numberOfLines={1}>
            Edit
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
          onPress={() => onLogs(habit)}
        >
          <Feather name="list" size={14} color={theme.primary} />
          <ThemedText style={[styles.actionLabel, { color: theme.primary }]} numberOfLines={1}>
            Logs
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: "#FBBF24" + "15" }]}
          onPress={() => onAssist(habit)}
        >
          <Feather name="zap" size={14} color="#FBBF24" />
          <ThemedText style={[styles.actionLabel, { color: "#FBBF24" }]} numberOfLines={1}>
            AI Assist
          </ThemedText>
        </Pressable>
      </View>

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
        linkedHabit={habit}
      />

      <SaveToast
        state={toastState}
        message={toastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
});
