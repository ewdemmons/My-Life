import React from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

const PLAN_GRADIENT_START = "#6B7FFF";
const PLAN_GRADIENT_END = "#8B6FFF";
const BANNER_BG = "#13131e";

interface NoPlanBannerProps {
  onGeneratePlan: () => void;
}

export function NoPlanBanner({ onGeneratePlan }: NoPlanBannerProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Feather name="calendar" size={16} color={theme.buttonText} />
        <ThemedText style={[styles.title, { color: theme.buttonText }]}>
          No daily plan yet
        </ThemedText>
      </View>
      <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
        Your Life Coach can build a personalized agenda using your pinned entries,
        events, and habits.
      </ThemedText>
      <Pressable onPress={onGeneratePlan} style={styles.buttonWrap}>
        <LinearGradient
          colors={[PLAN_GRADIENT_START, PLAN_GRADIENT_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Generate Daily Plan →</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BANNER_BG,
    borderRadius: 12,
    marginHorizontal: 14,
    marginVertical: 10,
    padding: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  buttonWrap: {
    alignSelf: "flex-start",
  },
  button: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
