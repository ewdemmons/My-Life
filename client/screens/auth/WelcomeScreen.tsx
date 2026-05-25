import React from "react";
import { View, StyleSheet, Image, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { AuthStackParamList } from "@/navigation/AuthNavigator";

const appIcon = require("../../../assets/images/icon.png");

const FEATURE_CARDS = [
  {
    icon: "check-square" as const,
    iconBg: "primary" as const,
    title: "Productivity & Organization",
    description:
      "Capture tasks and manage everything on your plate — with custom hierarchies, scheduling, and reminders that keep you on track.",
  },
  {
    icon: "target" as const,
    iconBg: "success" as const,
    title: "Personal Growth",
    description:
      "Build accountability through habit tracking, set meaningful goals and let your AI Life Coach turn ambitions into step-by-step action plans.",
  },
  {
    icon: "layers" as const,
    iconBg: "dark" as const,
    title: "Life Balance",
    description:
      "Visualize your life based on what matters most to you. Manage your priorities, relationships, passions, and schedule — all in one place.",
  },
] as const;

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const getIconBg = (kind: "primary" | "success" | "dark") => {
    if (kind === "primary") return theme.primary;
    if (kind === "success") return theme.success;
    return theme.backgroundSecondary;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { paddingHorizontal: Spacing.xl }]}>
          <View style={styles.logoSection}>
            <Image source={appIcon} style={styles.appIcon} />
            <ThemedText style={styles.appName}>My Life</ThemedText>
            <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
              Balance Your World
            </ThemedText>
          </View>

          <View style={styles.cardsSection}>
            {FEATURE_CARDS.map((card) => (
              <View
                key={card.title}
                style={[styles.featureCard, { backgroundColor: theme.backgroundDefault }]}
              >
                <View
                  style={[
                    styles.cardIconWrap,
                    { backgroundColor: getIconBg(card.iconBg) },
                  ]}
                >
                  <Feather
                    name={card.icon}
                    size={22}
                    color={card.iconBg === "dark" ? theme.text : "#FFFFFF"}
                  />
                </View>
                <View style={styles.cardTextWrap}>
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
                    {card.title}
                  </ThemedText>
                  <ThemedText
                    style={[styles.cardDescription, { color: theme.textSecondary }]}
                  >
                    {card.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.buttonSection, { paddingHorizontal: Spacing.xl }]}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate("SignUp")}
          >
            <ThemedText style={[styles.primaryButtonText, { color: theme.buttonText }]}>
              Get Started
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={() => navigation.navigate("SignIn")}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
              I already have an account
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingBottom: Spacing.xl,
  },
  logoSection: {
    alignItems: "center",
    marginTop: Spacing.xxl * 2,
  },
  appIcon: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  appName: {
    ...Typography.h1,
    marginBottom: Spacing.xs,
  },
  tagline: {
    ...Typography.h3,
  },
  cardsSection: {
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.h3,
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonSection: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  secondaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    ...Typography.body,
    fontWeight: "500",
  },
});
