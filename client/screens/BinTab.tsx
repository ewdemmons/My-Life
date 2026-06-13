import React from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { DeletedItem, Task, LifeCategory, getTaskTypeInfo } from "@/types";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";

const RECYCLE_BIN_RETENTION_DAYS = 30;

export function BinTab() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + Spacing.xl;
  const { theme } = useTheme();
  const { recycleBin, restoreFromRecycleBin, permanentlyDelete, emptyRecycleBin } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500 });

  const handleRestore = (item: DeletedItem) => {
    const itemName = item.type === "category"
      ? (item.data as LifeCategory).name
      : (item.data as Task).title;
    const childCount = item.relatedTasks?.length || 0;
    const message = childCount > 0
      ? `Restore "${itemName}" and ${childCount} related ${childCount === 1 ? "item" : "items"}?`
      : `Restore "${itemName}"?`;

    Alert.alert(
      "Restore Item",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", onPress: async () => {
          const performRestore = async () => {
            await restoreFromRecycleBin(item.id);
          };
          setRetry(() => { void performRestore(); });
          await withSaveIndicator(performRestore);
        }},
      ],
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
        { text: "Delete Forever", style: "destructive", onPress: async () => {
          const performDelete = async () => {
            await permanentlyDelete(item.id);
          };
          setRetry(() => { void performDelete(); });
          await withSaveIndicator(performDelete, { showSuccess: false });
        }},
      ],
    );
  };

  const handleEmptyRecycleBin = () => {
    Alert.alert(
      "Empty Recycle Bin",
      `Are you sure you want to permanently delete all ${recycleBin.length} items? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Empty All", style: "destructive", onPress: async () => {
          const performEmpty = async () => {
            await emptyRecycleBin();
          };
          setRetry(() => { void performEmpty(); });
          await withSaveIndicator(performEmpty, { showSuccess: false });
        }},
      ],
    );
  };

  const getDaysRemaining = (deletedAt: number): number => {
    const retentionMs = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expiresAt = deletedAt + retentionMs;
    const remaining = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  };

  const renderRecycleBinItem = (item: DeletedItem) => {
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
      <View key={item.id} style={[styles.recycleBinItem, { backgroundColor: theme.backgroundDefault }]}>
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
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: bottomPadding,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <ThemedText style={styles.sectionTitle}>Recycle Bin</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Deleted items are kept for {RECYCLE_BIN_RETENTION_DAYS} days
          </ThemedText>
        </View>
        {recycleBin.length > 0 ? (
          <Pressable onPress={handleEmptyRecycleBin}>
            <ThemedText style={[styles.emptyAllText, { color: theme.error }]}>Empty All</ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
        {recycleBin.length > 0 ? (
          <View style={styles.recycleBinList}>
            {recycleBin.map((item) => renderRecycleBinItem(item))}
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  emptyAllText: {
    fontSize: 13,
    fontWeight: "500",
  },
  settingsCard: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
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
