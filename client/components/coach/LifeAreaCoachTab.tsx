import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { CoachAssessmentCtaCard } from "@/components/coach/CoachAssessmentCtaCard";
import { CoachProfileSummaryCard } from "@/components/coach/CoachProfileSummaryCard";
import { CoachQuickActionsRow } from "@/components/coach/CoachQuickActionsRow";
import { CoachInsightsSection } from "@/components/coach/CoachInsightsSection";
import { useLifeAreaInsights } from "@/hooks/useLifeAreaInsights";
import type { LifeAreaProfile, LifeCategory } from "@/types";

interface LifeAreaCoachTabProps {
  category: LifeCategory;
  profile: LifeAreaProfile | undefined;
  isOwner: boolean;
  canModifyEntries: boolean;
  isLoading: boolean;
}

export function LifeAreaCoachTab({
  category,
  profile,
  isOwner,
  canModifyEntries,
  isLoading,
}: LifeAreaCoachTabProps) {
  const { theme } = useTheme();
  const { onRefresh, isRefreshing, canManualRefreshToday, insights, isGenerating, error } =
    useLifeAreaInsights({ category, profile });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={category.color} />
      </View>
    );
  }

  const status = profile?.status ?? "not_started";
  const showCompleted = status === "completed" && profile;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        showCompleted && isOwner ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={category.color}
            enabled={canManualRefreshToday}
          />
        ) : undefined
      }
    >
      {showCompleted ? (
        <CoachProfileSummaryCard
          category={category}
          profile={profile}
          isOwner={isOwner}
        />
      ) : (
        <CoachAssessmentCtaCard
          category={category}
          profile={profile}
          isOwner={isOwner}
        />
      )}

      <CoachQuickActionsRow
        category={category}
        profile={profile}
        isOwner={isOwner}
      />

      {showCompleted ? (
        <>
          <CoachInsightsSection
            category={category}
            profile={profile}
            insights={insights}
            isGenerating={isGenerating}
            error={error}
            canModifyEntries={canModifyEntries}
          />
          {!canManualRefreshToday && isOwner ? (
            <ThemedText style={[styles.refreshHint, { color: theme.textSecondary }]}>
              Insights refresh once per day. Pull to refresh again tomorrow.
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  refreshHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
