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

function mapCategoryToSupabaseBubble(category: Partial<LifeCategory>, userId: string) {
  const result: any = { user_id: userId };
  if (category.name !== undefined) result.name = category.name;
  if (category.description !== undefined) result.description = category.description;
  if (category.color !== undefined) result.color = category.color;
  if (category.icon !== undefined) result.icon = category.icon;
  if (category.peopleIds !== undefined) result.people_ids = category.peopleIds;
  return result;
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
      setupRealtimeSubscription();
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

  const setupRealtimeSubscription = () => {
    if (!user) return;

    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel(`life_bubbles_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "life_bubbles",
          filter: `user_id=eq.${user.id}`,
        },
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
            const deletedId = payload.old.id;
            setCategories((prev) => prev.filter((c) => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  };

  const cleanupExpiredItems = (items: DeletedItem[]): DeletedItem[] => {
    const retentionMs = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    return items.filter((item) => item.deletedAt > cutoff);
  };

  const loadData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const { data: bubblesData, error: bubblesError } = await supabase
        .from("life_bubbles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (bubblesError) {
        console.warn("Error loading bubbles:", bubblesError.message);
        setCategories([]);
      } else if (bubblesData && bubblesData.length > 0) {
        setCategories(bubblesData.map(mapSupabaseBubbleToCategory));
      } else {
        setCategories([]);
      }

      const userStoragePrefix = `${user.id}_`;
      const [tasksData, eventsData, peopleData, recycleBinData] = await Promise.all([
        AsyncStorage.getItem(userStoragePrefix + TASKS_KEY),
        AsyncStorage.getItem(userStoragePrefix + EVENTS_KEY),
        AsyncStorage.getItem(userStoragePrefix + PEOPLE_KEY),
        AsyncStorage.getItem(userStoragePrefix + RECYCLE_BIN_KEY),
      ]);

      if (tasksData) {
        const parsed = JSON.parse(tasksData);
        const migrated = parsed.map((task: any) => {
          const { dueDate, ...rest } = task;
          return { ...rest, type: task.type || "task" };
        });
        setTasks(migrated);
      } else {
        setTasks([]);
      }

      if (eventsData) {
        setEvents(JSON.parse(eventsData));
      } else {
        setEvents([]);
      }

      if (peopleData) {
        setPeople(JSON.parse(peopleData));
      } else {
        setPeople([]);
      }

      if (recycleBinData) {
        const parsed = JSON.parse(recycleBinData);
        const cleaned = cleanupExpiredItems(parsed);
        setRecycleBin(cleaned);
        if (cleaned.length !== parsed.length) {
          await AsyncStorage.setItem(userStoragePrefix + RECYCLE_BIN_KEY, JSON.stringify(cleaned));
        }
      } else {
        setRecycleBin([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setCategories([]);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTasks = async (newTasks: Task[]) => {
    if (!user) return;
    await AsyncStorage.setItem(`${user.id}_${TASKS_KEY}`, JSON.stringify(newTasks));
  };

  const saveRecycleBin = async (items: DeletedItem[]) => {
    if (!user) return;
    await AsyncStorage.setItem(`${user.id}_${RECYCLE_BIN_KEY}`, JSON.stringify(items));
  };

  const saveEvents = async (newEvents: CalendarEvent[]) => {
    if (!user) return;
    await AsyncStorage.setItem(`${user.id}_${EVENTS_KEY}`, JSON.stringify(newEvents));
  };

  const savePeople = async (newPeople: Person[]) => {
    if (!user) return;
    await AsyncStorage.setItem(`${user.id}_${PEOPLE_KEY}`, JSON.stringify(newPeople));
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

    const deletedItem: DeletedItem = {
      id: Date.now().toString(),
      type: "category",
      data: categoryToDelete,
      relatedTasks,
      deletedAt: Date.now(),
    };

    const updatedCategories = categories.filter((cat) => cat.id !== id);
    const updatedTasks = tasks.filter((task) => task.categoryId !== id);
    const updatedRecycleBin = [...recycleBin, deletedItem];

    setCategories(updatedCategories);
    setTasks(updatedTasks);
    setRecycleBin(updatedRecycleBin);

    await Promise.all([
      saveTasks(updatedTasks),
      saveRecycleBin(updatedRecycleBin),
    ]);
  }, [user, categories, tasks, recycleBin]);

  const addTask = useCallback(async (task: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks, user]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const updated = tasks.map((task) =>
      task.id === id ? { ...task, ...updates } : task
    );
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks, user]);

  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (!taskToDelete) return;

    const getDescendants = (taskId: string): Task[] => {
      const children = tasks.filter((t) => t.parentId === taskId);
      return children.flatMap((child) => [child, ...getDescendants(child.id)]);
    };

    const descendants = getDescendants(id);
    const allDeletedTasks = [taskToDelete, ...descendants];
    const idsToDelete = allDeletedTasks.map((t) => t.id);

    const deletedItem: DeletedItem = {
      id: Date.now().toString(),
      type: "task",
      data: taskToDelete,
      relatedTasks: descendants,
      deletedAt: Date.now(),
    };

    const updatedTasks = tasks.filter((task) => !idsToDelete.includes(task.id));
    const updatedRecycleBin = [...recycleBin, deletedItem];

    setTasks(updatedTasks);
    setRecycleBin(updatedRecycleBin);

    await Promise.all([
      saveTasks(updatedTasks),
      saveRecycleBin(updatedRecycleBin),
    ]);
  }, [tasks, recycleBin, user]);

  const reorderTasks = useCallback(async (taskIds: string[], parentId: string | null) => {
    const updated = tasks.map((task) => {
      const index = taskIds.indexOf(task.id);
      if (index !== -1 && task.parentId === parentId) {
        return { ...task, orderIndex: index };
      }
      return task;
    });
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks, user]);

  const moveTaskToParent = useCallback(async (taskId: string, newParentId: string | null, newCategoryId?: string) => {
    const taskToMove = tasks.find((t) => t.id === taskId);
    if (!taskToMove) return;

    const getDescendants = (id: string): Task[] => {
      const children = tasks.filter((t) => t.parentId === id);
      return children.flatMap((child) => [child, ...getDescendants(child.id)]);
    };
    const descendants = getDescendants(taskId);

    const categoryId = newCategoryId || (newParentId ? tasks.find((t) => t.id === newParentId)?.categoryId : taskToMove.categoryId) || taskToMove.categoryId;

    const updated = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, parentId: newParentId, categoryId, orderIndex: Date.now() };
      }
      if (descendants.find((d) => d.id === task.id)) {
        return { ...task, categoryId };
      }
      return task;
    });
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks, user]);

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
      const restoredTasks = relatedTasks.map((t) => ({ ...t, categoryId: restoredCategory.id }));

      const updatedCategories = [...categories, restoredCategory];
      const updatedTasks = [...tasks, ...restoredTasks];
      const updatedRecycleBin = recycleBin.filter((i) => i.id !== id);

      setCategories(updatedCategories);
      setTasks(updatedTasks);
      setRecycleBin(updatedRecycleBin);

      await Promise.all([
        saveTasks(updatedTasks),
        saveRecycleBin(updatedRecycleBin),
      ]);
    } else {
      const task = item.data as Task;
      const relatedTasks = item.relatedTasks || [];

      const updatedTasks = [...tasks, task, ...relatedTasks];
      const updatedRecycleBin = recycleBin.filter((i) => i.id !== id);

      setTasks(updatedTasks);
      setRecycleBin(updatedRecycleBin);

      await Promise.all([
        saveTasks(updatedTasks),
        saveRecycleBin(updatedRecycleBin),
      ]);
    }
  }, [user, categories, tasks, recycleBin]);

  const permanentlyDelete = useCallback(async (id: string) => {
    const updatedRecycleBin = recycleBin.filter((i) => i.id !== id);
    setRecycleBin(updatedRecycleBin);
    await saveRecycleBin(updatedRecycleBin);
  }, [recycleBin, user]);

  const emptyRecycleBin = useCallback(async () => {
    setRecycleBin([]);
    await saveRecycleBin([]);
  }, [user]);

  const getTasksByCategory = useCallback(
    (categoryId: string) => tasks.filter((task) => task.categoryId === categoryId),
    [tasks]
  );

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "id" | "createdAt">) => {
    const baseTimestamp = Date.now();

    if (event.recurrence && event.recurrence !== "none") {
      const seriesId = baseTimestamp.toString();
      const instances = generateRecurringInstances(event, seriesId);

      const newEvents: CalendarEvent[] = instances.map((instance, index) => ({
        ...instance,
        id: (baseTimestamp + index).toString(),
        createdAt: baseTimestamp,
      }));

      const updated = [...events, ...newEvents];
      setEvents(updated);
      await saveEvents(updated);
    } else {
      const newEvent: CalendarEvent = {
        ...event,
        id: baseTimestamp.toString(),
        createdAt: baseTimestamp,
        seriesId: null,
      };
      const updated = [...events, newEvent];
      setEvents(updated);
      await saveEvents(updated);
    }
  }, [events, user]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, ...updates } : event
    );
    setEvents(updated);
    await saveEvents(updated);
  }, [events, user]);

  const deleteEvent = useCallback(async (id: string) => {
    const updated = events.filter((event) => event.id !== id);
    setEvents(updated);
    await saveEvents(updated);
  }, [events, user]);

  const updateEventSeries = useCallback(async (seriesId: string, updates: Partial<CalendarEvent>) => {
    const seriesEvents = events.filter(e => e.seriesId === seriesId && !e.isException);
    if (seriesEvents.length === 0) return;

    const firstEvent = seriesEvents.sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

    const updated = events.map((event) => {
      if (event.seriesId === seriesId && !event.isException) {
        const eventUpdates = { ...updates };

        if (updates.startTime !== undefined) {
          eventUpdates.startTime = updates.startTime;
        }
        if (updates.endTime !== undefined) {
          eventUpdates.endTime = updates.endTime;
        }

        if (updates.startDate !== undefined && event.id === firstEvent.id) {
          eventUpdates.startDate = updates.startDate;
          if (updates.endDate !== undefined) {
            eventUpdates.endDate = updates.endDate;
          }
        } else {
          delete eventUpdates.startDate;
          delete eventUpdates.endDate;
        }

        return { ...event, ...eventUpdates };
      }
      return event;
    });
    setEvents(updated);
    await saveEvents(updated);
  }, [events, user]);

  const deleteEventSeries = useCallback(async (seriesId: string) => {
    const updated = events.filter((event) => event.seriesId !== seriesId);
    setEvents(updated);
    await saveEvents(updated);
  }, [events, user]);

  const updateEventInstance = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const updated = events.map((event) =>
      event.id === id ? { ...event, ...updates, isException: true } : event
    );
    setEvents(updated);
    await saveEvents(updated);
  }, [events, user]);

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
    const newPerson: Person = {
      ...person,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const updatedPeople = [...people, newPerson];
    setPeople(updatedPeople);
    await savePeople(updatedPeople);
  }, [people, user]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    const updated = people.map((person) =>
      person.id === id ? { ...person, ...updates } : person
    );
    setPeople(updated);
    await savePeople(updated);
  }, [people, user]);

  const deletePerson = useCallback(async (id: string) => {
    const updatedPeople = people.filter((person) => person.id !== id);
    setPeople(updatedPeople);
    await savePeople(updatedPeople);

    const updatedTasks = tasks.map((task) => ({
      ...task,
      assigneeIds: task.assigneeIds?.filter((pid) => pid !== id),
    }));
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);

    const updatedEvents = events.map((event) => ({
      ...event,
      attendeeIds: event.attendeeIds?.filter((pid) => pid !== id),
    }));
    setEvents(updatedEvents);
    await saveEvents(updatedEvents);
  }, [people, tasks, events, user]);

  const getPersonById = useCallback(
    (id: string) => people.find((person) => person.id === id),
    [people]
  );

  const clearAllData = useCallback(async () => {
    if (!user) return;

    const userStoragePrefix = `${user.id}_`;
    await AsyncStorage.multiRemove([
      userStoragePrefix + TASKS_KEY,
      userStoragePrefix + EVENTS_KEY,
      userStoragePrefix + PEOPLE_KEY,
      userStoragePrefix + RECYCLE_BIN_KEY,
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
