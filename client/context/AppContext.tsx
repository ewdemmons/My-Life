import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  writeBatch,
  Unsubscribe
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { LifeCategory, Task, DeletedItem, CalendarEvent, Person } from "@/types";
import { CategoryColors } from "@/constants/theme";
import { generateRecurringInstances } from "@/utils/recurrence";

const showError = (message: string) => {
  if (Platform.OS === "web") {
    console.error(message);
    window.alert(message);
  } else {
    Alert.alert("Error", message);
  }
};

const RECYCLE_BIN_RETENTION_DAYS = 30;

const getUserStorageKey = (userId: string, key: string) => `@mylife_${userId}_${key}`;

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultCategories: Omit<LifeCategory, "id" | "createdAt">[] = [
  { name: "Family", description: "Family time and relationships", color: CategoryColors[0], icon: "heart" },
  { name: "Health", description: "Physical and mental wellness", color: CategoryColors[2], icon: "activity" },
  { name: "Work", description: "Career and professional growth", color: CategoryColors[3], icon: "briefcase" },
  { name: "Hobbies", description: "Fun activities and interests", color: CategoryColors[4], icon: "star" },
  { name: "Finance", description: "Money and investments", color: CategoryColors[5], icon: "dollar-sign" },
  { name: "Learning", description: "Education and skills", color: CategoryColors[6], icon: "book" },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [recycleBin, setRecycleBin] = useState<DeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const unsubscribesRef = useRef<Unsubscribe[]>([]);
  const currentUserIdRef = useRef<string | null>(null);

  const cleanupListeners = useCallback(() => {
    unsubscribesRef.current.forEach(unsub => unsub());
    unsubscribesRef.current = [];
  }, []);

  const clearLocalData = useCallback(() => {
    setCategories([]);
    setTasks([]);
    setEvents([]);
    setPeople([]);
    setRecycleBin([]);
  }, []);

  const cleanupExpiredItems = (items: DeletedItem[]): DeletedItem[] => {
    const retentionMs = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    return items.filter((item) => item.deletedAt > cutoff);
  };

  const getUserCollection = useCallback((collectionName: string) => {
    if (!user?.uid) throw new Error("User not authenticated");
    return collection(db, "users", user.uid, collectionName);
  }, [user?.uid]);

  const getUserDocRef = useCallback((collectionName: string, docId: string) => {
    if (!user?.uid) throw new Error("User not authenticated");
    return doc(db, "users", user.uid, collectionName, docId);
  }, [user?.uid]);

  const hasInitializedForUserRef = useRef<string | null>(null);

  const createDefaultBubbles = useCallback(async (userId: string) => {
    if (hasInitializedForUserRef.current === userId) {
      console.log("Default bubbles already created for this user, skipping");
      return;
    }
    
    hasInitializedForUserRef.current = userId;
    console.log("Creating default bubbles for new user");
    
    try {
      const batch = writeBatch(db);
      const newCategories: LifeCategory[] = [];
      
      defaultCategories.forEach((cat, index) => {
        const id = `default_${Date.now()}_${index}`;
        const newCategory: LifeCategory = {
          ...cat,
          id,
          createdAt: Date.now(),
        };
        newCategories.push(newCategory);
        const docRef = doc(db, "users", userId, "bubbles", id);
        batch.set(docRef, newCategory);
      });

      await batch.commit();
      console.log("Default bubbles created successfully");
    } catch (batchError) {
      console.log("Failed to create default bubbles in Firestore:", batchError);
      hasInitializedForUserRef.current = null;
    }
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    console.log("Loading data for user:", userId);
    setIsLoading(true);
    cleanupListeners();
    currentUserIdRef.current = userId;

    try {
      const bubblesPath = `users/${userId}/bubbles`;
      const tasksPath = `users/${userId}/tasks`;
      const eventsPath = `users/${userId}/events`;
      const peoplePath = `users/${userId}/people`;
      
      console.log(`Querying Firestore paths: ${bubblesPath}, ${tasksPath}, ${eventsPath}, ${peoplePath}`);
      
      const categoriesCol = collection(db, "users", userId, "bubbles");
      const tasksCol = collection(db, "users", userId, "tasks");
      const eventsCol = collection(db, "users", userId, "events");
      const peopleCol = collection(db, "users", userId, "people");

      const recycleBinKey = getUserStorageKey(userId, "recycle_bin");
      const recycleBinData = await AsyncStorage.getItem(recycleBinKey);
      if (recycleBinData) {
        const parsed = JSON.parse(recycleBinData);
        const cleaned = cleanupExpiredItems(parsed);
        setRecycleBin(cleaned);
        if (cleaned.length !== parsed.length) {
          await AsyncStorage.setItem(recycleBinKey, JSON.stringify(cleaned));
        }
      } else {
        setRecycleBin([]);
      }

      console.log(`Setting up real-time listeners for user: ${userId}`);
      
      let isFirstBubblesSnapshot = true;
      
      const unsubCategories = onSnapshot(
        query(categoriesCol), 
        async (snapshot) => {
          if (currentUserIdRef.current !== userId) return;
          console.log(`Firestore snapshot received for bubbles: ${snapshot.docs.length} docs`);
          
          const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LifeCategory));
          
          if (isFirstBubblesSnapshot && cats.length === 0) {
            console.log("First snapshot shows 0 bubbles - new user, creating defaults");
            await createDefaultBubbles(userId);
          } else if (cats.length > 0) {
            hasInitializedForUserRef.current = userId;
            setCategories(cats);
          }
          
          isFirstBubblesSnapshot = false;
          setIsLoading(false);
        },
        (error) => {
          console.log(`Firestore listener error (bubbles): ${error.code} - ${error.message}`);
          showError(`Unable to load data. Please check your connection.`);
          setIsLoading(false);
        }
      );

      const unsubTasks = onSnapshot(
        query(tasksCol), 
        (snapshot) => {
          if (currentUserIdRef.current !== userId) return;
          console.log(`Firestore snapshot received for tasks: ${snapshot.docs.length} docs`);
          const t = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
          setTasks(t);
        },
        (error) => {
          console.log(`Firestore listener error (tasks): ${error.code} - ${error.message}`);
        }
      );

      const unsubEvents = onSnapshot(
        query(eventsCol), 
        (snapshot) => {
          if (currentUserIdRef.current !== userId) return;
          console.log(`Firestore snapshot received for events: ${snapshot.docs.length} docs`);
          const e = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
          setEvents(e);
        },
        (error) => {
          console.log(`Firestore listener error (events): ${error.code} - ${error.message}`);
        }
      );

      const unsubPeople = onSnapshot(
        query(peopleCol), 
        (snapshot) => {
          if (currentUserIdRef.current !== userId) return;
          console.log(`Firestore snapshot received for people: ${snapshot.docs.length} docs`);
          const p = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Person));
          setPeople(p);
        },
        (error) => {
          console.log(`Firestore listener error (people): ${error.code} - ${error.message}`);
        }
      );

      unsubscribesRef.current = [unsubCategories, unsubTasks, unsubEvents, unsubPeople];

    } catch (error) {
      console.error("Error loading user data:", error);
      setIsLoading(false);
    }
  }, [cleanupListeners, createDefaultBubbles]);

  const clearUserData = useCallback(async () => {
    console.log("Clearing user data on logout");
    cleanupListeners();
    currentUserIdRef.current = null;
    hasInitializedForUserRef.current = null;
    clearLocalData();
    setIsLoading(false);
  }, [cleanupListeners, clearLocalData]);

  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      if (currentUserIdRef.current !== user.uid) {
        loadUserData(user.uid);
      }
    } else {
      if (currentUserIdRef.current !== null) {
        clearUserData();
      } else {
        setIsLoading(false);
      }
    }

    return () => {
      cleanupListeners();
    };
  }, [isAuthenticated, user?.uid, loadUserData, clearUserData, cleanupListeners]);

  const saveRecycleBin = async (items: DeletedItem[]) => {
    if (!user?.uid) return;
    const key = getUserStorageKey(user.uid, "recycle_bin");
    await AsyncStorage.setItem(key, JSON.stringify(items));
  };

  const addCategory = useCallback(async (category: Omit<LifeCategory, "id" | "createdAt">) => {
    if (!user?.uid) {
      showError("You must be signed in to add a category.");
      return;
    }
    
    const id = Date.now().toString();
    const newCategory: LifeCategory = {
      ...category,
      id,
      createdAt: Date.now(),
    };
    
    try {
      const docRef = getUserDocRef("bubbles", id);
      await setDoc(docRef, newCategory);
      setCategories(prev => [...prev, newCategory]);
    } catch (error: any) {
      console.error("Error adding category:", error);
      showError("Failed to save category. Please check your internet connection and Firestore settings.");
    }
  }, [user?.uid, getUserDocRef]);

  const updateCategory = useCallback(async (id: string, updates: Partial<LifeCategory>) => {
    if (!user?.uid) return;
    
    const category = categories.find(c => c.id === id);
    if (!category) return;
    
    try {
      const docRef = getUserDocRef("bubbles", id);
      await setDoc(docRef, { ...category, ...updates }, { merge: true });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } catch (error: any) {
      console.error("Error updating category:", error);
      showError("Failed to update category. Please try again.");
    }
  }, [user?.uid, categories, getUserDocRef]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!user?.uid) return;
    
    const categoryToDelete = categories.find((cat) => cat.id === id);
    if (!categoryToDelete) return;

    const relatedTasks = tasks.filter((task) => task.categoryId === id);
    
    const deletedItem: DeletedItem = {
      id: Date.now().toString(),
      type: "category",
      data: categoryToDelete,
      relatedTasks,
      deletedAt: Date.now(),
    };

    const batch = writeBatch(db);
    
    batch.delete(getUserDocRef("bubbles", id));
    
    relatedTasks.forEach(task => {
      batch.delete(getUserDocRef("tasks", task.id));
    });

    await batch.commit();

    const updatedRecycleBin = [...recycleBin, deletedItem];
    setRecycleBin(updatedRecycleBin);
    await saveRecycleBin(updatedRecycleBin);
  }, [user?.uid, categories, tasks, recycleBin, getUserDocRef]);

  const addTask = useCallback(async (task: Omit<Task, "id" | "createdAt">) => {
    if (!user?.uid) {
      showError("You must be signed in to add a task.");
      return;
    }
    
    const id = Date.now().toString();
    const newTask: Task = {
      ...task,
      id,
      createdAt: Date.now(),
    };
    
    try {
      const docRef = getUserDocRef("tasks", id);
      await setDoc(docRef, newTask);
      setTasks(prev => [...prev, newTask]);
    } catch (error: any) {
      console.error("Error adding task:", error);
      showError("Failed to save task. Please try again.");
    }
  }, [user?.uid, getUserDocRef]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!user?.uid) return;
    
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const docRef = getUserDocRef("tasks", id);
    await setDoc(docRef, { ...task, ...updates }, { merge: true });
  }, [user?.uid, tasks, getUserDocRef]);

  const deleteTask = useCallback(async (id: string) => {
    if (!user?.uid) return;
    
    const taskToDelete = tasks.find((t) => t.id === id);
    if (!taskToDelete) return;

    const getDescendants = (taskId: string): Task[] => {
      const children = tasks.filter((t) => t.parentId === taskId);
      return children.flatMap((child) => [child, ...getDescendants(child.id)]);
    };

    const descendants = getDescendants(id);
    const allDeletedTasks = [taskToDelete, ...descendants];

    const deletedItem: DeletedItem = {
      id: Date.now().toString(),
      type: "task",
      data: taskToDelete,
      relatedTasks: descendants,
      deletedAt: Date.now(),
    };

    const batch = writeBatch(db);
    allDeletedTasks.forEach(task => {
      batch.delete(getUserDocRef("tasks", task.id));
    });
    await batch.commit();

    const updatedRecycleBin = [...recycleBin, deletedItem];
    setRecycleBin(updatedRecycleBin);
    await saveRecycleBin(updatedRecycleBin);
  }, [user?.uid, tasks, recycleBin, getUserDocRef]);

  const reorderTasks = useCallback(async (taskIds: string[], parentId: string | null) => {
    if (!user?.uid) return;
    
    const batch = writeBatch(db);
    
    taskIds.forEach((taskId, index) => {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.parentId === parentId) {
        const docRef = getUserDocRef("tasks", taskId);
        batch.update(docRef, { orderIndex: index });
      }
    });
    
    await batch.commit();
  }, [user?.uid, tasks, getUserDocRef]);

  const moveTaskToParent = useCallback(async (taskId: string, newParentId: string | null, newCategoryId?: string) => {
    if (!user?.uid) return;
    
    const taskToMove = tasks.find((t) => t.id === taskId);
    if (!taskToMove) return;

    const getDescendants = (id: string): Task[] => {
      const children = tasks.filter((t) => t.parentId === id);
      return children.flatMap((child) => [child, ...getDescendants(child.id)]);
    };
    const descendants = getDescendants(taskId);

    const categoryId = newCategoryId || (newParentId ? tasks.find((t) => t.id === newParentId)?.categoryId : taskToMove.categoryId) || taskToMove.categoryId;

    const batch = writeBatch(db);
    
    const taskDocRef = getUserDocRef("tasks", taskId);
    batch.update(taskDocRef, { parentId: newParentId, categoryId, orderIndex: Date.now() });
    
    descendants.forEach(desc => {
      const descDocRef = getUserDocRef("tasks", desc.id);
      batch.update(descDocRef, { categoryId });
    });
    
    await batch.commit();
  }, [user?.uid, tasks, getUserDocRef]);

  const restoreFromRecycleBin = useCallback(async (id: string) => {
    if (!user?.uid) return;
    
    const item = recycleBin.find((i) => i.id === id);
    if (!item) return;

    const batch = writeBatch(db);

    if (item.type === "category") {
      const category = item.data as LifeCategory;
      const relatedTasks = item.relatedTasks || [];
      
      batch.set(getUserDocRef("bubbles", category.id), category);
      relatedTasks.forEach(task => {
        batch.set(getUserDocRef("tasks", task.id), task);
      });
    } else {
      const task = item.data as Task;
      const relatedTasks = item.relatedTasks || [];
      
      batch.set(getUserDocRef("tasks", task.id), task);
      relatedTasks.forEach(t => {
        batch.set(getUserDocRef("tasks", t.id), t);
      });
    }

    await batch.commit();

    const updatedRecycleBin = recycleBin.filter((i) => i.id !== id);
    setRecycleBin(updatedRecycleBin);
    await saveRecycleBin(updatedRecycleBin);
  }, [user?.uid, recycleBin, getUserDocRef]);

  const permanentlyDelete = useCallback(async (id: string) => {
    const updatedRecycleBin = recycleBin.filter((i) => i.id !== id);
    setRecycleBin(updatedRecycleBin);
    await saveRecycleBin(updatedRecycleBin);
  }, [recycleBin]);

  const emptyRecycleBin = useCallback(async () => {
    setRecycleBin([]);
    await saveRecycleBin([]);
  }, []);

  const getTasksByCategory = useCallback(
    (categoryId: string) => tasks.filter((task) => task.categoryId === categoryId),
    [tasks]
  );

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "id" | "createdAt">) => {
    if (!user?.uid) return;
    
    const baseTimestamp = Date.now();
    
    if (event.recurrence && event.recurrence !== "none") {
      const seriesId = baseTimestamp.toString();
      const instances = generateRecurringInstances(event, seriesId);
      
      const batch = writeBatch(db);
      instances.forEach((instance, index) => {
        const id = (baseTimestamp + index).toString();
        const newEvent: CalendarEvent = {
          ...instance,
          id,
          createdAt: baseTimestamp,
        };
        batch.set(getUserDocRef("events", id), newEvent);
      });
      await batch.commit();
    } else {
      const id = baseTimestamp.toString();
      const newEvent: CalendarEvent = {
        ...event,
        id,
        createdAt: baseTimestamp,
        seriesId: null,
      };
      const docRef = getUserDocRef("events", id);
      await setDoc(docRef, newEvent);
    }
  }, [user?.uid, getUserDocRef]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    if (!user?.uid) return;
    
    const event = events.find(e => e.id === id);
    if (!event) return;
    
    const docRef = getUserDocRef("events", id);
    await setDoc(docRef, { ...event, ...updates }, { merge: true });
  }, [user?.uid, events, getUserDocRef]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!user?.uid) return;
    
    const docRef = getUserDocRef("events", id);
    await deleteDoc(docRef);
  }, [user?.uid, getUserDocRef]);

  const updateEventSeries = useCallback(async (seriesId: string, updates: Partial<CalendarEvent>) => {
    if (!user?.uid) return;
    
    const seriesEvents = events.filter(e => e.seriesId === seriesId && !e.isException);
    if (seriesEvents.length === 0) return;
    
    const firstEvent = seriesEvents.sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    
    const batch = writeBatch(db);
    
    seriesEvents.forEach(event => {
      const eventUpdates = { ...updates };
      
      if (updates.startDate !== undefined && event.id !== firstEvent.id) {
        delete eventUpdates.startDate;
        delete eventUpdates.endDate;
      }
      
      const docRef = getUserDocRef("events", event.id);
      batch.update(docRef, eventUpdates);
    });
    
    await batch.commit();
  }, [user?.uid, events, getUserDocRef]);

  const deleteEventSeries = useCallback(async (seriesId: string) => {
    if (!user?.uid) return;
    
    const seriesEvents = events.filter(e => e.seriesId === seriesId);
    
    const batch = writeBatch(db);
    seriesEvents.forEach(event => {
      batch.delete(getUserDocRef("events", event.id));
    });
    await batch.commit();
  }, [user?.uid, events, getUserDocRef]);

  const updateEventInstance = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    if (!user?.uid) return;
    
    const event = events.find(e => e.id === id);
    if (!event) return;
    
    const docRef = getUserDocRef("events", id);
    await setDoc(docRef, { ...event, ...updates, isException: true }, { merge: true });
  }, [user?.uid, events, getUserDocRef]);

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
    if (!user?.uid) return;
    
    const id = Date.now().toString();
    const newPerson: Person = {
      ...person,
      id,
      createdAt: Date.now(),
    };
    
    const docRef = getUserDocRef("people", id);
    await setDoc(docRef, newPerson);

    if (newPerson.categoryIds && newPerson.categoryIds.length > 0) {
      const batch = writeBatch(db);
      categories.forEach(category => {
        if (newPerson.categoryIds!.includes(category.id)) {
          const existingPeopleIds = category.peopleIds || [];
          if (!existingPeopleIds.includes(newPerson.id)) {
            const catDocRef = getUserDocRef("bubbles", category.id);
            batch.update(catDocRef, { peopleIds: [...existingPeopleIds, newPerson.id] });
          }
        }
      });
      await batch.commit();
    }
  }, [user?.uid, categories, getUserDocRef]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    if (!user?.uid) return;
    
    const existingPerson = people.find((p) => p.id === id);
    if (!existingPerson) return;
    
    const oldCategoryIds = existingPerson.categoryIds || [];
    const newCategoryIds = updates.categoryIds !== undefined ? updates.categoryIds : oldCategoryIds;

    const docRef = getUserDocRef("people", id);
    await setDoc(docRef, { ...existingPerson, ...updates }, { merge: true });

    if (updates.categoryIds !== undefined) {
      const addedCategories = newCategoryIds.filter((cid) => !oldCategoryIds.includes(cid));
      const removedCategories = oldCategoryIds.filter((cid) => !newCategoryIds.includes(cid));

      if (addedCategories.length > 0 || removedCategories.length > 0) {
        const batch = writeBatch(db);
        categories.forEach(category => {
          const existingPeopleIds = category.peopleIds || [];
          if (addedCategories.includes(category.id) && !existingPeopleIds.includes(id)) {
            const catDocRef = getUserDocRef("bubbles", category.id);
            batch.update(catDocRef, { peopleIds: [...existingPeopleIds, id] });
          }
          if (removedCategories.includes(category.id)) {
            const catDocRef = getUserDocRef("bubbles", category.id);
            batch.update(catDocRef, { peopleIds: existingPeopleIds.filter((pid) => pid !== id) });
          }
        });
        await batch.commit();
      }
    }
  }, [user?.uid, people, categories, getUserDocRef]);

  const deletePerson = useCallback(async (id: string) => {
    if (!user?.uid) return;
    
    await deleteDoc(getUserDocRef("people", id));
    
    const batch = writeBatch(db);
    
    categories.forEach(category => {
      if (category.peopleIds?.includes(id)) {
        const catDocRef = getUserDocRef("bubbles", category.id);
        batch.update(catDocRef, { peopleIds: category.peopleIds.filter(pid => pid !== id) });
      }
    });
    
    tasks.forEach(task => {
      if (task.assigneeIds?.includes(id)) {
        const taskDocRef = getUserDocRef("tasks", task.id);
        batch.update(taskDocRef, { assigneeIds: task.assigneeIds.filter(pid => pid !== id) });
      }
    });
    
    events.forEach(event => {
      if (event.attendeeIds?.includes(id)) {
        const eventDocRef = getUserDocRef("events", event.id);
        batch.update(eventDocRef, { attendeeIds: event.attendeeIds.filter(pid => pid !== id) });
      }
    });
    
    await batch.commit();
  }, [user?.uid, categories, tasks, events, getUserDocRef]);

  const getPersonById = useCallback(
    (id: string) => people.find((person) => person.id === id),
    [people]
  );

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
