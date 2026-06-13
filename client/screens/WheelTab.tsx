import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { LifeAreaSchedule, LifeCategory } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { supabase } from "@/lib/supabase";
import { formatTime12h } from "@/utils/scheduleTimeUtils";

const WHEEL_CENTER_ICON_KEY = "@wheel_center_icon";
const LIFE_AREA_ORDER_KEY = "@life_area_order";
const CENTER_PREVIEW_SIZE = 60;
const OPTION_CIRCLE_SIZE = 44;
const CURATED_SYMBOLS = ["🎯", "⭐", "⚡", "🧭", "💫", "🔥"];
const DEFAULT_EMOJI = "😊";

type WheelCenterIcon = {
  type: "initial" | "emoji" | "symbol";
  value: string;
};

const DEFAULT_CENTER_ICON: WheelCenterIcon = { type: "initial", value: "" };

function getInitialLetter(displayName: string, email?: string | null): string {
  const trimmed = displayName.trim();
  if (trimmed.length > 0) return trimmed[0].toUpperCase();
  if (email && email.length > 0) return email[0].toUpperCase();
  return "?";
}

function applyCategoryOrder(all: LifeCategory[], orderIds: string[]): LifeCategory[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const ordered: LifeCategory[] = [];
  for (const id of orderIds) {
    const cat = byId.get(id);
    if (cat) ordered.push(cat);
  }
  for (const cat of all) {
    if (!orderIds.includes(cat.id)) ordered.push(cat);
  }
  return ordered;
}

function formatTimeCompact(hhmm: string): string {
  return formatTime12h(hhmm)
    .replace(":00", "")
    .replace(" AM", "am")
    .replace(" PM", "pm");
}

function getScheduleSummary(categoryId: string, schedules: LifeAreaSchedule[]): string {
  const active = schedules.filter((s) => s.categoryId === categoryId && s.isActive);
  if (active.length === 0) return "No preference";
  const first = active[0];
  return `${formatTimeCompact(first.startTime)}–${formatTimeCompact(first.endTime)}`;
}

function parseCenterIcon(raw: string | null): WheelCenterIcon {
  if (!raw) return DEFAULT_CENTER_ICON;
  try {
    const parsed = JSON.parse(raw) as WheelCenterIcon;
    if (
      parsed &&
      (parsed.type === "initial" || parsed.type === "emoji" || parsed.type === "symbol") &&
      typeof parsed.value === "string"
    ) {
      return parsed;
    }
  } catch {
    // ignore invalid stored value
  }
  return DEFAULT_CENTER_ICON;
}

function isOptionSelected(icon: WheelCenterIcon, option: WheelCenterIcon): boolean {
  if (icon.type !== option.type) return false;
  if (option.type === "initial" || option.type === "emoji") return true;
  return icon.value === option.value;
}

