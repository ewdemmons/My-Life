import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getTaskTypeInfo, getEventTypeInfo } from "@/types";

export default function CentralDashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { pinnedTasks, unpinTask, updateTask, categories, events } = useApp();

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);

    return events
      .filter((event) => {
        const eventDate = new Date(event.startDate);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate <= endDate;
      })
      .sort((a, b) => {
        const dateCompare = a.startDate.localeCompare(b.startDate);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 10);
  }, [events]);

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() === today.getTime()) return "Today";
    if (eventDate.getTime() === tomorrow.getTime()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl }}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="star" size={20} color="#F59E0B" />
          <ThemedText style={styles.sectionTitle}>Master To Do</ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
              {pinnedTasks.length}
            </ThemedText>
          </View>
        </View>

        {pinnedTasks.length > 0 ? (
          pinnedTasks.map((task) => {
            const category = categories.find((c) => c.id === task.categoryId);
            const typeInfo = getTaskTypeInfo(task.type);
            return (
              <Pressable
                key={task.id}
                style={[styles.taskCard, { backgroundColor: theme.backgroundDefault }]}
                onPress={() => {
                  if (category) {
                    navigation.navigate("CategoryDetail", {
                      category,
                      initialTaskId: task.id,
                    });
                  }
                }}
              >
                <Pressable
                  onPress={() => {
                    const newStatus = task.status === "completed" ? "pending" : "completed";
                    updateTask(task.id, { status: newStatus });
                  }}
                  hitSlop={8}
                  style={styles.checkBtn}
                >
                  <Feather
                    name={task.status === "completed" ? "check-circle" : "circle"}
                    size={22}
                    color={task.status === "completed" ? theme.success : theme.textSecondary}
                  />
                </Pressable>

                <View style={styles.taskContent}>
                  <ThemedText
                    style={[
                      styles.taskTitle,
                      task.status === "completed" && styles.completedText,
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </ThemedText>
                  <View style={styles.taskMeta}>
                    {category ? (
                      <View style={styles.categoryBadge}>
                        <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                          {category.name}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={[styles.typeBadge, { backgroundColor: "#6B7280" + "20" }]}>
                      <Feather name={typeInfo.icon as any} size={10} color={theme.textSecondary} />
                      <ThemedText style={[styles.typeText, { color: theme.textSecondary }]}>
                        {typeInfo.label}
                      </ThemedText>
                    </View>
                    {task.priority === "high" ? (
                      <View style={[styles.priorityBadge, { backgroundColor: theme.error + "20" }]}>
                        <Feather name="alert-circle" size={10} color={theme.error} />
                      </View>
                    ) : null}
                  </View>
                </View>

                <Pressable
                  onPress={() => unpinTask(task.id)}
                  hitSlop={8}
                  style={styles.unpinBtn}
                >
                  <Feather name="star" size={18} color="#F59E0B" />
                </Pressable>
              </Pressable>
            );
          })
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="star" size={32} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No pinned tasks yet
            </ThemedText>
            <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
              Pin important tasks from any bubble to see them here
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="calendar" size={20} color="#3B82F6" />
          <ThemedText style={styles.sectionTitle}>Upcoming Events</ThemedText>
          <View style={[styles.badge, { backgroundColor: "#3B82F6" + "20" }]}>
            <ThemedText style={[styles.badgeText, { color: "#3B82F6" }]}>
              Next 7 days
            </ThemedText>
          </View>
        </View>

        {upcomingEvents.length > 0 ? (
          upcomingEvents.map((event) => {
            const category = categories.find((c) => c.id === event.categoryId);
            const eventTypeInfo = getEventTypeInfo(event.eventType);
            return (
              <Pressable
                key={event.id}
                style={[styles.eventCard, { backgroundColor: theme.backgroundDefault }]}
                onPress={() => {
                  if (category) {
                    navigation.navigate("CategoryDetail", {
                      category,
                      initialEventId: event.id,
                    });
                  }
                }}
              >
                <View style={[styles.eventTimeCol, { borderRightColor: theme.border }]}>
                  <ThemedText style={[styles.eventDate, { color: theme.primary }]}>
                    {formatEventDate(event.startDate)}
                  </ThemedText>
                  <ThemedText style={[styles.eventTime, { color: theme.textSecondary }]}>
                    {formatTime(event.startTime)}
                  </ThemedText>
                </View>

                <View style={styles.eventContent}>
                  <View style={styles.eventTitleRow}>
                    <View style={[styles.eventTypeDot, { backgroundColor: eventTypeInfo.color }]} />
                    <ThemedText style={styles.eventTitle} numberOfLines={1}>
                      {event.title}
                    </ThemedText>
                  </View>
                  {category ? (
                    <View style={styles.categoryBadge}>
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                        {category.name}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="calendar" size={32} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No upcoming events
            </ThemedText>
            <ThemedText style={[styles.emptyHint, { color: theme.textSecondary }]}>
              Schedule events in your bubbles to see them here
            </ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  checkBtn: {
    padding: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
  },
  priorityBadge: {
    padding: 4,
    borderRadius: 4,
  },
  unpinBtn: {
    padding: 4,
  },
  eventCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  eventTimeCol: {
    width: 80,
    padding: Spacing.md,
    borderRightWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventDate: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  eventTime: {
    fontSize: 11,
    marginTop: 2,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  eventTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: Spacing.md,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
