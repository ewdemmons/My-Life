import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LifeCategory, Task, DeletedItem, CalendarEvent, Person } from "@/types";
import { generateRecurringInstances } from "@/utils/recurrence";
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
  updateEventSeries: (seriesId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEventSeries: (seriesId: string) => Promise<void>;
  updateEventInstance: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  getEventsByDate: (date: string) => CalendarEvent[];
  getEventsByTask: (taskId: string) => CalendarEvent[];
  getEventsBySeries: (seriesId: string) => CalendarEvent[];
  addPerson: (person: Omit<Person, "id" | "createdAt">) => Promise<void>;
  updatePerson: (id: string, updates: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  getPersonById: (id: string) => Person | undefined;
  restoreFromRecycleBin: (id: string) => Promise<void>;
  permanentlyDelete: (id: string) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
  clearAllData: () => Promise<void>;
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
  return result;
}

function mapSupabaseEventToEvent(event: any): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description || "",
    startDate: event.start_date,
    startTime: event.start_time,
    endDate: event.end_date,
    endTime: event.end_time,
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

function mapEventToSupabase(event: Partial<CalendarEvent>, userId: string) {
  const result: any = { user_id: userId };
  if (event.title !== undefined) result.title = event.title;
  if (event.description !== undefined) result.description = event.description;
  if (event.startDate !== undefined) result.start_date = event.startDate;
  if (event.startTime !== undefined) result.start_time = event.startTime;
  if (event.endDate !== undefined) result.end_date = event.endDate;
  if (event.endTime !== undefined) result.end_time = event.endTime;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [recycleBin, setRecycleBin] = useState<DeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);

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
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        (payload) => {
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
        { event: "*", schema: "public", table: "events", filter: `user_id=eq.${user.id}` },
        (payload) => {
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
      const [tasksData, eventsData, peopleData, recycleBinData] = await Promise.all([
        AsyncStorage.getItem(userStoragePrefix + TASKS_KEY),
        AsyncStorage.getItem(userStoragePrefix + EVENTS_KEY),
        AsyncStorage.getItem(userStoragePrefix + PEOPLE_KEY),
        AsyncStorage.getItem(userStoragePrefix + RECYCLE_BIN_KEY),
      ]);

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

      const [bubblesRes, tasksRes, eventsRes, peopleRes, recycleBinRes] = await Promise.all([
        supabase.from("life_bubbles").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("events").select("*").eq("user_id", user.id).order("start_date", { ascending: true }),
        supabase.from("people").select("*").eq("user_id", user.id).order("name", { ascending: true }),
        supabase.from("recycle_bin").select("*").eq("user_id", user.id).order("deleted_at", { ascending: false }),
      ]);

      if (bubblesRes.error) console.warn("Error loading bubbles:", bubblesRes.error.message);
      else setCategories((bubblesRes.data || []).map(mapSupabaseBubbleToCategory));

      if (tasksRes.error) console.warn("Error loading tasks:", tasksRes.error.message);
      else setTasks((tasksRes.data || []).map(mapSupabaseTaskToTask));

      if (eventsRes.error) console.warn("Error loading events:", eventsRes.error.message);
      else setEvents((eventsRes.data || []).map(mapSupabaseEventToEvent));

      if (peopleRes.error) console.warn("Error loading people:", peopleRes.error.message);
      else setPeople((peopleRes.data || []).map(mapSupabasePersonToPerson));

      if (recycleBinRes.error) console.warn("Error loading recycle bin:", recycleBinRes.error.message);
      else setRecycleBin((recycleBinRes.data || []).map(mapSupabaseRecycleBinToDeletedItem));

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

    await supabase.from("recycle_bin").insert({
      user_id: user.id,
      item_type: "category",
      item_data: categoryToDelete,
      related_items: relatedTasks,
    });

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

    await supabase.from("recycle_bin").insert({
      user_id: user.id,
      item_type: "task",
      item_data: taskToDelete,
      related_items: descendants,
    });

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
      const seriesId = Date.now().toString();
      const instances = generateRecurringInstances(event, seriesId);

      for (const instance of instances) {
        const supabaseEvent = mapEventToSupabase(instance, user.id);
        await supabase.from("events").insert(supabaseEvent);
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

    const supabaseUpdates = mapEventToSupabase(updates, user.id);
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
  }, [user]);

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

  const updateEventSeries = useCallback(async (seriesId: string, updates: Partial<CalendarEvent>) => {
    if (!user) return;

    const seriesEvents = events.filter((e) => e.seriesId === seriesId && !e.isException);
    if (seriesEvents.length === 0) return;

    const firstEvent = seriesEvents.sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

    for (const event of seriesEvents) {
      const eventUpdates = { ...updates };

      if (event.id !== firstEvent.id) {
        delete eventUpdates.startDate;
        delete eventUpdates.endDate;
      }

      const supabaseUpdates = mapEventToSupabase(eventUpdates, user.id);
      delete supabaseUpdates.user_id;

      await supabase
        .from("events")
        .update(supabaseUpdates)
        .eq("id", event.id)
        .eq("user_id", user.id);
    }

    setEvents((prev) =>
      prev.map((event) => {
        if (event.seriesId === seriesId && !event.isException) {
          const eventUpdates = { ...updates };
          if (event.id !== firstEvent.id) {
            delete eventUpdates.startDate;
            delete eventUpdates.endDate;
          }
          return { ...event, ...eventUpdates };
        }
        return event;
      })
    );
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

    const supabaseUpdates = mapEventToSupabase({ ...updates, isException: true }, user.id);
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

    setEvents((prev) =>
      prev.map((event) => (event.id === id ? { ...event, ...updates, isException: true } : event))
    );
  }, [user]);

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
    ]);

    setTasks([]);
    setEvents([]);
    setPeople([]);
    setRecycleBin([]);
  }, [user]);

  return (
    <AppContext.Provider
      value={{
        categories,
        tasks,
        events,
        people,
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
        restoreFromRecycleBin,
        permanentlyDelete,
        emptyRecycleBin,
        clearAllData,
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
