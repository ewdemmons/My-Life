import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LifeCategory, Task, DeletedItem, CalendarEvent, Person, SharePermission, Habit, Occurrence, OccurrenceItemType } from "@/types";
import { generateRecurringInstances, generateUUID } from "@/utils/recurrence";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import { DEFAULT_BUBBLES } from "@/lib/defaultBubbles";

const TASKS_KEY = "@mylife_tasks";
const EVENTS_KEY = "@mylife_events";
const PEOPLE_KEY = "@mylife_people";
const RECYCLE_BIN_KEY = "@mylife_recycle_bin";
const MIGRATION_COMPLETE_KEY = "@mylife_migration_complete";
const RECYCLE_BIN_RETENTION_DAYS = 30;

interface AppContextType {
  categories: LifeCategory[];
  tasks: Task[];
  events: CalendarEvent[];
  people: Person[];
  habits: Habit[];
  occurrences: Occurrence[];
  recycleBin: DeletedItem[];
  isLoading: boolean;
  addCategory: (category: Omit<LifeCategory, "id" | "createdAt">) => Promise<void>;
  updateCategory: (id: string, updates: Partial<LifeCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, "id" | "createdAt">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (taskIds: string[], parentId: string | null) => Promise<void>;
  moveTaskToParent: (taskId: string, newParentId: string | null, newCategoryId?: string) => Promise<void>;
  getTasksByCategory: (categoryId: string) => Task[];
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt">) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  updateEventSeries: (seriesId: string, updates: Partial<CalendarEvent>, editedEventId?: string) => Promise<boolean>;
  deleteEventSeries: (seriesId: string) => Promise<void>;
  updateEventInstance: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  getEventsByDate: (date: string) => CalendarEvent[];
  getEventsByTask: (taskId: string) => CalendarEvent[];
  getEventsBySeries: (seriesId: string) => CalendarEvent[];
  addPerson: (person: Omit<Person, "id" | "createdAt">) => Promise<void>;
  updatePerson: (id: string, updates: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  getPersonById: (id: string) => Person | undefined;
  addHabit: (habit: Omit<Habit, "id" | "createdAt">) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addOccurrence: (occurrence: Omit<Occurrence, "id" | "createdAt">) => Promise<void>;
  deleteOccurrence: (id: string) => Promise<void>;
  getOccurrencesForItem: (itemId: string, itemType: OccurrenceItemType) => Occurrence[];
  restoreFromRecycleBin: (id: string) => Promise<void>;
  permanentlyDelete: (id: string) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
  clearAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function mapSupabaseBubbleToCategory(bubble: any): LifeCategory {
  return {
    id: bubble.id,
    name: bubble.name,
    description: bubble.description || "",
    color: bubble.color,
    icon: bubble.icon,
    createdAt: new Date(bubble.created_at).getTime(),
    peopleIds: bubble.people_ids || [],
  };
}

function mapSharedBubbleToCategory(share: any, bubble: any): LifeCategory {
  return {
    id: bubble.id,
    name: bubble.name,
    description: bubble.description || "",
    color: bubble.color,
    icon: bubble.icon,
    createdAt: new Date(bubble.created_at).getTime(),
    peopleIds: bubble.people_ids || [],
    isShared: true,
    sharePermission: share.permission as SharePermission,
    ownerId: share.owner_id,
  };
}

function mapSupabaseTaskToTask(task: any): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    type: task.type || "task",
    categoryId: task.bubble_id || "",
    parentId: task.parent_id || null,
    priority: task.priority || "medium",
    status: task.status || "pending",
    createdAt: new Date(task.created_at).getTime(),
    orderIndex: task.order_index || 0,
    assigneeIds: task.assignee_ids || [],
    completionType: task.completion_type || null,
    completionDate: task.completion_date || undefined,
    isRecurring: task.is_recurring || false,
  };
}

function mapSupabaseHabitToHabit(item: any): Habit {
  return {
    id: item.id,
    name: item.name,
    description: item.description || undefined,
    habitType: item.habit_type || "positive",
    goalFrequency: item.goal_frequency || "daily",
    goalCount: item.goal_count || 1,
    categoryId: item.bubble_id || null,
    linkedTaskId: item.linked_task_id || null,
    isActive: item.is_active !== false,
    createdAt: new Date(item.created_at).getTime(),
  };
}

function mapSupabaseOccurrenceToOccurrence(item: any): Occurrence {
  return {
    id: item.id,
    itemId: item.item_id,
    itemType: item.item_type as OccurrenceItemType,
    occurredAt: new Date(item.occurred_at).getTime(),
    occurredDate: item.occurred_date,
    notes: item.notes || undefined,
    createdAt: new Date(item.created_at).getTime(),
  };
}

function mapTaskToSupabase(task: Partial<Task>, userId: string) {
  const result: any = { user_id: userId };
  if (task.title !== undefined) result.title = task.title;
  if (task.description !== undefined) result.description = task.description;
  if (task.type !== undefined) result.type = task.type;
  if (task.categoryId !== undefined) result.bubble_id = task.categoryId || null;
  if (task.parentId !== undefined) result.parent_id = task.parentId || null;
  if (task.priority !== undefined) result.priority = task.priority;
  if (task.status !== undefined) result.status = task.status;
  if (task.orderIndex !== undefined) result.order_index = task.orderIndex;
  if (task.assigneeIds !== undefined) result.assignee_ids = task.assigneeIds;
  if (task.completionType !== undefined) result.completion_type = task.completionType;
  if (task.completionDate !== undefined) result.completion_date = task.completionDate || null;
  if (task.isRecurring !== undefined) result.is_recurring = task.isRecurring;
  return result;
}

function mapHabitToSupabase(habit: Partial<Habit>, userId: string) {
  const result: any = { user_id: userId };
  if (habit.name !== undefined) result.name = habit.name;
  if (habit.description !== undefined) result.description = habit.description || null;
  if (habit.habitType !== undefined) result.habit_type = habit.habitType;
  if (habit.goalFrequency !== undefined) result.goal_frequency = habit.goalFrequency;
  if (habit.goalCount !== undefined) result.goal_count = habit.goalCount;
  if (habit.categoryId !== undefined) result.bubble_id = habit.categoryId;
  if (habit.linkedTaskId !== undefined) result.linked_task_id = habit.linkedTaskId;
  if (habit.isActive !== undefined) result.is_active = habit.isActive;
  return result;
}

function mapOccurrenceToSupabase(occurrence: Partial<Occurrence>, userId: string) {
  const result: any = { user_id: userId };
  if (occurrence.itemId !== undefined) result.item_id = occurrence.itemId;
  if (occurrence.itemType !== undefined) result.item_type = occurrence.itemType;
  if (occurrence.occurredAt !== undefined) result.occurred_at = new Date(occurrence.occurredAt).toISOString();
  if (occurrence.occurredDate !== undefined) result.occurred_date = occurrence.occurredDate;
  if (occurrence.notes !== undefined) result.notes = occurrence.notes || null;
  return result;
}

function combineDateTime(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return dateObj.toISOString();
}

function parseTimestamp(timestamp: string | null, fallbackTimestamp?: string | null): { date: string; time: string } {
  const ts = timestamp || fallbackTimestamp;
  if (!ts) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return {
      date: `${year}-${month}-${day}`,
      time: "09:00",
    };
  }
  const dateObj = new Date(ts);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

function addHoursToTimestamp(timestamp: string, hours: number): string {
  const dateObj = new Date(timestamp);
  dateObj.setHours(dateObj.getHours() + hours);
  return dateObj.toISOString();
}

function mapSupabaseEventToEvent(event: any): CalendarEvent {
  const start = parseTimestamp(event.start_time);
  const end = parseTimestamp(event.end_time, event.start_time);
  
  return {
    id: event.id,
    title: event.title,
    description: event.description || "",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    eventType: event.event_type || "reminder",
    recurrence: event.recurrence || "none",
    linkedTaskId: event.linked_task_id || null,
    categoryId: event.bubble_id || null,
    createdAt: new Date(event.created_at).getTime(),
    seriesId: event.series_id || null,
    isException: event.is_exception || false,
    originalDate: event.original_date || undefined,
    attendeeIds: event.attendee_ids || [],
  };
}

function mapEventToSupabase(event: Partial<CalendarEvent>, userId: string, existingEvent?: CalendarEvent) {
  const result: any = { user_id: userId };
  if (event.title !== undefined) result.title = event.title;
  if (event.description !== undefined) result.description = event.description;
  
  const startDate = event.startDate ?? existingEvent?.startDate;
  const startTime = event.startTime ?? existingEvent?.startTime;
  const endDate = event.endDate ?? existingEvent?.endDate;
  const endTime = event.endTime ?? existingEvent?.endTime;
  
  if (startDate && startTime) {
    const startTimestamp = combineDateTime(startDate, startTime);
    result.start_time = startTimestamp;
    
    if (endDate && endTime) {
      result.end_time = combineDateTime(endDate, endTime);
    } else {
      result.end_time = addHoursToTimestamp(startTimestamp, 1);
    }
  } else if (startDate) {
    const startTimestamp = combineDateTime(startDate, "09:00");
    result.start_time = startTimestamp;
    result.end_time = addHoursToTimestamp(startTimestamp, 1);
  }
  
  if (event.eventType !== undefined) result.event_type = event.eventType;
  if (event.recurrence !== undefined) result.recurrence = event.recurrence;
  if (event.linkedTaskId !== undefined) result.linked_task_id = event.linkedTaskId;
  if (event.categoryId !== undefined) result.bubble_id = event.categoryId;
  if (event.seriesId !== undefined) result.series_id = event.seriesId;
  if (event.isException !== undefined) result.is_exception = event.isException;
  if (event.originalDate !== undefined) result.original_date = event.originalDate;
  if (event.attendeeIds !== undefined) result.attendee_ids = event.attendeeIds;
  return result;
}

function mapSupabasePersonToPerson(person: any): Person {
  return {
    id: person.id,
    name: person.name,
    relationship: person.relationship || "other",
    email: person.email || undefined,
    phone: person.phone || undefined,
    photoUri: person.photo_uri || undefined,
    notes: person.notes || undefined,
    createdAt: new Date(person.created_at).getTime(),
    categoryIds: person.category_ids || [],
  };
}

function buildPastEventUpdatePayload(updates: Partial<CalendarEvent>) {
  const result: any = {};
  if (updates.title !== undefined) result.title = updates.title;
  if (updates.description !== undefined) result.description = updates.description;
  if (updates.eventType !== undefined) result.event_type = updates.eventType;
  if (updates.categoryId !== undefined) result.bubble_id = updates.categoryId;
  if (updates.linkedTaskId !== undefined) result.linked_task_id = updates.linkedTaskId;
  if (updates.attendeeIds !== undefined) result.attendee_ids = updates.attendeeIds;
  if (updates.recurrence !== undefined) result.recurrence = updates.recurrence;
  return result;
}

function mapPersonToSupabase(person: Partial<Person>, userId: string) {
  const result: any = { user_id: userId };
  if (person.name !== undefined) result.name = person.name;
  if (person.relationship !== undefined) result.relationship = person.relationship;
  if (person.email !== undefined) result.email = person.email || null;
  if (person.phone !== undefined) result.phone = person.phone || null;
  if (person.photoUri !== undefined) result.photo_uri = person.photoUri || null;
  if (person.notes !== undefined) result.notes = person.notes || null;
  if (person.categoryIds !== undefined) result.category_ids = person.categoryIds;
  return result;
}

function mapSupabaseRecycleBinToDeletedItem(item: any): DeletedItem {
  return {
    id: item.id,
    type: item.item_type as "task" | "category",
    data: item.item_data,
    relatedTasks: item.related_items || [],
    deletedAt: new Date(item.deleted_at).getTime(),
  };
}

interface RegenState {
  activeSeries: string | null;
  ignoreIds: Set<string>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [recycleBin, setRecycleBin] = useState<DeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);
  const sharedBubbleIdsRef = useRef<Set<string>>(new Set());
  const ownedBubbleIdsRef = useRef<Set<string>>(new Set());
  const regenStateRef = useRef<RegenState>({ activeSeries: null, ignoreIds: new Set() });

