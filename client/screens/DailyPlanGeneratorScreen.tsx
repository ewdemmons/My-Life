import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AppTimePicker from "@/components/AppTimePicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { PlanGeneratorProgress, PlanGeneratorPhase } from "@/components/agenda/PlanGeneratorProgress";
import { DailyPlanPreviewCard } from "@/components/agenda/DailyPlanPreviewCard";
import { useApp } from "@/context/AppContext";
import { buildSchedulePreferences } from "@/utils/schedulePreferences";
import { buildAppContext } from "@/utils/appContextBuilder";
import { sendToAI } from "@/lib/aiService";
import { getRegularSystemPrompt } from "@/lib/systemPrompts";
import {
  DailyPlanMeta,
  parseDailyPlanFromResponse,
  stripJsonFromResponse,
  savePlan,
  addMinutesToTime,
  getActivePlanDates,
} from "@/utils/planUtils";
import { formatLocalDateYYYYMMDD, getLocalTodayDate } from "@/utils/masterListUtils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { CalendarEvent, Habit, LifeAreaSchedule, LifeCategory, Task } from "@/types";

const PLAN_GRADIENT_START = "#6B7FFF";
const PLAN_GRADIENT_END = "#8B6FFF";
const APPLY_GRADIENT_START = "#10B981";
const APPLY_GRADIENT_END = "#059669";
const ENERGY_ACTIVE_BG = "#6B7FFF22";
const ENERGY_ACTIVE_BORDER = "#6B7FFF";
const ENERGY_ACTIVE_TEXT = "#6B7FFF";

type EnergyLevel = "low" | "medium" | "high";
type ApplySubPhase = "applying" | "complete";
type TimePickerTarget = "start" | "end" | null;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface LifeAreaTimeBlock {
  startTime: string;
  endTime: string;
}

interface LifeAreaPlanWindow {
  categoryId: string;
  categoryName: string;
  color: string;
  included: boolean;
  blocks: LifeAreaTimeBlock[];
  hasPreference: boolean;
}

interface FormState {
  selectedDate: string;
  startTime: string;
  endTime: string;
  includePinned: boolean;
  includeEvents: boolean;
  includeHabits: boolean;
  includeSuggested: boolean;
  includeCoachPicks: boolean;
  energyLevel: EnergyLevel;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function buildDateOptions(count: number): Date[] {
  const today = getLocalTodayDate();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getFirstAvailableDateInWindow(
  existingPlanDates: string[],
  count = 7,
): string {
  const today = getLocalTodayDate();
  const todayStr = formatLocalDateYYYYMMDD(today);
  const options = buildDateOptions(count).map((d) => formatLocalDateYYYYMMDD(d));
  return options.find((d) => !existingPlanDates.includes(d)) ?? todayStr;
}

function formatSelectedDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function normalizeLifeAreaColor(color: string): string {
  return color.startsWith("#") ? color : `#${color}`;
}

function formatHhmm12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const mins = String(m ?? 0).padStart(2, "0");
  return `${hour12}:${mins} ${period}`;
}

function formatBlocksDisplay(blocks: LifeAreaTimeBlock[]): string {
  return blocks
    .map((b) => `${formatHhmm12(b.startTime)} – ${formatHhmm12(b.endTime)}`)
    .join(", ");
}

function hhmmToDate(hhmm: string): Date {
  const [hoursStr, minutesStr] = hhmm.split(":");
  const d = new Date();
  d.setHours(parseInt(hoursStr, 10), parseInt(minutesStr, 10), 0, 0);
  return d;
}

function dateToHhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildLifeAreaWindows(
  categories: LifeCategory[],
  lifeAreaSchedules: LifeAreaSchedule[],
  selectedDate: string,
): LifeAreaPlanWindow[] {
  const dayOfWeek = new Date(`${selectedDate}T12:00:00`).getDay();

  return categories.map((cat) => {
    const matching = lifeAreaSchedules.filter(
      (s) =>
        s.categoryId === cat.id &&
        s.isActive &&
        s.daysOfWeek.includes(dayOfWeek),
    );
    const blocks: LifeAreaTimeBlock[] = matching.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      color: cat.color,
      included: true,
      blocks,
      hasPreference: blocks.length > 0,
    };
  });
}

