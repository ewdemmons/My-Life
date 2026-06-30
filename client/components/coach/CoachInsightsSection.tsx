import React, { useCallback, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { CoachInsightCard } from "@/components/coach/CoachInsightCard";
import { useApp } from "@/context/AppContext";
import { executeCoachInsightAction } from "@/lib/coachInsightActions";
import type { CommandActionHelpers } from "@/lib/runCommandAction";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { CoachInsight, LifeAreaProfile, LifeCategory, Task } from "@/types";

interface CoachInsightsSectionProps {
  category: LifeCategory;
  profile: LifeAreaProfile;
  insights: CoachInsight[];
  isGenerating: boolean;
  error: string | null;
  canModifyEntries: boolean;
}

function InsightSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[styles.skeleton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
      <ActivityIndicator size="small" color={theme.textSecondary} />
      <ThemedText style={[styles.skeletonText, { color: theme.textSecondary }]}>
        Coach is reflecting on your progress...
      </ThemedText>
    </View>
  );
}

export function CoachInsightsSection({
  category,
  profile,
  insights,
  isGenerating,
  error,
  canModifyEntries,
}: CoachInsightsSectionProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const app = useApp();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const commandHelpers: CommandActionHelpers = {
    categories: app.categories,
    tasks: app.tasks,
    habits: app.habits,
    events: app.events,
    addTask: (task) => app.addTask(task) as Promise<Task | null>,
    deleteTask: app.deleteTask,
    addEvent: (event) => app.addEvent(event).then(() => undefined),
    deleteEvent: app.deleteEvent,
    getEventsByDate: app.getEventsByDate,
    addHabit: (habit) => app.addHabit(habit).then(() => undefined),
    deleteHabit: app.deleteHabit,
    addOccurrence: (occurrence) =>
      app.addOccurrence(occurrence).then((result) =>
        result && typeof result === "object" && "id" in result
          ? { id: result.id as string }
          : null,
      ),
    deleteOccurrence: app.deleteOccurrence,
    pinTask: app.pinTask,
    unpinTask: app.unpinTask,
    updateTask: app.updateTask,
    updateEvent: app.updateEvent,
  };

  const handleAction = useCallback(
    async (insightId: string) => {
      const insight = insights.find((i) => i.id === insightId);
      if (!insight?.action || !canModifyEntries) return;

      setActionLoadingId(insightId);
      try {
        await executeCoachInsightAction(insight.action, {
          category,
          profile,
          navigation,
          commandHelpers,
        });
      } finally {
        setActionLoadingId(null);
      }
    },
    [insights, canModifyEntries, category, profile, navigation, commandHelpers],
  );

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Coach Insights
      </ThemedText>

      {isGenerating && insights.length === 0 ? <InsightSkeleton /> : null}

      {error && insights.length === 0 ? (
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          {error}
        </ThemedText>
      ) : null}

      {insights.map((insight) => (
        <CoachInsightCard
          key={insight.id}
          insight={insight}
          categoryColor={category.color}
          canShowActions={canModifyEntries}
          onActionPress={
            insight.action && canModifyEntries
              ? () => void handleAction(insight.id)
              : undefined
          }
          isActionLoading={actionLoadingId === insight.id}
        />
      ))}

      {!isGenerating && insights.length === 0 && !error ? (
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          Your Coach is all caught up for now.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  skeleton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  skeletonText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: Spacing.md,
    fontStyle: "italic",
  },
});
