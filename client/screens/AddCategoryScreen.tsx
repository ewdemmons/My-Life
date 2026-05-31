import React, { useState, useLayoutEffect, useCallback, useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton, useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CategoryColors } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PeopleSelector } from "@/components/PeopleSelector";
import { PreferredTimesSection } from "@/components/PreferredTimesSection";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { LifeAreaSchedule, PendingScheduleBlock } from "@/types";
import { isEndAfterStart } from "@/utils/scheduleTimeUtils";

const ICONS = [
  "heart", "activity", "briefcase", "star", "dollar-sign", "book",
  "home", "users", "target", "coffee", "music", "camera",
  "globe", "sun", "moon", "zap", "award", "gift", "smile", "feather",
];

type RouteParams = RouteProp<RootStackParamList, "AddCategory">;

function scheduleToPendingBlock(schedule: LifeAreaSchedule): PendingScheduleBlock {
  return {
    clientKey: schedule.id,
    id: schedule.id,
    label: schedule.label,
    daysOfWeek: [...schedule.daysOfWeek],
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  };
}

function blocksEqual(a: PendingScheduleBlock, b: LifeAreaSchedule): boolean {
  return (
    (a.label || "") === (b.label || "") &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    a.daysOfWeek.length === b.daysOfWeek.length &&
    a.daysOfWeek.every((d) => b.daysOfWeek.includes(d))
  );
}