function buildPlanRequestMessage(
  form: FormState,
  formattedDate: string,
  selectedDate: string,
  lifeAreaNames: string,
  events: CalendarEvent[],
  categories: LifeCategory[],
  tasks: Task[],
  pinnedTasks: Task[],
  habits: Habit[],
  lifeAreaWindows: LifeAreaPlanWindow[],
): string {
  const selectedDayEvents = events.filter((e) => e.startDate === selectedDate);

  const blockedRanges = selectedDayEvents
    .filter((e) => e.eventType === "appointment" || e.eventType === "meeting")
    .map((e) => {
      const startParts = e.startTime.split(":");
      const endParts = (e.endTime || "23:59").split(":");
      const startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
      const endMins = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
      const duration = endMins - startMins;
      return {
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        startMins,
        endMins,
        duration,
      };
    });

  const blockedSummary =
    blockedRanges.length > 0
      ? blockedRanges
          .map(
            (r) =>
              `  • "${r.title}": ${r.startTime} → ${r.endTime} (${r.duration} min) — FULLY OCCUPIED, nothing else allowed`,
          )
          .join("\n")
      : "  • None";

  const excludedAreas = lifeAreaWindows
    .filter((w) => !w.included)
    .map((w) => `  • ${w.categoryName}`)
    .join("\n");

  const confirmedWindowLines = lifeAreaWindows
    .filter((w) => w.included && w.blocks.length > 0)
    .flatMap((w) =>
      w.blocks.map(
        (b) => `  • ${w.categoryName}: ${b.startTime}–${b.endTime}`,
      ),
    )
    .join("\n");

  const noWindowAreas = lifeAreaWindows
    .filter((w) => w.included && w.blocks.length === 0)
    .map((w) => `  • ${w.categoryName}`)
    .join("\n");

  const planStartTime = form.startTime;
  const planEndTime = form.endTime;

  const eventDetails = selectedDayEvents
    .map((e) => {
      const category = categories.find((c) => c.id === e.categoryId);
      const lifeAreaName = category?.name ?? "Unassigned";

      if (e.eventType === "appointment" || e.eventType === "meeting") {
        const startParts = e.startTime.split(":");
        const endParts = (e.endTime || "23:59").split(":");
        const startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
        const endMins = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
        const duration = endMins - startMins;

        return `- "${e.title}" | Life Area: ${lifeAreaName} | Type: ${e.eventType} | Start: ${e.startTime} | End: ${e.endTime} | Duration: ${duration} minutes | OCCUPIED: ${e.startTime}–${e.endTime}`;
      }
      return `- ${e.title} | Life Area: ${lifeAreaName} | Type: ${e.eventType} | Time: ${e.startTime} | This is a reminder at ${e.startTime} with no time block — schedule it as a brief 5-10 min item`;
    })
    .join("\n");

  const pinnedEntryDetails = pinnedTasks
    .filter((t) => t.isPinned !== false && t.status !== "completed")
    .map((t) => {
      const category = categories.find((c) => c.id === t.categoryId);
      return `- "${t.title}" | Life Area: ${category?.name ?? "Unassigned"} | Type: ${t.type} | Priority: ${t.priority}`;
    })
    .join("\n");

  const habitDetails = habits
    .filter((h) => h.isActive && h.habitType !== "negative")
    .map((h) => {
      const category = categories.find((c) => c.id === h.categoryId);
      return `- "${h.name}" | Life Area: ${category?.name ?? "Unassigned"} | Type: Build Habit | Frequency: ${h.goalFrequency}`;
    })
    .join("\n");

  const suggestedTasksDetails = tasks
    .filter((t) => !t.isPinned && t.type === "task" && t.status !== "completed")
    .slice(0, 10)
    .map((t) => {
      const category = categories.find((c) => c.id === t.categoryId);
      return `- "${t.title}" | Life Area: ${category?.name ?? "Unassigned"} | Priority: ${t.priority}`;
    })
    .join("\n");

  return `
Please generate a daily plan for ${formattedDate}.

Parameters:
- Time window: ${form.startTime} to ${form.endTime}
- Include pinned entries: ${form.includePinned}
- Include scheduled events: ${form.includeEvents}
- Include scheduled habits: ${form.includeHabits}
- Include suggested tasks: ${form.includeSuggested}
- Include Life Coach picks: ${form.includeCoachPicks}
- Energy level: ${form.energyLevel}

SCHEDULED EVENTS FOR ${formattedDate}:
${eventDetails.length > 0 ? eventDetails : "No events scheduled for this day."}

OCCUPIED TIME BLOCKS — nothing may be
scheduled during these times:
${blockedSummary}

AUTHORITATIVE LIFE AREA WINDOWS FOR THIS PLAN
(these override any schedule preferences elsewhere
in context — use only this section for Life Area timing):

EXCLUDED LIFE AREAS (do not include any
items from these Life Areas in the plan):
${excludedAreas || "  • None — all Life Areas included"}

CONFIRMED TIME WINDOWS (schedule each Life
Area's items within these time ranges, 24h):
${confirmedWindowLines || "  • None set"}

LIFE AREAS WITH NO TIME PREFERENCE
(schedule in any available free gap):
${noWindowAreas || "  • None"}

SUGGESTED TASKS (unpinned, for Step 6 only):
${suggestedTasksDetails || "None available"}

NOTE: These are the ONLY entries available for AI suggestions. Only Task-type entries are included here intentionally. Do not suggest any other entry types directly.

DAILY PLAN BUILDING ALGORITHM:
Build the plan by following these 7 steps
in exact order. Complete each step fully
before moving to the next.

STEP 1 — PLACE APPOINTMENTS AND MEETINGS:
Add every Appointment and Meeting from
SCHEDULED EVENTS to the plan exactly as
listed. Use exact startTime. Calculate
durationMinutes from the exact difference
between startTime and endTime. These are
IMMOVABLE. Their entire time range is
occupied — mark it so in your mental model.

STEP 2 — MARK FREE TIME AND CONFIRMED ZONES:
Identify every free time gap between ${planStartTime}
and ${planEndTime} not occupied by Step 1 items.

For items belonging to Life Areas with
CONFIRMED TIME WINDOWS above, only place
them in free gaps that fall within their
confirmed window. This is a hard constraint
not a suggestion — if no free gap exists
within their window place the item at the
nearest available time outside the window
rather than skipping it entirely.

For items belonging to Life Areas with no
time preference, place in any free gap.

Never place items belonging to EXCLUDED
LIFE AREAS in the plan at any point in
Steps 3-6.

STEP 3 — PLACE REMINDERS AND DEADLINES:
Add Reminders and Deadlines from SCHEDULED
EVENTS at their scheduled time. These are
5-10 minutes only and do not block
surrounding time. If their scheduled time
falls inside an Appointment or Meeting
block, move them to the nearest free slot.

STEP 4 — PLACE PINNED ENTRIES:
Add all items from PINNED ENTRIES to the
plan. These are the user's declared
priorities and must be included regardless
of their entry type (Task, Goal, Project,
Objective, Idea, etc.).

Place in free gaps from Step 2 respecting
Life Area preferred windows. Order by
priority: high → medium → low.


STEP 5 — PLACE PINNED HABITS:
Add active Build Habits from ACTIVE BUILD
HABITS. Place in free gaps respecting Life
Area preferred windows. Never include
Break (negative) habits.

STEP 6 — ADD AI SUGGESTIONS (only if
user requested suggested tasks or Life
Coach picks):
Fill remaining free gaps with additional
items. Apply these rules strictly:

RULE A — Only use items from SUGGESTED TASKS:
In Step 6 you may ONLY add items that
appear in the SUGGESTED TASKS section above.
Do not invent new tasks. Do not add any
entry from memory or training data.
Do not add entries of any type other than
Task from the user's data.
The only exception is planning sessions
for Goals/Projects/Objectives/Ideas (Rule B)
which are coach-generated items, not pulled
from the entry list.

RULE B — Planning sessions for complex
entry types:
For entries of type Goal, Project,
Objective, or Idea that are NOT already
pinned, suggest a planning session:
  title: "Planning session: [entry title]"
  type: "suggestion"
  lifeArea: [same Life Area as the entry]
  source: "coach"
  durationMinutes: 30
Limit to maximum 2 planning sessions
per plan total (including any from Step 4).

RULE C — No Break Habits:
Never suggest or add Break (negative)
habits to the plan under any circumstances.
Build Habits only.

STEP 7 — FINAL VERIFICATION:
Before outputting the JSON, check:
- Every Appointment and Meeting from Step 1
  is in the plan with correct startTime
  and full durationMinutes
- NO item from Steps 3-6 has a startTime
  that falls between the startTime and
  endTime of any Appointment or Meeting
- If any conflict exists remove the
  conflicting item
- Plan flows chronologically with no
  overlapping time slots
- All lifeArea values exactly match the
  user's actual Life Area names

Only output the JSON block after completing
all 7 steps. Keep your conversational
response to 2-3 sentences maximum before
the JSON block.

PINNED ENTRIES (use EXACTLY these Life Areas):
${pinnedEntryDetails || "None"}

ACTIVE BUILD HABITS (use EXACTLY these Life Areas):
${habitDetails || "None"}

CRITICAL: The lifeArea field in every timeBlock JSON entry MUST exactly match the Life Area shown above for that item. Do not reassign items to different Life Areas. Do not invent Life Area assignments.

HABIT RULES:
- Only include Build Habits in the daily plan
- Never suggest, add, or reference Break Habits (negative habits) in the plan
- Break Habits are personal behavior goals and do not belong in a daily schedule

Please generate a structured daily plan and include the dailyPlan JSON block in your response.
IMPORTANT: You MUST include the dailyPlan JSON block in your response wrapped in triple backticks with json tag. The JSON must start with {"dailyPlan": {"date": and include timeBlocks array. This is required for the plan to be saved to the app.
Keep your conversational response brief (2-3 sentences max) before the JSON block. The JSON block is the most important part of your response.
CRITICAL: When assigning lifeArea values in the JSON timeBlocks, you MUST use ONLY these exact Life Area names from the user's account: ${lifeAreaNames}. Do not use any other Life Area names. If an item doesn't clearly belong to one of these areas, use the closest match from this list.
`.trim();
}

