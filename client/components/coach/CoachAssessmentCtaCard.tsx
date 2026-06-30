import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { showRetakeAssessmentAlert } from "@/lib/lifeAreaCoachUtils";
import type { LifeAreaProfile, LifeCategory } from "@/types";

interface CoachAssessmentCtaCardProps {
  category: LifeCategory;
  profile: LifeAreaProfile | undefined;
  isOwner: boolean;
}

export function CoachAssessmentCtaCard({
  category,
  profile,
  isOwner,
}: CoachAssessmentCtaCardProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isInProgress = profile?.status === "in_progress";
  const answeredCount = profile?.rawAnswers?.length ?? 0;

  if (!isOwner) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
        ]}
      >
        <Feather name="zap" size={24} color={theme.textSecondary} />
        <ThemedText style={[styles.title, { color: theme.text }]}>
          Coach profile not set up
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          The Life Area owner hasn&apos;t set up a Coach profile yet.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: category.color + "18",
          borderColor: category.color + "40",
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: category.color + "30" }]}>
        <Feather name="zap" size={22} color={category.color} />
      </View>

      <ThemedText style={[styles.title, { color: theme.text }]}>
        {isInProgress ? "Assessment in progress" : "Get to know your Coach"}
      </ThemedText>

      <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
        {isInProgress
          ? `${answeredCount} question${answeredCount === 1 ? "" : "s"} answered. Pick up where you left off.`
          : "Answer a few questions so your Coach understands this Life Area."}
      </ThemedText>

      <Pressable
        style={[styles.primaryBtn, { backgroundColor: category.color }]}
        onPress={() =>
          navigation.navigate("LifeAreaAssessment", { categoryId: category.id })
        }
      >
        <ThemedText style={[styles.primaryBtnText, { color: theme.buttonText }]}>
          {isInProgress ? "Continue Assessment" : "Start Assessment"}
        </ThemedText>
      </Pressable>

      {isInProgress ? (
        <Pressable
          onPress={() =>
            showRetakeAssessmentAlert(category.name, () =>
              navigation.navigate("LifeAreaAssessment", {
                categoryId: category.id,
                isRetake: true,
              }),
            )
          }
          style={styles.secondaryBtn}
        >
          <ThemedText style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>
            Start Over
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  primaryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryBtn: {
    paddingVertical: Spacing.xs,
  },
  secondaryBtnText: {
    fontSize: 14,
  },
});
