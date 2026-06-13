import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView, Switch, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import useDisplayDensity, { DisplayDensity } from "@/hooks/useDisplayDensity";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import InviteCodeModal from "@/components/InviteCodeModal";
import { requestNotificationPermissions } from "@/utils/notifications";
import { supabase } from "@/lib/supabase";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";

const DENSITY_OPTIONS: { value: DisplayDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
];

const DENSITY_DESCRIPTIONS: Record<DisplayDensity, string> = {
  compact: "Smaller cards, more entries visible. Sub-entries scale down.",
  default: "Balanced size for everyday use. Sub-entries scale down.",
  large: "Larger text and cards. Consistent size at all levels.",
};

export function ProfileTab() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + Spacing.xl;
  const { theme, isDark } = useTheme();
  const { categories, tasks, clearAllData, refreshData } = useApp();
  const { user, signOut } = useAuth();
  const { preferences, updatePreferences } = useNotifications();
  const { density, setDensity } = useDisplayDensity();
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500, successMessage: "Settings saved" });

  React.useEffect(() => {
    const loadProfileName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setDisplayName(data?.display_name || "");
    };
    loadProfileName();
  }, [user?.id]);

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled && Platform.OS !== "web") {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive reminders."
        );
        updatePreferences({ enabled: false });
        return;
      }
    }
    updatePreferences({ enabled });
  };

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
      "Are you sure you want to delete all your tasks and events? Categories are stored in the cloud. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Alert.alert("Done", "All local data has been cleared.");
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: signOut,
        },
      ]
    );
  };

  const handleSaveDisplayName = async () => {
    if (!user?.id || isSavingName) return;

    const performSave = async () => {
      setIsSavingName(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: displayName.trim() || null })
          .eq("id", user.id);
        if (error) throw new Error(error.message);
      } finally {
        setIsSavingName(false);
      }
    };

    setRetry(() => {
      void performSave();
    });
    await withSaveIndicator(performSave);
  };

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: Spacing.xl,
        paddingBottom: bottomPadding,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Feather name="user" size={40} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.profileName}>My Life</ThemedText>
        <ThemedText style={[styles.profileSubtitle, { color: theme.textSecondary }]}>
          {user?.email || "Organizing life, one task at a time"}
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
        <ThemedText style={styles.sectionTitle}>Profile</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.nameSection}>
            <ThemedText style={[styles.nameLabel, { color: theme.textSecondary }]}>Your name</ThemedText>
            <TextInput
              style={[
                styles.nameInput,
                {
                  backgroundColor: theme.backgroundRoot,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="How should we call you?"
              placeholderTextColor={theme.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
            <Pressable
              style={[
                styles.saveNameButton,
                { backgroundColor: theme.primary },
                isSavingName && { opacity: 0.7 },
              ]}
              disabled={isSavingName}
              onPress={handleSaveDisplayName}
            >
              <ThemedText style={[styles.saveNameButtonText, { color: theme.buttonText }]}>
                {isSavingName ? "Saving..." : "Save name"}
              </ThemedText>
            </Pressable>
          </View>
          <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
          <View style={styles.aboutRow}>
            <ThemedText style={styles.aboutLabel}>Email</ThemedText>
            <ThemedText style={[styles.aboutValue, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.email || "Not signed in"}
            </ThemedText>
          </View>
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
        <ThemedText style={styles.sectionTitle}>Display</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.densitySetting}>
            <ThemedText style={styles.settingText}>Card Size</ThemedText>
            <ThemedText style={[styles.densitySublabel, { color: theme.textSecondary }]}>
              Controls entry card and font size
            </ThemedText>
            <View style={styles.densityPillRow}>
              {DENSITY_OPTIONS.map((option) => {
                const isSelected = density === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.densityPill,
                      isSelected
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                    ]}
                    onPress={() => setDensity(option.value)}
                  >
                    <ThemedText
                      style={[
                        styles.densityPillText,
                        isSelected
                          ? styles.densityPillTextSelected
                          : { color: theme.textSecondary },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={[styles.densityDescription, { color: theme.textSecondary }]}>
              {DENSITY_DESCRIPTIONS[density]}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="bell" size={20} color={theme.warning} />
              </View>
              <ThemedText style={styles.settingText}>Push Notifications</ThemedText>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: theme.backgroundSecondary, true: theme.primary + "80" }}
              thumbColor={preferences.enabled ? theme.primary : theme.backgroundTertiary}
            />
          </View>
          {preferences.enabled ? (
            <>
              <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={[styles.settingIcon, { backgroundColor: theme.secondary + "20" }]}>
                    <Feather name="share-2" size={20} color={theme.secondary} />
                  </View>
                  <ThemedText style={styles.settingText}>Bubble Shares</ThemedText>
                </View>
                <Switch
                  value={preferences.bubbleShares}
                  onValueChange={(value) => updatePreferences({ bubbleShares: value })}
                  trackColor={{ false: theme.backgroundSecondary, true: theme.primary + "80" }}
                  thumbColor={preferences.bubbleShares ? theme.primary : theme.backgroundTertiary}
                />
              </View>
              <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={[styles.settingIcon, { backgroundColor: theme.success + "20" }]}>
                    <Feather name="user-plus" size={20} color={theme.success} />
                  </View>
                  <ThemedText style={styles.settingText}>Task Assignments</ThemedText>
                </View>
                <Switch
                  value={preferences.taskAssignments}
                  onValueChange={(value) => updatePreferences({ taskAssignments: value })}
                  trackColor={{ false: theme.backgroundSecondary, true: theme.primary + "80" }}
                  thumbColor={preferences.taskAssignments ? theme.primary : theme.backgroundTertiary}
                />
              </View>
              <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={[styles.settingIcon, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="clock" size={20} color={theme.primary} />
                  </View>
                  <ThemedText style={styles.settingText}>Event Reminders</ThemedText>
                </View>
                <Switch
                  value={preferences.eventReminders}
                  onValueChange={(value) => updatePreferences({ eventReminders: value })}
                  trackColor={{ false: theme.backgroundSecondary, true: theme.primary + "80" }}
                  thumbColor={preferences.eventReminders ? theme.primary : theme.backgroundTertiary}
                />
              </View>
              <ThemedText style={[styles.settingHint, { color: theme.textSecondary }]}>
                Reminder {preferences.reminderMinutesBefore} minutes before events
              </ThemedText>
            </>
          ) : null}
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

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Account</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
            onPress={() => setShowInviteCodeModal(true)}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="gift" size={20} color={theme.primary} />
              </View>
              <ThemedText style={styles.settingText}>Enter Invite Code</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
          <View style={[styles.settingDivider, { backgroundColor: theme.border }]} />
          <Pressable
            style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.error + "20" }]}>
                <Feather name="log-out" size={20} color={theme.error} />
              </View>
              <ThemedText style={[styles.settingText, { color: theme.error }]}>
                Sign Out
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <InviteCodeModal
        visible={showInviteCodeModal}
        onClose={() => setShowInviteCodeModal(false)}
        onSuccess={refreshData}
      />
    </ScrollView>
    <SaveToast
      state={toastState}
      message={toastMessage}
      onRetry={retryFn ?? undefined}
      onDismiss={dismiss}
    />
    </>
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  nameSection: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  nameLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  nameInput: {
    height: 44,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  saveNameButton: {
    height: 40,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  saveNameButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
  densitySetting: {
    padding: Spacing.md,
  },
  densitySublabel: {
    fontSize: 13,
    marginTop: 4,
  },
  densityPillRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  densityPill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  densityPillText: {
    fontSize: 13,
  },
  densityPillTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  densityDescription: {
    fontSize: 11,
    marginTop: 6,
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