export default function DailyPlanGeneratorScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DailyPlanGenerator">>();

  const {
    categories,
    tasks,
    habits,
    events,
    people,
    occurrences,
    pinnedTasks,
    lifeAreaSchedules,
    addEvent,
  } = useApp();

  const schedulePreferences = useMemo(
    () => buildSchedulePreferences(lifeAreaSchedules, categories),
    [lifeAreaSchedules, categories],
  );

  const todayStr = formatLocalDateYYYYMMDD(getLocalTodayDate());
  const dateOptions = useMemo(() => buildDateOptions(7), []);

  const [existingPlanDates, setExistingPlanDates] = useState<string[]>([]);
  const [phase, setPhase] = useState<PlanGeneratorPhase>("form");
  const [applySubPhase, setApplySubPhase] = useState<ApplySubPhase>("applying");
  const [form, setForm] = useState<FormState>({
    selectedDate: route.params?.initialDate ?? todayStr,
    startTime: "07:00",
    endTime: "21:00",
    includePinned: true,
    includeEvents: true,
    includeHabits: true,
    includeSuggested: true,
    includeCoachPicks: true,
    energyLevel: "medium",
  });
  const [lifeAreaWindows, setLifeAreaWindows] = useState<LifeAreaPlanWindow[]>([]);
  const [editingLifeAreaId, setEditingLifeAreaId] = useState<string | null>(null);
  const [lifeAreaEditDraft, setLifeAreaEditDraft] = useState<LifeAreaTimeBlock[] | null>(null);
  const [lifeAreaPickerTarget, setLifeAreaPickerTarget] = useState<{
    blockIndex: number;
    field: "start" | "end";
  } | null>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<TimePickerTarget>(null);
  const [timeWindowError, setTimeWindowError] = useState(false);
  const [draftPlan, setDraftPlan] = useState<DailyPlanMeta | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [eventsCreatedCount, setEventsCreatedCount] = useState(0);
  const checkScale = useRef(new Animated.Value(0)).current;
  const hasStartedChat = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const hasManualLifeAreaEditsRef = useRef(false);
  const lastLifeAreaBuildDateRef = useRef<string | null>(null);
  const lifeAreaWindowsRef = useRef<LifeAreaPlanWindow[]>([]);

  useEffect(() => {
    const loadHours = async () => {
      try {
        const [storedStart, storedEnd] = await Promise.all([
          AsyncStorage.getItem("@calendar_hours_start"),
          AsyncStorage.getItem("@calendar_hours_end"),
        ]);
        const start = Number.parseInt(storedStart ?? "7", 10);
        const end = Number.parseInt(storedEnd ?? "21", 10);
        const safeStart = Number.isFinite(start) ? Math.min(23, Math.max(0, start)) : 7;
        let safeEnd = Number.isFinite(end) ? Math.min(23, Math.max(0, end)) : 21;
        if (safeEnd <= safeStart) safeEnd = Math.min(23, safeStart + 1);
        setForm((prev) => ({
          ...prev,
          startTime: `${String(safeStart).padStart(2, "0")}:00`,
          endTime: `${String(safeEnd).padStart(2, "0")}:00`,
        }));
      } catch {
        // keep defaults
      }
    };
    loadHours();
  }, []);

  useEffect(() => {
    const loadExistingPlans = async () => {
      const dates = await getActivePlanDates();
      setExistingPlanDates(dates);
      if (route.params?.initialDate) return;
      const defaultDate = getFirstAvailableDateInWindow(dates);
      setForm((prev) => ({ ...prev, selectedDate: defaultDate }));
    };
    loadExistingPlans();
  }, [route.params?.initialDate]);

  useEffect(() => {
    const dateChanged = lastLifeAreaBuildDateRef.current !== form.selectedDate;
    if (dateChanged) {
      hasManualLifeAreaEditsRef.current = false;
      lastLifeAreaBuildDateRef.current = form.selectedDate;
    }

    if (hasManualLifeAreaEditsRef.current) return;

    setLifeAreaWindows(buildLifeAreaWindows(categories, lifeAreaSchedules, form.selectedDate));
    if (dateChanged) {
      setEditingLifeAreaId(null);
      setLifeAreaEditDraft(null);
      setLifeAreaPickerTarget(null);
    }
  }, [form.selectedDate, categories, lifeAreaSchedules]);

  useEffect(() => {
    lifeAreaWindowsRef.current = lifeAreaWindows;
  }, [lifeAreaWindows]);

  const pinnedCount = useMemo(
    () => pinnedTasks.filter((t) => t.status !== "completed").length,
    [pinnedTasks],
  );

  const eventsOnDateCount = useMemo(
    () => events.filter((e) => e.startDate === form.selectedDate).length,
    [events, form.selectedDate],
  );

  const activeHabitsCount = useMemo(
    () => habits.filter((h) => h.isActive).length,
    [habits],
  );

  const weekdayName = useMemo(() => {
    const [y, m, d] = form.selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
  }, [form.selectedDate]);

  const lifeAreaNames = useMemo(
    () => categories.map((c) => c.name).join(", "),
    [categories],
  );

  const appContext = useMemo(
    () =>
      buildAppContext({
        categories,
        tasks,
        habits,
        events,
        people,
        occurrences,
        schedulePreferences,
        forDailyPlan: true,
      }),
    [categories, tasks, habits, events, people, occurrences, schedulePreferences],
  );

  const callAI = useCallback(
    async (message: string, history: Array<{ role: string; content: string }>) => {
      setIsLoading(true);
      setAiError(null);
      try {
        const response = await sendToAI({
          message,
          context: appContext,
          history,
          systemPrompt: getRegularSystemPrompt(appContext),
          maxTokens: 4096,
        });
        const plan = parseDailyPlanFromResponse(response);
        console.log("Raw response length:", response.length);
        console.log("Contains json block:", response.includes("```json"));
        console.log("Parse result:", plan);
        const displayText = stripJsonFromResponse(response) || response;
        return { response, plan, displayText };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Something went wrong";
        setAiError(msg);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [appContext],
  );

  const startInitialGeneration = useCallback(async () => {
    const formattedDate = formatSelectedDateLong(form.selectedDate);
    const windowsForPlan = lifeAreaWindowsRef.current;
    const planRequestMessage = buildPlanRequestMessage(
      form,
      formattedDate,
      form.selectedDate,
      lifeAreaNames,
      events,
      categories,
      tasks,
      pinnedTasks,
      habits,
      windowsForPlan,
    );

    setChatMessages([
      { id: "user-init", role: "user", content: "Generate my daily plan" },
    ]);

    try {
      const { response, plan, displayText } = await callAI(planRequestMessage, []);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: displayText,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setChatHistory([
        { role: "user", content: planRequestMessage },
        { role: "assistant", content: response },
      ]);
      if (plan) {
        setDraftPlan({ ...plan, date: form.selectedDate });
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I couldn't generate your plan. Please try again.",
        },
      ]);
    }
  }, [form, lifeAreaNames, events, categories, tasks, pinnedTasks, habits, lifeAreaWindows, callAI]);

  useEffect(() => {
    if (phase === "chat" && !hasStartedChat.current) {
      hasStartedChat.current = true;
      startInitialGeneration();
    }
  }, [phase, startInitialGeneration]);

  const handleSendFollowUp = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");

    try {
      const { response, plan, displayText } = await callAI(text, chatHistory);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: displayText,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setChatHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: response },
      ]);
      if (plan) {
        setDraftPlan({ ...plan, date: form.selectedDate });
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    }
  }, [inputText, isLoading, callAI, chatHistory, form.selectedDate]);

  const handleRetry = useCallback(() => {
    setChatMessages([]);
    setChatHistory([]);
    hasStartedChat.current = false;
    setAiError(null);
    hasStartedChat.current = true;
    startInitialGeneration();
  }, [startInitialGeneration]);

  const handleApplyPlan = useCallback(async () => {
    if (!draftPlan) return;
    const selectedDate = form.selectedDate;

    if (existingPlanDates.includes(selectedDate)) {
      Alert.alert(
        "Plan Already Exists",
        "You already have a plan for this date. Go back to Phase 1 to select a different date, or return to your dashboard and regenerate the existing plan.",
        [{ text: "OK" }],
      );
      return;
    }

    setPhase("approved");
    setApplySubPhase("applying");
    checkScale.setValue(0);

    Animated.spring(checkScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

    const planToSave: DailyPlanMeta = {
      ...draftPlan,
      approved: true,
      date: selectedDate,
      itemCount: draftPlan.timeBlocks.length,
      completedCount: 0,
      timeBlocks: draftPlan.timeBlocks.map((b) => ({ ...b, completed: false })),
    };

    try {
      await savePlan(planToSave);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("3-plan limit")) {
        Alert.alert(
          "Plan limit reached",
          "You already have 3 active plans. Please remove one before creating a new plan.",
          [{ text: "OK" }],
        );
        return;
      }
      throw error;
    }

    let created = 0;
    for (const block of planToSave.timeBlocks) {
      if ((block.source === "suggested" || block.source === "coach") && block.id === null) {
        const categoryId =
          categories.find((c) => c.name === block.lifeArea)?.id ??
          categories[0]?.id ??
          null;
        await addEvent({
          title: block.title,
          description: "",
          startDate: planToSave.date,
          startTime: block.time,
          endDate: planToSave.date,
          endTime: addMinutesToTime(block.time, block.durationMinutes || 30),
          eventType: "appointment",
          recurrence: "none",
          linkedTaskId: null,
          categoryId,
        });
        created += 1;
      }
    }

    setEventsCreatedCount(created);
    setApplySubPhase("complete");
  }, [draftPlan, form.selectedDate, existingPlanDates, categories, addEvent, checkScale]);

  const handleLetsGo = useCallback(() => {
    navigation.navigate("Main", {
      screen: "HomeTab",
      params: { scrollToAgenda: true, refreshTimestamp: Date.now() },
    });
  }, [navigation]);

  const handleFormStartTimeConfirm = (timeStr: string) => {
    setForm((prev) => {
      const next = { ...prev, startTime: timeStr };
      if (timeToMinutes(timeStr) >= timeToMinutes(prev.endTime)) {
        const bumped = Math.min(23 * 60 + 59, timeToMinutes(timeStr) + 60);
        const h = Math.floor(bumped / 60);
        const m = bumped % 60;
        next.endTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      return next;
    });
    setTimeWindowError(false);
    setActiveTimePicker(null);
  };

  const handleFormEndTimeConfirm = (timeStr: string) => {
    let invalid = false;
    setForm((prev) => {
      if (timeToMinutes(timeStr) <= timeToMinutes(prev.startTime)) {
        invalid = true;
        return prev;
      }
      return { ...prev, endTime: timeStr };
    });
    setTimeWindowError(invalid);
    setActiveTimePicker(null);
  };

  const openLifeAreaEditor = (window: LifeAreaPlanWindow) => {
    setEditingLifeAreaId(window.categoryId);
    setLifeAreaEditDraft(
      window.blocks.length > 0
        ? window.blocks.map((b) => ({ ...b }))
        : [{ startTime: "09:00", endTime: "17:00" }],
    );
    setLifeAreaPickerTarget(null);
    setActiveTimePicker(null);
  };

  const saveLifeAreaEditor = () => {
    if (!editingLifeAreaId || !lifeAreaEditDraft) return;
    hasManualLifeAreaEditsRef.current = true;
    setLifeAreaWindows((prev) =>
      prev.map((w) =>
        w.categoryId === editingLifeAreaId
          ? {
              ...w,
              blocks: lifeAreaEditDraft,
              hasPreference: lifeAreaEditDraft.length > 0,
            }
          : w,
      ),
    );
    setEditingLifeAreaId(null);
    setLifeAreaEditDraft(null);
    setLifeAreaPickerTarget(null);
  };

  const cancelLifeAreaEditor = () => {
    setEditingLifeAreaId(null);
    setLifeAreaEditDraft(null);
    setLifeAreaPickerTarget(null);
  };

  const renderToggleRow = (
    label: string,
    subtitle: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <View style={[styles.toggleRow, { borderBottomColor: theme.border }]}>
      <View style={styles.toggleText}>
        <ThemedText style={styles.toggleLabel}>{label}</ThemedText>
        <ThemedText style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: PLAN_GRADIENT_START }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const renderFormPhase = () => (
    <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Which day?</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
          {dateOptions.map((date) => {
            const dateStr = formatLocalDateYYYYMMDD(date);
            const isSelected = dateStr === form.selectedDate;
            const hasPlan = existingPlanDates.includes(dateStr);
            const isToday = dateStr === todayStr;
            const dayLabel = date.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = date.getDate();

            const handleDatePress = () => {
              if (hasPlan) {
                Alert.alert("Plan already exists", "Plan already exists for this date.", [{ text: "OK" }]);
                return;
              }
              setForm((prev) => ({ ...prev, selectedDate: dateStr }));
            };

            return (
              <Pressable
                key={dateStr}
                onPress={handleDatePress}
                style={[
                  styles.datePill,
                  {
                    backgroundColor: hasPlan
                      ? theme.backgroundDefault
                      : isSelected
                        ? PLAN_GRADIENT_START
                        : theme.backgroundDefault,
                    borderColor: hasPlan
                      ? theme.border
                      : isSelected
                        ? PLAN_GRADIENT_START
                        : theme.border,
                    opacity: hasPlan ? 0.55 : 1,
                  },
                ]}
              >
                {isToday && !hasPlan ? <View style={styles.todayDot} /> : null}
                {hasPlan ? (
                  <Feather name="check" size={10} color={theme.textSecondary} style={styles.datePillCheck} />
                ) : null}
                <Text
                  style={[
                    styles.datePillText,
                    {
                      color: isSelected && !hasPlan ? "#FFFFFF" : theme.textSecondary,
                      textDecorationLine: hasPlan ? "line-through" : "none",
                    },
                  ]}
                >
                  {dayLabel} {dayNum}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Time window</ThemedText>
        <View style={styles.timeRow}>
          <Pressable
            style={[styles.timePill, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            onPress={() => {
              setLifeAreaPickerTarget(null);
              setActiveTimePicker("start");
            }}
          >
            <ThemedText style={styles.timePillText}>▸ {formatHhmm12(form.startTime)}</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.timePill, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            onPress={() => {
              setLifeAreaPickerTarget(null);
              setActiveTimePicker("end");
            }}
          >
            <ThemedText style={styles.timePillText}>◂ {formatHhmm12(form.endTime)}</ThemedText>
          </Pressable>
        </View>
        {timeWindowError ? (
          <ThemedText style={[styles.timeWindowError, { color: theme.error }]}>
            End time must be after start time
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>What to include</ThemedText>
        {renderToggleRow(
          "Pinned entries",
          `${pinnedCount} items on Master List`,
          form.includePinned,
          (v) => setForm((prev) => ({ ...prev, includePinned: v })),
        )}
        {renderToggleRow(
          "Scheduled events",
          `${eventsOnDateCount} events on ${weekdayName}`,
          form.includeEvents,
          (v) => setForm((prev) => ({ ...prev, includeEvents: v })),
        )}
        {renderToggleRow(
          "Scheduled habits",
          `${activeHabitsCount} habits due today`,
          form.includeHabits,
          (v) => setForm((prev) => ({ ...prev, includeHabits: v })),
        )}
        {renderToggleRow(
          "Suggested tasks",
          "From all your entries",
          form.includeSuggested,
          (v) => setForm((prev) => ({ ...prev, includeSuggested: v })),
        )}
        {renderToggleRow(
          "Life Coach picks",
          "AI recommendations",
          form.includeCoachPicks,
          (v) => setForm((prev) => ({ ...prev, includeCoachPicks: v })),
        )}
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Life Areas & Time Windows</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          All Life Areas are included by default. Toggle off to exclude. Tap a time to adjust for today.
        </ThemedText>
        <View style={[styles.lifeAreaList, { borderColor: theme.border }]}>
          {lifeAreaWindows.map((window, index) => {
            const areaColor = normalizeLifeAreaColor(window.color);
            const isEditing = editingLifeAreaId === window.categoryId;
            const displayBlocks =
              isEditing && lifeAreaEditDraft ? lifeAreaEditDraft : window.blocks;
            const timeLabel =
              displayBlocks.length > 0
                ? formatBlocksDisplay(displayBlocks)
                : "No preference";

            return (
              <View key={window.categoryId}>
                <View style={styles.lifeAreaRow}>
                  <Pressable
                    onPress={() => {
                      hasManualLifeAreaEditsRef.current = true;
                      setLifeAreaWindows((prev) =>
                        prev.map((w) =>
                          w.categoryId === window.categoryId
                            ? { ...w, included: !w.included }
                            : w,
                        ),
                      );
                    }}
                    hitSlop={8}
                  >
                    <Feather
                      name={window.included ? "check-circle" : "circle"}
                      size={22}
                      color={window.included ? areaColor : theme.textSecondary}
                    />
                  </Pressable>
                  <View style={[styles.lifeAreaDot, { backgroundColor: areaColor }]} />
                  <ThemedText
                    style={[
                      styles.lifeAreaName,
                      { color: window.included ? theme.buttonText : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {window.categoryName}
                  </ThemedText>
                  <Pressable
                    onPress={() => openLifeAreaEditor(window)}
                    style={styles.lifeAreaTimePressable}
                  >
                    <Text
                      style={[
                        styles.lifeAreaTimeText,
                        {
                          color:
                            window.blocks.length > 0 ? areaColor : theme.textSecondary,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {timeLabel}
                    </Text>
                  </Pressable>
                </View>

                {isEditing && lifeAreaEditDraft ? (
                  <View style={[styles.lifeAreaEditor, { borderTopColor: theme.border }]}>
                    {lifeAreaEditDraft.map((block, blockIndex) => (
                      <View key={`${window.categoryId}-${blockIndex}`} style={styles.lifeAreaBlockRow}>
                        <Pressable
                          style={[
                            styles.timePill,
                            styles.lifeAreaTimePill,
                            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                          ]}
                          onPress={() => {
                            setActiveTimePicker(null);
                            setLifeAreaPickerTarget({ blockIndex, field: "start" });
                          }}
                        >
                          <ThemedText style={styles.timePillText}>
                            ▸ {formatHhmm12(block.startTime)}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.timePill,
                            styles.lifeAreaTimePill,
                            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                          ]}
                          onPress={() => {
                            setActiveTimePicker(null);
                            setLifeAreaPickerTarget({ blockIndex, field: "end" });
                          }}
                        >
                          <ThemedText style={styles.timePillText}>
                            ◂ {formatHhmm12(block.endTime)}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            setLifeAreaEditDraft((prev) =>
                              prev ? prev.filter((_, i) => i !== blockIndex) : prev,
                            )
                          }
                          hitSlop={8}
                        >
                          <ThemedText style={[styles.lifeAreaEditorAction, { color: theme.error }]}>
                            Remove
                          </ThemedText>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={() =>
                        setLifeAreaEditDraft((prev) => [
                          ...(prev ?? []),
                          { startTime: "09:00", endTime: "17:00" },
                        ])
                      }
                    >
                      <ThemedText style={[styles.lifeAreaEditorAction, { color: theme.primary }]}>
                        + Add Block
                      </ThemedText>
                    </Pressable>
                    <View style={styles.lifeAreaEditorActions}>
                      <Pressable onPress={cancelLifeAreaEditor}>
                        <ThemedText style={[styles.lifeAreaEditorAction, { color: theme.textSecondary }]}>
                          Cancel
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={saveLifeAreaEditor}>
                        <ThemedText style={[styles.lifeAreaEditorAction, { color: theme.primary }]}>
                          Save
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {index < lifeAreaWindows.length - 1 ? (
                  <View style={[styles.lifeAreaSeparator, { backgroundColor: theme.border }]} />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Energy level today</ThemedText>
        <View style={styles.energyRow}>
          {([
            { key: "low" as const, label: "😴 Low" },
            { key: "medium" as const, label: "⚡ Medium" },
            { key: "high" as const, label: "🔥 High" },
          ]).map((item) => {
            const selected = form.energyLevel === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setForm((prev) => ({ ...prev, energyLevel: item.key }))}
                style={[
                  styles.energyButton,
                  {
                    backgroundColor: selected ? ENERGY_ACTIVE_BG : theme.backgroundDefault,
                    borderColor: selected ? ENERGY_ACTIVE_BORDER : theme.border,
                  },
                ]}
              >
                <Text style={{ color: selected ? ENERGY_ACTIVE_TEXT : theme.text, fontSize: 13, fontWeight: "600" }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => {
          lifeAreaWindowsRef.current = lifeAreaWindows;
          hasStartedChat.current = false;
          setChatMessages([]);
          setChatHistory([]);
          setDraftPlan(null);
          setPhase("chat");
        }}
        style={styles.generateButtonWrap}
      >
        <LinearGradient
          colors={[PLAN_GRADIENT_START, PLAN_GRADIENT_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.generateButton}
        >
          <Text style={styles.generateButtonText}>Generate My Plan →</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );

  const renderChatBubble = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            backgroundColor: isUser ? PLAN_GRADIENT_START : theme.backgroundDefault,
            alignSelf: isUser ? "flex-end" : "flex-start",
          },
        ]}
      >
        <ThemedText style={{ color: isUser ? "#FFFFFF" : theme.text, fontSize: 14, lineHeight: 20 }}>
          {item.content}
        </ThemedText>
      </View>
    );
  };

  const renderChatPhase = () => (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderChatBubble}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          <>
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Life Coach is planning your day...
                </ThemedText>
              </View>
            ) : null}
            {aiError ? (
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>Retry</ThemedText>
              </Pressable>
            ) : null}
            {draftPlan ? (
              <>
                <DailyPlanPreviewCard plan={draftPlan} categories={categories} />
                <Pressable onPress={handleApplyPlan} style={styles.applyButtonWrap}>
                  <LinearGradient
                    colors={[APPLY_GRADIENT_START, APPLY_GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.applyButton}
                  >
                    <Text style={styles.applyButtonText}>Apply to My Day →</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : null}
          </>
        }
      />

      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
        <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundRoot }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Ask to adjust your plan..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!isLoading}
          />
          <Pressable
            style={[styles.sendButton, { backgroundColor: theme.primary }, (!inputText.trim() || isLoading) && { opacity: 0.5 }]}
            onPress={handleSendFollowUp}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const renderApprovedPhase = () => (
    <View style={styles.approvedContainer}>
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Feather name="check" size={40} color="#FFFFFF" />
      </Animated.View>
      {applySubPhase === "applying" ? (
        <ThemedText style={styles.approvedTitle}>Setting up your day...</ThemedText>
      ) : (
        <>
          <ThemedText style={styles.approvedTitle}>Your day is planned!</ThemedText>
          <ThemedText style={[styles.approvedSubtext, { color: theme.textSecondary }]}>
            {draftPlan?.itemCount ?? 0} items scheduled. Time to Thrive.
          </ThemedText>
          {eventsCreatedCount > 0 ? (
            <ThemedText style={[styles.approvedSummary, { color: theme.textSecondary }]}>
              ✓ {eventsCreatedCount} events added to calendar
            </ThemedText>
          ) : null}
          <Pressable onPress={handleLetsGo} style={styles.letsGoWrap}>
            <LinearGradient
              colors={[PLAN_GRADIENT_START, PLAN_GRADIENT_END]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.letsGoButton}
            >
              <Text style={styles.letsGoText}>Let's Go →</Text>
            </LinearGradient>
          </Pressable>
        </>
      )}
    </View>
  );

  const headerTitle =
    phase === "form" ? "Plan My Day" : phase === "chat" ? "Your Daily Plan" : "All Set";

  const headerLeftAction =
    phase === "form"
      ? () => navigation.goBack()
      : phase === "chat"
        ? () => setPhase("form")
        : undefined;

  const headerLeftLabel = phase === "form" ? "Cancel" : phase === "chat" ? "Back" : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {headerLeftLabel ? (
          <Pressable onPress={headerLeftAction} hitSlop={8}>
            <ThemedText style={[styles.headerAction, { color: theme.primary }]}>
              {headerLeftLabel}
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle}>{headerTitle}</ThemedText>
          {phase === "form" ? (
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {formatSelectedDateLong(form.selectedDate)}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <PlanGeneratorProgress currentPhase={phase} />

      {phase === "form" ? renderFormPhase() : null}
      {phase === "chat" ? renderChatPhase() : null}
      {phase === "approved" ? renderApprovedPhase() : null}

      <AppTimePicker
        visible={activeTimePicker === "start"}
        value={form.startTime}
        title="Start time"
        onConfirm={handleFormStartTimeConfirm}
        onCancel={() => setActiveTimePicker(null)}
      />
      <AppTimePicker
        visible={activeTimePicker === "end"}
        value={form.endTime}
        title="End time"
        onConfirm={handleFormEndTimeConfirm}
        onCancel={() => setActiveTimePicker(null)}
      />
      <AppTimePicker
        visible={lifeAreaPickerTarget !== null}
        value={
          lifeAreaPickerTarget && lifeAreaEditDraft
            ? lifeAreaEditDraft[lifeAreaPickerTarget.blockIndex]?.[
                lifeAreaPickerTarget.field === "start"
                  ? "startTime"
                  : "endTime"
              ] ?? "09:00"
            : "09:00"
        }
        title={
          lifeAreaPickerTarget?.field === "start"
            ? "Start Time"
            : "End Time"
        }
        onConfirm={(timeStr) => {
          if (!lifeAreaPickerTarget || !lifeAreaEditDraft) return;
          hasManualLifeAreaEditsRef.current = true;
          const { blockIndex, field } = lifeAreaPickerTarget;
          setLifeAreaEditDraft((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            updated[blockIndex] = {
              ...updated[blockIndex],
              [field === "start" ? "startTime" : "endTime"]: timeStr,
            };
            return updated;
          });
          setLifeAreaPickerTarget(null);
        }}
        onCancel={() => setLifeAreaPickerTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerAction: {
    fontSize: 16,
    fontWeight: "500",
    width: 60,
  },
  headerSpacer: {
    width: 60,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  dateRow: {
    flexDirection: "row",
  },
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: Spacing.sm,
    alignItems: "center",
    minWidth: 64,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    marginBottom: 2,
  },
  datePillCheck: {
    marginBottom: 2,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  timePill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  timePillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  timeWindowError: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  toggleText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 12,
  },
  lifeAreaList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  lifeAreaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  lifeAreaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lifeAreaName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  lifeAreaTimePressable: {
    maxWidth: "46%",
    alignItems: "flex-end",
  },
  lifeAreaTimeText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  lifeAreaSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.md,
  },
  lifeAreaEditor: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  lifeAreaBlockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  lifeAreaTimePill: {
    flex: 0,
    minWidth: 100,
  },
  lifeAreaEditorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  lifeAreaEditorAction: {
    fontSize: 13,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  energyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  energyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  generateButtonWrap: {
    marginTop: Spacing.md,
  },
  generateButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  chatContainer: {
    flex: 1,
  },
  chatList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  bubble: {
    maxWidth: "85%",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  loadingText: {
    fontSize: 13,
  },
  retryButton: {
    alignSelf: "center",
    padding: Spacing.md,
  },
  applyButtonWrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  applyButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  approvedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: APPLY_GRADIENT_START,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  approvedTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  approvedSubtext: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  approvedSummary: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  letsGoWrap: {
    width: "100%",
    marginTop: Spacing.lg,
  },
  letsGoButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  letsGoText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
