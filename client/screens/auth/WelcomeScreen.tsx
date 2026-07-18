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
    icon: "layers" as const,
    iconBg: "dark" as const,
    title: "Life Balance",
    description:
      "Create dedicated spaces for important areas of your life. Each organized its own way, all connected in a unified view of your life — the way YOU see it.",
  },
  {
    icon: "check-square" as const,
    iconBg: "primary" as const,
    title: "Organization & Planning",
    description:
      "Capture tasks, make lists, manage projects, schedule events, and generate daily plans. Use voice commands to capture anything instantly.",
  },
  {
    icon: "target" as const,
    iconBg: "success" as const,
    title: "Personal Growth",
    description:
      "Track habits and turn goals into detailed action plans. Get guidance from an AI Coach that learns what you want from every area of your life — and holds you to it.",
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
          { paddingTop: insets.top, paddingBottom: insets.bottom },
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
            <View style={[styles.cardsGroup, { borderColor: theme.border }]}>
              {FEATURE_CARDS.map((card, index) => (
                <React.Fragment key={card.title}>
                  <View
                    style={[
                      styles.featureCard,
                      { backgroundColor: theme.backgroundDefault },
                      index === 0 && {
                        borderTopLeftRadius: BorderRadius.sm,
                        borderTopRightRadius: BorderRadius.sm,
                      },
                      index === FEATURE_CARDS.length - 1 && {
                        borderBottomLeftRadius: BorderRadius.sm,
                        borderBottomRightRadius: BorderRadius.sm,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.cardIconWrap,
                        { backgroundColor: getIconBg(card.iconBg) },
                      ]}
                    >
                      <Feather
                        name={card.icon}
                        size={18}
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
                  {index < FEATURE_CARDS.length - 1 && (
                    <View
                      style={[styles.cardDivider, { backgroundColor: theme.border }]}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
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
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.sm,
  },
  logoSection: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  appIcon: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  appName: {
    ...Typography.h1,
    fontSize: 22,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardsSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    marginTop: Spacing.md,
    gap: 0,
  },
  cardsGroup: {
    borderRadius: BorderRadius.sm,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
    flex: 1,
    borderWidth: 0.5,
    borderColor: "transparent",
  },
  cardDivider: {
    height: 0.5,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.h3,
    fontSize: 15,
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonSection: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  primaryButton: {
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  secondaryButton: {
    height: 44,
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