  useEffect(() => {
    if (user) {
      loadData();
      setupRealtimeSubscriptions();
    } else {
      clearLocalState();
    }

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user?.id]);

  const clearLocalState = () => {
    setCategories([]);
    setTasks([]);
    setEvents([]);
    setPeople([]);
    setHabits([]);
    setOccurrences([]);
    setRecycleBin([]);
    setIsLoading(false);
  };

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel(`mylife_data_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "life_bubbles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newCategory = mapSupabaseBubbleToCategory(payload.new);
            setCategories((prev) => {
              if (prev.find((c) => c.id === newCategory.id)) return prev;
              return [...prev, newCategory];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedCategory = mapSupabaseBubbleToCategory(payload.new);
            setCategories((prev) =>
              prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c))
            );
          } else if (payload.eventType === "DELETE") {
            setCategories((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          const bubbleId = payload.new?.bubble_id || payload.old?.bubble_id;
          const taskUserId = payload.new?.user_id || payload.old?.user_id;
          const isOwnTask = taskUserId === user.id;
          const isInOwnedBubble = bubbleId && ownedBubbleIdsRef.current.has(bubbleId);
          const isInSharedBubble = bubbleId && sharedBubbleIdsRef.current.has(bubbleId);
          // Accept task if: user owns it, OR it's in a bubble user owns, OR it's in a shared bubble
          if (!isOwnTask && !isInOwnedBubble && !isInSharedBubble) return;

          if (payload.eventType === "INSERT") {
            const newTask = mapSupabaseTaskToTask(payload.new);
            setTasks((prev) => {
              if (prev.find((t) => t.id === newTask.id)) return prev;
              return [...prev, newTask];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedTask = mapSupabaseTaskToTask(payload.new);
            setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          const bubbleId = payload.new?.bubble_id || payload.old?.bubble_id;
          const eventUserId = payload.new?.user_id || payload.old?.user_id;
          const isOwnEvent = eventUserId === user.id;
          const isInOwnedBubble = bubbleId && ownedBubbleIdsRef.current.has(bubbleId);
          const isInSharedBubble = bubbleId && sharedBubbleIdsRef.current.has(bubbleId);
          // Accept event if: user owns it, OR it's in a bubble user owns, OR it's in a shared bubble
          if (!isOwnEvent && !isInOwnedBubble && !isInSharedBubble) return;

          const eventId = payload.new?.id || payload.old?.id;
          const eventSeriesId = payload.new?.series_id || payload.old?.series_id;
          
          if (regenStateRef.current.activeSeries && eventSeriesId === regenStateRef.current.activeSeries) {
            return;
          }
          
          if (eventId && regenStateRef.current.ignoreIds.has(eventId)) {
            return;
          }
          
          if (payload.eventType === "INSERT") {
            const newEvent = mapSupabaseEventToEvent(payload.new);
            setEvents((prev) => {
              if (prev.find((e) => e.id === newEvent.id)) return prev;
              return [...prev, newEvent];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedEvent = mapSupabaseEventToEvent(payload.new);
            setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
          } else if (payload.eventType === "DELETE") {
            setEvents((prev) => prev.filter((e) => e.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newPerson = mapSupabasePersonToPerson(payload.new);
            setPeople((prev) => {
              if (prev.find((p) => p.id === newPerson.id)) return prev;
              return [...prev, newPerson];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedPerson = mapSupabasePersonToPerson(payload.new);
            setPeople((prev) => prev.map((p) => (p.id === updatedPerson.id ? updatedPerson : p)));
          } else if (payload.eventType === "DELETE") {
            setPeople((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recycle_bin", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newItem = mapSupabaseRecycleBinToDeletedItem(payload.new);
            setRecycleBin((prev) => {
              if (prev.find((i) => i.id === newItem.id)) return prev;
              return [...prev, newItem];
            });
          } else if (payload.eventType === "DELETE") {
            setRecycleBin((prev) => prev.filter((i) => i.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habits", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newHabit = mapSupabaseHabitToHabit(payload.new);
            setHabits((prev) => {
              if (prev.find((h) => h.id === newHabit.id)) return prev;
              return [...prev, newHabit];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedHabit = mapSupabaseHabitToHabit(payload.new);
            setHabits((prev) => prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)));
          } else if (payload.eventType === "DELETE") {
            setHabits((prev) => prev.filter((h) => h.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "occurrences", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOccurrence = mapSupabaseOccurrenceToOccurrence(payload.new);
            setOccurrences((prev) => {
              if (prev.find((o) => o.id === newOccurrence.id)) return prev;
              return [...prev, newOccurrence];
            });
          } else if (payload.eventType === "DELETE") {
            setOccurrences((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bubble_shares", filter: `shared_with_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const bubbleId = payload.new.bubble_id;
            sharedBubbleIdsRef.current.add(bubbleId);
            const [bubbleRes, tasksRes, eventsRes] = await Promise.all([
              supabase.from("life_bubbles").select("*").eq("id", bubbleId).single(),
              supabase.from("tasks").select("*").eq("bubble_id", bubbleId),
              supabase.from("events").select("*").eq("bubble_id", bubbleId),
            ]);
            if (bubbleRes.data) {
              const sharedCategory = mapSharedBubbleToCategory(payload.new, bubbleRes.data);
              setCategories((prev) => {
                if (prev.find((c) => c.id === sharedCategory.id)) return prev;
                return [...prev, sharedCategory];
              });
            }
            if (tasksRes.data && tasksRes.data.length > 0) {
              const newTasks = tasksRes.data.map(mapSupabaseTaskToTask);
              setTasks((prev) => {
                const existingIds = new Set(prev.map(t => t.id));
                const uniqueNewTasks = newTasks.filter(t => !existingIds.has(t.id));
                return [...prev, ...uniqueNewTasks];
              });
            }
            if (eventsRes.data && eventsRes.data.length > 0) {
              const newEvents = eventsRes.data.map(mapSupabaseEventToEvent);
              setEvents((prev) => {
                const existingIds = new Set(prev.map(e => e.id));
                const uniqueNewEvents = newEvents.filter(e => !existingIds.has(e.id));
                return [...prev, ...uniqueNewEvents];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const bubbleId = payload.old.bubble_id;
            sharedBubbleIdsRef.current.delete(bubbleId);
            setCategories((prev) => prev.filter((c) => !(c.id === bubbleId && c.isShared)));
            setTasks((prev) => prev.filter((t) => t.categoryId !== bubbleId));
            setEvents((prev) => prev.filter((e) => e.categoryId !== bubbleId));
          } else if (payload.eventType === "UPDATE") {
            setCategories((prev) =>
              prev.map((c) => {
                if (c.id === payload.new.bubble_id && c.isShared) {
                  return { ...c, sharePermission: payload.new.permission };
                }
                return c;
              })
            );
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  };

  const migrateLocalDataToSupabase = async () => {
    if (!user) return;

    const userStoragePrefix = `${user.id}_`;
    const migrationKey = userStoragePrefix + MIGRATION_COMPLETE_KEY;
    
    const migrationComplete = await AsyncStorage.getItem(migrationKey);
    if (migrationComplete === "true") return;

    try {
      const [
        prefixedTasksData, prefixedEventsData, prefixedPeopleData, prefixedRecycleBinData,
        legacyTasksData, legacyEventsData, legacyPeopleData, legacyRecycleBinData,
      ] = await Promise.all([
        AsyncStorage.getItem(userStoragePrefix + TASKS_KEY),
        AsyncStorage.getItem(userStoragePrefix + EVENTS_KEY),
        AsyncStorage.getItem(userStoragePrefix + PEOPLE_KEY),
        AsyncStorage.getItem(userStoragePrefix + RECYCLE_BIN_KEY),
        AsyncStorage.getItem(TASKS_KEY),
        AsyncStorage.getItem(EVENTS_KEY),
        AsyncStorage.getItem(PEOPLE_KEY),
        AsyncStorage.getItem(RECYCLE_BIN_KEY),
      ]);

      const tasksData = prefixedTasksData || legacyTasksData;
      const eventsData = prefixedEventsData || legacyEventsData;
      const peopleData = prefixedPeopleData || legacyPeopleData;
      const recycleBinData = prefixedRecycleBinData || legacyRecycleBinData;

      if (tasksData) {
        const localTasks = JSON.parse(tasksData);
        for (const task of localTasks) {
          const supabaseTask = {
            user_id: user.id,
            title: task.title,
            description: task.description || "",
            type: task.type || "task",
            bubble_id: task.categoryId || null,
            parent_id: task.parentId || null,
            priority: task.priority || "medium",
            status: task.status || "pending",
            order_index: task.orderIndex || 0,
            assignee_ids: task.assigneeIds || [],
          };
          await supabase.from("tasks").insert(supabaseTask);
        }
      }

      if (eventsData) {
        const localEvents = JSON.parse(eventsData);
        for (const event of localEvents) {
          const supabaseEvent = {
            user_id: user.id,
            title: event.title,
            description: event.description || "",
            start_date: event.startDate,
            start_time: event.startTime,
            end_date: event.endDate,
            end_time: event.endTime,
            event_type: event.eventType || "reminder",
            recurrence: event.recurrence || "none",
            linked_task_id: event.linkedTaskId || null,
            bubble_id: event.categoryId || null,
            series_id: event.seriesId || null,
            is_exception: event.isException || false,
            original_date: event.originalDate || null,
            attendee_ids: event.attendeeIds || [],
          };
          await supabase.from("events").insert(supabaseEvent);
        }
      }

      if (peopleData) {
        const localPeople = JSON.parse(peopleData);
        for (const person of localPeople) {
          const supabasePerson = {
            user_id: user.id,
            name: person.name,
            relationship: person.relationship || "other",
            email: person.email || null,
            phone: person.phone || null,
            photo_uri: person.photoUri || null,
            notes: person.notes || null,
            category_ids: person.categoryIds || [],
          };
          await supabase.from("people").insert(supabasePerson);
        }
      }

      if (recycleBinData) {
        const localRecycleBin = JSON.parse(recycleBinData);
        for (const item of localRecycleBin) {
          const supabaseItem = {
            user_id: user.id,
            item_type: item.type,
            item_data: item.data,
            related_items: item.relatedTasks || [],
            deleted_at: new Date(item.deletedAt).toISOString(),
          };
          await supabase.from("recycle_bin").insert(supabaseItem);
        }
      }

      await AsyncStorage.multiRemove([
        userStoragePrefix + TASKS_KEY,
        userStoragePrefix + EVENTS_KEY,
        userStoragePrefix + PEOPLE_KEY,
        userStoragePrefix + RECYCLE_BIN_KEY,
        TASKS_KEY,
        EVENTS_KEY,
        PEOPLE_KEY,
        RECYCLE_BIN_KEY,
      ]);

      await AsyncStorage.setItem(migrationKey, "true");
      console.log("Migration to Supabase completed successfully");
    } catch (error) {
      console.warn("Migration error:", error);
    }
  };

  const cleanupExpiredRecycleBin = async () => {
    if (!user) return;
    
    const retentionMs = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs).toISOString();
    
    await supabase
      .from("recycle_bin")
      .delete()
      .eq("user_id", user.id)
      .lt("deleted_at", cutoffDate);
  };

  const loadData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      await migrateLocalDataToSupabase();

      // Fetch bubbles the user is shared with (as recipient)
      const sharedBubblesRes = await supabase.from("bubble_shares").select("*, life_bubbles(*)").eq("shared_with_id", user.id);
      const sharedBubbleIds = sharedBubblesRes.error ? [] : (sharedBubblesRes.data || [])
        .filter((share: any) => share.life_bubbles)
        .map((share: any) => share.bubble_id);
      sharedBubbleIdsRef.current = new Set(sharedBubbleIds);

      // First fetch owned bubbles to get their IDs
      const bubblesRes = await supabase.from("life_bubbles").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      const ownedBubbleIds = bubblesRes.error ? [] : (bubblesRes.data || []).map((b: any) => b.id);

      // Combine owned + shared bubble IDs for fetching all tasks/events
      const allRelevantBubbleIds = [...new Set([...ownedBubbleIds, ...sharedBubbleIds])];

      // Store owned bubble IDs for realtime subscriptions
      ownedBubbleIdsRef.current = new Set(ownedBubbleIds);

      const [tasksInBubblesRes, userUncategorizedTasksRes, eventsInBubblesRes, userUncategorizedEventsRes, peopleRes, recycleBinRes, habitsRes, occurrencesRes] = await Promise.all([
        // Fetch all tasks in bubbles the user owns or is shared with
        allRelevantBubbleIds.length > 0
          ? supabase.from("tasks").select("*").in("bubble_id", allRelevantBubbleIds).order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        // Fetch user's uncategorized tasks (null bubble_id)
        supabase.from("tasks").select("*").eq("user_id", user.id).is("bubble_id", null).order("created_at", { ascending: true }),
        // Fetch all events in bubbles the user owns or is shared with
        allRelevantBubbleIds.length > 0
          ? supabase.from("events").select("*").in("bubble_id", allRelevantBubbleIds).order("start_time", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        // Fetch user's uncategorized events (null bubble_id)
        supabase.from("events").select("*").eq("user_id", user.id).is("bubble_id", null).order("start_time", { ascending: true }),
        supabase.from("people").select("*").eq("user_id", user.id).order("name", { ascending: true }),
        supabase.from("recycle_bin").select("*").eq("user_id", user.id).order("deleted_at", { ascending: false }),
        supabase.from("habits").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("occurrences").select("*").eq("user_id", user.id).order("occurred_at", { ascending: false }),
      ]);

      const ownedCategories = bubblesRes.error ? [] : (bubblesRes.data || []).map(mapSupabaseBubbleToCategory);
      const sharedCategories = sharedBubblesRes.error ? [] : (sharedBubblesRes.data || [])
        .filter((share: any) => share.life_bubbles)
        .map((share: any) => mapSharedBubbleToCategory(share, share.life_bubbles));
      
      if (bubblesRes.error) console.warn("Error loading bubbles:", bubblesRes.error.message);
      if (sharedBubblesRes.error) console.warn("Error loading shared bubbles:", sharedBubblesRes.error.message);
      
      setCategories([...ownedCategories, ...sharedCategories]);

      // Combine tasks from bubbles + uncategorized user tasks
      const bubbleTasks = tasksInBubblesRes.error ? [] : (tasksInBubblesRes.data || []).map(mapSupabaseTaskToTask);
      const uncategorizedTasks = userUncategorizedTasksRes.error ? [] : (userUncategorizedTasksRes.data || []).map(mapSupabaseTaskToTask);
      if (tasksInBubblesRes.error) console.warn("Error loading tasks:", tasksInBubblesRes.error.message);
      // Deduplicate in case of overlap
      const taskMap = new Map<string, Task>();
      bubbleTasks.forEach(t => taskMap.set(t.id, t));
      uncategorizedTasks.forEach(t => { if (!taskMap.has(t.id)) taskMap.set(t.id, t); });
      setTasks(Array.from(taskMap.values()));

      // Combine events from bubbles + uncategorized user events
      const bubbleEvents = eventsInBubblesRes.error ? [] : (eventsInBubblesRes.data || []).map(mapSupabaseEventToEvent);
      const uncategorizedEvents = userUncategorizedEventsRes.error ? [] : (userUncategorizedEventsRes.data || []).map(mapSupabaseEventToEvent);
      if (eventsInBubblesRes.error) console.warn("Error loading events:", eventsInBubblesRes.error.message);
      // Deduplicate in case of overlap
      const eventMap = new Map<string, CalendarEvent>();
      bubbleEvents.forEach(e => eventMap.set(e.id, e));
      uncategorizedEvents.forEach(e => { if (!eventMap.has(e.id)) eventMap.set(e.id, e); });
      setEvents(Array.from(eventMap.values()));

      if (peopleRes.error) console.warn("Error loading people:", peopleRes.error.message);
      else setPeople((peopleRes.data || []).map(mapSupabasePersonToPerson));

      if (recycleBinRes.error) console.warn("Error loading recycle bin:", recycleBinRes.error.message);
      else setRecycleBin((recycleBinRes.data || []).map(mapSupabaseRecycleBinToDeletedItem));

      if (habitsRes.error) console.warn("Error loading habits:", habitsRes.error.message);
      else setHabits((habitsRes.data || []).map(mapSupabaseHabitToHabit));

      if (occurrencesRes.error) console.warn("Error loading occurrences:", occurrencesRes.error.message);
      else setOccurrences((occurrencesRes.data || []).map(mapSupabaseOccurrenceToOccurrence));

      await cleanupExpiredRecycleBin();
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addCategory = useCallback(async (category: Omit<LifeCategory, "id" | "createdAt">) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("life_bubbles")
      .insert({
        user_id: user.id,
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding category:", error.message);
      return;
    }

    const newCategory = mapSupabaseBubbleToCategory(data);
    setCategories((prev) => [...prev, newCategory]);
  }, [user]);

  const updateCategory = useCallback(async (id: string, updates: Partial<LifeCategory>) => {
    if (!user) return;

    const supabaseUpdates: any = {};
    if (updates.name !== undefined) supabaseUpdates.name = updates.name;
    if (updates.description !== undefined) supabaseUpdates.description = updates.description;
    if (updates.color !== undefined) supabaseUpdates.color = updates.color;
    if (updates.icon !== undefined) supabaseUpdates.icon = updates.icon;

    const { error } = await supabase
      .from("life_bubbles")
      .update(supabaseUpdates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating category:", error.message);
      return;
    }

    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat))
    );
  }, [user]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!user) return;

