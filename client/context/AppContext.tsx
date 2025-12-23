import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LifeCategory, Task, DeletedItem } from "@/types";
import { CategoryColors } from "@/constants/theme";

const CATEGORIES_KEY = "@mylife_categories";
const TASKS_KEY = "@mylife_tasks";
const RECYCLE_BIN_KEY = "@mylife_recycle_bin";
const RECYCLE_BIN_RETENTION_DAYS = 30;

interface AppContextType {
  categories: LifeCategory[];
  tasks: Task[];
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
  getTasksByDate: (date: string) => Task[];
  restoreFromRecycleBin: (id: string) => Promise<void>;
  permanentlyDelete: (id: string) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultCategories: LifeCategory[] = [
  { id: "1", name: "Family", description: "Family time and relationships", color: CategoryColors[0], icon: "heart", createdAt: Date.now() },
  { id: "2", name: "Health", description: "Physical and mental wellness", color: CategoryColors[2], icon: "activity", createdAt: Date.now() },
  { id: "3", name: "Work", description: "Career and professional growth", color: CategoryColors[3], icon: "briefcase", createdAt: Date.now() },
  { id: "4", name: "Hobbies", description: "Fun activities and interests", color: CategoryColors[4], icon: "star", createdAt: Date.now() },
  { id: "5", name: "Finance", description: "Money and investments", color: CategoryColors[5], icon: "dollar-sign", createdAt: Date.now() },
  { id: "6", name: "Learning", description: "Education and skills", color: CategoryColors[6], icon: "book", createdAt: Date.now() },
];

const defaultTasks: Task[] = [
  { id: "t1", title: "Call Mom", description: "Weekly check-in call", type: "task", categoryId: "1", parentId: null, dueDate: new Date().toISOString().split("T")[0], priority: "high", status: "pending", createdAt: Date.now() },
  { id: "t2", title: "Get Fit This Year", description: "Annual health and fitness goal", type: "goal", categoryId: "2", parentId: null, dueDate: null, priority: "high", status: "in_progress", createdAt: Date.now() },
  { id: "t2a", title: "Build Running Habit", description: "Run 3x per week", type: "objective", categoryId: "2", parentId: "t2", dueDate: null, priority: "high", status: "in_progress", createdAt: Date.now() + 1 },
  { id: "t2b", title: "Morning Jog Routine", description: "30 min run each session", type: "project", categoryId: "2", parentId: "t2a", dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0], priority: "medium", status: "in_progress", createdAt: Date.now() + 2 },
  { id: "t2c", title: "Today's Run", description: "30 minute jog around the park", type: "task", categoryId: "2", parentId: "t2b", dueDate: new Date().toISOString().split("T")[0], priority: "medium", status: "pending", createdAt: Date.now() + 3 },
  { id: "t2d", title: "Warm up stretches", description: "5 min dynamic stretching", type: "subtask", categoryId: "2", parentId: "t2c", dueDate: new Date().toISOString().split("T")[0], priority: "low", status: "pending", createdAt: Date.now() + 4 },
  { id: "t3", title: "Q4 Business Review", description: "Quarterly review project", type: "project", categoryId: "3", parentId: null, dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0], priority: "high", status: "in_progress", createdAt: Date.now() },
  { id: "t3a", title: "Prepare Slides", description: "Create presentation deck", type: "task", categoryId: "3", parentId: "t3", dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0], priority: "high", status: "pending", createdAt: Date.now() + 1 },
  { id: "t3b", title: "Gather Sales Data", description: "Pull Q4 numbers from CRM", type: "subtask", categoryId: "3", parentId: "t3a", dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0], priority: "medium", status: "pending", createdAt: Date.now() + 2 },
  { id: "t4", title: "New App Feature Ideas", description: "Brainstorm ideas for the mobile app", type: "list", categoryId: "3", parentId: null, dueDate: null, priority: "low", status: "pending", createdAt: Date.now() },
  { id: "t4a", title: "Dark mode improvements", description: "Better contrast ratios", type: "idea", categoryId: "3", parentId: "t4", dueDate: null, priority: "low", status: "pending", createdAt: Date.now() + 1 },
  { id: "t4b", title: "Push notifications", description: "Task reminders", type: "idea", categoryId: "3", parentId: "t4", dueDate: null, priority: "medium", status: "pending", createdAt: Date.now() + 2 },
  { id: "t5", title: "Doctor Appointment", description: "Annual checkup", type: "appointment", categoryId: "2", parentId: null, dueDate: new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0], priority: "high", status: "pending", createdAt: Date.now() },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recycleBin, setRecycleBin] = useState<DeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const cleanupExpiredItems = (items: DeletedItem[]): DeletedItem[] => {
    const retentionMs = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    return items.filter((item) => item.deletedAt > cutoff);
  };

  const loadData = async () => {
    try {
      const [categoriesData, tasksData, recycleBinData] = await Promise.all([
        AsyncStorage.getItem(CATEGORIES_KEY),
        AsyncStorage.getItem(TASKS_KEY),
        AsyncStorage.getItem(RECYCLE_BIN_KEY),
      ]);
      
      if (categoriesData) {
        setCategories(JSON.parse(categoriesData));
      } else {
        setCategories(defaultCategories);
        await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(defaultCategories));
      }
      
      if (tasksData) {
        const parsed = JSON.parse(tasksData);
        const migrated = parsed.map((task: any) => ({
          ...task,
          type: task.type || "task",
        }));
        setTasks(migrated);
        if (parsed.some((t: any) => !t.type)) {
          await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(migrated));
        }
      } else {
        setTasks(defaultTasks);
        await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(defaultTasks));
      }

      if (recycleBinData) {
        const parsed = JSON.parse(recycleBinData);
        const cleaned = cleanupExpiredItems(parsed);
        setRecycleBin(cleaned);
        if (cleaned.length !== parsed.length) {
          await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(cleaned));
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setCategories(defaultCategories);
      setTasks(defaultTasks);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCategories = async (newCategories: LifeCategory[]) => {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(newCategories));
  };

  const saveTasks = async (newTasks: Task[]) => {
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(newTasks));
  };

  const saveRecycleBin = async (items: DeletedItem[]) => {
    await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(items));
  };

  const addCategory = useCallback(async (category: Omit<LifeCategory, "id" | "createdAt">) => {
    const newCategory: LifeCategory = {
      ...category,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const updated = [...categories, newCategory];
    setCategories(updated);
    await saveCategories(updated);
  }, [categories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<LifeCategory>) => {
    const updated = categories.map((cat) =>
      cat.id === id ? { ...cat, ...updates } : cat
    );
    setCategories(updated);
    await saveCategories(updated);
  }, [categories]);

  const deleteCategory = useCallback(async (id: string) => {
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

    const updatedCategories = categories.filter((cat) => cat.id !== id);
    const updatedTasks = tasks.filter((task) => task.categoryId !== id);
    const updatedRecycleBin = [...recycleBin, deletedItem];

    setCategories(updatedCategories);
    setTasks(updatedTasks);
    setRecycleBin(updatedRecycleBin);

    await Promise.all([
      saveCategories(updatedCategories),
      saveTasks(updatedTasks),
      saveRecycleBin(updatedRecycleBin),
    ]);
  }, [categories, tasks, recycleBin]);

  const addTask = useCallback(async (task: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const updated = tasks.map((task) =>
      task.id === id ? { ...task, ...updates } : task
    );
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks]);

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
  }, [tasks, recycleBin]);

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
  }, [tasks]);

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
  }, [tasks]);

  const restoreFromRecycleBin = useCallback(async (id: string) => {
    const item = recycleBin.find((i) => i.id === id);
    if (!item) return;

    if (item.type === "category") {
      const category = item.data as LifeCategory;
      const relatedTasks = item.relatedTasks || [];
      
      const updatedCategories = [...categories, category];
      const updatedTasks = [...tasks, ...relatedTasks];
      const updatedRecycleBin = recycleBin.filter((i) => i.id !== id);

      setCategories(updatedCategories);
      setTasks(updatedTasks);
      setRecycleBin(updatedRecycleBin);

      await Promise.all([
        saveCategories(updatedCategories),
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
  }, [categories, tasks, recycleBin]);

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

  const getTasksByDate = useCallback(
    (date: string) => tasks.filter((task) => task.dueDate === date),
    [tasks]
  );

  return (
    <AppContext.Provider
      value={{
        categories,
        tasks,
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
        getTasksByDate,
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
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
