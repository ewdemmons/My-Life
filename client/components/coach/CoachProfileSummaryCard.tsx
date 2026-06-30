import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { LifeAreaProfile, LifeCategory } from "@/types";

interface CoachProfileSummaryCardProps {
  category: LifeCategory;
  profile: LifeAreaProfile;
  isOwner: boolean;
}

function ChipRow({ items, color }: { items: string[]; color: string }) {
  const { theme } = useTheme();

  if (items.length === 0) {
    return (
      <ThemedText style={[styles.emptyChips, { color: theme.textSecondary }]}>
        None
      </ThemedText>
    );
  }

  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View
          key={item}
          style={[styles.chip, { backgroundColor: color + "20", borderColor: color + "40" }]}
        >
          <ThemedText style={[styles.chipText, { color }]}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

export function CoachProfileSummaryCard({
  category,
  profile,
  isOwner,
}: CoachProfileSummaryCardProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Feather name="zap" size={18} color={category.color} />
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Coach Profile
          </ThemedText>
        </View>
        {isOwner ? (
          <Pressable
            onPress={() =>
              navigation.navigate("LifeAreaProfileEdit", { categoryId: category.id })
            }
            hitSlop={8}
          >
            <ThemedText style={[styles.editLink, { color: category.color }]}>
              Edit
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          Primary Goal
        </ThemedText>
        <ThemedText style={[styles.goalText, { color: theme.text }]}>
          {profile.primaryGoal || "Not set"}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          Current Focus
        </ThemedText>
        <ChipRow items={profile.currentFocus} color={category.color} />
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          Known Obstacles
        </ThemedText>
        <ChipRow items={profile.knownObstacles} color="#EF4444" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  editLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  goalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  emptyChips: {
    fontSize: 14,
    fontStyle: "italic",
  },
});
