import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

const appIcon = require("../../assets/images/icon.png");

type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { signInWithGoogle, isLoading, error } = useAuth();

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xxl }]}>
        <View style={styles.logoContainer}>
          <Image source={appIcon} style={styles.appIcon} />
          <ThemedText style={styles.appName}>My Life</ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            Balance Your World
          </ThemedText>
        </View>

        <View style={styles.featureList}>
          <FeatureItem icon="target" text="Organize with Life Categories" theme={theme} />
          <FeatureItem icon="check-circle" text="Track Goals and Tasks" theme={theme} />
          <FeatureItem icon="calendar" text="Schedule Important Events" theme={theme} />
          <FeatureItem icon="users" text="Connect with People" theme={theme} />
        </View>
      </View>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
            <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => navigation.navigate("SignUp")}
          disabled={isLoading}
        >
          <ThemedText style={styles.primaryButtonText}>Create Account</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { 
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              opacity: pressed ? 0.8 : 1 
            },
          ]}
          onPress={() => navigation.navigate("SignIn")}
          disabled={isLoading}
        >
          <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
            Sign In
          </ThemedText>
        </Pressable>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>or</ThemedText>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            { 
              backgroundColor: isDark ? "#FFFFFF" : "#FFFFFF",
              borderColor: theme.border,
              opacity: pressed ? 0.8 : 1 
            },
          ]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <View style={styles.googleIconContainer}>
            <Feather name="search" size={20} color="#4285F4" />
          </View>
          <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function FeatureItem({ icon, text, theme }: { icon: string; text: string; theme: typeof Colors.dark }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: theme.primary + "20" }]}>
        <Feather name={icon as any} size={18} color={theme.primary} />
      </View>
      <ThemedText style={[styles.featureText, { color: theme.text }]}>{text}</ThemedText>
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
  logoContainer: {
    alignItems: "center",
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
    marginBottom: Spacing.lg,
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: 18,
  },
  featureList: {
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 16,
    fontWeight: "500",
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.lg,
    fontSize: 14,
  },
  googleButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    color: "#1F1F1F",
    fontSize: 16,
    fontWeight: "500",
  },
});
