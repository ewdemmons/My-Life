import { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

import { useApp } from "@/context/AppContext";
import { buildLifeAreaInsightsContext } from "@/lib/lifeAreaInsightsContext";
import { generateLifeAreaInsights } from "@/lib/lifeAreaInsightsService";
import { shouldRegenerateInsights } from "@/lib/lifeAreaInsightsRegen";
import { isLifeAreaOwner } from "@/lib/permissions";
import type { CoachInsight, LifeAreaProfile, LifeCategory } from "@/types";

const MANUAL_REFRESH_PREFIX = "@coach_insights_manual_refresh_";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function manualRefreshKey(categoryId: string) {
  return `${MANUAL_REFRESH_PREFIX}${categoryId}`;
}

interface UseLifeAreaInsightsParams {
  category: LifeCategory;
  profile: LifeAreaProfile | undefined;
}

export function useLifeAreaInsights({ category, profile }: UseLifeAreaInsightsParams) {
  const {
    tasks,
    habits,
    occurrences,
    events,
    getTasksByCategory,
    getLifeAreaInsights,
    saveLifeAreaInsights,
  } = useApp();

  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManualRefreshToday, setCanManualRefreshToday] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const generatingRef = useRef(false);

  const isOwner = isLifeAreaOwner(category);
  const isCompleted = profile?.status === "completed";

  const loadCachedInsights = useCallback(() => {
    const cache = getLifeAreaInsights(category.id);
    setInsights(cache?.insights ?? []);
    return cache;
  }, [category.id, getLifeAreaInsights]);

  const checkManualRefreshAllowed = useCallback(async () => {
    const raw = await AsyncStorage.getItem(manualRefreshKey(category.id));
    if (!raw) {
      setCanManualRefreshToday(true);
      return true;
    }
    const allowed = Date.now() - parseInt(raw, 10) >= ONE_DAY_MS;
    setCanManualRefreshToday(allowed);
    return allowed;
  }, [category.id]);

  const runGeneration = useCallback(
    async (options?: { force?: boolean }) => {
      if (!profile || profile.status !== "completed" || !isOwner) return;
      if (generatingRef.current) return;

      const categoryTasks = getTasksByCategory(category.id);
      const categoryHabits = habits.filter(
        (h) => h.categoryId === category.id && h.isActive,
      );

      const insightsContext = await buildLifeAreaInsightsContext({
        category,
        profile,
        tasks: categoryTasks,
        habits: categoryHabits,
        occurrences,
        events,
      });

      const cache = getLifeAreaInsights(category.id);
      if (!shouldRegenerateInsights(cache, insightsContext.watermark, options)) {
        loadCachedInsights();
        return;
      }

      generatingRef.current = true;
      setIsGenerating(true);
      setError(null);

      try {
        const generated = await generateLifeAreaInsights(category.name, insightsContext);
        await saveLifeAreaInsights(
          category.id,
          generated,
          insightsContext.watermark,
        );
        setInsights(generated);
      } catch (err) {
        console.error("Insight generation failed:", err);
        setError("Couldn't generate insights right now.");
        loadCachedInsights();
      } finally {
        generatingRef.current = false;
        setIsGenerating(false);
      }
    },
    [
      profile,
      isOwner,
      getTasksByCategory,
      category,
      habits,
      occurrences,
      events,
      getLifeAreaInsights,
      loadCachedInsights,
      saveLifeAreaInsights,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isCompleted) {
        setInsights([]);
        return;
      }

      loadCachedInsights();
      void checkManualRefreshAllowed();
      void runGeneration();
    }, [isCompleted, loadCachedInsights, checkManualRefreshAllowed, runGeneration]),
  );

  const onRefresh = useCallback(async () => {
    if (!isCompleted || !isOwner) return;

    const allowed = await checkManualRefreshAllowed();
    if (!allowed) {
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    await AsyncStorage.setItem(manualRefreshKey(category.id), String(Date.now()));
    setCanManualRefreshToday(false);

    await runGeneration({ force: true });
    setIsRefreshing(false);
  }, [isCompleted, isOwner, checkManualRefreshAllowed, category.id, runGeneration]);

  return {
    insights,
    isGenerating,
    isRefreshing,
    error,
    canManualRefreshToday,
    onRefresh,
    isCompleted,
    isOwner,
  };
}
