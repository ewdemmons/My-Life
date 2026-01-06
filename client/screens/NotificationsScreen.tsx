import React from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/context/NotificationContext";
import { AppNotification } from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";

function getNotificationIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case "bubble_shared":
      return "share-2";
    case "task_assigned":
      return "user-plus";
    case "event_reminder":
      return "clock";
    case "event_updated":
      return "calendar";
    case "bubble_updated":
      return "edit-3";
    case "connection_request":
      return "link";
    case "connection_accepted":
      return "check-circle";
    case "connection_declined":
      return "x-circle";
    default:
      return "bell";
  }
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function NotificationsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    respondToConnectionRequest,
  } = useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notification: AppNotification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    const { data, type } = notification;
    const bubbleId = data?.bubbleId as string | undefined;
    const eventId = data?.eventId as string | undefined;

    try {
      switch (type) {
        case "event_reminder":
          if (bubbleId) {
            navigation.navigate("CategoryDetail", {
              categoryId: bubbleId,
              initialTab: "calendar",
            });
          } else {
            navigation.navigate("Main", { screen: "CalendarTab" });
          }
          break;
        case "bubble_shared":
          if (bubbleId) {
            navigation.navigate("CategoryDetail", {
              categoryId: bubbleId,
            });
          }
          break;
        case "task_assigned":
          if (bubbleId) {
            navigation.navigate("CategoryDetail", {
              categoryId: bubbleId,
              initialTab: "tasks",
            });
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
    }
  };

  const handleConnectionResponse = async (notification: AppNotification, accept: boolean) => {
    const personId = notification.data?.personId as string;
    const requesterId = notification.data?.requesterId as string;

    if (!personId || !requesterId) {
      Alert.alert("Error", "Invalid connection request data.");
      return;
    }

    await respondToConnectionRequest(notification.id, personId, requesterId, accept);
    
    if (accept) {
      Alert.alert("Connected", "You are now connected and can receive notifications when assigned to tasks or events.");
    } else {
      Alert.alert("Declined", "Connection request has been declined.");
    }
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const icon = getNotificationIcon(item.type);
    const isConnectionRequest = item.type === "connection_request" && !item.isRead;

    return (
      <Pressable
        style={[
          styles.notificationItem,
          {
            backgroundColor: item.isRead
              ? theme.backgroundDefault
              : isDark
              ? "rgba(99, 102, 241, 0.1)"
              : "rgba(99, 102, 241, 0.05)",
            borderColor: theme.border,
          },
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundRoot },
          ]}
        >
          <Feather name={icon} size={20} color={theme.primary} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <ThemedText style={[styles.title, !item.isRead && { fontWeight: "700" }]}>
              {item.title}
            </ThemedText>
            <Pressable onPress={() => deleteNotification(item.id)} hitSlop={10}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
            {item.body}
          </ThemedText>
          {isConnectionRequest ? (
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.acceptButton, { backgroundColor: theme.primary }]}
                onPress={() => handleConnectionResponse(item, true)}
              >
                <Feather name="check" size={14} color="#FFFFFF" />
                <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.declineButton, { borderColor: theme.textSecondary }]}
                onPress={() => handleConnectionResponse(item, false)}
              >
                <Feather name="x" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.declineButtonText, { color: theme.textSecondary }]}>
                  Decline
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText style={[styles.time, { color: theme.textSecondary }]}>
              {formatTimeAgo(item.createdAt)}
            </ThemedText>
          )}
        </View>
        {!item.isRead ? (
          <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
        ) : null}
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="bell-off" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No notifications yet
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        When someone shares a bubble with you or you have upcoming events, they will appear here.
      </ThemedText>
    </View>
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ThemedView style={styles.container}>
      {unreadCount > 0 ? (
        <View style={[styles.markAllContainer, { borderBottomColor: theme.border }]}>
          <Pressable onPress={markAllAsRead} style={styles.markAllButton}>
            <Feather name="check-circle" size={16} color={theme.primary} />
            <ThemedText style={[styles.markAllText, { color: theme.primary }]}>
              Mark all as read
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
          notifications.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  markAllContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-end",
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  notificationItem: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    position: "relative",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: Spacing.sm,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
  },
  unreadDot: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.xs,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: "center",
    padding: Spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  acceptButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  declineButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  declineButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
