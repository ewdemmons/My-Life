import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import AppDatePicker from "@/components/AppDatePicker";
import AppTimePicker from "@/components/AppTimePicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Colors } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import type { PostSignUpStackParamList } from "@/navigation/RootStackNavigator";
import { useApp } from "@/context/AppContext";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { createDefaultLifeWheel } from "@/lib/defaultLifeWheel";
import {
  autoSelectLifeArea,
  autoSelectEntryType,
  autoSelectEventType,
  type CategoryForAutoSelect,
  ENTRY_TYPE_CHIP_LABELS,
  EVENT_TYPE_CHIP_LABELS,
} from "@/lib/onboardingLifeArea";
import type { TaskType, EventType, HabitType, GoalFrequency, LifeCategory } from "@/types";

const ONBOARDING_COMPLETE_KEY = "@onboarding_complete";
const KEYBOARD_VERTICAL_OFFSET = 100;
const KEYBOARD_SCROLL_PADDING = 80;
const PENDING_ONBOARDING_KEY = "@pending_onboarding";
const TOTAL_STEPS = 6;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WHEEL_DIAMETER = 200;
const WHEEL_RADIUS = WHEEL_DIAMETER / 2;
const WHEEL_NODE_RADIUS = 22;
const WHEEL_SPOKE_RADIUS = WHEEL_RADIUS - WHEEL_NODE_RADIUS - 8;
const WHEEL_CENTER_SIZE = 40;
const WHEEL_INNER_RING_OFFSET = 12;

const DEFAULT_LIFE_AREAS: { name: string; color: string; icon: string; description: string }[] = [
  { name: "Home", color: "#EF4444", icon: "home", description: "Chores, maintenance & household tasks" },
  { name: "Family", color: "#8B5CF6", icon: "users", description: "Family obligations, events & shared responsibilities" },
  { name: "Health", color: "#10B981", icon: "activity", description: "Fitness, medical & wellbeing" },
  { name: "Work", color: "#3B82F6", icon: "briefcase", description: "Career responsibilities, projects & deadlines" },
  { name: "Finance", color: "#F59E0B", icon: "dollar-sign", description: "Budget, bills & planning" },
];

const ADDITIONAL_SUGGESTIONS: { name: string; color: string; icon: string }[] = [
  { name: "Fitness", color: "#EC4899", icon: "zap" },
  { name: "Education", color: "#6366F1", icon: "book" },
  { name: "Hobbies", color: "#06B6D4", icon: "star" },
  { name: "Personal Growth", color: "#84CC16", icon: "trending-up" },
];

const CUSTOM_AREA_PALETTE = ["#EC4899", "#6366F1", "#06B6D4", "#84CC16", "#F59E0B", "#8B5CF6"];
const MAX_ADDITIONAL_AREAS = 3;
const MAX_CUSTOM_NAME_LENGTH = 30;

function resolveOnboardingLifeAreaId(
  categoryId: string,
  title: string,
  createdCategories: CategoryForAutoSelect[],
  createdCategoryIds: string[]
): string | null {
  if (categoryId && createdCategories.some((c) => c.id === categoryId)) {
    return categoryId;
  }
  if (title.trim()) {
    const auto = autoSelectLifeArea(title, createdCategories);
    if (auto) return auto;
  }
  return createdCategoryIds[0] ?? null;
}

type WheelNode = { name: string; color: string; icon: string };

type OnboardingLifeAreaSelectorProps = {
  categoryId: string;
  titleForAutoSelect: string;
  createdCategories: LifeCategory[];
  manualLifeAreaOverride: boolean;
  dropdownKey: string;
  openDropdownKey: string | null;
  onOpenDropdown: (key: string | null) => void;
  onSelectCategory: (categoryId: string) => void;
  onClearManualOverride: () => void;
};

