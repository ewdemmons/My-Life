import React from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { DeletedItem, Task, LifeCategory, getTaskTypeInfo } from "@/types";

const RECYCLE_BIN_RETENTION_DAYS = 30;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { categories, tasks, recycleBin, restoreFromRecycleBin, permanentlyDelete, emptyRecycleBin, clearAllData } = useApp();
  const { user, signOut } = useAuth();

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

  const handleRestore = (item: DeletedItem) => {
    const itemName = item.type === "category" 
      ? (item.data as LifeCategory).name 
      : (item.data as Task).title;
    const childCount = item.relatedTasks?.length || 0;
    const message = childCount > 0
      ? `Restore "${itemName}" and ${childCount} related ${childCount === 1 ? 'item' : 'items'}?`
      : `Restore "${itemName}"?`;

    Alert.alert(
      "Restore Item",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", onPress: () => restoreFromRecycleBin(item.id) },
      ]
    );
  };

  const handlePermanentDelete = (item: DeletedItem) => {
    const itemName = item.type === "category" 
      ? (item.data as LifeCategory).name 
      : (item.data as Task).title;

    Alert.alert(
      "Delete Permanently",
      `Are you sure you want to permanently delete "${itemName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Forever", style: "destructive", onPress: () => permanentlyDelete(item.id) },
      ]
    );
  };

  const handleEmptyRecycleBin = () => {
    Alert.alert(
      "Empty Recycle Bin",
      `Are you sure you want to permanently delete all ${recycleBin.length} items? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Empty All", style: "destructive", onPress: emptyRecycleBin },
      ]
    );
  };

  const getDaysRemaining = (deletedAt: number): number => {
    const retentionMs = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expiresAt = deletedAt + retentionMs;
    const remaining = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  };

  const renderRecycleBinItem = ({ item }: { item: DeletedItem }) => {
    const isCategory = item.type === "category";
    const data = item.data;
    const name = isCategory ? (data as LifeCategory).name : (data as Task).title;
    const icon = isCategory 
      ? (data as LifeCategory).icon 
      : getTaskTypeInfo((data as Task).type).icon;
    const color = isCategory 
      ? (data as LifeCategory).color 
      : theme.textSecondary;
    const childCount = item.relatedTasks?.length || 0;
    const daysRemaining = getDaysRemaining(item.deletedAt);

    return (
      <View style={[styles.recycleBinItem, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.recycleBinItemHeader}>
          <View style={[styles.recycleBinIcon, { backgroundColor: isCategory ? color + "20" : theme.backgroundRoot }]}>
            <Feather name={icon as any} size={18} color={isCategory ? color : theme.textSecondary} />
          </View>
          <View style={styles.recycleBinItemContent}>
            <ThemedText style={styles.recycleBinItemName} numberOfLines={1}>
              {name}
            </ThemedText>
            <ThemedText style={[styles.recycleBinItemMeta, { color: theme.textSecondary }]}>
              {isCategory ? "Category" : "Entry"}{childCount > 0 ? ` + ${childCount} items` : ""} - {daysRemaining} days left
            </ThemedText>
          </View>
        </View>
        <View style={styles.recycleBinActions}>
          <Pressable
            style={[styles.recycleBinAction, { backgroundColor: theme.success + "20" }]}
            onPress={() => handleRestore(item)}
          >
            <Feather name="rotate-ccw" size={16} color={theme.success} />
          </Pressable>
          <Pressable
            style={[styles.recycleBinAction, { backgroundColor: theme.error + "20" }]}
            onPress={() => handlePermanentDelete(item)}
          >
            <Feather name="x" size={16} color={theme.error} />
          </Pressable>
        </View>
      </View>
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
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Recycle Bin</ThemedText>
          {recycleBin.length > 0 ? (
            <Pressable onPress={handleEmptyRecycleBin}>
              <ThemedText style={[styles.emptyAllText, { color: theme.error }]}>Empty All</ThemedText>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          {recycleBin.length > 0 ? (
            <View style={styles.recycleBinList}>
              {recycleBin.map((item) => (
                <React.Fragment key={item.id}>
                  {renderRecycleBinItem({ item })}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.emptyRecycleBin}>
              <Feather name="trash-2" size={32} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyRecycleBinText, { color: theme.textSecondary }]}>
                Recycle Bin is empty
              </ThemedText>
              <ThemedText style={[styles.emptyRecycleBinHint, { color: theme.textSecondary }]}>
                Deleted items are kept for {RECYCLE_BIN_RETENTION_DAYS} days
              </ThemedText>
            </View>
          )}
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

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Account</ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.aboutRow}>
            <ThemedText style={styles.aboutLabel}>Email</ThemedText>
            <ThemedText style={[styles.aboutValue, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.email || "Not signed in"}
            </ThemedText>
          </View>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyAllText: {
    fontSize: 13,
    fontWeight: "500",
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
  recycleBinList: {
    paddingVertical: Spacing.xs,
  },
  recycleBinItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  recycleBinItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  recycleBinIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  recycleBinItemContent: {
    flex: 1,
  },
  recycleBinItemName: {
    fontSize: 15,
    fontWeight: "500",
  },
  recycleBinItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  recycleBinActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  recycleBinAction: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRecycleBin: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyRecycleBinText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  emptyRecycleBinHint: {
    fontSize: 12,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
});
