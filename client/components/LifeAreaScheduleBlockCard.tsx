import React from "react";
import { View, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import {
  DAY_INDICES,
  DAY_LABELS_SHORT,
  formatTime12h,
  isEndAfterStart,
} from "@/utils/scheduleTimeUtils";
import type { PendingScheduleBlock } from "@/types";

interface LifeAreaScheduleBlockCardProps {
  block: PendingScheduleBlock;
  accentColor: string;
  onChange: (updates: Partial<PendingScheduleBlock>) => void;
  onDelete: () => void;
  onOpenPicker: (field: "start" | "end") => void;
}

export function LifeAreaScheduleBlockCard({
  block,
  accentColor,
  onChange,
  onDelete,
  onOpenPicker,
}: LifeAreaScheduleBlockCardProps) {
  const { theme } = useTheme();
  const timeInvalid = !isEndAfterStart(block.startTime, block.endTime);

  const toggleDay = (day: number) => {
    const hasDay = block.daysOfWeek.includes(day);
    if (hasDay && block.daysOfWeek.length <= 1) return;
    const next = hasDay
      ? block.daysOfWeek.filter((d) => d !== day)
      : [...block.daysOfWeek, day].sort((a, b) => a - b);
    onChange({ daysOfWeek: next });
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove time block",
      "Remove this preferred time block?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderLeftColor: accentColor,
        },
      ]}
    >
      <Pressable style={styles.deleteBtn} onPress={handleDelete} hitSlop={8}>
        <Feather name="x" size={18} color={theme.textSecondary} />
      </Pressable>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundRoot,
            color: theme.text,
            borderColor: theme.border,
          },
        ]}
        placeholder="e.g. Work Hours, Evening Family Time, Morning Workout"
        placeholderTextColor={theme.textSecondary}
        value={block.label || ""}
        onChangeText={(label) => onChange({ label: label || undefined })}
      />

      <View style={styles.daysRow}>
        {DAY_INDICES.map((day, i) => {
          const selected = block.daysOfWeek.includes(day);
          return (
            <Pressable
              key={day}
              style={[
                styles.dayCircle,
                selected
                  ? { backgroundColor: accentColor }
                  : { borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => toggleDay(day)}
            >
              <ThemedText
                style={[
                  styles.dayLabel,
                  { color: selected ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                {DAY_LABELS_SHORT[i]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timeRow}>
        <Pressable
          style={[styles.timePill, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
          onPress={() => onOpenPicker("start")}
        >
          <ThemedText style={[styles.timePillLabel, { color: theme.textSecondary }]}>
            Start
          </ThemedText>
          <ThemedText style={styles.timePillValue}>{formatTime12h(block.startTime)}</ThemedText>
        </Pressable>
        <Feather name="arrow-right" size={16} color={theme.textSecondary} />
        <Pressable
          style={[styles.timePill, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
          onPress={() => onOpenPicker("end")}
        >
          <ThemedText style={[styles.timePillLabel, { color: theme.textSecondary }]}>
            End
          </ThemedText>
          <ThemedText style={styles.timePillValue}>{formatTime12h(block.endTime)}</ThemedText>
        </Pressable>
      </View>

      {timeInvalid ? (
        <ThemedText style={[styles.errorText, { color: theme.error }]}>
          End time must be after start time
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    position: "relative",
  },
  deleteBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
    padding: Spacing.xs,
  },
  input: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.md,
    paddingRight: Spacing.xxl,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timePill: {
    flex: 1,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  timePillLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  timePillValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 13,
    marginTop: Spacing.sm,
  },
});