export function WheelTab() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { categories, lifeAreaSchedules } = useApp();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [centerIcon, setCenterIcon] = useState<WheelCenterIcon>(DEFAULT_CENTER_ICON);
  const [orderedCategories, setOrderedCategories] = useState<LifeCategory[]>(categories);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const initialLetter = useMemo(
    () => getInitialLetter(displayName, user?.email),
    [displayName, user?.email],
  );

  useEffect(() => {
    const loadDisplayName = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();
        setDisplayName(data?.display_name || "");
      } catch {
        setDisplayName("");
      }
    };
    loadDisplayName();
  }, [user?.id]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [iconRaw, orderRaw] = await Promise.all([
          AsyncStorage.getItem(WHEEL_CENTER_ICON_KEY),
          AsyncStorage.getItem(LIFE_AREA_ORDER_KEY),
        ]);
        setCenterIcon(parseCenterIcon(iconRaw));
        if (orderRaw) {
          try {
            const orderIds = JSON.parse(orderRaw) as string[];
            if (Array.isArray(orderIds)) {
              setOrderedCategories(applyCategoryOrder(categories, orderIds));
            } else {
              setOrderedCategories(categories);
            }
          } catch {
            setOrderedCategories(categories);
          }
        } else {
          setOrderedCategories(categories);
        }
      } finally {
        setPrefsLoaded(true);
      }
    };
    loadPrefs();
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    AsyncStorage.getItem(LIFE_AREA_ORDER_KEY).then((orderRaw) => {
      if (orderRaw) {
        try {
          const orderIds = JSON.parse(orderRaw) as string[];
          if (Array.isArray(orderIds)) {
            setOrderedCategories(applyCategoryOrder(categories, orderIds));
            return;
          }
        } catch {
          // fall through
        }
      }
      setOrderedCategories(categories);
    });
  }, [categories, prefsLoaded]);

  const saveCenterIcon = useCallback(async (icon: WheelCenterIcon) => {
    setCenterIcon(icon);
    await AsyncStorage.setItem(WHEEL_CENTER_ICON_KEY, JSON.stringify(icon));
  }, []);

  const saveLifeAreaOrder = useCallback(async (cats: LifeCategory[]) => {
    await AsyncStorage.setItem(
      LIFE_AREA_ORDER_KEY,
      JSON.stringify(cats.map((c) => c.id)),
    );
  }, []);

  const handleSelectInitial = () => {
    saveCenterIcon({ type: "initial", value: "" });
  };

  const handleSelectEmoji = () => {
    const value =
      centerIcon.type === "emoji" && centerIcon.value ? centerIcon.value : DEFAULT_EMOJI;
    saveCenterIcon({ type: "emoji", value });
  };

  const handleSelectSymbol = (symbol: string) => {
    saveCenterIcon({ type: "symbol", value: symbol });
  };

  const handleEmojiChange = (text: string) => {
    const segments = [...text];
    const emoji = segments.length > 0 ? segments[0] : DEFAULT_EMOJI;
    saveCenterIcon({ type: "emoji", value: emoji });
  };

  const handleDragEnd = useCallback(
    ({ data }: { data: LifeCategory[] }) => {
      setOrderedCategories(data);
      saveLifeAreaOrder(data);
    },
    [saveLifeAreaOrder],
  );

  const renderPreviewContent = () => {
    if (centerIcon.type === "initial") {
      return (
        <ThemedText style={[styles.previewInitial, { color: theme.buttonText }]}>
          {initialLetter}
        </ThemedText>
      );
    }
    const displayValue =
      centerIcon.type === "emoji"
        ? centerIcon.value || DEFAULT_EMOJI
        : centerIcon.value;
    return <Text style={styles.previewEmoji}>{displayValue}</Text>;
  };

  const renderOptionCircle = (
    option: WheelCenterIcon,
    content: React.ReactNode,
    onPress: () => void,
    useGradient = false,
  ) => {
    const selected = isOptionSelected(centerIcon, option);
    const borderStyle = selected
      ? { borderWidth: 2, borderColor: theme.primary }
      : { borderWidth: 2, borderColor: "transparent" };

    return (
      <Pressable
        key={`${option.type}-${option.value}`}
        onPress={onPress}
        style={[styles.optionOuter, borderStyle]}
      >
        {useGradient ? (
          <LinearGradient
            colors={[theme.primary, theme.link]}
            style={styles.optionCircle}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.optionCircle, { backgroundColor: theme.backgroundDefault }]}>
            {content}
          </View>
        )}
      </Pressable>
    );
  };

  const renderCenterIconSection = () => (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Center Icon</ThemedText>

      <View style={styles.previewWrapper}>
        {centerIcon.type === "initial" ? (
          <LinearGradient
            colors={[theme.primary, theme.link]}
            style={[
              styles.centerPreview,
              {
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 8,
              },
            ]}
          >
            {renderPreviewContent()}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.centerPreview,
              {
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 8,
              },
            ]}
          >
            {renderPreviewContent()}
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.optionsRow}
      >
        {renderOptionCircle(
          { type: "initial", value: "" },
          <ThemedText style={[styles.optionInitial, { color: theme.buttonText }]}>
            {initialLetter}
          </ThemedText>,
          handleSelectInitial,
          true,
        )}
        {renderOptionCircle(
          { type: "emoji", value: centerIcon.type === "emoji" ? centerIcon.value : DEFAULT_EMOJI },
          <Text style={styles.optionEmoji}>
            {centerIcon.type === "emoji" && centerIcon.value ? centerIcon.value : DEFAULT_EMOJI}
          </Text>,
          handleSelectEmoji,
        )}
        {CURATED_SYMBOLS.map((symbol) =>
          renderOptionCircle(
            { type: "symbol", value: symbol },
            <Text style={styles.optionEmoji}>{symbol}</Text>,
            () => handleSelectSymbol(symbol),
          ),
        )}
      </ScrollView>

      {centerIcon.type === "emoji" ? (
        <View style={styles.emojiInputRow}>
          <ThemedText style={[styles.emojiInputLabel, { color: theme.textSecondary }]}>
            Custom emoji
          </ThemedText>
          <TextInput
            style={[
              styles.emojiInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={centerIcon.value || DEFAULT_EMOJI}
            onChangeText={handleEmojiChange}
            maxLength={2}
            placeholder={DEFAULT_EMOJI}
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      ) : null}

      <ThemedText style={[styles.sectionTitle, styles.lifeAreasTitle]}>Life Areas</ThemedText>
    </View>
  );

  const renderLifeAreaRow = useCallback(
    ({ item, drag, isActive }: RenderItemParams<LifeCategory>) => {
      const summary = getScheduleSummary(item.id, lifeAreaSchedules);

      return (
        <ScaleDecorator>
          <View
            style={[
              styles.lifeAreaRow,
              {
                backgroundColor: isActive ? theme.backgroundSecondary : theme.backgroundRoot,
                borderColor: theme.border,
              },
            ]}
          >
            <Pressable onLongPress={drag} delayLongPress={150} hitSlop={8} style={styles.dragHandle}>
              <Feather name="menu" size={20} color={theme.textSecondary} />
            </Pressable>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <View style={styles.lifeAreaInfo}>
              <ThemedText style={styles.lifeAreaName} numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText style={[styles.lifeAreaSummary, { color: theme.textSecondary }]}>
                {summary}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => navigation.navigate("AddCategory", { category: item })}
              hitSlop={8}
            >
              <ThemedText style={[styles.editLink, { color: theme.primary }]}>Edit ›</ThemedText>
            </Pressable>
          </View>
        </ScaleDecorator>
      );
    },
    [lifeAreaSchedules, navigation, theme],
  );

  const renderFooter = () => (
    <Pressable
      style={[styles.addButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
      onPress={() => navigation.navigate("AddCategory", {})}
    >
      <ThemedText style={[styles.addButtonText, { color: theme.primary }]}>
        + Add Life Area
      </ThemedText>
    </Pressable>
  );

  return (
    <DraggableFlatList
      data={orderedCategories}
      keyExtractor={(item) => item.id}
      onDragEnd={handleDragEnd}
      renderItem={renderLifeAreaRow}
      ListHeaderComponent={renderCenterIconSection}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      activationDistance={8}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  lifeAreasTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  previewWrapper: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  centerPreview: {
    width: CENTER_PREVIEW_SIZE,
    height: CENTER_PREVIEW_SIZE,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  previewInitial: {
    fontSize: 28,
    fontWeight: "700",
  },
  previewEmoji: {
    fontSize: 28,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  optionOuter: {
    borderRadius: BorderRadius.full,
  },
  optionCircle: {
    width: OPTION_CIRCLE_SIZE,
    height: OPTION_CIRCLE_SIZE,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  optionEmoji: {
    fontSize: 22,
  },
  emojiInputRow: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  emojiInputLabel: {
    fontSize: 13,
  },
  emojiInput: {
    width: 72,
    height: 44,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    fontSize: 24,
    textAlign: "center",
  },
  lifeAreaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  dragHandle: {
    padding: Spacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lifeAreaInfo: {
    flex: 1,
    minWidth: 0,
  },
  lifeAreaName: {
    fontSize: 16,
    fontWeight: "500",
  },
  lifeAreaSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  editLink: {
    fontSize: 14,
    fontWeight: "500",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
