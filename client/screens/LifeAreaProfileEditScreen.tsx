import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { LifeAreaProfileForm } from "@/components/LifeAreaProfileForm";
import { SaveToast } from "@/components/SaveToast";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { isLifeAreaOwner } from "@/lib/permissions";
import { showRetakeAssessmentAlert } from "@/lib/lifeAreaCoachUtils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { LifeAreaProfile } from "@/types";

type RouteParams = RouteProp<RootStackParamList, "LifeAreaProfileEdit">;

export default function LifeAreaProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { categoryId, fromAssessment } = route.params;

  const { categories, getLifeAreaProfile, updateLifeAreaProfile } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500, successMessage: "Saved" });

  const category = categories.find((c) => c.id === categoryId);
  const storedProfile = getLifeAreaProfile(categoryId);
  const readOnly = category ? !isLifeAreaOwner(category) : true;

  const [draft, setDraft] = useState<Partial<LifeAreaProfile>>({});

  useEffect(() => {
    if (!category) return;
    navigation.setOptions({
      headerTitle: readOnly ? `${category.name} Profile` : `Edit ${category.name} Profile`,
    });
  }, [category, navigation, readOnly]);

  useEffect(() => {
    if (storedProfile) {
      setDraft({ ...storedProfile });
    }
  }, [storedProfile]);

  const handleSave = async () => {
    if (!category || readOnly) return;

    const performSave = async () => {
      await updateLifeAreaProfile(categoryId, {
        primaryGoal: draft.primaryGoal ?? "",
        currentFocus: draft.currentFocus ?? [],
        knownObstacles: draft.knownObstacles ?? [],
        currentState: draft.currentState ?? "",
        motivations: draft.motivations ?? "",
        successCriteria: draft.successCriteria ?? "",
        rawAnswers: draft.rawAnswers ?? [],
      });

      if (fromAssessment) {
        navigation.replace("CategoryDetail", { categoryId, initialTab: "coach" });
      } else {
        navigation.goBack();
      }
    };

    setRetry(() => { void performSave(); });
    await withSaveIndicator(performSave);
  };

  const handleRetake = () => {
    if (!category || readOnly) return;
    showRetakeAssessmentAlert(category.name, () =>
      navigation.navigate("LifeAreaAssessment", { categoryId, isRetake: true }),
    );
  };

  if (!category) {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight, backgroundColor: theme.backgroundRoot }]}>
        <ThemedText style={{ color: theme.textSecondary }}>Life Area not found.</ThemedText>
      </View>
    );
  }

  if (!storedProfile || storedProfile.status !== "completed") {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight, backgroundColor: theme.backgroundRoot }]}>
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          No profile yet
        </ThemedText>
        {!readOnly ? (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: category.color }]}
            onPress={() => navigation.navigate("LifeAreaAssessment", { categoryId })}
          >
            <ThemedText style={[styles.primaryBtnText, { color: theme.buttonText }]}>
              Start Assessment
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingHorizontal: Spacing.xl,
          paddingBottom: insets.bottom + (readOnly ? Spacing.xl : 100),
        }}
        keyboardShouldPersistTaps="handled"
      >
        {readOnly ? (
          <ThemedText style={[styles.readOnlyHint, { color: theme.textSecondary }]}>
            View-only — this profile belongs to the Life Area owner.
          </ThemedText>
        ) : null}

        <LifeAreaProfileForm
          profile={draft}
          onChange={(updates) => setDraft((prev) => ({ ...prev, ...updates }))}
          readOnly={readOnly}
          accentColor={category.color}
        />

        {!readOnly ? (
          <Pressable onPress={handleRetake} style={styles.retakeBtn}>
            <ThemedText style={[styles.retakeText, { color: theme.textSecondary }]}>
              Retake Assessment
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      {!readOnly ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.backgroundRoot,
              borderTopColor: theme.border,
            },
          ]}
        >
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: category.color }]}
            onPress={() => void handleSave()}
          >
            <ThemedText style={[styles.primaryBtnText, { color: theme.buttonText }]}>
              Save Profile
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <SaveToast
        state={toastState}
        message={toastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: "center",
  },
  readOnlyHint: {
    ...Typography.caption,
    marginBottom: Spacing.lg,
  },
  retakeBtn: {
    marginTop: Spacing.xl,
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  retakeText: {
    ...Typography.link,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
