import React from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { categories, tasks } = useApp();

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleExportData = () => {
    Alert.alert(
      "Export Data",
      "Your data has been prepared for export. In a future update, you'll be able to save or share this data.",
      [{ text: "OK" }]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to delete all your categories and tasks? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove(["@mylife_categories", "@mylife_tasks"]);
            Alert.alert("Done", "All data has been cleared. Please restart the app.");
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Feather name="user" size={40} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.profileName}>My Life User</ThemedText>
        <ThemedText style={[styles.profileSubtitle, { color: theme.textSecondary }]}>
          Organizing life, one task at a time
        </ThemedText>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statValue}>{categories.length}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Life Areas
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <ThemedText style={styles.statValue}>{totalTasks}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Total Tasks
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: theme.success }]}>
            {completionRate}%
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Completion
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name={isDark ? "moon" : "sun"} size={20} color={theme.primary} />
              </View>
              <ThemedText style={styles.settingText}>Dark Mode</ThemedText>
            </View>
            <ThemedText style={[styles.settingValue, { color: theme.textSecondary }]}>
              {isDark ? "On" : "Off"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.settingHint, { color: theme.textSecondary }]}>
            Dark mode follows your system settings
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Data</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
            onPress={handleExportData}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.success + "20" }]}>
                <Feather name="download" size={20} color={theme.success} />
              </View>
              <ThemedText style={styles.settingText}>Export Data</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
          <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
          <Pressable
            style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
            onPress={handleClearData}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.error + "20" }]}>
                <Feather name="trash-2" size={20} color={theme.error} />
              </View>
              <ThemedText style={[styles.settingText, { color: theme.error }]}>
                Clear All Data
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>About</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.aboutRow}>
            <ThemedText style={styles.aboutLabel}>Version</ThemedText>
            <ThemedText style={[styles.aboutValue, { color: theme.textSecondary }]}>
              1.0.0
            </ThemedText>
          </View>
          <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
          <View style={styles.aboutRow}>
            <ThemedText style={styles.aboutLabel}>Made with</ThemedText>
            <ThemedText style={[styles.aboutValue, { color: theme.textSecondary }]}>
              React Native + Expo
            </ThemedText>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  profileSubtitle: {
    fontSize: 14,
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: "100%",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 14,
  },
  settingHint: {
    fontSize: 12,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    marginTop: -Spacing.sm,
  },
  settingDivider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  aboutLabel: {
    fontSize: 15,
  },
  aboutValue: {
    fontSize: 15,
  },
});
