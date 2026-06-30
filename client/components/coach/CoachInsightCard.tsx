import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { CoachInsight, CoachInsightType } from "@/types";

const TYPE_META: Record<
  CoachInsightType,
  { label: string; icon: keyof typeof Feather.glyphMap; accent: string }
> = {
  positive_trend: { label: "Trend", icon: "trending-up", accent: "#22C55E" },
  gap_or_drop_off: { label: "Pattern", icon: "activity", accent: "#F59E0B" },
  accountability_nudge: { label: "Nudge", icon: "heart", accent: "#8B5CF6" },
  sparse_area_prompt: { label: "Get started", icon: "plus-circle", accent: "#3B82F6" },
  detail_planning_suggestion: { label: "Plan it out", icon: "git-branch", accent: "#0EA5E9" },
  daily_planning_tie_in: { label: "Daily plan", icon: "calendar", accent: "#A855F7" },
};

interface CoachInsightCardProps {
  insight: CoachInsight;
  categoryColor: string;
  canShowActions: boolean;
  onActionPress?: () => void;
  isActionLoading?: boolean;
}

export function CoachInsightCard({
  insight,
  categoryColor,
  canShowActions,
  onActionPress,
  isActionLoading,
}: CoachInsightCardProps) {
  const { theme } = useTheme();
  const meta = TYPE_META[insight.type];
  const accent = insight.type === "accountability_nudge" ? categoryColor : meta.accent;
  const action = insight.action;
  const showAction = canShowActions && action && onActionPress;

  const isCommand = action?.actionType === "command";
  const isChat = action?.actionType === "navigate_chat";
  const isPlanGen = action?.actionType === "navigate_plan_generator";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
          borderLeftColor: accent,
        },
      ]}
    >
      <View style={styles.header}>
        <Feather name={meta.icon} size={16} color={accent} />
        <ThemedText style={[styles.typeLabel, { color: accent }]}>{meta.label}</ThemedText>
      </View>

      <ThemedText style={[styles.text, { color: theme.text }]}>{insight.text}</ThemedText>

      {showAction ? (
        <Pressable
          style={[
            styles.actionBtn,
            isCommand
              ? { backgroundColor: categoryColor }
              : {
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: isChat ? "#0EA5E9" : isPlanGen ? "#A855F7" : categoryColor,
                },
          ]}
          onPress={onActionPress}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator size="small" color={isCommand ? "#FFFFFF" : accent} />
          ) : (
            <>
              <Feather
                name={
                  isCommand
                    ? "zap"
                    : isChat
                      ? "message-circle"
                      : "calendar"
                }
                size={16}
                color={isCommand ? "#FFFFFF" : isChat ? "#0EA5E9" : "#A855F7"}
              />
              <ThemedText
                style={[
                  styles.actionLabel,
                  { color: isCommand ? "#FFFFFF" : theme.text },
                ]}
              >
                {action.label}
              </ThemedText>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
