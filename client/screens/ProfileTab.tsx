import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Switch,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
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

const SPEAK_OVER_SILENT_MODE_KEY = "@speak_over_silent_mode";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [speakOverSilentMode, setSpeakOverSilentMode] = useState(false);
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500, successMessage: "Settings saved" });

  React.useEffect(() => {
    const loadProfileName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .single();
      setDisplayName(data?.display_name || "");
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      } else {
        setAvatarUrl(null);
      }
    };
    loadProfileName();
  }, [user?.id]);

  React.useEffect(() => {
    AsyncStorage.getItem(SPEAK_OVER_SILENT_MODE_KEY).then((val) => {
      if (val !== null) {
        setSpeakOverSilentMode(val === "true");
      }
    });
  }, []);

  const handleToggleSpeakOverSilentMode = async (enabled: boolean) => {
    setSpeakOverSilentMode(enabled);
    await AsyncStorage.setItem(SPEAK_OVER_SILENT_MODE_KEY, String(enabled));
  };

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

  const handlePickPhoto = async () => {
    if (!user?.id || isUploadingPhoto) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please allow access to your photo library in Settings.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;

    setIsUploadingPhoto(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      const base64Data = compressed.base64;
      if (!base64Data) throw new Error("Failed to compress image");

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const fileName = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, bytes.buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error("Photo upload error:", error);
      Alert.alert("Upload failed", "Could not upload photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
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
        <Pressable
          onPress={handlePickPhoto}
          disabled={isUploadingPhoto}
          style={styles.avatarContainer}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.avatarInitial}>
                {displayName?.[0]?.toUpperCase() ?? "?"}
              </ThemedText>
            </View>
          )}
          <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary, borderColor: theme.backgroundRoot }]}>
            <Feather name="camera" size={12} color="#fff" />
          </View>
          {isUploadingPhoto ? (
            <View style={styles.avatarUploading}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>
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
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault, marginTop: Spacing.sm }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: theme.secondary + "20" }]}>
                <Feather name="volume-2" size={20} color={theme.secondary} />
              </View>
              <ThemedText style={styles.settingText}>Speak Over Silent Mode</ThemedText>
            </View>
            <Switch
              value={speakOverSilentMode}
              onValueChange={handleToggleSpeakOverSilentMode}
              trackColor={{ false: theme.backgroundSecondary, true: theme.primary + "80" }}
              thumbColor={speakOverSilentMode ? theme.primary : theme.backgroundTertiary}
            />
          </View>
          <ThemedText style={[styles.settingHint, { color: theme.textSecondary }]}>
            Allow Coach to read responses aloud even when your phone is on silent
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
  avatarContainer: {
    position: "relative",
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarUploading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
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