export default function AddCategoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const {
    addCategory,
    updateCategory,
    getLifeAreaSchedules,
    addLifeAreaSchedule,
    updateLifeAreaSchedule,
    deleteLifeAreaSchedule,
  } = useApp();

  const editingCategory = route.params?.category;
  const isEditing = !!editingCategory;
  const scrollToPreferredTimes = route.params?.scrollToPreferredTimes;

  const scrollRef = useRef<ScrollView>(null);
  const preferredTimesRef = useRef<View>(null);
  const initialSnapshotRef = useRef<Map<string, LifeAreaSchedule>>(new Map());
  const hasScrolledRef = useRef(false);
  const [preferredTimesY, setPreferredTimesY] = useState(0);

  const [name, setName] = useState(editingCategory?.name || "");
  const [description, setDescription] = useState(editingCategory?.description || "");
  const [color, setColor] = useState(editingCategory?.color || CategoryColors[0]);
  const [icon, setIcon] = useState(editingCategory?.icon || ICONS[0]);
  const [peopleIds, setPeopleIds] = useState<string[]>(editingCategory?.peopleIds || []);
  const [pendingBlocks, setPendingBlocks] = useState<PendingScheduleBlock[]>([]);
  const [originalBlockIds, setOriginalBlockIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [schedulesLoaded, setSchedulesLoaded] = useState(!isEditing);

  useEffect(() => {
    if (!isEditing || !editingCategory) return;

    let cancelled = false;
    (async () => {
      const schedules = await getLifeAreaSchedules(editingCategory.id);
      if (cancelled) return;
      const snapshot = new Map<string, LifeAreaSchedule>();
      schedules.forEach((s) => snapshot.set(s.id, s));
      initialSnapshotRef.current = snapshot;
      setPendingBlocks(schedules.map(scheduleToPendingBlock));
      setOriginalBlockIds(schedules.map((s) => s.id));
      setSchedulesLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditing, editingCategory?.id, getLifeAreaSchedules]);

  useEffect(() => {
    if (!scrollToPreferredTimes || !isEditing || !schedulesLoaded || hasScrolledRef.current) {
      return;
    }
    if (preferredTimesY <= 0) return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, preferredTimesY - Spacing.lg),
        animated: true,
      });
      hasScrolledRef.current = true;
      navigation.setParams({ scrollToPreferredTimes: undefined });
    }, 350);

    return () => clearTimeout(timer);
  }, [scrollToPreferredTimes, isEditing, schedulesLoaded, preferredTimesY, navigation]);

  const schedulesValid = useMemo(() => {
    if (!isEditing) return true;
    return pendingBlocks.every(
      (b) =>
        b.daysOfWeek.length >= 1 && isEndAfterStart(b.startTime, b.endTime),
    );
  }, [isEditing, pendingBlocks]);

  const isValid = name.trim().length > 0 && schedulesValid;

  const saveSchedules = useCallback(async (categoryId: string): Promise<boolean> => {
    const currentIds = new Set(
      pendingBlocks.filter((b) => b.id).map((b) => b.id as string),
    );
    const toDelete = originalBlockIds.filter((id) => !currentIds.has(id));

    for (const id of toDelete) {
      await deleteLifeAreaSchedule(id);
    }

    for (const block of pendingBlocks) {
      if (!block.id) {
        const created = await addLifeAreaSchedule({
          categoryId,
          label: block.label,
          daysOfWeek: block.daysOfWeek,
          startTime: block.startTime,
          endTime: block.endTime,
          isActive: true,
        });
        if (!created) {
          setSaveError("Failed to save a time block. Please try again.");
          return false;
        }
      } else {
        const original = initialSnapshotRef.current.get(block.id);
        if (original && !blocksEqual(block, original)) {
          const updated = await updateLifeAreaSchedule(block.id, {
            label: block.label,
            daysOfWeek: block.daysOfWeek,
            startTime: block.startTime,
            endTime: block.endTime,
          });
          if (!updated) {
            setSaveError("Failed to update a time block. Please try again.");
            return false;
          }
        }
      }
    }

    await getLifeAreaSchedules();
    return true;
  }, [
    pendingBlocks,
    originalBlockIds,
    deleteLifeAreaSchedule,
    addLifeAreaSchedule,
    updateLifeAreaSchedule,
    getLifeAreaSchedules,
  ]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !schedulesValid) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      if (isEditing && editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
          peopleIds,
        });

        const schedulesOk = await saveSchedules(editingCategory.id);
        if (!schedulesOk) {
          setIsSaving(false);
          return;
        }
      } else {
        await addCategory({
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
          peopleIds,
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error("Error saving category:", error);
      setSaveError("Failed to save. Please try again.");
      setIsSaving(false);
    }
  }, [
    name,
    description,
    color,
    icon,
    peopleIds,
    isEditing,
    editingCategory,
    schedulesValid,
    updateCategory,
    addCategory,
    saveSchedules,
    navigation,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEditing ? "Edit Category" : "Add Category",
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()} disabled={isSaving}>
          <ThemedText style={{ color: theme.primary }}>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={!isValid || isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText
              style={{
                color: isValid ? theme.primary : theme.textSecondary,
                fontWeight: "600",
              }}
            >
              Save
            </ThemedText>
          )}
        </HeaderButton>
      ),
    });
  }, [navigation, isEditing, isValid, isSaving, theme, handleSave]);

  return (
    <KeyboardAwareScrollViewCompat
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.section}>
        <ThemedText style={styles.label}>Name</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="e.g., Family, Health, Work"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          autoFocus={!scrollToPreferredTimes}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Description (Optional)</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Describe this Life Area..."
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Color</ThemedText>
        <View style={styles.colorGrid}>
          {CategoryColors.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorOption,
                { backgroundColor: c },
                color === c && styles.colorSelected,
              ]}
              onPress={() => setColor(c)}
            >
              {color === c ? (
                <Feather name="check" size={20} color="#FFFFFF" />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Icon</ThemedText>
        <View style={styles.iconGrid}>
          {ICONS.map((i) => (
            <Pressable
              key={i}
              style={[
                styles.iconOption,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                icon === i && { borderColor: color, borderWidth: 2 },
              ]}
              onPress={() => setIcon(i)}
            >
              <Feather
                name={i as any}
                size={24}
                color={icon === i ? color : theme.textSecondary}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <PeopleSelector
        selectedIds={peopleIds}
        onSelectionChange={setPeopleIds}
        label="Tag People (Optional)"
        placeholder="Tag family, friends, or teammates..."
      />

      {isEditing && editingCategory ? (
        <PreferredTimesSection
          sectionRef={preferredTimesRef}
          onSectionLayout={setPreferredTimesY}
          blocks={pendingBlocks}
          onBlocksChange={setPendingBlocks}
          accentColor={color}
          saveError={saveError}
        />
      ) : null}

      <View style={[styles.preview, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={[styles.previewLabel, { color: theme.textSecondary }]}>
          Preview
        </ThemedText>
        <View style={[styles.previewBubble, { borderColor: color }]}>
          <Feather name={icon as any} size={28} color={color} />
          <ThemedText style={styles.previewName} numberOfLines={1}>
            {name || "Category"}
          </ThemedText>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  previewLabel: {
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  previewBubble: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xs,
  },
  previewName: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: Spacing.xs,
    textAlign: "center",
  },
});
