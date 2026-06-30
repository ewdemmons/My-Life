import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { BatchExecutionResult } from "@/lib/commandBatch";

interface CommandBatchSummaryProps {
  result: BatchExecutionResult;
  onUndoItem?: (itemId: string) => Promise<void>;
  canUndoItem?: (itemId: string) => boolean;
}

export function CommandBatchSummary({
  result,
  onUndoItem,
  canUndoItem,
}: CommandBatchSummaryProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(result.items.length <= 5);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const activeCount = result.items.filter(
    (item) => item.success && !item.undone,
  ).length;

  const handleUndo = async (itemId: string) => {
    if (!onUndoItem || undoingId) return;
    setUndoingId(itemId);
    try {
      await onUndoItem(itemId);
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <Feather
          name={expanded ? "chevron-down" : "chevron-right"}
          size={18}
          color={theme.textSecondary}
        />
        <ThemedText style={[styles.headerText, { color: theme.text }]}>
          {activeCount > 0
            ? `${activeCount} item${activeCount === 1 ? "" : "s"}`
            : "View details"}
        </ThemedText>
      </Pressable>

      {expanded ? (
        <View style={styles.list}>
          {result.items.map((item) => {
            const showUndo =
              item.success &&
              item.canUndo &&
              !item.undone &&
              canUndoItem?.(item.id) !== false &&
              onUndoItem;

            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  { borderTopColor: theme.border },
                  item.undone && styles.rowUndone,
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: item.undone
                        ? theme.textSecondary + "20"
                        : item.success
                          ? theme.success + "20"
                          : theme.error + "20",
                    },
                  ]}
                >
                  <Feather
                    name={
                      item.undone
                        ? "minus-circle"
                        : item.success
                          ? (item.icon ?? "calendar")
                          : "alert-circle"
                    }
                    size={14}
                    color={
                      item.undone
                        ? theme.textSecondary
                        : item.success
                          ? theme.success
                          : theme.error
                    }
                  />
                </View>

                <View style={styles.rowContent}>
                  <ThemedText
                    style={[
                      styles.rowTitle,
                      { color: theme.text },
                      item.undone && {
                        color: theme.textSecondary,
                        textDecorationLine: "line-through",
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </ThemedText>
                  {item.undone ? (
                    <ThemedText
                      style={[styles.rowDetail, { color: theme.textSecondary }]}
                    >
                      Removed
                    </ThemedText>
                  ) : item.detail ? (
                    <ThemedText
                      style={[styles.rowDetail, { color: theme.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.detail}
                    </ThemedText>
                  ) : null}
                  {!item.success && item.error ? (
                    <ThemedText
                      style={[styles.rowError, { color: theme.error }]}
                      numberOfLines={2}
                    >
                      {item.error}
                    </ThemedText>
                  ) : null}
                </View>

                {showUndo ? (
                  <Pressable
                    style={styles.undoButton}
                    onPress={() => void handleUndo(item.id)}
                    disabled={undoingId === item.id}
                  >
                    <ThemedText
                      style={[
                        styles.undoText,
                        {
                          color:
                            undoingId === item.id
                              ? theme.textSecondary
                              : theme.error,
                        },
                      ]}
                    >
                      Undo
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  list: {
    paddingBottom: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowUndone: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  rowDetail: {
    fontSize: 12,
  },
  rowError: {
    fontSize: 12,
  },
  undoButton: {
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  undoText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
