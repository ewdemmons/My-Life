import React from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { AuthStackParamList } from "@/navigation/AuthNavigator";

const appIcon = require("../../../assets/images/icon.png");

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xxl }]}>
        <View style={styles.logoSection}>
          <Image source={appIcon} style={styles.appIcon} />
          <ThemedText style={styles.appName}>My Life</ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            Balance Your World
          </ThemedText>
        </View>

        <View style={styles.descriptionSection}>
          <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
            Organize your life through visual categories, tasks, and calendar integration.
          </ThemedText>
        </View>
      </View>

      <View style={[styles.buttonSection, { paddingBottom: insets.bottom + Spacing.xl }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
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
  descriptionSection: {
    marginTop: Spacing.xxl,
    alignItems: "center",
  },
  description: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
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
