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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
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
  buildCoachSuggestions,
  postProcessPlan,
  CoachSuggestion,
} from "@/utils/planUtils";
import { formatLocalDateYYYYMMDD, getLocalTodayDate } from "@/utils/masterListUtils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { CalendarEvent, Habit, LifeAreaProfile, LifeAreaSchedule, LifeCategory, Task } from "@/types";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";

const PLAN_GRADIENT_START = "#6B7FFF";
const PLAN_GRADIENT_END = "#8B6FFF";
const APPLY_GRADIENT_START = "#10B981";
const APPLY_GRADIENT_END = "#059669";
const ENERGY_ACTIVE_BG = "#6B7FFF22";
const ENERGY_ACTIVE_BORDER = "#6B7FFF";
const ENERGY_ACTIVE_TEXT = "#6B7FFF";

type EnergyLevel = "normal" | "high";
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
  customPlanNotes?: string;
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

function formatEstimatedMinutes(minutes: number | null | undefined): string {
  return minutes != null && minutes > 0
    ? ` | Estimated: ${minutes} minutes`
    : " | Estimated: 30 minutes (default)";
}

function buildStep6Block(
  form: FormState,
  planStartTime: string,
  planEndTime: string,
): string {
  if (!form.includeSuggested && !form.includeCoachPicks) {
    return `STEP 6 — ADD AI SUGGESTIONS:
Skip this step — user did not request suggested tasks or Life Coach picks.`;
  }

  const lines: string[] = [
    "STEP 6 — ADD COACH SUGGESTIONS (only if user requested suggested tasks or Life Coach picks):",
    "Fill remaining free gaps with additional items. Apply these rules strictly:",
    "",
  ];

  if (form.includeSuggested) {
    lines.push(
      "RULE A — Suggested tasks (if user requested suggested tasks):",
      "Add items from the SUGGESTED TASKS section above.",
      "Do not invent new tasks. Do not add entries from memory or training data.",
      "Only Task-type entries from the user's data.",
      "",
    );
  }

  if (form.includeCoachPicks) {
    const ruleLabel = form.includeSuggested ? "RULE B" : "RULE A";
    lines.push(
      `${ruleLabel} — Use ONLY the suggestions from COACH SUGGESTIONS FOR STEP 6 above.`,
      "Do not invent suggestions not on this list. Place each suggestion in a free",
      "gap respecting life area time windows. Apply density rules (max 2 items/hour,",
      "10-min buffer) to suggestions.",
      "",
      `${form.includeSuggested ? "RULE C" : "RULE B"} — Plan Tomorrow block:`,
      "Always place the PLAN TOMORROW BLOCK in the last 2 hours of the plan window",
      `(${planStartTime}–${planEndTime}). This is a guaranteed fixture — it is NOT`,
      "subject to density rules and must always appear regardless of how full the",
      "schedule is. Find the first available 15-minute slot in the evening window",
      "and place it there even if other items are already in that hour.",
      "Include description in the JSON timeBlock. Set isPlanTomorrow: true.",
      "",
      `${form.includeSuggested ? "RULE D" : "RULE C"} — No Break Habits:`,
      "Never suggest or add Break (negative) habits. Build Habits only.",
      "",
      `${form.includeSuggested ? "RULE E" : "RULE D"} — Minimum suggestions:`,
      "Include at least 1 suggestion from COACH SUGGESTIONS FOR STEP 6 in the plan",
      "(in addition to the Plan Tomorrow block). If no gaps exist for other",
      "suggestions, the Plan Tomorrow block alone satisfies this minimum.",
      "",
    );
  } else {
    lines.push(
      "RULE B — No Break Habits:",
      "Never suggest or add Break (negative) habits. Build Habits only.",
      "",
    );
  }

  return lines.join("\n");
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
  coachSuggestions: CoachSuggestion[],
  planTomorrow: CoachSuggestion,
  lifeAreaProfiles: LifeAreaProfile[],
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

  const excludedCategoryIds = new Set(
    lifeAreaWindows.filter((w) => !w.included).map((w) => w.categoryId),
  );

  const allWindowLines = lifeAreaWindows
    .flatMap((w) =>
      w.blocks.length > 0
        ? w.blocks.map((b) => `  • ${w.categoryName}: ${b.startTime}–${b.endTime}`)
        : [`  • ${w.categoryName}: no preference`],
    )
    .join("\n");

  const excludedSuggestionAreas = lifeAreaWindows
    .filter((w) => !w.included)
    .map((w) => `  • ${w.categoryName}`)
    .join("\n");

  const planStartTime = form.startTime;
  const planEndTime = form.endTime;

  const eventDetails = form.includeEvents
    ? selectedDayEvents
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
        .join("\n")
    : "";

  const eventsOffNote = !form.includeEvents
    ? `
NOTE: Calendar events are not included in this plan per user preference,
but their time slots are still blocked to prevent conflicts.
`
    : "";

  const pinnedEntryDetails = form.includePinned
    ? pinnedTasks
        .filter((t) => t.isPinned && t.status !== "completed" && !t.excludeFromPlan)
        .map((t) => {
          const category = categories.find((c) => c.id === t.categoryId);
          const timeStr = formatEstimatedMinutes(t.estimatedMinutes);
          return `- "${t.title}" | Life Area: ${category?.name ?? "Unassigned"} | Type: ${t.type} | Priority: ${t.priority}${timeStr}`;
        })
        .join("\n")
    : "";

  const habitDetails = form.includeHabits
    ? habits
        .filter(
          (h) =>
            h.isActive &&
            h.habitType !== "negative" &&
            h.categoryId != null &&
            !excludedCategoryIds.has(h.categoryId),
        )
        .map((h) => {
          const category = categories.find((c) => c.id === h.categoryId);
          return `- "${h.name}" | Life Area: ${category?.name ?? "Unassigned"} | Type: Build Habit | Frequency: ${h.goalFrequency}`;
        })
        .join("\n")
    : "";

  const suggestedTasksDetails = form.includeSuggested
    ? tasks
        .filter(
          (t) =>
            !t.isPinned &&
            t.type === "task" &&
            t.status !== "completed" &&
            !t.excludeFromPlan &&
            !excludedCategoryIds.has(t.categoryId),
        )
        .slice(0, 10)
        .map((t) => {
          const category = categories.find((c) => c.id === t.categoryId);
          const timeStr = formatEstimatedMinutes(t.estimatedMinutes);
          return `- "${t.title}" | Life Area: ${category?.name ?? "Unassigned"} | Priority: ${t.priority}${timeStr}`;
        })
        .join("\n")
    : "";

  const energyLabel = form.energyLevel === "normal" ? "Normal" : "High";
  const hasCustomization = !!form.customPlanNotes?.trim();

  const coachSuggestionsSection = form.includeCoachPicks
    ? `
COACH SUGGESTIONS FOR STEP 6:
(use these specific suggestions to fill gaps — do not invent your own):
${coachSuggestions
  .map(
    (s) =>
      `- "${s.title}" | Life Area: ${s.lifeArea} | Duration: ${s.durationMinutes} min | agendaOnly: ${s.agendaOnly} | Description: ${s.description}`,
  )
  .join("\n")}

PLAN TOMORROW BLOCK (always include):
- "${planTomorrow.title}" | Life Area: ${planTomorrow.lifeArea} | Duration: ${planTomorrow.durationMinutes} min | agendaOnly: ${planTomorrow.agendaOnly} | Place in evening (last 2 hours of plan window) | Description: ${planTomorrow.description}
`
    : "";

  const step6Block = buildStep6Block(form, planStartTime, planEndTime);

  const profilePlanNotes = lifeAreaProfiles
    .filter(
      (p) => p.status === "completed" && !excludedCategoryIds.has(p.categoryId),
    )
    .map((profile) => {
      const category = categories.find((c) => c.id === profile.categoryId);
      if (!category) return "";

      const notes: string[] = [];

      const hasPinnedGoalEntry = pinnedTasks.some(
        (t) => t.categoryId === profile.categoryId,
      );
      if (!hasPinnedGoalEntry && profile.primaryGoal) {
        notes.push(
          `No pinned entries for ${category.name} — consider suggesting a planning session toward: "${profile.primaryGoal}"`,
        );
      }

      if (profile.knownObstacles?.length > 0) {
        notes.push(
          `Known obstacles in ${category.name}: ${profile.knownObstacles.join(", ")} — schedule this Life Area's items at optimal times`,
        );
      }

      return notes.length > 0
        ? `${category.name}:\n${notes.map((n) => `  - ${n}`).join("\n")}`
        : "";
    })
    .filter(Boolean)
    .join("\n");

  const profileInsightsSection = profilePlanNotes
    ? `
LIFE AREA COACH INSIGHTS FOR TODAY:
${profilePlanNotes}

Use these insights to personalize the plan — reference the user's actual goals
and obstacles when scheduling items and suggesting Coach activities.
`
    : "";

  return `
Please generate a daily plan for ${formattedDate}.

Parameters:
- Time window: ${form.startTime} to ${form.endTime}
- Include pinned entries: ${form.includePinned}
- Include scheduled events: ${form.includeEvents}
- Include scheduled habits: ${form.includeHabits}
- Include suggested tasks: ${form.includeSuggested}
- Include Life Coach picks: ${form.includeCoachPicks}
${hasCustomization ? `
USER CUSTOMIZATION:
${form.customPlanNotes?.trim() ? `- Additional context: ${form.customPlanNotes.trim()}` : ""}
` : ""}
ENERGY LEVEL: ${energyLabel}

SCHEDULING DENSITY RULES (enforce strictly — these override any other
instruction to fill gaps):

Normal energy rules:
- Maximum 2 scheduled items per hour
- Minimum 10-minute buffer between consecutive items (do not schedule
  back-to-back without a gap)
- Maximum 6 hours of total scheduled task/entry time in the day
  (not counting scheduled events which are immovable)
- After every 90 minutes of scheduled items, leave at least 15 minutes
  unscheduled
- Prefer quality over quantity: it is better to include fewer items
  well-spaced than to pack the day

High energy rules (future — for now apply Normal rules for High too):
- Apply Normal rules for now
${profileInsightsSection}
SCHEDULED EVENTS FOR ${formattedDate}:
${eventDetails.length > 0 ? eventDetails : "No events scheduled for this day."}
${eventsOffNote}
OCCUPIED TIME BLOCKS — nothing may be
scheduled during these times:
${blockedSummary}

LIFE AREA TIME WINDOWS
(apply to ALL items from each area — these control WHEN, not WHETHER):
${allWindowLines}

LIFE AREAS EXCLUDED FROM SUGGESTIONS
(exclude unpinned entries, habits, and Coach suggestions from these areas
— pinned items still included):
${excludedSuggestionAreas || "  • None"}

SUGGESTED TASKS (unpinned, for Step 6 only):
${suggestedTasksDetails || "None available"}

NOTE: These are the ONLY entries available for AI task suggestions. Only Task-type entries are included here intentionally. Do not suggest any other entry types directly.
${coachSuggestionsSection}
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
LIFE AREA TIME WINDOWS above, only place
them in free gaps that fall within their
window. This is a hard constraint. If no free
gap exists within a Life Area's time window
for an unpinned item, skip that item rather
than placing it outside the window. For PINNED
items only: if no gap exists within the
window, place at the nearest available time
— pinned items must always appear in the plan.

For items belonging to Life Areas with no
time preference, place in any free gap.

In Steps 5–6, do not add habits or unpinned/Coach
suggestions from LIFE AREAS EXCLUDED FROM
SUGGESTIONS. Step 4 pinned entries from those
areas are still included.

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
Life Area time windows. Order by
priority: high → medium → low.

DURATION RULE (applies to all steps):
Every entry includes an "Estimated:" time. Use
that exact value as durationMinutes in the
timeBlock JSON. The 30-minute default has
already been applied to entries without a
user-set estimate. Never use a duration other
than what is listed unless the entry has no
Estimated field at all, in which case use
30 minutes.

STEP 5 — PLACE PINNED HABITS:
Add active Build Habits from ACTIVE BUILD
HABITS. Place in free gaps respecting Life
Area time windows. Never include
Break (negative) habits.

HABIT DEDUPLICATION RULE: Each habit may
appear AT MOST ONCE in the plan regardless
of frequency. If a habit has already been
placed in any earlier step, do not add it
again in Step 5 or Step 6. Track placed
habits by title and skip any duplicate.

${step6Block}

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
Each timeBlock may include "agendaOnly", "description", and "isPlanTomorrow" fields.
Set agendaOnly true for mindfulness and other agenda-only suggestions.
Include description text from COACH SUGGESTIONS for coach blocks.
Set isPlanTomorrow true for the Plan Tomorrow block.
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
    lifeAreaProfiles,
    lifeAreaInsights,
    addEvent,
  } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 800, successMessage: "Plan applied" });

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
    energyLevel: "normal",
    customPlanNotes: "",
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
        lifeAreaProfiles,
        forDailyPlan: true,
      }),
    [categories, tasks, habits, events, people, occurrences, schedulePreferences, lifeAreaProfiles],
  );

  const callAI = useCallback(
    async (
      message: string,
      history: Array<{ role: string; content: string }>,
      isAdjustMode = false,
    ) => {
      setIsLoading(true);
      setAiError(null);
      try {
        const response = await sendToAI({
          message,
          context: appContext,
          history,
          systemPrompt: getRegularSystemPrompt(appContext, isAdjustMode),
          maxTokens: 4096,
        });
        const plan = parseDailyPlanFromResponse(response);
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

  const buildCoachInput = useCallback(
    (windows: LifeAreaPlanWindow[]) => {
      const excludedCategoryIds = new Set(
        windows.filter((w) => !w.included).map((w) => w.categoryId),
      );
      return buildCoachSuggestions({
        categories,
        tasks,
        habits,
        events,
        lifeAreaProfiles,
        lifeAreaInsights,
        selectedDate: form.selectedDate,
        excludedCategoryIds,
      });
    },
    [
      categories,
      tasks,
      habits,
      events,
      lifeAreaProfiles,
      lifeAreaInsights,
      form.selectedDate,
    ],
  );

  const applyPlanPostProcessing = useCallback(
    (plan: DailyPlanMeta, coachResult: ReturnType<typeof buildCoachSuggestions>) => {
      return postProcessPlan(
        { ...plan, date: form.selectedDate },
        {
          startTime: form.startTime,
          endTime: form.endTime,
          planTomorrow: form.includeCoachPicks ? coachResult.planTomorrow : null,
          includeCoachPicks: form.includeCoachPicks,
        },
      );
    },
    [form.selectedDate, form.startTime, form.endTime, form.includeCoachPicks],
  );

  const startInitialGeneration = useCallback(async () => {
    const formattedDate = formatSelectedDateLong(form.selectedDate);
    const windowsForPlan = lifeAreaWindowsRef.current;
    const coachResult = buildCoachInput(windowsForPlan);
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
      coachResult.coachSuggestions,
      coachResult.planTomorrow,
      lifeAreaProfiles,
    );

    setChatMessages([
      { id: "user-init", role: "user", content: "Generate my daily plan" },
    ]);

    try {
      const { response, plan, displayText } = await callAI(planRequestMessage, [], false);
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
        setDraftPlan(applyPlanPostProcessing(plan, coachResult));
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
  }, [
    form,
    lifeAreaNames,
    events,
    categories,
    tasks,
    pinnedTasks,
    habits,
    callAI,
    buildCoachInput,
    applyPlanPostProcessing,
  ]);

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
      const coachResult = buildCoachInput(lifeAreaWindowsRef.current);
      const { response, plan, displayText } = await callAI(text, chatHistory, true);
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
        setDraftPlan(applyPlanPostProcessing(plan, coachResult));
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
  }, [inputText, isLoading, callAI, chatHistory, buildCoachInput, applyPlanPostProcessing]);

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

    const performApply = async () => {
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
        if (
          (block.source === "suggested" || block.source === "coach") &&
          block.id === null &&
          !block.agendaOnly
        ) {
          const categoryId =
            categories.find((c) => c.name === block.lifeArea)?.id ??
            categories[0]?.id ??
            null;
          await addEvent({
            title: block.title,
            description: block.description || "",
            startDate: planToSave.date,
            startTime: block.time,
            endDate: planToSave.date,
            endTime: addMinutesToTime(block.time, block.durationMinutes || 30),
            eventType: "appointment",
            recurrence: "none",
            linkedTaskId: null,
            categoryId,
            autoDeleteAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
          created += 1;
        }
      }

      setEventsCreatedCount(created);
      setApplySubPhase("complete");
    };

    setRetry(() => {
      void performApply();
    });
    await withSaveIndicator(performApply);
  }, [draftPlan, form.selectedDate, existingPlanDates, categories, addEvent, checkScale, withSaveIndicator, setRetry]);

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
    <KeyboardAwareScrollViewCompat style={styles.formScroll} contentContainerStyle={styles.formContent}>
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
        <ThemedText style={styles.sectionLabel}>
          Anything else Coach should know?
        </ThemedText>
        <TextInput
          style={[
            styles.customizeInputMultiline,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.backgroundDefault,
            },
          ]}
          placeholder="Add any context, preferences, or constraints for today's plan — focus areas, energy levels, time constraints, or anything else that should shape your day."
          placeholderTextColor={theme.textSecondary}
          value={form.customPlanNotes}
          onChangeText={(v) =>
            setForm((prev) => ({
              ...prev,
              customPlanNotes: v,
            }))
          }
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Energy level today</ThemedText>
        <View style={styles.energyRow}>
          {([
            { key: "normal" as const, label: "⚡ Normal" },
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
    </KeyboardAwareScrollViewCompat>
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
      <SaveToast
        state={toastState}
        message={toastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
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
  customizeInputMultiline: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    minHeight: 88,
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
