import React, { useState } from "react";
import { 
  View, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export default function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { signUp, signInWithGoogle, isLoading, error, clearError, isGoogleSignInAvailable } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setLocalError(null);
    clearError();

    if (!displayName.trim()) {
      setLocalError("Please enter your name");
      return;
    }
    if (!email.trim()) {
      setLocalError("Please enter your email");
      return;
    }
    if (!password) {
      setLocalError("Please enter a password");
      return;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch (err) {
    }
  };

  const displayError = localError || error;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title}>Create Account</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Start organizing your life today
          </ThemedText>
        </View>

        <View style={styles.form}>
          {displayError ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
              <Feather name="alert-circle" size={16} color={theme.error} />
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {displayError}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Name</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="user" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setLocalError(null);
                }}
                placeholder="Enter your name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
                autoComplete="name"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Email</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="mail" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setLocalError(null);
                }}
                placeholder="Enter your email"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Password</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setLocalError(null);
                }}
                placeholder="Create a password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                editable={!isLoading}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Feather 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={theme.textSecondary} 
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Confirm Password</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setLocalError(null);
                }}
                placeholder="Confirm your password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                editable={!isLoading}
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { 
                backgroundColor: theme.primary, 
                opacity: pressed || isLoading ? 0.8 : 1 
              },
            ]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Create Account</ThemedText>
            )}
          </Pressable>

          {isGoogleSignInAvailable ? (
            <>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>or</ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.googleButton,
                  { 
                    backgroundColor: "#FFFFFF",
                    borderColor: theme.border,
                    opacity: pressed || isLoading ? 0.8 : 1 
                  },
                ]}
                onPress={signInWithGoogle}
                disabled={isLoading}
              >
                <Feather name="search" size={20} color="#4285F4" />
                <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            Already have an account?{" "}
          </ThemedText>
          <Pressable onPress={() => navigation.navigate("SignIn")}>
            <ThemedText style={[styles.footerLink, { color: theme.primary }]}>
              Sign In
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  backButton: {
    marginBottom: Spacing.lg,
    padding: Spacing.xs,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: Spacing.lg,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  primaryButtonText: {
    color: "#FFFFFF",
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
  googleButtonText: {
    color: "#1F1F1F",
    fontSize: 16,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: Spacing.xxl,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});
