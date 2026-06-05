import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Habit, LifeCategory } from "@/types";

interface MasterListPinnedHabitCardProps {
  habit: Habit;
  category?: LifeCategory;
  onPress: () => void;
  onUnpin: () => void;
}

export function MasterListPinnedHabitCard({
  habit,
  category,
  onPress,
  onUnpin,
}: MasterListPinnedHabitCardProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onPress}>
        <View style={[styles.taskCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.checkBtn}>
            <Feather name="circle" size={22} color={theme.textSecondary} />
          </View>

          <View style={styles.taskContent}>
            <ThemedText style={styles.taskTitle} numberOfLines={1}>
              {habit.name}
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
                <Feather name="activity" size={10} color={theme.textSecondary} />
                <ThemedText style={[styles.typeText, { color: theme.textSecondary }]}>
                  Habit
                </ThemedText>
              </View>
            </View>
          </View>

          <Pressable onPress={onUnpin} hitSlop={8} style={styles.unpinBtn}>
            <Feather name="star" size={18} color="#F59E0B" />
          </Pressable>
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
  unpinBtn: {
    padding: 4,
  },
});
