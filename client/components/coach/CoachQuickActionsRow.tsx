import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { buildLifeAreaContext, showRetakeAssessmentAlert } from "@/lib/lifeAreaCoachUtils";
import type { LifeAreaProfile, LifeCategory } from "@/types";

interface CoachQuickActionsRowProps {
  category: LifeCategory;
  profile: LifeAreaProfile | undefined;
  isOwner: boolean;
}

interface ActionButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

function ActionButton({ icon, label, color, onPress, variant = "secondary" }: ActionButtonProps) {
  const { theme } = useTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      style={[
        styles.actionBtn,
        isPrimary
          ? { backgroundColor: color }
          : { backgroundColor: theme.backgroundDefault, borderColor: theme.border, borderWidth: 1 },
      ]}
      onPress={onPress}
    >
      <Feather
        name={icon}
        size={18}
        color={isPrimary ? "#FFFFFF" : color}
      />
      <ThemedText
        style={[
          styles.actionLabel,
          { color: isPrimary ? "#FFFFFF" : theme.text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function CoachQuickActionsRow({
  category,
  profile,
  isOwner,
}: CoachQuickActionsRowProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isCompleted = profile?.status === "completed";
  const lifeAreaContext = buildLifeAreaContext(category, profile);

  const openChat = () => {
    navigation.navigate("AssistantChat", { lifeAreaContext });
  };

  const openPlanning = () => {
    navigation.navigate("AssistantChat", {
      lifeAreaContext,
      openPlanningSession: true,
    });
  };

  const handleRetake = () => {
    showRetakeAssessmentAlert(category.name, () =>
      navigation.navigate("LifeAreaAssessment", {
        categoryId: category.id,
        isRetake: true,
      }),
    );
  };

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Quick Actions
      </ThemedText>

      <ActionButton
        icon="message-circle"
        label="Chat with Coach"
        color={category.color}
        onPress={openChat}
        variant="primary"
      />

      {isCompleted ? (
        <ActionButton
          icon="target"
          label="Plan & Manifest"
          color={category.color}
          onPress={openPlanning}
        />
      ) : null}

      {isOwner && isCompleted ? (
        <ActionButton
          icon="refresh-cw"
          label="Retake Assessment"
          color={theme.textSecondary}
          onPress={handleRetake}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
});