function OnboardingLifeAreaSelector({
  categoryId,
  titleForAutoSelect,
  createdCategories,
  manualLifeAreaOverride,
  dropdownKey,
  openDropdownKey,
  onOpenDropdown,
  onSelectCategory,
  onClearManualOverride,
}: OnboardingLifeAreaSelectorProps) {
  const { theme } = useTheme();

  if (createdCategories.length === 0) return null;

  const autoCategoryId = titleForAutoSelect.trim()
    ? autoSelectLifeArea(titleForAutoSelect, createdCategories)
    : (createdCategories[0]?.id ?? "");
  const displayCategoryId =
    categoryId && createdCategories.some((c) => c.id === categoryId)
      ? categoryId
      : autoCategoryId;
  const displayCat = createdCategories.find((c) => c.id === displayCategoryId);
  if (!displayCat) return null;

  const isOpen = openDropdownKey === dropdownKey;

  return (
    <View style={styles.lifeAreaSelectorWrap}>
      <Pressable
        onPress={() => onOpenDropdown(isOpen ? null : dropdownKey)}
        style={[styles.autoLifeAreaChipPressable, { backgroundColor: displayCat.color }]}
      >
        <ThemedText style={styles.autoLifeAreaChipText}>{displayCat.name}</ThemedText>
        <View style={styles.lifeAreaChipChangeRow}>
          <ThemedText style={styles.lifeAreaChipChangeLabel}>change</ThemedText>
          <Feather name="chevron-down" size={14} color="#fff" />
        </View>
      </Pressable>
      {manualLifeAreaOverride ? (
        <ThemedText style={[styles.lifeAreaManualHint, { color: theme.textSecondary }]}>
          Manually selected
        </ThemedText>
      ) : null}
      {isOpen ? (
        <View
          style={[
            styles.lifeAreaDropdown,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.lifeAreaDropdownItem, pressed && { opacity: 0.7 }]}
            onPress={() => {
              onClearManualOverride();
              onOpenDropdown(null);
            }}
          >
            <Feather name="zap" size={14} color={theme.primary} />
            <ThemedText style={[styles.lifeAreaDropdownItemText, { color: theme.text }]}>
              Auto-detect from text
            </ThemedText>
          </Pressable>
          {createdCategories.map((cat) => (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.lifeAreaDropdownItem,
                pressed && { opacity: 0.7 },
                displayCategoryId === cat.id && { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={() => {
                onSelectCategory(cat.id);
                onOpenDropdown(null);
              }}
            >
              <View style={[styles.lifeAreaDropdownDot, { backgroundColor: cat.color }]} />
              <ThemedText style={[styles.lifeAreaDropdownItemText, { color: theme.text }]}>
                {cat.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LifeWheelPreview({
  nodes,
  theme,
}: {
  nodes: WheelNode[];
  theme: { border: string; primary: string; backgroundDefault: string; text: string };
}) {
  const animsRef = useRef<{ [key: string]: { scale: Animated.Value; opacity: Animated.Value } }>({});
  const prevNodesRef = useRef<WheelNode[]>([]);
  const [exitingNodes, setExitingNodes] = useState<WheelNode[]>([]);
  const exitingAnimsRef = useRef<{ [key: string]: { scale: Animated.Value; opacity: Animated.Value } }>({});

  const allDisplayNodes = useMemo(() => {
    const byName = new Map<string, WheelNode>();
    nodes.forEach((n) => byName.set(n.name, n));
    exitingNodes.forEach((n) => byName.set(n.name, n));
    return Array.from(byName.values());
  }, [nodes, exitingNodes]);

  useEffect(() => {
    const prev = prevNodesRef.current;
    const prevNames = new Set(prev.map((p) => p.name));
    const nextNames = new Set(nodes.map((n) => n.name));
    const removed = prev.filter((p) => !nextNames.has(p.name));
    if (removed.length > 0) {
      removed.forEach((n) => {
        if (!exitingAnimsRef.current[n.name]) {
          exitingAnimsRef.current[n.name] = {
            scale: new Animated.Value(1),
            opacity: new Animated.Value(1),
          };
        }
        Animated.parallel([
          Animated.timing(exitingAnimsRef.current[n.name].scale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(exitingAnimsRef.current[n.name].opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setExitingNodes((e) => e.filter((x) => x.name !== n.name));
          delete exitingAnimsRef.current[n.name];
        });
      });
      setExitingNodes((e) => [...e, ...removed]);
    }
    prevNodesRef.current = nodes;
  }, [nodes]);

  allDisplayNodes.forEach((n) => {
    if (!animsRef.current[n.name]) {
      animsRef.current[n.name] = {
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
      };
    }
  });

  useEffect(() => {
    nodes.forEach((n) => {
      const a = animsRef.current[n.name];
      if (a) {
        Animated.parallel([
          Animated.timing(a.scale, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(a.opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        ]).start();
      }
    });
  }, [nodes]);

  const n = allDisplayNodes.length;
  const positions = useMemo(() => {
    if (n === 0) return [];
    return allDisplayNodes.map((_, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const cx = WHEEL_RADIUS + WHEEL_SPOKE_RADIUS * Math.cos(angle);
      const cy = WHEEL_RADIUS + WHEEL_SPOKE_RADIUS * Math.sin(angle);
      return {
        left: cx - WHEEL_NODE_RADIUS,
        top: cy - WHEEL_NODE_RADIUS,
        angleDeg: (angle * 180) / Math.PI,
        spokeLength: WHEEL_SPOKE_RADIUS,
      };
    });
  }, [n, allDisplayNodes]);

  return (
    <View style={[styles.wheelPreviewOuter, { width: WHEEL_DIAMETER, height: WHEEL_DIAMETER }]}>
      {/* Outer dashed ring */}
      <View
        style={[
          styles.wheelPreviewDashedRing,
          {
            width: WHEEL_DIAMETER,
            height: WHEEL_DIAMETER,
            borderRadius: WHEEL_RADIUS,
            borderColor: theme.border,
          },
        ]}
      />
      {/* Inner subtle ring */}
      <View
        style={[
          styles.wheelPreviewInnerRing,
          {
            width: WHEEL_DIAMETER - WHEEL_INNER_RING_OFFSET * 2,
            height: WHEEL_DIAMETER - WHEEL_INNER_RING_OFFSET * 2,
            borderRadius: (WHEEL_DIAMETER - WHEEL_INNER_RING_OFFSET * 2) / 2,
            borderColor: theme.border,
            left: WHEEL_INNER_RING_OFFSET,
            top: WHEEL_INNER_RING_OFFSET,
          },
        ]}
      />
      {/* Spoke lines (from center to each node) */}
      {positions.map((pos, i) => {
        const node = allDisplayNodes[i];
        return (
          <View
            key={`spoke-${node.name}`}
            style={[
              styles.wheelSpoke,
              {
                left: WHEEL_RADIUS - pos.spokeLength / 2,
                top: WHEEL_RADIUS - 1,
                width: pos.spokeLength,
                height: 2,
                backgroundColor: `${node.color}40`,
                transform: [{ rotate: `${pos.angleDeg}deg` }],
              },
            ]}
          />
        );
      })}
      {/* Center circle with target */}
      <View
        style={[
          styles.wheelCenter,
          {
            width: WHEEL_CENTER_SIZE,
            height: WHEEL_CENTER_SIZE,
            borderRadius: WHEEL_CENTER_SIZE / 2,
            left: WHEEL_RADIUS - WHEEL_CENTER_SIZE / 2,
            top: WHEEL_RADIUS - WHEEL_CENTER_SIZE / 2,
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
          },
        ]}
      >
        <Feather name="target" size={22} color="#FFFFFF" />
      </View>
      {/* Nodes */}
      {allDisplayNodes.map((node, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const isExiting = exitingNodes.some((e) => e.name === node.name);
        const anim = isExiting ? exitingAnimsRef.current[node.name] : animsRef.current[node.name];
        if (!anim) return null;
        const shortLabel = node.name.length > 8 ? node.name.slice(0, 7) + "…" : node.name;
        return (
          <Animated.View
            key={node.name}
            style={[
              styles.wheelNode,
              {
                left: pos.left,
                top: pos.top,
                width: WHEEL_NODE_RADIUS * 2,
                height: WHEEL_NODE_RADIUS * 2,
                borderRadius: WHEEL_NODE_RADIUS,
                borderColor: node.color,
                backgroundColor: theme.backgroundDefault,
                transform: [{ scale: anim.scale }],
                opacity: anim.opacity,
              },
            ]}
          >
            <Feather name={node.icon as any} size={14} color={node.color} />
            <ThemedText style={[styles.wheelNodeLabel, { color: theme.text }]} numberOfLines={1}>
              {shortLabel}
            </ThemedText>
          </Animated.View>
        );
      })}
    </View>
  );
}

type NavigationProp = NativeStackNavigationProp<PostSignUpStackParamList, "Onboarding">;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { theme: systemTheme } = useTheme();
  const theme = systemTheme;
  const navigation = useNavigation<NavigationProp>();
  const { addCategory, addTask, addEvent, addHabit, categories } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500, successMessage: "Saved" });

  const [currentStep, setCurrentStep] = useState(1);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [createdCategoryIds, setCreatedCategoryIds] = useState<string[]>([]);

  const [step1AdditionalSelected, setStep1AdditionalSelected] = useState<string[]>([]);
  const [step1CustomAreas, setStep1CustomAreas] = useState<Array<{ name: string; color: string }>>([]);
  const [step1CustomInput, setStep1CustomInput] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);

  const [step3Tasks, setStep3Tasks] = useState<
    Array<{ title: string; categoryId: string; created?: boolean; manualLifeAreaOverride?: boolean }>
  >([{ title: "", categoryId: "" }]);

  type Step4Event = {
    title: string;
    date: Date;
    time: Date | null;
    categoryId: string;
    eventType: EventType;
    created?: boolean;
    manualLifeAreaOverride?: boolean;
  };
  const [step4Events, setStep4Events] = useState<Step4Event[]>([
    { title: "", date: new Date(), time: null, categoryId: "", eventType: "appointment" },
  ]);
  const [step4Picker, setStep4Picker] = useState<{ index: number; mode: "date" | "time" } | null>(null);

  type Step5Goal = {
    title: string;
    details: string;
    categoryId: string;
    created?: boolean;
    manualLifeAreaOverride?: boolean;
  };
  const [step5Goals, setStep5Goals] = useState<Step5Goal[]>([
    { title: "", details: "", categoryId: "" },
  ]);

  type Step6Habit = {
    name: string;
    habitType: HabitType;
    goalFrequency: GoalFrequency;
    goalCount: number;
    categoryId: string;
    created?: boolean;
    manualLifeAreaOverride?: boolean;
  };
  const [step6Habits, setStep6Habits] = useState<Step6Habit[]>([
    {
      name: "",
      habitType: "positive",
      goalFrequency: "daily",
      goalCount: 1,
      categoryId: "",
    },
  ]);

  const [lifeAreaDropdownKey, setLifeAreaDropdownKey] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const continueInFlightRef = useRef(false);
  const stepScrollRefs = useRef<(ScrollView | null)[]>([]);
  const inputScrollOffsets = useRef<Record<string, number>>({});
  const cardScrollOffsets = useRef<Record<string, number>>({});
  const innerScrollOffsets = useRef<Record<string, number>>({});

  const createdCategories = useMemo(
    () =>
      createdCategoryIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => c != null),
    [createdCategoryIds, categories]
  );

  const step1WheelNodes = useMemo((): WheelNode[] => {
    const defaults: WheelNode[] = DEFAULT_LIFE_AREAS.map((d) => ({ name: d.name, color: d.color, icon: d.icon }));
    const additional: WheelNode[] = [
      ...step1AdditionalSelected.map((name) => {
        const s = ADDITIONAL_SUGGESTIONS.find((x) => x.name === name);
        return s ? { name: s.name, color: s.color, icon: s.icon } : { name, color: CUSTOM_AREA_PALETTE[0], icon: "circle" as const };
      }),
      ...step1CustomAreas.map((c) => ({ name: c.name, color: c.color, icon: "circle" as const })),
    ];
    return [...defaults, ...additional];
  }, [step1AdditionalSelected, step1CustomAreas]);

  const step1AdditionalCount = step1AdditionalSelected.length + step1CustomAreas.length;
  const step1RemainingSlots = Math.max(0, MAX_ADDITIONAL_AREAS - step1AdditionalCount);

  const formatStepDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const formatStepTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const toYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const toHHMM = (date: Date) => {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const setStepScrollRef = (stepIndex: number) => (ref: ScrollView | null) => {
    stepScrollRefs.current[stepIndex] = ref;
  };

  const registerScrollOffset = (key: string, y: number) => {
    inputScrollOffsets.current[key] = y;
  };

  const registerCardOffset = (key: string, y: number) => {
    cardScrollOffsets.current[key] = y;
  };

  const registerInnerOffset = (key: string, y: number) => {
    innerScrollOffsets.current[key] = y;
  };

  const scrollToFocusedInput = (stepIndex: number, key: string) => {
    setTimeout(
      () => {
        const scroll = stepScrollRefs.current[stepIndex];
        if (!scroll) return;
        const cardKey = key.replace(/-count$/, "").replace(/-details$/, "");
        const cardY = cardScrollOffsets.current[cardKey];
        const innerY = innerScrollOffsets.current[key];
        const y =
          cardY != null && innerY != null
            ? cardY + innerY
            : inputScrollOffsets.current[key] ?? cardY;
        if (y == null) return;
        scroll.scrollTo({
          y: Math.max(0, y - KEYBOARD_SCROLL_PADDING),
          animated: true,
        });
      },
      Platform.OS === "ios" ? 350 : 100
    );
  };

  useEffect(() => {
    const checkOnboardingComplete = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        const pending = await AsyncStorage.getItem(PENDING_ONBOARDING_KEY);
        if (value === "true" && pending !== "true") {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Main" }],
            })
          );
          return;
        }
      } catch {
        // ignore
      } finally {
        setCheckingStorage(false);
      }
    };
    checkOnboardingComplete();
  }, [navigation]);

  useEffect(() => {
    if (checkingStorage) return;
    Animated.timing(progressAnim, {
      toValue: (currentStep / TOTAL_STEPS) * SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, checkingStorage, progressAnim]);

  useEffect(() => {
    if (currentStep !== 2 || createdCategories.length === 0) return;
    setStep3Tasks((prev) =>
      prev.map((t) => {
        if (t.manualLifeAreaOverride) return t;
        return {
          ...t,
          categoryId:
            t.categoryId && createdCategories.some((c) => c.id === t.categoryId)
              ? t.categoryId
              : autoSelectLifeArea(t.title, createdCategories),
        };
      })
    );
  }, [currentStep, createdCategories]);

  useEffect(() => {
    if (currentStep !== 3 || createdCategories.length === 0) return;
    setStep4Events((prev) =>
      prev.map((e) => {
        const next = { ...e };
        if (!e.manualLifeAreaOverride) {
          next.categoryId =
            e.categoryId && createdCategories.some((c) => c.id === e.categoryId)
              ? e.categoryId
              : autoSelectLifeArea(e.title, createdCategories);
        }
        next.eventType = autoSelectEventType(e.title);
        return next;
      })
    );
  }, [currentStep, createdCategories]);

  useEffect(() => {
    if (currentStep !== 4 || createdCategories.length === 0) return;
    setStep5Goals((prev) =>
      prev.map((g) => {
        if (g.manualLifeAreaOverride) return g;
        return {
          ...g,
          categoryId:
            g.categoryId && createdCategories.some((c) => c.id === g.categoryId)
              ? g.categoryId
              : autoSelectLifeArea(g.title, createdCategories),
        };
      })
    );
  }, [currentStep, createdCategories]);

  useEffect(() => {
    if (currentStep !== 5 || createdCategories.length === 0) return;
    setStep6Habits((prev) =>
      prev.map((h) => {
        if (h.manualLifeAreaOverride) return h;
        return {
          ...h,
          categoryId:
            h.categoryId && createdCategories.some((c) => c.id === h.categoryId)
              ? h.categoryId
              : autoSelectLifeArea(h.name, createdCategories),
        };
      })
    );
  }, [currentStep, createdCategories]);

  useEffect(() => {
    setLifeAreaDropdownKey(null);
  }, [currentStep]);

  const goToNextStep = () => {
    if (currentStep >= TOTAL_STEPS) return;
    Animated.timing(slideAnim, {
      toValue: -currentStep * SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep((s) => s + 1);
    });
  };

  const goToPrevStep = () => {
    if (currentStep <= 1) return;
    Animated.timing(slideAnim, {
      toValue: -(currentStep - 2) * SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep((s) => s - 1);
    });
  };

  const handleSkipOnboarding = async () => {
    try {
      if (categories.length === 0) {
        await createDefaultLifeWheel(addCategory, categories);
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    } catch {
      // continue to Main
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }],
      })
    );
  };

  const toggleStep1Suggestion = (name: string) => {
    setStep1Error(null);
    setStep1AdditionalSelected((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : step1AdditionalCount >= MAX_ADDITIONAL_AREAS ? prev : [...prev, name]
    );
  };

  const addStep1Custom = () => {
    setStep1Error(null);
    const trimmed = step1CustomInput.trim().slice(0, MAX_CUSTOM_NAME_LENGTH);
    if (!trimmed) return;
    if (step1AdditionalCount >= MAX_ADDITIONAL_AREAS) return;
    const exists = step1CustomAreas.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
      || ADDITIONAL_SUGGESTIONS.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
      || step1AdditionalSelected.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;
    const color = CUSTOM_AREA_PALETTE[step1CustomAreas.length % CUSTOM_AREA_PALETTE.length];
    setStep1CustomAreas((prev) => [...prev, { name: trimmed, color }]);
    setStep1CustomInput("");
  };

  const removeStep1Additional = (name: string) => {
    setStep1Error(null);
    if (step1AdditionalSelected.includes(name)) {
      setStep1AdditionalSelected((prev) => prev.filter((s) => s !== name));
    } else {
      setStep1CustomAreas((prev) => prev.filter((c) => c.name !== name));
    }
  };

  const canContinueStep1 = true;

  const addStep3Task = () => {
    if (step3Tasks.length >= 3) return;
    const fallbackId = createdCategories[0]?.id ?? "";
    setStep3Tasks((prev) => [...prev, { title: "", categoryId: fallbackId }]);
  };
  const removeStep3Task = (index: number) => {
    setStep3Tasks((prev) => prev.filter((_, i) => i !== index));
  };
  const updateStep3Task = (index: number, field: "title" | "categoryId", value: string) => {
    setStep3Tasks((prev) =>
      prev.map((t, i) =>
        i === index
          ? {
              ...t,
              [field]: value,
              ...(field === "title" && !t.manualLifeAreaOverride
                ? { categoryId: autoSelectLifeArea(value, createdCategories) }
                : {}),
            }
          : t
      )
    );
  };

  const setTaskLifeArea = (index: number, categoryId: string, manual: boolean) => {
    setStep3Tasks((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, categoryId, manualLifeAreaOverride: manual } : t
      )
    );
  };

  const clearTaskLifeAreaOverride = (index: number) => {
    setStep3Tasks((prev) =>
      prev.map((t, i) =>
        i === index
          ? {
              ...t,
              manualLifeAreaOverride: false,
              categoryId: autoSelectLifeArea(t.title, createdCategories),
            }
          : t
      )
    );
  };

  const addStep4Event = () => {
    if (step4Events.length >= 5) return;
    setStep4Events((prev) => [
      ...prev,
      { title: "", date: new Date(), time: null, categoryId: createdCategoryIds[0] || "", eventType: "appointment" },
    ]);
  };
  const removeStep4Event = (index: number) => {
    setStep4Events((prev) => prev.filter((_, i) => i !== index));
    if (step4Picker && step4Picker.index === index) setStep4Picker(null);
  };
  const updateStep4Event = <K extends keyof Step4Event>(index: number, field: K, value: Step4Event[K]) => {
    setStep4Events((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              [field]: value,
              ...(field === "title" && typeof value === "string"
                ? {
                    eventType: autoSelectEventType(value),
                    ...(!e.manualLifeAreaOverride
                      ? { categoryId: autoSelectLifeArea(value, createdCategories) }
                      : {}),
                  }
                : {}),
            }
          : e
      )
    );
  };

  const setEventLifeArea = (index: number, categoryId: string, manual: boolean) => {
    setStep4Events((prev) =>
      prev.map((e, i) =>
        i === index ? { ...e, categoryId, manualLifeAreaOverride: manual } : e
      )
    );
  };

  const clearEventLifeAreaOverride = (index: number) => {
    setStep4Events((prev) =>
      prev.map((e, i) =>
        i === index
          ? {
              ...e,
              manualLifeAreaOverride: false,
              categoryId: autoSelectLifeArea(e.title, createdCategories),
            }
          : e
      )
    );
  };

  const addStep5Goal = () => {
    if (step5Goals.length >= 3) return;
    setStep5Goals((prev) => [
      ...prev,
      { title: "", details: "", categoryId: createdCategories[0]?.id ?? "" },
    ]);
  };
  const removeStep5Goal = (index: number) => {
    setStep5Goals((prev) => prev.filter((_, i) => i !== index));
  };
  const updateStep5Goal = (index: number, field: keyof Step5Goal, value: string) => {
    setStep5Goals((prev) =>
      prev.map((g, i) =>
        i === index
          ? {
              ...g,
              [field]: value,
              ...(field === "title" && !g.manualLifeAreaOverride
                ? { categoryId: autoSelectLifeArea(value, createdCategories) }
                : {}),
            }
          : g
      )
    );
  };

  const setGoalLifeArea = (index: number, categoryId: string, manual: boolean) => {
    setStep5Goals((prev) =>
      prev.map((g, i) =>
        i === index ? { ...g, categoryId, manualLifeAreaOverride: manual } : g
      )
    );
  };

  const clearGoalLifeAreaOverride = (index: number) => {
    setStep5Goals((prev) =>
      prev.map((g, i) =>
        i === index
          ? {
              ...g,
              manualLifeAreaOverride: false,
              categoryId: autoSelectLifeArea(g.title, createdCategories),
            }
          : g
      )
    );
  };

  const addStep6Habit = () => {
    if (step6Habits.length >= 5) return;
    setStep6Habits((prev) => [
      ...prev,
      {
        name: "",
        habitType: "positive",
        goalFrequency: "daily",
        goalCount: 1,
        categoryId: createdCategories[0]?.id ?? "",
      },
    ]);
  };
  const removeStep6Habit = (index: number) => {
    setStep6Habits((prev) => prev.filter((_, i) => i !== index));
  };
  const updateStep6Habit = (index: number, field: keyof Step6Habit, value: string | number | HabitType | GoalFrequency) => {
    setStep6Habits((prev) =>
      prev.map((h, i) =>
        i === index
          ? {
              ...h,
              [field]: value,
              ...(field === "name" && !h.manualLifeAreaOverride && typeof value === "string"
                ? { categoryId: autoSelectLifeArea(value, createdCategories) }
                : {}),
            }
          : h
      )
    );
  };

  const setHabitLifeArea = (index: number, categoryId: string, manual: boolean) => {
    setStep6Habits((prev) =>
      prev.map((h, i) =>
        i === index ? { ...h, categoryId, manualLifeAreaOverride: manual } : h
      )
    );
  };

  const clearHabitLifeAreaOverride = (index: number) => {
    setStep6Habits((prev) =>
      prev.map((h, i) =>
        i === index
          ? {
              ...h,
              manualLifeAreaOverride: false,
              categoryId: autoSelectLifeArea(h.name, createdCategories),
            }
          : h
      )
    );
  };

  const handleContinue = async () => {
    if (continueInFlightRef.current) return;
    continueInFlightRef.current = true;
    try {
      if (currentStep === 1) {
        if (!canContinueStep1) return;
        setStep1Loading(true);
        setStep1Error(null);
        const performSave = async () => {
          const ids: string[] = [];
          for (const d of DEFAULT_LIFE_AREAS) {
            const created = await addCategory({
              name: d.name,
              description: d.description,
              color: d.color,
              icon: d.icon,
              peopleIds: [],
            });
            if (created) ids.push(created.id);
          }
          for (const name of step1AdditionalSelected) {
            const s = ADDITIONAL_SUGGESTIONS.find((x) => x.name === name);
            const created = await addCategory({
              name,
              description: "",
              color: s?.color ?? CUSTOM_AREA_PALETTE[0],
              icon: (s?.icon ?? "circle") as string,
              peopleIds: [],
            });
            if (created) ids.push(created.id);
          }
          for (const c of step1CustomAreas) {
            const created = await addCategory({
              name: c.name,
              description: "",
              color: c.color,
              icon: "circle",
              peopleIds: [],
            });
            if (created) ids.push(created.id);
          }
          setCreatedCategoryIds(ids);

          const homeId = ids[0];
          const familyId = ids[1];
          const healthId = ids[2];
          const workId = ids[3];
          const financeId = ids[4];

          const starterTasks = [
            { title: "Weekly grocery run", categoryId: homeId },
            { title: "Home maintenance checklist", categoryId: homeId },
            { title: "Family dinner plan", categoryId: familyId },
            { title: "Call parents", categoryId: familyId },
            { title: "Schedule annual checkup", categoryId: healthId },
            { title: "Start morning routine", categoryId: healthId },
            { title: "Review weekly priorities", categoryId: workId },
            { title: "Update project status", categoryId: workId },
            { title: "Review monthly budget", categoryId: financeId },
            { title: "Check savings goal", categoryId: financeId },
          ];
          for (const t of starterTasks) {
            if (!t.categoryId) continue;
            try {
              await addTask({
                title: t.title,
                description: "",
                type: "task",
                categoryId: t.categoryId,
                parentId: null,
                priority: "medium",
                status: "pending",
                assigneeIds: [],
              });
            } catch (err) {
              console.error("[Onboarding] Failed to create starter task:", t.title, err);
            }
          }

          const starterHabits = [
            { name: "Tidy up before bed", habitType: "positive" as const, goalFrequency: "daily" as const, goalCount: 1, categoryId: homeId },
            { name: "Quality time with family", habitType: "positive" as const, goalFrequency: "weekly" as const, goalCount: 1, categoryId: familyId },
            { name: "Exercise", habitType: "positive" as const, goalFrequency: "daily" as const, goalCount: 3, categoryId: healthId },
            { name: "Daily planning session", habitType: "positive" as const, goalFrequency: "daily" as const, goalCount: 1, categoryId: workId },
            { name: "Track daily spending", habitType: "positive" as const, goalFrequency: "daily" as const, goalCount: 1, categoryId: financeId },
          ];
          for (const h of starterHabits) {
            if (!h.categoryId) continue;
            try {
              await addHabit({
                name: h.name,
                habitType: h.habitType,
                goalFrequency: h.goalFrequency,
                goalCount: h.goalCount,
                categoryId: h.categoryId,
                linkedTaskId: null,
                isActive: true,
              });
            } catch (err) {
              console.error("[Onboarding] Failed to create starter habit:", h.name, err);
            }
          }

          goToNextStep();
        };
        setRetry(() => { void performSave(); });
        const result = await withSaveIndicator(performSave);
        if (result === null) {
          setStep1Error("Something went wrong. Please try again.");
        }
        setStep1Loading(false);
        return;
      }
      if (currentStep === 2) {
        const performSave = async () => {
          let pinnedOrder = 0;
          const createdIndices: number[] = [];
          for (let i = 0; i < step3Tasks.length; i++) {
            const t = step3Tasks[i];
            if (!t.title.trim()) continue;
            if (t.created) continue;
            const taskCategoryId = resolveOnboardingLifeAreaId(
              t.categoryId,
              t.title.trim(),
              createdCategories,
              createdCategoryIds
            );
            if (!taskCategoryId) continue;
            const entryType = autoSelectEntryType(t.title);
            await addTask({
              title: t.title.trim(),
              description: "",
              type: entryType,
              categoryId: taskCategoryId,
              parentId: null,
              priority: "high",
              status: "pending",
              assigneeIds: [],
              isPinned: true,
              pinnedOrder: pinnedOrder++,
            });
            createdIndices.push(i);
          }
          setStep3Tasks((prev) => prev.map((task, j) => (createdIndices.includes(j) ? { ...task, created: true } : task)));
          goToNextStep();
        };
        setRetry(() => { void performSave(); });
        await withSaveIndicator(performSave);
        return;
      }
      if (currentStep === 3) {
        const performSave = async () => {
          const createdIndices: number[] = [];
          for (let i = 0; i < step4Events.length; i++) {
            const e = step4Events[i];
            if (!e.title.trim()) continue;
            if (e.created) continue;
            const eventCategoryId = resolveOnboardingLifeAreaId(
              e.categoryId,
              e.title.trim(),
              createdCategories,
              createdCategoryIds
            );
            const startDate = toYYYYMMDD(e.date);
            const startTime = e.time ? toHHMM(e.time) : "09:00";
            const startDt = e.time
              ? new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate(), e.time.getHours(), e.time.getMinutes())
              : new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate(), 9, 0);
            const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
            const endDate = toYYYYMMDD(endDt);
            const endTime = toHHMM(endDt);
            await addEvent({
              title: e.title.trim(),
              description: "",
              startDate,
              startTime,
              endDate,
              endTime,
              eventType: e.eventType,
              recurrence: "none",
              linkedTaskId: null,
              categoryId: eventCategoryId,
            });
            createdIndices.push(i);
          }
          setStep4Events((prev) => prev.map((ev, j) => (createdIndices.includes(j) ? { ...ev, created: true } : ev)));
          goToNextStep();
        };
        setRetry(() => { void performSave(); });
        await withSaveIndicator(performSave);
        return;
      }
      if (currentStep === 4) {
        const performSave = async () => {
          const createdGoalIndices: number[] = [];
          for (let i = 0; i < step5Goals.length; i++) {
            const g = step5Goals[i];
            if (!g.title.trim()) continue;
            if (g.created) continue;
            const goalCategoryId = resolveOnboardingLifeAreaId(
              g.categoryId,
              g.title.trim(),
              createdCategories,
              createdCategoryIds
            );
            if (!goalCategoryId) continue;
            await addTask({
              title: g.title.trim(),
              description: g.details.trim() || "",
              type: "goal",
              categoryId: goalCategoryId,
              parentId: null,
              priority: "high",
              status: "pending",
              assigneeIds: [],
            });
            createdGoalIndices.push(i);
          }
          setStep5Goals((prev) =>
            prev.map((goal, j) => (createdGoalIndices.includes(j) ? { ...goal, created: true } : goal))
          );
          goToNextStep();
        };
        setRetry(() => { void performSave(); });
        await withSaveIndicator(performSave);
        return;
      }
      if (currentStep === 5) {
        const performSave = async () => {
          const createdHabitIndices: number[] = [];
          for (let i = 0; i < step6Habits.length; i++) {
            const h = step6Habits[i];
            if (!h.name.trim()) continue;
            if (h.created) continue;
            const count = Math.max(1, Math.floor(Number(h.goalCount)) || 0) || 1;
            const habitCategoryId = resolveOnboardingLifeAreaId(
              h.categoryId,
              h.name.trim(),
              createdCategories,
              createdCategoryIds
            );
            const habitType: HabitType = h.habitType === "negative" ? "negative" : "positive";
            const goalFrequency: GoalFrequency =
              h.goalFrequency === "weekly" || h.goalFrequency === "monthly" ? h.goalFrequency : "daily";
            await addHabit({
              name: h.name.trim(),
              habitType,
              goalFrequency,
              goalCount: count,
              categoryId: habitCategoryId,
              linkedTaskId: null,
              isActive: true,
            });
            createdHabitIndices.push(i);
          }
          setStep6Habits((prev) =>
            prev.map((habit, j) => (createdHabitIndices.includes(j) ? { ...habit, created: true } : habit))
          );
          goToNextStep();
        };
        setRetry(() => { void performSave(); });
        await withSaveIndicator(performSave);
        return;
      }
      if (currentStep === 6) {
        await handleSkipOnboarding();
        return;
      }
      if (currentStep < TOTAL_STEPS) {
        goToNextStep();
      }
    } finally {
      continueInFlightRef.current = false;
    }
  };

  const handleSkipStep = () => {
    if (currentStep < TOTAL_STEPS) {
      goToNextStep();
    }
  };

  const canContinue =
    (currentStep === 1 && canContinueStep1) ||
    (currentStep >= 2 && currentStep <= 6);

  if (checkingStorage) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.lg }]}>
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: theme.primary,
                width: progressAnim,
              },
            ]}
          />
        </View>
        <View style={styles.headerRow}>
          {currentStep > 1 ? (
            <Pressable
              onPress={goToPrevStep}
              style={styles.backButton}
              hitSlop={12}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <ThemedText style={[styles.stepCounter, { color: theme.textSecondary }]}>
            Step {currentStep} of {TOTAL_STEPS}
          </ThemedText>
          <Pressable
            style={styles.skipOnboardingButton}
            onPress={handleSkipOnboarding}
            hitSlop={12}
          >
            <ThemedText style={[styles.skipOnboardingText, { color: theme.textSecondary }]}>
              Skip onboarding
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
      >
        <View style={styles.sliderContainer}>
          <Animated.View
            style={[
              styles.slider,
              {
                width: SCREEN_WIDTH * TOTAL_STEPS,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Step 1 — Life Areas */}
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <ScrollView
                ref={setStepScrollRef(0)}
                style={styles.slideScroll}
                contentContainerStyle={[styles.slideScrollContent, { paddingHorizontal: Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <ThemedText style={[styles.heading, { color: theme.text }]}>
                  Build your Life Wheel
                </ThemedText>
                <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
                  Life Areas are the pillars of your life that you want to stay on top of. We've set up 5 to get you started — let's add a few more.
                </ThemedText>
                <View style={styles.wheelPreviewWrap}>
                  <LifeWheelPreview nodes={step1WheelNodes} theme={theme} />
                </View>

                {DEFAULT_LIFE_AREAS.map((area) => (
                  <View
                    key={area.name}
                    style={[
                      styles.step1DefaultCard,
                      {
                        borderLeftColor: area.color,
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={[styles.step1DefaultCardIconWrap, { backgroundColor: `${area.color}20` }]}>
                      <Feather name={area.icon as any} size={20} color={area.color} />
                    </View>
                    <View style={styles.step1DefaultCardBody}>
                      <ThemedText style={[styles.step1DefaultCardName, { color: theme.text }]}>{area.name}</ThemedText>
                      <ThemedText style={[styles.step1DefaultCardDesc, { color: theme.textSecondary }]}>
                        {area.description}
                      </ThemedText>
                    </View>
                    <View style={[styles.step1DefaultCardCheck, { backgroundColor: area.color }]}>
                      <Feather name="check" size={14} color="#fff" />
                    </View>
                  </View>
                ))}

                <ThemedText style={[styles.step1SectionHeading, { color: theme.text }]}>
                  Add more areas
                </ThemedText>
                <ThemedText style={[styles.subtext, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
                  These can be specific hobbies, personal projects, or any area of life you want to keep organized or improve. Add up to {step1RemainingSlots} more for now.
                </ThemedText>
                <View style={styles.chipRow}>
                  {ADDITIONAL_SUGGESTIONS.map((s) => {
                    const selected = step1AdditionalSelected.includes(s.name);
                    const disabled = step1AdditionalCount >= MAX_ADDITIONAL_AREAS && !selected;
                    return (
                      <Pressable
                        key={s.name}
                        onPress={() => !disabled && toggleStep1Suggestion(s.name)}
                        disabled={disabled}
                        style={[
                          styles.step1SuggestionChip,
                          {
                            backgroundColor: selected ? s.color : theme.backgroundSecondary,
                            borderColor: selected ? s.color : theme.border,
                            opacity: disabled ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Feather name={s.icon as any} size={16} color={selected ? "#fff" : s.color} />
                        <ThemedText
                          style={[
                            styles.step1SuggestionChipText,
                            { color: selected ? "#fff" : theme.text },
                          ]}
                        >
                          {s.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                {(step1AdditionalSelected.length > 0 || step1CustomAreas.length > 0) && (
                  <View style={styles.selectedRow}>
                    {step1AdditionalSelected.map((name) => {
                      const s = ADDITIONAL_SUGGESTIONS.find((x) => x.name === name);
                      const color = s?.color ?? theme.primary;
                      return (
                        <View key={name} style={[styles.selectedChip, { backgroundColor: color }]}>
                          <ThemedText style={styles.selectedChipText} numberOfLines={1}>{name}</ThemedText>
                          <Pressable onPress={() => removeStep1Additional(name)} hitSlop={8} style={styles.selectedChipRemove}>
                            <Feather name="x" size={14} color="#fff" />
                          </Pressable>
                        </View>
                      );
                    })}
                    {step1CustomAreas.map((c) => (
                      <View key={c.name} style={[styles.selectedChip, { backgroundColor: c.color }]}>
                        <ThemedText style={styles.selectedChipText} numberOfLines={1}>{c.name}</ThemedText>
                        <Pressable onPress={() => removeStep1Additional(c.name)} hitSlop={8} style={styles.selectedChipRemove}>
                          <Feather name="x" size={14} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <View
                  style={styles.customRow}
                  onLayout={(e) => registerScrollOffset("step1-custom", e.nativeEvent.layout.y)}
                >
                  <TextInput
                    style={[
                      styles.customInput,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="Add your own..."
                    placeholderTextColor={theme.textSecondary}
                    value={step1CustomInput}
                    onChangeText={(t) => setStep1CustomInput(t.slice(0, MAX_CUSTOM_NAME_LENGTH))}
                    onSubmitEditing={addStep1Custom}
                    returnKeyType="done"
                    editable={step1AdditionalCount < MAX_ADDITIONAL_AREAS}
                    onFocus={() => scrollToFocusedInput(0, "step1-custom")}
                  />
                  <Pressable
                    onPress={addStep1Custom}
                    disabled={step1AdditionalCount >= MAX_ADDITIONAL_AREAS}
                    style={[
                      styles.addCustomButton,
                      {
                        backgroundColor: step1AdditionalCount >= MAX_ADDITIONAL_AREAS ? theme.backgroundTertiary : theme.primary,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.addCustomButtonText, { color: theme.buttonText }]}>Add</ThemedText>
                  </Pressable>
                </View>
                {step1Error ? (
                  <View style={styles.step1ErrorWrap}>
                    <ThemedText style={[styles.step1ErrorText, { color: theme.error }]}>{step1Error}</ThemedText>
                    <Pressable onPress={() => setStep1Error(null)}>
                      <ThemedText style={[styles.step1RetryText, { color: theme.primary }]}>Dismiss</ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </View>

            {/* Step 2 — This Week */}
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <ScrollView
                ref={setStepScrollRef(1)}
                style={styles.slideScroll}
                contentContainerStyle={[styles.slideScrollContent, { paddingHorizontal: Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <ThemedText style={[styles.heading, { color: theme.text }]}>
                Is there anything you need to get done this week?
              </ThemedText>
              <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
                We'll add it as a task and pin it to your Master List so it's always front and center.
              </ThemedText>
              {step3Tasks.map((task, index) => (
                <View
                  key={index}
                  style={[styles.taskCard, { borderColor: theme.border }]}
                  onLayout={(e) => registerCardOffset(`task-${index}`, e.nativeEvent.layout.y)}
                >
                  <View style={styles.taskCardRow}>
                    <TextInput
                      style={[
                        styles.priorityInput,
                        { flex: 1, backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
                      ]}
                      placeholder="e.g. Call the insurance company, Submit the report..."
                      placeholderTextColor={theme.textSecondary}
                      value={task.title}
                      onChangeText={(v) => updateStep3Task(index, "title", v)}
                      onFocus={() => scrollToFocusedInput(1, `task-${index}`)}
                    />
                    <Pressable onPress={() => removeStep3Task(index)} hitSlop={8} style={styles.cardRemove}>
                      <Feather name="x" size={18} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                  <View style={[styles.autoTypeChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.autoTypeChipText, { color: theme.text }]}>
                      {ENTRY_TYPE_CHIP_LABELS[autoSelectEntryType(task.title)]}
                    </ThemedText>
                  </View>
                  <OnboardingLifeAreaSelector
                    categoryId={task.categoryId}
                    titleForAutoSelect={task.title}
                    createdCategories={createdCategories}
                    manualLifeAreaOverride={!!task.manualLifeAreaOverride}
                    dropdownKey={`task-${index}`}
                    openDropdownKey={lifeAreaDropdownKey}
                    onOpenDropdown={setLifeAreaDropdownKey}
                    onSelectCategory={(id) => setTaskLifeArea(index, id, true)}
                    onClearManualOverride={() => clearTaskLifeAreaOverride(index)}
                  />
                  {task.created && (
                    <View style={styles.inlineConfirm}>
                      <Feather name="check" size={14} color={theme.success} />
                      <ThemedText style={[styles.inlineConfirmText, { color: theme.success }]}>Pinned to your Master List</ThemedText>
                    </View>
                  )}
                </View>
              ))}
              {step3Tasks.length < 3 && (
                <Pressable onPress={addStep3Task} style={[styles.addAnotherButton, { borderColor: theme.border }]}>
                  <Feather name="plus" size={16} color={theme.primary} />
                  <ThemedText style={[styles.addAnotherText, { color: theme.primary }]}>Add another task</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>

            {/* Step 3 — Upcoming Events */}
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <ScrollView
                ref={setStepScrollRef(2)}
                style={styles.slideScroll}
                contentContainerStyle={[styles.slideScrollContent, { paddingHorizontal: Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <ThemedText style={[styles.heading, { color: theme.text }]}>
                Any important events or appointments coming up?
              </ThemedText>
              <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
                We'll add them to your calendar so nothing slips through the cracks.
              </ThemedText>
              {step4Events.map((ev, index) => (
                <View
                  key={index}
                  style={[styles.eventCard, { borderColor: theme.border }]}
                  onLayout={(e) => registerCardOffset(`event-${index}`, e.nativeEvent.layout.y)}
                >
                  <View style={styles.taskCardRow}>
                    <TextInput
                      style={[styles.priorityInput, { flex: 1, backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                      placeholder="e.g. Doctor's appointment, Team meeting, Flight to New York..."
                      placeholderTextColor={theme.textSecondary}
                      value={ev.title}
                      onChangeText={(v) => updateStep4Event(index, "title", v)}
                      onFocus={() => scrollToFocusedInput(2, `event-${index}`)}
                    />
                    <Pressable onPress={() => removeStep4Event(index)} hitSlop={8} style={styles.cardRemove}>
                      <Feather name="x" size={18} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => setStep4Picker({ index, mode: "date" })} style={[styles.dateTimeButton, { backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="calendar" size={16} color={theme.primary} />
                    <ThemedText style={[styles.dateTimeText, { color: theme.text }]}>{formatStepDate(ev.date)}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => setStep4Picker({ index, mode: "time" })} style={[styles.dateTimeButton, { backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="clock" size={16} color={theme.primary} />
                    <ThemedText style={[styles.dateTimeText, { color: theme.text }]}>{ev.time ? formatStepTime(ev.time) : "No time set"}</ThemedText>
                  </Pressable>
                  <View style={[styles.autoTypeChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.autoTypeChipText, { color: theme.text }]}>
                      {EVENT_TYPE_CHIP_LABELS[ev.eventType]}
                    </ThemedText>
                  </View>
                  <OnboardingLifeAreaSelector
                    categoryId={ev.categoryId}
                    titleForAutoSelect={ev.title}
                    createdCategories={createdCategories}
                    manualLifeAreaOverride={!!ev.manualLifeAreaOverride}
                    dropdownKey={`event-${index}`}
                    openDropdownKey={lifeAreaDropdownKey}
                    onOpenDropdown={setLifeAreaDropdownKey}
                    onSelectCategory={(id) => setEventLifeArea(index, id, true)}
                    onClearManualOverride={() => clearEventLifeAreaOverride(index)}
                  />
                  {ev.created && (
                    <View style={styles.inlineConfirm}>
                      <Feather name="check" size={14} color={theme.success} />
                      <ThemedText style={[styles.inlineConfirmText, { color: theme.success }]}>Added to your calendar on {formatStepDate(ev.date)}</ThemedText>
                    </View>
                  )}
                </View>
              ))}
              {step4Events.length < 5 && (
                <Pressable onPress={addStep4Event} style={[styles.addAnotherButton, { borderColor: theme.border }]}>
                  <Feather name="plus" size={16} color={theme.primary} />
                  <ThemedText style={[styles.addAnotherText, { color: theme.primary }]}>Add another event</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>

            {/* Step 4 — Future Goal */}
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <ScrollView
                ref={setStepScrollRef(3)}
                style={styles.slideScroll}
                contentContainerStyle={[styles.slideScrollContent, { paddingHorizontal: Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <ThemedText style={[styles.heading, { color: theme.text }]}>
                What goals do you want to achieve?
              </ThemedText>
              <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
                Something meaningful in the next 6-12 months. Your Life Coach will help you build a plan.
              </ThemedText>
              {step5Goals.map((goal, index) => (
                <View
                  key={index}
                  style={[styles.eventCard, { borderColor: theme.border }]}
                  onLayout={(e) => registerCardOffset(`goal-${index}`, e.nativeEvent.layout.y)}
                >
                  <View style={styles.taskCardRow}>
                    <TextInput
                      style={[styles.priorityInput, { flex: 1, backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                      placeholder="Goal title"
                      placeholderTextColor={theme.textSecondary}
                      value={goal.title}
                      onChangeText={(v) => updateStep5Goal(index, "title", v)}
                      onFocus={() => scrollToFocusedInput(3, `goal-${index}`)}
                    />
                    <Pressable onPress={() => removeStep5Goal(index)} hitSlop={8} style={styles.cardRemove}>
                      <Feather name="x" size={18} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                  <OnboardingLifeAreaSelector
                    categoryId={goal.categoryId}
                    titleForAutoSelect={goal.title}
                    createdCategories={createdCategories}
                    manualLifeAreaOverride={!!goal.manualLifeAreaOverride}
                    dropdownKey={`goal-${index}`}
                    openDropdownKey={lifeAreaDropdownKey}
                    onOpenDropdown={setLifeAreaDropdownKey}
                    onSelectCategory={(id) => setGoalLifeArea(index, id, true)}
                    onClearManualOverride={() => clearGoalLifeAreaOverride(index)}
                  />
                  <ThemedText style={[styles.stepLabel, { color: theme.textSecondary }]}>Goal details (optional)</ThemedText>
                  <View onLayout={(e) => registerInnerOffset(`goal-${index}-details`, e.nativeEvent.layout.y)}>
                    <TextInput
                      style={[styles.priorityInput, styles.optionalInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                      placeholder="Add any details, context, or notes about this goal..."
                      placeholderTextColor={theme.textSecondary}
                      value={goal.details}
                      onChangeText={(v) => updateStep5Goal(index, "details", v)}
                      onFocus={() => scrollToFocusedInput(3, `goal-${index}-details`)}
                      multiline
                    />
                  </View>
                </View>
              ))}
              {step5Goals.length < 3 && (
                <Pressable onPress={addStep5Goal} style={[styles.addAnotherButton, { borderColor: theme.border }]}>
                  <Feather name="plus" size={16} color={theme.primary} />
                  <ThemedText style={[styles.addAnotherText, { color: theme.primary }]}>Add another goal</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>

            {/* Step 5 — Habits */}
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <ScrollView
                ref={setStepScrollRef(4)}
                style={styles.slideScroll}
                contentContainerStyle={[styles.slideScrollContent, { paddingHorizontal: Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <ThemedText style={[styles.heading, { color: theme.text }]}>
                Any habits you want to build or break?
              </ThemedText>
              <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
                Your Habit Tracker helps you stay consistent.
              </ThemedText>
              {step6Habits.map((habit, index) => (
                <View
                  key={index}
                  style={[styles.eventCard, { borderColor: theme.border }]}
                  onLayout={(e) => registerCardOffset(`habit-${index}`, e.nativeEvent.layout.y)}
                >
                  <View style={styles.taskCardRow}>
                    <TextInput
                      style={[styles.priorityInput, { flex: 1, backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                      placeholder="Habit name"
                      placeholderTextColor={theme.textSecondary}
                      value={habit.name}
                      onChangeText={(v) => updateStep6Habit(index, "name", v)}
                      onFocus={() => scrollToFocusedInput(4, `habit-${index}`)}
                    />
                    <Pressable onPress={() => removeStep6Habit(index)} hitSlop={8} style={styles.cardRemove}>
                      <Feather name="x" size={18} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                  <OnboardingLifeAreaSelector
                    categoryId={habit.categoryId}
                    titleForAutoSelect={habit.name}
                    createdCategories={createdCategories}
                    manualLifeAreaOverride={!!habit.manualLifeAreaOverride}
                    dropdownKey={`habit-${index}`}
                    openDropdownKey={lifeAreaDropdownKey}
                    onOpenDropdown={setLifeAreaDropdownKey}
                    onSelectCategory={(id) => setHabitLifeArea(index, id, true)}
                    onClearManualOverride={() => clearHabitLifeAreaOverride(index)}
                  />
                  <View style={styles.typeRow}>
                    <Pressable
                      onPress={() => updateStep6Habit(index, "habitType", "positive")}
                      style={[styles.typePill, { backgroundColor: habit.habitType === "positive" ? theme.success : theme.backgroundSecondary, borderColor: theme.border }]}
                    >
                      <ThemedText style={[styles.typePillText, { color: habit.habitType === "positive" ? "#fff" : theme.text }]}>Build</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => updateStep6Habit(index, "habitType", "negative")}
                      style={[styles.typePill, { backgroundColor: habit.habitType === "negative" ? theme.error : theme.backgroundSecondary, borderColor: theme.border }]}
                    >
                      <ThemedText style={[styles.typePillText, { color: habit.habitType === "negative" ? "#fff" : theme.text }]}>Break</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.typeRow}>
                    {(["daily", "weekly", "monthly"] as const).map((f) => {
                      const selected = habit.goalFrequency === f;
                      return (
                        <Pressable
                          key={f}
                          onPress={() => updateStep6Habit(index, "goalFrequency", f)}
                          style={[styles.typePill, { backgroundColor: selected ? theme.primary : theme.backgroundSecondary, borderColor: theme.border }]}
                        >
                          <ThemedText style={[styles.typePillText, { color: selected ? theme.buttonText : theme.text }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <ThemedText style={[styles.stepLabel, { color: theme.textSecondary }]}>Goal count</ThemedText>
                  <View onLayout={(e) => registerInnerOffset(`habit-${index}-count`, e.nativeEvent.layout.y)}>
                    <TextInput
                      style={[styles.priorityInput, styles.goalCountInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text }]}
                      placeholder="1"
                      placeholderTextColor={theme.textSecondary}
                      value={habit.goalCount > 0 ? String(habit.goalCount) : ""}
                      onChangeText={(v) => {
                        const trimmed = v.replace(/\D/g, "");
                        const n = trimmed === "" ? 0 : parseInt(trimmed, 10);
                        updateStep6Habit(index, "goalCount", Number.isNaN(n) ? 1 : Math.max(0, n));
                      }}
                      keyboardType="number-pad"
                      onFocus={() => scrollToFocusedInput(4, `habit-${index}-count`)}
                    />
                  </View>
                </View>
              ))}
              {step6Habits.length < 5 && (
                <Pressable onPress={addStep6Habit} style={[styles.addAnotherButton, { borderColor: theme.border }]}>
                  <Feather name="plus" size={16} color={theme.primary} />
                  <ThemedText style={[styles.addAnotherText, { color: theme.primary }]}>Add another habit</ThemedText>
                </Pressable>
              )}
            </ScrollView>
          </View>

            {/* Step 6 — Completion */}
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <ScrollView
                ref={setStepScrollRef(5)}
                style={styles.slideScroll}
                contentContainerStyle={[styles.slideScrollContent, styles.completionContent, { paddingHorizontal: Spacing.xl }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <ThemedText style={[styles.heading, { color: theme.text }]}>You're ready to get started.</ThemedText>
                <View style={styles.completionSummary}>
                  <ThemedText style={[styles.completionSummaryLine, { color: theme.textSecondary }]}>
                    ✓ {createdCategories.length} Life Areas
                  </ThemedText>
                  <ThemedText style={[styles.completionSummaryLine, { color: theme.textSecondary }]}>
                    ✓ {step3Tasks.filter((t) => t.title.trim()).length} tasks pinned
                  </ThemedText>
                  <ThemedText style={[styles.completionSummaryLine, { color: theme.textSecondary }]}>
                    ✓ {step4Events.filter((e) => e.title.trim()).length} events added
                  </ThemedText>
                  <ThemedText style={[styles.completionSummaryLine, { color: theme.textSecondary }]}>
                    ✓ {step5Goals.filter((g) => g.title.trim()).length} goals set
                  </ThemedText>
                  <ThemedText style={[styles.completionSummaryLine, { color: theme.textSecondary }]}>
                    ✓ {step6Habits.filter((h) => h.name.trim()).length} habits added
                  </ThemedText>
                </View>
                <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
                  You now have some life areas added to your life wheel and some initial entries in place. Now let's show you around.
                </ThemedText>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
          },
        ]}
      >
        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: canContinue && !step1Loading ? theme.primary : theme.backgroundTertiary,
            },
          ]}
          onPress={handleContinue}
          disabled={!canContinue || step1Loading}
        >
          <ThemedText style={[styles.primaryButtonText, { color: theme.buttonText }]}>
            {currentStep === 1 && step1Loading ? "Creating…" : currentStep === 6 ? "Let's Go →" : "Continue →"}
          </ThemedText>
        </Pressable>
        {currentStep !== 6 && (
          <Pressable style={styles.skipStepButton} onPress={handleSkipStep}>
            <ThemedText style={[styles.skipStepText, { color: theme.textSecondary }]}>
              Skip this step
            </ThemedText>
          </Pressable>
        )}
      </View>

      <AppDatePicker
        visible={step4Picker?.mode === "date"}
        value={
          step4Picker != null
            ? toYYYYMMDD(step4Events[step4Picker.index]?.date ?? new Date())
            : toYYYYMMDD(new Date())
        }
        title="Event date"
        onConfirm={(dateStr) => {
          const index = step4Picker?.index;
          if (index == null) {
            setStep4Picker(null);
            return;
          }
          const [y, m, d] = dateStr.split("-").map(Number);
          updateStep4Event(index, "date", new Date(y, m - 1, d));
          setStep4Picker(null);
        }}
        onCancel={() => setStep4Picker(null)}
      />
      <AppTimePicker
        visible={step4Picker?.mode === "time"}
        value={
          step4Picker != null
            ? step4Events[step4Picker.index]?.time
              ? toHHMM(step4Events[step4Picker.index].time!)
              : "09:00"
            : "09:00"
        }
        title="Event time"
        onConfirm={(timeStr) => {
          const index = step4Picker?.index;
          if (index == null) {
            setStep4Picker(null);
            return;
          }
          const ev = step4Events[index];
          const [h, min] = timeStr.split(":").map(Number);
          const merged = new Date(
            ev.date.getFullYear(),
            ev.date.getMonth(),
            ev.date.getDate(),
            h,
            min,
          );
          updateStep4Event(index, "time", merged);
          setStep4Picker(null);
        }}
        onCancel={() => setStep4Picker(null)}
      />
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
  header: {
    paddingBottom: Spacing.md,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  stepCounter: {
    ...Typography.caption,
  },
  skipOnboardingButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  skipOnboardingText: {
    ...Typography.small,
  },
  sliderContainer: {
    flex: 1,
    overflow: "hidden",
  },
  slider: {
    flex: 1,
    flexDirection: "row",
  },
  slide: {
    flex: 1,
  },
  slideContent: {
    paddingHorizontal: 0,
  },
  slideScroll: {
    flex: 1,
  },
  slideScrollContent: {
    paddingBottom: Spacing.xl,
  },
  heading: {
    ...Typography.h1,
    marginBottom: Spacing.md,
  },
  subtext: {
    ...Typography.body,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  keyboardAvoidWrap: {
    flex: 1,
  },
  wheelPreviewWrap: {
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  wheelPreviewOuter: {
    position: "relative",
    alignSelf: "center",
  },
  wheelPreviewDashedRing: {
    position: "absolute",
    left: 0,
    top: 0,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  wheelPreviewInnerRing: {
    position: "absolute",
    borderWidth: 1,
    opacity: 0.6,
  },
  wheelSpoke: {
    position: "absolute",
  },
  wheelCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  wheelNode: {
    position: "absolute",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  wheelNodeLabel: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 1,
    maxWidth: "100%",
  },
  step1DefaultCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 6,
  },
  step1DefaultCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  step1DefaultCardBody: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  step1DefaultCardName: {
    ...Typography.body,
    fontWeight: "700",
    marginBottom: 2,
  },
  step1DefaultCardDesc: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
  },
  step1DefaultCardCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
    marginTop: 8,
  },
  step1SectionHeading: {
    ...Typography.h2,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  step1SuggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  step1SuggestionChipText: {
    ...Typography.caption,
  },
  step1ErrorWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  step1ErrorText: {
    ...Typography.caption,
    flex: 1,
  },
  step1RetryText: {
    ...Typography.caption,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  presetChipText: {
    ...Typography.caption,
  },
  customRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  customInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  addCustomButton: {
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  addCustomButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  selectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    maxWidth: "100%",
  },
  selectedChipText: {
    ...Typography.caption,
    color: "#fff",
    maxWidth: 120,
  },
  selectedChipRemove: {
    padding: Spacing.xs,
  },
  priorityInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  stepLabel: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  lifeAreaScroll: {
    marginBottom: Spacing.lg,
  },
  lifeAreaScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  lifeAreaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  lifeAreaChipText: {
    ...Typography.caption,
    maxWidth: 100,
  },
  lifeAreaSelectorWrap: {
    alignSelf: "flex-start",
    marginBottom: Spacing.md,
    zIndex: 10,
  },
  autoLifeAreaChipPressable: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  autoLifeAreaChip: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  autoLifeAreaChipText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "600",
  },
  lifeAreaChipChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: Spacing.xs,
  },
  lifeAreaChipChangeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: "rgba(255,255,255,0.85)",
    textTransform: "lowercase",
  },
  lifeAreaManualHint: {
    ...Typography.caption,
    fontSize: 10,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  lifeAreaDropdown: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    minWidth: 200,
    maxWidth: "100%",
  },
  lifeAreaDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  lifeAreaDropdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lifeAreaDropdownItemText: {
    ...Typography.caption,
    flex: 1,
  },
  autoTypeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  autoTypeChipText: {
    ...Typography.caption,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typePill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  typePillText: {
    ...Typography.body,
    fontWeight: "500",
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  taskCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardRemove: {
    padding: Spacing.xs,
  },
  inlineConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  inlineConfirmText: {
    ...Typography.caption,
  },
  addAnotherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  addAnotherText: {
    ...Typography.body,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  dateTimeText: {
    ...Typography.body,
  },
  optionalInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  goalCountInput: {
    maxWidth: 80,
  },
  completionContent: {
    justifyContent: "center",
  },
  completionSummary: {
    marginBottom: Spacing.xl,
  },
  completionSummaryLine: {
    ...Typography.body,
    marginBottom: Spacing.xs,
  },
  footer: {
    gap: Spacing.md,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  skipStepButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipStepText: {
    ...Typography.link,
  },
});
