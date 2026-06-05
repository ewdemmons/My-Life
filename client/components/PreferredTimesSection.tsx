import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { LifeAreaScheduleBlockCard } from "@/components/LifeAreaScheduleBlockCard";
import { LifeAreaScheduleWeekPreview } from "@/components/LifeAreaScheduleWeekPreview";
import AppTimePicker from "@/components/AppTimePicker";
import { PendingScheduleBlock } from "@/types";
import { generateUUID } from "@/utils/recurrence";
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  DEFAULT_WEEKDAYS,
} from "@/utils/scheduleTimeUtils";

interface PreferredTimesSectionProps {
  blocks: PendingScheduleBlock[];
  onBlocksChange: (blocks: PendingScheduleBlock[]) => void;
  accentColor: string;
  saveError?: string | null;
  sectionRef?: React.RefObject<View | null>;
  onSectionLayout?: (y: number) => void;
}

export function createEmptyScheduleBlock(): PendingScheduleBlock {
  return {
    clientKey: generateUUID(),
    daysOfWeek: [...DEFAULT_WEEKDAYS],
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  };
}

export function PreferredTimesSection({
  blocks,
  onBlocksChange,
  accentColor,
  saveError,
  sectionRef,
  onSectionLayout,
}: PreferredTimesSectionProps) {
  const { theme } = useTheme();
  const [activePicker, setActivePicker] = useState<{
    clientKey: string;
    field: "start" | "end";
  } | null>(null);

  const activeBlock = activePicker
    ? blocks.find((b) => b.clientKey === activePicker.clientKey)
    : null;

  const updateBlock = (clientKey: string, updates: Partial<PendingScheduleBlock>) => {
    onBlocksChange(
      blocks.map((b) => (b.clientKey === clientKey ? { ...b, ...updates } : b)),
    );
  };

  const handleAddBlock = () => {
    onBlocksChange([...blocks, createEmptyScheduleBlock()]);
  };

  const handleDeleteBlock = (clientKey: string) => {
    onBlocksChange(blocks.filter((b) => b.clientKey !== clientKey));
    if (activePicker?.clientKey === clientKey) setActivePicker(null);
  };

  return (
    <View
      ref={sectionRef}
      style={styles.section}
      onLayout={(e) => onSectionLayout?.(e.nativeEvent.layout.y)}
    >
      <ThemedText style={styles.header}>Preferred Times</ThemedText>
      <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
        When do you typically focus on this Life Area? Your Life Coach uses these to
        schedule tasks at the right time.
      </ThemedText>

      {saveError ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.error + "15" }]}>
          <ThemedText style={{ color: theme.error, fontSize: 14 }}>{saveError}</ThemedText>
        </View>
      ) : null}

      {blocks.map((block) => (
        <LifeAreaScheduleBlockCard
          key={block.clientKey}
          block={block}
          accentColor={accentColor}
          onChange={(updates) => updateBlock(block.clientKey, updates)}
          onDelete={() => handleDeleteBlock(block.clientKey)}
          onOpenPicker={(field) => setActivePicker({ clientKey: block.clientKey, field })}
        />
      ))}

      <Pressable
        style={[styles.addButton, { borderColor: theme.border }]}
        onPress={handleAddBlock}
      >
        <Feather name="plus" size={18} color={accentColor} />
        <ThemedText style={[styles.addButtonText, { color: accentColor }]}>
          Add time block
        </ThemedText>
      </Pressable>

      <LifeAreaScheduleWeekPreview blocks={blocks} accentColor={accentColor} />

      <AppTimePicker
        visible={activePicker !== null}
        value={
          activeBlock
            ? activePicker?.field === "end"
              ? activeBlock.endTime
              : activeBlock.startTime
            : DEFAULT_START_TIME
        }
        title={activePicker?.field === "end" ? "End time" : "Start time"}
        onConfirm={(timeStr) => {
          if (!activePicker || !activeBlock) {
            setActivePicker(null);
            return;
          }
          updateBlock(activeBlock.clientKey, {
            [activePicker.field === "start" ? "startTime" : "endTime"]: timeStr,
          });
          setActivePicker(null);
        }}
        onCancel={() => setActivePicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  header: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  subtext: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  errorBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: Spacing.sm,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
