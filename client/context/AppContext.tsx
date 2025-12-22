import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LifeCategory, Task } from "@/types";
import { CategoryColors } from "@/constants/theme";

const CATEGORIES_KEY = "@mylife_categories";
const TASKS_KEY = "@mylife_tasks";

interface AppContextType {
  categories: LifeCategory[];
  tasks: Task[];
  isLoading: boolean;
  addCategory: (category: Omit<LifeCategory, "id" | "createdAt">) => Promise<void>;
  updateCategory: (id: string, updates: Partial<LifeCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, "id" | "createdAt">) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTasksByCategory: (categoryId: string) => Task[];
  getTasksByDate: (date: string) => Task[];
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
  { id: "t1", title: "Call Mom", description: "Weekly check-in call", categoryId: "1", parentId: null, dueDate: new Date().toISOString().split("T")[0], priority: "high", status: "pending", createdAt: Date.now() },
  { id: "t2", title: "Morning jog", description: "30 minute run", categoryId: "2", parentId: null, dueDate: new Date().toISOString().split("T")[0], priority: "medium", status: "pending", createdAt: Date.now() },
  { id: "t3", title: "Project presentation", description: "Q4 review slides", categoryId: "3", parentId: null, dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0], priority: "high", status: "in_progress", createdAt: Date.now() },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<LifeCategory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesData, tasksData] = await Promise.all([
        AsyncStorage.getItem(CATEGORIES_KEY),
        AsyncStorage.getItem(TASKS_KEY),
      ]);
      
      if (categoriesData) {
        setCategories(JSON.parse(categoriesData));
      } else {
        setCategories(defaultCategories);
        await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(defaultCategories));
      }
      
      if (tasksData) {
        setTasks(JSON.parse(tasksData));
      } else {
        setTasks(defaultTasks);
        await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(defaultTasks));
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
    const updated = categories.filter((cat) => cat.id !== id);
    setCategories(updated);
    await saveCategories(updated);
    const updatedTasks = tasks.filter((task) => task.categoryId !== id);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  }, [categories, tasks]);

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
    const deleteRecursive = (taskId: string): string[] => {
      const childIds = tasks
        .filter((t) => t.parentId === taskId)
        .flatMap((t) => deleteRecursive(t.id));
      return [taskId, ...childIds];
    };
    const idsToDelete = deleteRecursive(id);
    const updated = tasks.filter((task) => !idsToDelete.includes(task.id));
    setTasks(updated);
    await saveTasks(updated);
  }, [tasks]);

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
        isLoading,
        addCategory,
        updateCategory,
        deleteCategory,
        addTask,
        updateTask,
        deleteTask,
        getTasksByCategory,
        getTasksByDate,
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
