import React, { useState } from "react";
import { View, StyleSheet, Image, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { createDefaultLifeWheel } from "@/lib/defaultLifeWheel";
import { seedStarterContent } from "@/lib/starterContent";
import type { PostSignUpStackParamList } from "@/navigation/RootStackNavigator";

const appIcon = require("../../../assets/images/icon.png");
const ONBOARDING_COMPLETE_KEY = "@onboarding_complete";
const PENDING_ONBOARDING_KEY = "@pending_onboarding";

type NavigationProp = NativeStackNavigationProp<PostSignUpStackParamList, "OnboardingIntro">;

export default function OnboardingIntroScreen() {
  const insets = useSafeAreaInsets();
  const { theme: systemTheme } = useTheme();
  const theme = Colors.dark;
  const navigation = useNavigation<NavigationProp>();
  const { addCategory, addTask, addHabit, categories } = useApp();
  const { user } = useAuth();
  const [isSkipping, setIsSkipping] = useState(false);

  const handleLetsBegin = () => {
    navigation.push("Onboarding");
  };

  const handleSkipForNow = async () => {
    setIsSkipping(true);
    try {
      const freshCategories = await createDefaultLifeWheel(addCategory, categories);
      try {
        await seedStarterContent(
          freshCategories,
          addTask,
          addHabit,
          user?.id ?? "",
        );
      } catch {
        // Fail silently — never block navigation to Main
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" }],
        })
      );
    } catch {
      // continue to Main even if default wheel fails
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" }],
        })
      );
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xxl,
            paddingBottom: insets.bottom + Spacing.xxl,
            paddingHorizontal: Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.logoSection}>
          <Image source={appIcon} style={styles.appIcon} />
          <ThemedText style={[styles.appName, { color: theme.text }]}>My Life</ThemedText>
        </View>

        <View style={styles.bodySection}>
          <ThemedText style={[styles.heading, { color: theme.text }]}>
            Let's get you started
          </ThemedText>
          <ThemedText style={[styles.bodyText, { color: theme.textSecondary }]}>
            Before we dive in, we'll do a quick Q&A to set up your Life Areas, add some starter
            entries, and help your Life Coach get to know what's going on in your world. It only
            takes about 2 minutes.
          </ThemedText>
        </View>

        <View style={styles.buttonSection}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleLetsBegin}
            disabled={isSkipping}
          >
            <ThemedText style={[styles.primaryButtonText, { color: theme.buttonText }]}>
              Let's Begin →
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.skipButton}
            onPress={handleSkipForNow}
            disabled={isSkipping}
          >
            {isSkipping ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <ThemedText style={[styles.skipButtonText, { color: theme.textSecondary }]}>
                Skip for now
              </ThemedText>
            )}
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
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  appIcon: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  appName: {
    ...Typography.h1,
  },
  bodySection: {
    marginBottom: Spacing.xxl,
    alignItems: "center",
  },
  heading: {
    ...Typography.h1,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  bodyText: {
    ...Typography.body,
    lineHeight: 24,
    textAlign: "center",
  },
  buttonSection: {
    width: "100%",
    gap: Spacing.md,
    alignItems: "center",
  },
  primaryButton: {
    width: "100%",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  skipButtonText: {
    ...Typography.link,
  },
});
