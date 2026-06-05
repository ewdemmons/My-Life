import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { getTaskTypeInfo, LifeCategory, Task } from "@/types";

interface MasterListPinnedTaskCardProps {
  task: Task;
  category?: LifeCategory;
  onPress: () => void;
  onToggleComplete: () => void;
  onUnpin: () => void;
  canModify: boolean;
}

export function MasterListPinnedTaskCard({
  task,
  category,
  onPress,
  onToggleComplete,
  onUnpin,
  canModify,
}: MasterListPinnedTaskCardProps) {
  const { theme } = useTheme();
  const typeInfo = getTaskTypeInfo(task.type);

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onPress}>
        <View style={[styles.taskCard, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            onPress={onToggleComplete}
            disabled={!canModify}
            hitSlop={8}
            style={styles.checkBtn}
          >
            <Feather
              name={task.status === "completed" ? "check-circle" : "circle"}
              size={22}
              color={task.status === "completed" ? theme.success : theme.textSecondary}
            />
          </Pressable>

          <View style={styles.taskContent}>
            <ThemedText
              style={[
                styles.taskTitle,
                task.status === "completed" && styles.completedText,
              ]}
              numberOfLines={1}
            >
              {task.title}
            </ThemedText>
            <View style={styles.taskMeta}>
              {category ? (
                <View style={styles.categoryBadge}>
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {category.name}
                  </ThemedText>
                </View>
              ) : null}
              <View style={[styles.typeBadge, { backgroundColor: "#6B728020" }]}>
                <Feather
                  name={typeInfo.icon as keyof typeof Feather.glyphMap}
                  size={10}
                  color={theme.textSecondary}
                />
                <ThemedText style={[styles.typeText, { color: theme.textSecondary }]}>
                  {typeInfo.label}
                </ThemedText>
              </View>
              {task.priority === "high" ? (
                <View style={[styles.priorityBadge, { backgroundColor: theme.error + "20" }]}>
                  <Feather name="alert-circle" size={10} color={theme.error} />
                </View>
              ) : null}
            </View>
          </View>

          {canModify ? (
            <Pressable onPress={onUnpin} hitSlop={8} style={styles.unpinBtn}>
              <Feather name="star" size={18} color="#F59E0B" />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.sm,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  checkBtn: {
    padding: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
  },
  priorityBadge: {
    padding: 4,
    borderRadius: 4,
  },
  unpinBtn: {
    padding: 4,
  },
});