    const categoryToDelete = categories.find((cat) => cat.id === id);
    if (!categoryToDelete) return;

    const relatedTasks = tasks.filter((task) => task.categoryId === id);

    const { error } = await supabase
      .from("life_bubbles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting category:", error.message);
      return;
    }

    const { data, error: insertError } = await supabase.from("recycle_bin").insert({
      user_id: user.id,
      item_type: "category",
      item_data: categoryToDelete,
      related_items: relatedTasks,
    }).select().single();

    if (!insertError && data) {
      const deletedItem = mapSupabaseRecycleBinToDeletedItem(data);
      setRecycleBin((prev) => [...prev, deletedItem]);
    }

    for (const task of relatedTasks) {
      await supabase.from("tasks").delete().eq("id", task.id).eq("user_id", user.id);
    }

    setCategories((prev) => prev.filter((cat) => cat.id !== id));
    setTasks((prev) => prev.filter((task) => task.categoryId !== id));
  }, [user, categories, tasks]);

  const addTask = useCallback(async (task: Omit<Task, "id" | "createdAt">) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .insert(mapTaskToSupabase(task, user.id))
      .select()
      .single();

    if (error) {
      console.error("Error adding task:", error.message);
      return;
    }

    const newTask = mapSupabaseTaskToTask(data);
    setTasks((prev) => [...prev, newTask]);
  }, [user]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    const supabaseUpdates = mapTaskToSupabase(updates, user.id);
    delete supabaseUpdates.user_id;

    const { error } = await supabase
      .from("tasks")
      .update(supabaseUpdates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating task:", error.message);
      return;
    }

    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
  }, [user]);

  const deleteTask = useCallback(async (id: string) => {
    if (!user) return;

    const taskToDelete = tasks.find((t) => t.id === id);
    if (!taskToDelete) return;

    const getDescendants = (taskId: string): Task[] => {
      const children = tasks.filter((t) => t.parentId === taskId);
      return children.flatMap((child) => [child, ...getDescendants(child.id)]);
    };

    const descendants = getDescendants(id);

    const { data, error: insertError } = await supabase.from("recycle_bin").insert({
      user_id: user.id,
      item_type: "task",
      item_data: taskToDelete,
      related_items: descendants,
    }).select().single();

    if (!insertError && data) {
      const deletedItem = mapSupabaseRecycleBinToDeletedItem(data);
      setRecycleBin((prev) => [...prev, deletedItem]);
    }

    const idsToDelete = [id, ...descendants.map((t) => t.id)];
    for (const taskId of idsToDelete) {
      await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id);
    }

    setTasks((prev) => prev.filter((task) => !idsToDelete.includes(task.id)));
  }, [user, tasks]);

  const reorderTasks = useCallback(async (taskIds: string[], parentId: string | null) => {
    if (!user) return;

    const updates = taskIds.map((id, index) => ({ id, order_index: index }));
    
    for (const update of updates) {
      await supabase
        .from("tasks")
        .update({ order_index: update.order_index })
        .eq("id", update.id)
        .eq("user_id", user.id);
    }

    setTasks((prev) =>
      prev.map((task) => {
        const index = taskIds.indexOf(task.id);
        if (index !== -1 && task.parentId === parentId) {
          return { ...task, orderIndex: index };
        }
        return task;
      })
    );
  }, [user]);

  const moveTaskToParent = useCallback(async (taskId: string, newParentId: string | null, newCategoryId?: string) => {
    if (!user) return;

    const taskToMove = tasks.find((t) => t.id === taskId);
    if (!taskToMove) return;

    const getDescendants = (id: string): Task[] => {
      const children = tasks.filter((t) => t.parentId === id);
      return children.flatMap((child) => [child, ...getDescendants(child.id)]);
    };
    const descendants = getDescendants(taskId);

    const categoryId = newCategoryId || (newParentId ? tasks.find((t) => t.id === newParentId)?.categoryId : taskToMove.categoryId) || taskToMove.categoryId;

    await supabase
      .from("tasks")
      .update({ parent_id: newParentId, bubble_id: categoryId, order_index: Date.now() })
      .eq("id", taskId)
      .eq("user_id", user.id);

    for (const descendant of descendants) {
      await supabase
        .from("tasks")
        .update({ bubble_id: categoryId })
        .eq("id", descendant.id)
        .eq("user_id", user.id);
    }

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          return { ...task, parentId: newParentId, categoryId, orderIndex: Date.now() };
        }
        if (descendants.find((d) => d.id === task.id)) {
          return { ...task, categoryId };
        }
        return task;
      })
    );
  }, [user, tasks]);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "id" | "createdAt">) => {
    if (!user) return;

    if (event.recurrence && event.recurrence !== "none") {
      const seriesId = generateUUID();
      const instances = generateRecurringInstances(event, seriesId);

      const supabaseInstances = instances.map(instance => {
        const supabaseEvent = mapEventToSupabase(instance, user.id);
        // Ensure valid linked_task_id
        if (event.linkedTaskId && !event.linkedTaskId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          delete supabaseEvent.linked_task_id;
        }
        return supabaseEvent;
      });

      if (supabaseInstances.length > 0) {
        console.log("Inserting recurring events:", { seriesId, instanceCount: supabaseInstances.length, firstInstance: supabaseInstances[0] });
      }

      const { data, error } = await supabase
        .from("events")
        .insert(supabaseInstances)
        .select();

      if (error) {
        console.error("Error adding recurring events:", error.message, { seriesId, instances: supabaseInstances });
        return;
      }

      if (data) {
        const newEvents = data.map(mapSupabaseEventToEvent);
        setEvents((prev) => [...prev, ...newEvents]);
      }
    } else {
      const supabaseEvent = mapEventToSupabase({ ...event, seriesId: null }, user.id);
      const { data, error } = await supabase.from("events").insert(supabaseEvent).select().single();
      
      if (error) {
        console.error("Error adding event:", error.message);
        return;
      }

      const newEvent = mapSupabaseEventToEvent(data);
      setEvents((prev) => [...prev, newEvent]);
    }
  }, [user]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    if (!user) return;

    const existingEvent = events.find((e) => e.id === id);
    const supabaseUpdates = mapEventToSupabase(updates, user.id, existingEvent);
    delete supabaseUpdates.user_id;

    const { error } = await supabase
      .from("events")
      .update(supabaseUpdates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating event:", error.message);
      return;
    }

    setEvents((prev) => prev.map((event) => (event.id === id ? { ...event, ...updates } : event)));
  }, [user, events]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting event:", error.message);
      return;
    }

    setEvents((prev) => prev.filter((event) => event.id !== id));
  }, [user]);

  const updateEventSeries = useCallback(async (seriesId: string, updates: Partial<CalendarEvent>, editedEventId?: string): Promise<boolean> => {
    if (!user) return false;

    const seriesEvents = events.filter((e) => e.seriesId === seriesId);
    const nonExceptionEvents = seriesEvents.filter((e) => !e.isException);
    const exceptionEvents = seriesEvents.filter((e) => e.isException);
    
    if (nonExceptionEvents.length === 0) return false;

    const anchorEvent = nonExceptionEvents.sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const originalRecurrence = anchorEvent.recurrence;
    const newRecurrence = updates.recurrence;
    const recurrenceChanged = newRecurrence !== undefined && newRecurrence !== originalRecurrence;

    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    if (recurrenceChanged) {
      console.log("Recurrence changed from", originalRecurrence, "to", newRecurrence, "- regenerating series");

      const allSeriesIds = seriesEvents.map((e) => e.id);
      regenStateRef.current = { activeSeries: seriesId, ignoreIds: new Set(allSeriesIds) };

      try {
        if (newRecurrence === "none") {
          const idsToDelete = seriesEvents.filter((e) => e.id !== anchorEvent.id).map((e) => e.id);
          
          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from("events")
              .delete()
              .eq("user_id", user.id)
              .in("id", idsToDelete);

            if (deleteError) {
              console.error("Error deleting series instances:", deleteError.message);
              return false;
            }
          }

          const supabaseUpdates = mapEventToSupabase({ ...updates, seriesId: null, recurrence: "none" }, user.id, anchorEvent);
          delete supabaseUpdates.user_id;

          await supabase
            .from("events")
            .update(supabaseUpdates)
            .eq("id", anchorEvent.id)
            .eq("user_id", user.id);

          setEvents((prev) => {
            const eventsNotInSeries = prev.filter((e) => !allSeriesIds.includes(e.id));
            const updatedAnchor = { ...anchorEvent, ...updates, seriesId: null, recurrence: "none" as const };
            return [...eventsNotInSeries, updatedAnchor];
          });

          return true;
        }

        const futureNonExceptionIds = nonExceptionEvents
          .filter((e) => e.startDate >= todayString && e.id !== anchorEvent.id)
          .map((e) => e.id);

        if (futureNonExceptionIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("events")
            .delete()
            .eq("user_id", user.id)
            .in("id", futureNonExceptionIds);

          if (deleteError) {
            console.error("Error deleting future series instances:", deleteError.message);
            return false;
          }
        }

        const supabaseAnchorUpdates = mapEventToSupabase(updates, user.id, anchorEvent);
        delete supabaseAnchorUpdates.user_id;

        await supabase
          .from("events")
          .update(supabaseAnchorUpdates)
          .eq("id", anchorEvent.id)
          .eq("user_id", user.id);

        const updatedAnchorData: Omit<CalendarEvent, "id" | "createdAt"> = {
          title: updates.title ?? anchorEvent.title,
          description: updates.description ?? anchorEvent.description,
          startDate: updates.startDate ?? anchorEvent.startDate,
          startTime: updates.startTime ?? anchorEvent.startTime,
          endDate: updates.endDate ?? anchorEvent.endDate,
          endTime: updates.endTime ?? anchorEvent.endTime,
          eventType: updates.eventType ?? anchorEvent.eventType,
          recurrence: newRecurrence,
          linkedTaskId: updates.linkedTaskId ?? anchorEvent.linkedTaskId,
          categoryId: updates.categoryId ?? anchorEvent.categoryId,
          attendeeIds: updates.attendeeIds ?? anchorEvent.attendeeIds,
        };

        const newInstances = generateRecurringInstances(updatedAnchorData, seriesId);
        const futureInstances = newInstances.filter((instance) => instance.startDate > anchorEvent.startDate);

        const pastNonExceptions = nonExceptionEvents.filter((e) => e.startDate < todayString && e.id !== anchorEvent.id);
        
        const pastEventUpdates = buildPastEventUpdatePayload({ ...updates, recurrence: newRecurrence });
        if (Object.keys(pastEventUpdates).length > 0 && pastNonExceptions.length > 0) {
          const pastEventIds = pastNonExceptions.map((e) => e.id);
          await supabase
            .from("events")
            .update(pastEventUpdates)
            .eq("user_id", user.id)
            .in("id", pastEventIds);
        }

        if (futureInstances.length > 0) {
          const supabaseInstances = futureInstances.map(instance => {
            const supabaseEvent = mapEventToSupabase(instance, user.id);
            if (instance.linkedTaskId && !instance.linkedTaskId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              delete supabaseEvent.linked_task_id;
            }
            return supabaseEvent;
          });

          const { data: insertedData, error: insertError } = await supabase
            .from("events")
            .insert(supabaseInstances)
            .select();

          if (insertError) {
            console.error("Error inserting regenerated instances:", insertError.message);
            return false;
          }

          if (insertedData) {
            const newEvents = insertedData.map(mapSupabaseEventToEvent);
            newEvents.forEach((e) => regenStateRef.current.ignoreIds.add(e.id));
            
            setEvents((prev) => {
              const eventsNotInSeries = prev.filter((e) => e.seriesId !== seriesId);
              const updatedAnchor = { ...anchorEvent, ...updates, recurrence: newRecurrence };
              const updatedPastEvents = pastNonExceptions.map((e) => ({
                ...e,
                title: updates.title ?? e.title,
                description: updates.description ?? e.description,
                eventType: updates.eventType ?? e.eventType,
                categoryId: updates.categoryId ?? e.categoryId,
                linkedTaskId: updates.linkedTaskId ?? e.linkedTaskId,
                attendeeIds: updates.attendeeIds ?? e.attendeeIds,
                recurrence: newRecurrence,
              }));
              return [...eventsNotInSeries, updatedAnchor, ...updatedPastEvents, ...newEvents, ...exceptionEvents];
            });
          }
        } else {
          setEvents((prev) => {
            const eventsNotInSeries = prev.filter((e) => e.seriesId !== seriesId);
            const updatedAnchor = { ...anchorEvent, ...updates, recurrence: newRecurrence };
            const updatedPastEvents = pastNonExceptions.map((e) => ({
              ...e,
              title: updates.title ?? e.title,
              description: updates.description ?? e.description,
              eventType: updates.eventType ?? e.eventType,
              categoryId: updates.categoryId ?? e.categoryId,
              linkedTaskId: updates.linkedTaskId ?? e.linkedTaskId,
              attendeeIds: updates.attendeeIds ?? e.attendeeIds,
              recurrence: newRecurrence,
            }));
            return [...eventsNotInSeries, updatedAnchor, ...updatedPastEvents, ...exceptionEvents];
          });
        }

        return true;
      } finally {
        regenStateRef.current = { activeSeries: null, ignoreIds: new Set() };
      }
    }

    const isEditingAnchor = editedEventId === anchorEvent.id;
    const anchorDateChanged = isEditingAnchor && (
      (updates.startDate && updates.startDate !== anchorEvent.startDate) ||
      (updates.endDate && updates.endDate !== anchorEvent.endDate)
    );

    if (anchorDateChanged) {
      console.log("Anchor date changed - regenerating future instances");
      
      const allSeriesIds = seriesEvents.map((e) => e.id);
      regenStateRef.current = { activeSeries: seriesId, ignoreIds: new Set(allSeriesIds) };

      try {
        const futureNonExceptionIds = nonExceptionEvents
          .filter((e) => e.startDate >= todayString && e.id !== anchorEvent.id)
          .map((e) => e.id);

        if (futureNonExceptionIds.length > 0) {
          futureNonExceptionIds.forEach((id) => regenStateRef.current.ignoreIds.add(id));
          await supabase
            .from("events")
            .delete()
            .eq("user_id", user.id)
            .in("id", futureNonExceptionIds);
        }

        const supabaseAnchorUpdates = mapEventToSupabase(updates, user.id, anchorEvent);
        delete supabaseAnchorUpdates.user_id;
        
        await supabase
          .from("events")
          .update(supabaseAnchorUpdates)
          .eq("id", anchorEvent.id)
          .eq("user_id", user.id);

        const pastNonExceptions = nonExceptionEvents.filter((e) => e.startDate < todayString && e.id !== anchorEvent.id);
        const pastEventUpdates = buildPastEventUpdatePayload(updates);
        if (Object.keys(pastEventUpdates).length > 0 && pastNonExceptions.length > 0) {
          const pastEventIds = pastNonExceptions.map((e) => e.id);
          await supabase
            .from("events")
            .update(pastEventUpdates)
            .eq("user_id", user.id)
            .in("id", pastEventIds);
        }

        const updatedAnchorData: Omit<CalendarEvent, "id" | "createdAt"> = {
          title: updates.title ?? anchorEvent.title,
          description: updates.description ?? anchorEvent.description,
          startDate: updates.startDate ?? anchorEvent.startDate,
          startTime: updates.startTime ?? anchorEvent.startTime,
          endDate: updates.endDate ?? anchorEvent.endDate,
          endTime: updates.endTime ?? anchorEvent.endTime,
          eventType: updates.eventType ?? anchorEvent.eventType,
          recurrence: anchorEvent.recurrence,
          linkedTaskId: updates.linkedTaskId ?? anchorEvent.linkedTaskId,
          categoryId: updates.categoryId ?? anchorEvent.categoryId,
          attendeeIds: updates.attendeeIds ?? anchorEvent.attendeeIds,
        };

        const newInstances = generateRecurringInstances(updatedAnchorData, seriesId);
        const futureInstances = newInstances.filter((instance) => instance.startDate > updatedAnchorData.startDate);

        if (futureInstances.length > 0) {
          const supabaseInstances = futureInstances.map(instance => {
            const supabaseEvent = mapEventToSupabase(instance, user.id);
            if (instance.linkedTaskId && !instance.linkedTaskId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              delete supabaseEvent.linked_task_id;
            }
            return supabaseEvent;
          });

          const { data: insertedData, error: insertError } = await supabase
            .from("events")
            .insert(supabaseInstances)
            .select();

          if (insertError) {
            console.error("Error inserting regenerated instances:", insertError.message);
            return false;
          }

          if (insertedData) {
            const newEvents = insertedData.map(mapSupabaseEventToEvent);
            newEvents.forEach((e) => regenStateRef.current.ignoreIds.add(e.id));
            
            setEvents((prev) => {
              const eventsNotInSeries = prev.filter((e) => e.seriesId !== seriesId);
              const updatedAnchor = { ...anchorEvent, ...updates };
              const updatedPastEvents = pastNonExceptions.map((e) => ({
                ...e,
                title: updates.title ?? e.title,
                description: updates.description ?? e.description,
                eventType: updates.eventType ?? e.eventType,
                categoryId: updates.categoryId ?? e.categoryId,
                linkedTaskId: updates.linkedTaskId ?? e.linkedTaskId,
                attendeeIds: updates.attendeeIds ?? e.attendeeIds,
              }));
              return [...eventsNotInSeries, updatedAnchor, ...updatedPastEvents, ...newEvents, ...exceptionEvents];
            });
          }
        } else {
          const updatedAnchor = { ...anchorEvent, ...updates };
          const updatedPastEvents = pastNonExceptions.map((e) => ({
            ...e,
            title: updates.title ?? e.title,
            description: updates.description ?? e.description,
            eventType: updates.eventType ?? e.eventType,
            categoryId: updates.categoryId ?? e.categoryId,
            linkedTaskId: updates.linkedTaskId ?? e.linkedTaskId,
            attendeeIds: updates.attendeeIds ?? e.attendeeIds,
          }));
          
          setEvents((prev) => {
            const eventsNotInSeries = prev.filter((e) => e.seriesId !== seriesId);
            return [...eventsNotInSeries, updatedAnchor, ...updatedPastEvents, ...exceptionEvents];
          });
        }

        return true;
      } finally {
        regenStateRef.current = { activeSeries: null, ignoreIds: new Set() };
      }
    }
    
    const anchorUpdates = { ...updates };
    delete anchorUpdates.startDate;
    delete anchorUpdates.endDate;

    const supabaseAnchorUpdates = mapEventToSupabase(anchorUpdates, user.id, anchorEvent);
    delete supabaseAnchorUpdates.user_id;
    
    await supabase
      .from("events")
      .update(supabaseAnchorUpdates)
      .eq("id", anchorEvent.id)
      .eq("user_id", user.id);

    const pastEvents = nonExceptionEvents.filter((e) => e.id !== anchorEvent.id && e.startDate < todayString);
    const futureEvents = nonExceptionEvents.filter((e) => e.id !== anchorEvent.id && e.startDate >= todayString);

    if (pastEvents.length > 0) {
      const pastEventUpdates = buildPastEventUpdatePayload(updates);
      if (Object.keys(pastEventUpdates).length > 0) {
        const pastEventIds = pastEvents.map((e) => e.id);
        await supabase
          .from("events")
          .update(pastEventUpdates)
          .eq("user_id", user.id)
          .in("id", pastEventIds);
      }
    }

    const futureEventUpdates = { ...updates };
    delete futureEventUpdates.startDate;
    delete futureEventUpdates.endDate;

    for (const event of futureEvents) {
      const supabaseUpdates = mapEventToSupabase(futureEventUpdates, user.id, event);
      delete supabaseUpdates.user_id;
      await supabase
        .from("events")
        .update(supabaseUpdates)
        .eq("id", event.id)
        .eq("user_id", user.id);
    }

    const { startDate: _sd, endDate: _ed, ...safeUpdates } = updates;
    
    setEvents((prev) =>
      prev.map((event) => {
        if (event.seriesId === seriesId && !event.isException) {
          if (event.startDate < todayString && event.id !== anchorEvent.id) {
            return {
              ...event,
              title: updates.title ?? event.title,
              description: updates.description ?? event.description,
              eventType: updates.eventType ?? event.eventType,
              categoryId: updates.categoryId ?? event.categoryId,
              linkedTaskId: updates.linkedTaskId ?? event.linkedTaskId,
              attendeeIds: updates.attendeeIds ?? event.attendeeIds,
              recurrence: updates.recurrence ?? event.recurrence,
            };
          }
          return { ...event, ...safeUpdates };
        }
        return event;
      })
    );

    return true;
  }, [user, events]);

  const deleteEventSeries = useCallback(async (seriesId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("series_id", seriesId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting event series:", error.message);
      return;
    }

    setEvents((prev) => prev.filter((event) => event.seriesId !== seriesId));
  }, [user]);

  const updateEventInstance = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    if (!user) return;

    const existingEvent = events.find((e) => e.id === id);
    if (!existingEvent) return;

    const isException = existingEvent.seriesId ? true : undefined;
    const supabaseUpdates = mapEventToSupabase({ ...updates, isException }, user.id, existingEvent);
    delete supabaseUpdates.user_id;

    const { error } = await supabase
      .from("events")
      .update(supabaseUpdates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating event instance:", error.message);
      return;
    }

    const updatedEvent = { ...existingEvent, ...updates };
    if (existingEvent.seriesId) updatedEvent.isException = true;
    setEvents((prev) => prev.map((event) => (event.id === id ? updatedEvent : event)));
  }, [user, events]);

  const getEventsByDate = useCallback(
    (date: string) => events.filter((event) => event.startDate === date),
    [events]
  );

  const getEventsByTask = useCallback(
    (taskId: string) => events.filter((event) => event.linkedTaskId === taskId),
    [events]
  );

  const getEventsBySeries = useCallback(
    (seriesId: string) => events.filter((event) => event.seriesId === seriesId),
    [events]
  );

  const addPerson = useCallback(async (person: Omit<Person, "id" | "createdAt">) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("people")
      .insert(mapPersonToSupabase(person, user.id))
      .select()
      .single();

    if (error) {
      console.error("Error adding person:", error.message);
      return;
    }

    const newPerson = mapSupabasePersonToPerson(data);
    setPeople((prev) => [...prev, newPerson]);
  }, [user]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    if (!user) return;

    const supabaseUpdates = mapPersonToSupabase(updates, user.id);
    delete supabaseUpdates.user_id;

    const { error } = await supabase
      .from("people")
      .update(supabaseUpdates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating person:", error.message);
      return;
    }

    setPeople((prev) => prev.map((person) => (person.id === id ? { ...person, ...updates } : person)));
  }, [user]);

  const deletePerson = useCallback(async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("people")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting person:", error.message);
      return;
    }

    setPeople((prev) => prev.filter((person) => person.id !== id));

    const tasksToUpdate = tasks.filter((t) => t.assigneeIds?.includes(id));
    for (const task of tasksToUpdate) {
      const newAssigneeIds = task.assigneeIds?.filter((pid) => pid !== id);
      await supabase
        .from("tasks")
        .update({ assignee_ids: newAssigneeIds })
        .eq("id", task.id)
        .eq("user_id", user.id);
    }

    const eventsToUpdate = events.filter((e) => e.attendeeIds?.includes(id));
    for (const event of eventsToUpdate) {
      const newAttendeeIds = event.attendeeIds?.filter((pid) => pid !== id);
      await supabase
        .from("events")
        .update({ attendee_ids: newAttendeeIds })
        .eq("id", event.id)
        .eq("user_id", user.id);
    }

    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        assigneeIds: task.assigneeIds?.filter((pid) => pid !== id),
      }))
    );
    setEvents((prev) =>
      prev.map((event) => ({
        ...event,
        attendeeIds: event.attendeeIds?.filter((pid) => pid !== id),
      }))
    );
  }, [user, tasks, events]);

  const getPersonById = useCallback(
    (id: string) => people.find((person) => person.id === id),
    [people]
  );

  const addHabit = useCallback(async (habit: Omit<Habit, "id" | "createdAt">) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("habits")
      .insert(mapHabitToSupabase(habit, user.id))
      .select()
      .single();

    if (error) {
      console.error("Error adding habit:", error.message);
      return;
    }

    const newHabit = mapSupabaseHabitToHabit(data);
    setHabits((prev) => [...prev, newHabit]);
  }, [user]);

  const updateHabit = useCallback(async (id: string, updates: Partial<Habit>) => {
    if (!user) return;

    const supabaseUpdates = mapHabitToSupabase(updates, user.id);
    delete supabaseUpdates.user_id;

    const { error } = await supabase
      .from("habits")
      .update(supabaseUpdates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating habit:", error.message);
      return;
    }

    setHabits((prev) => prev.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit)));
  }, [user]);

  const deleteHabit = useCallback(async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting habit:", error.message);
      return;
    }

    setHabits((prev) => prev.filter((habit) => habit.id !== id));
    setOccurrences((prev) => prev.filter((o) => !(o.itemId === id && o.itemType === "habit")));
  }, [user]);

  const addOccurrence = useCallback(async (occurrence: Omit<Occurrence, "id" | "createdAt">) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("occurrences")
      .insert(mapOccurrenceToSupabase(occurrence, user.id))
      .select()
      .single();

    if (error) {
      console.error("Error adding occurrence:", error.message);
      return;
    }

    const newOccurrence = mapSupabaseOccurrenceToOccurrence(data);
    setOccurrences((prev) => [...prev, newOccurrence]);
  }, [user]);

  const deleteOccurrence = useCallback(async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("occurrences")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting occurrence:", error.message);
      return;
    }

    setOccurrences((prev) => prev.filter((occurrence) => occurrence.id !== id));
  }, [user]);

  const getOccurrencesForItem = useCallback(
    (itemId: string, itemType: OccurrenceItemType) => 
      occurrences.filter((o) => o.itemId === itemId && o.itemType === itemType),
    [occurrences]
  );

  const restoreFromRecycleBin = useCallback(async (id: string) => {
    if (!user) return;

    const item = recycleBin.find((i) => i.id === id);
    if (!item) return;

    if (item.type === "category") {
      const category = item.data as LifeCategory;
      const relatedTasks = item.relatedTasks || [];

      const { data, error } = await supabase
        .from("life_bubbles")
        .insert({
          user_id: user.id,
          name: category.name,
          description: category.description,
          color: category.color,
          icon: category.icon,
        })
        .select()
        .single();

      if (error) {
        console.error("Error restoring category:", error.message);
        return;
      }

      const restoredCategory = mapSupabaseBubbleToCategory(data);

      for (const task of relatedTasks) {
        await supabase.from("tasks").insert({
          ...mapTaskToSupabase(task, user.id),
          bubble_id: restoredCategory.id,
        });
      }

      await supabase.from("recycle_bin").delete().eq("id", id).eq("user_id", user.id);

      setCategories((prev) => [...prev, restoredCategory]);
      setRecycleBin((prev) => prev.filter((i) => i.id !== id));
    } else {
      const task = item.data as Task;
      const relatedTasks = item.relatedTasks || [];

      const { data, error } = await supabase
        .from("tasks")
        .insert(mapTaskToSupabase(task, user.id))
        .select()
        .single();

      if (error) {
        console.error("Error restoring task:", error.message);
        return;
      }

      const restoredTask = mapSupabaseTaskToTask(data);

      for (const related of relatedTasks) {
        await supabase.from("tasks").insert({
          ...mapTaskToSupabase(related, user.id),
          parent_id: related.parentId === task.id ? restoredTask.id : related.parentId,
        });
      }

      await supabase.from("recycle_bin").delete().eq("id", id).eq("user_id", user.id);

      setTasks((prev) => [...prev, restoredTask]);
      setRecycleBin((prev) => prev.filter((i) => i.id !== id));
    }
  }, [user, recycleBin]);

  const permanentlyDelete = useCallback(async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("recycle_bin")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error permanently deleting:", error.message);
      return;
    }

    setRecycleBin((prev) => prev.filter((i) => i.id !== id));
  }, [user]);

  const emptyRecycleBin = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from("recycle_bin")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error emptying recycle bin:", error.message);
      return;
    }

    setRecycleBin([]);
  }, [user]);

  const getTasksByCategory = useCallback(
    (categoryId: string) => tasks.filter((task) => task.categoryId === categoryId),
    [tasks]
  );

  const clearAllData = useCallback(async () => {
    if (!user) return;

    await Promise.all([
      supabase.from("tasks").delete().eq("user_id", user.id),
      supabase.from("events").delete().eq("user_id", user.id),
      supabase.from("people").delete().eq("user_id", user.id),
      supabase.from("recycle_bin").delete().eq("user_id", user.id),
      supabase.from("habits").delete().eq("user_id", user.id),
      supabase.from("occurrences").delete().eq("user_id", user.id),
    ]);

    setTasks([]);
    setEvents([]);
    setPeople([]);
    setHabits([]);
    setOccurrences([]);
    setRecycleBin([]);
  }, [user]);

  return (
    <AppContext.Provider
      value={{
        categories,
        tasks,
        events,
        people,
        habits,
        occurrences,
        recycleBin,
        isLoading,
        addCategory,
        updateCategory,
        deleteCategory,
        addTask,
        updateTask,
        deleteTask,
        reorderTasks,
        moveTaskToParent,
        getTasksByCategory,
        addEvent,
        updateEvent,
        deleteEvent,
        updateEventSeries,
        deleteEventSeries,
        updateEventInstance,
        getEventsByDate,
        getEventsByTask,
        getEventsBySeries,
        addPerson,
        updatePerson,
        deletePerson,
        getPersonById,
        addHabit,
        updateHabit,
        deleteHabit,
        addOccurrence,
        deleteOccurrence,
        getOccurrencesForItem,
        restoreFromRecycleBin,
        permanentlyDelete,
        emptyRecycleBin,
        clearAllData,
        refreshData: loadData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
