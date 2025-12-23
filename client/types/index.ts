export interface LifeCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  createdAt: number;
}

export type TaskType = 
  | "task"
  | "subtask"
  | "project"
  | "objective"
  | "goal"
  | "idea"
  | "list"
  | "item"
  | "resource";

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  categoryId: string;
  parentId: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  createdAt: number;
}

export type TaskHierarchy = Task & {
  children: TaskHierarchy[];
};

export const TASK_TYPES: { value: TaskType; label: string; icon: string }[] = [
  { value: "goal", label: "Goal", icon: "target" },
  { value: "objective", label: "Objective", icon: "flag" },
  { value: "project", label: "Project", icon: "folder" },
  { value: "task", label: "Task", icon: "check-square" },
  { value: "subtask", label: "Sub-task", icon: "corner-down-right" },
  { value: "idea", label: "Idea", icon: "zap" },
  { value: "list", label: "List", icon: "list" },
  { value: "item", label: "Item", icon: "circle" },
  { value: "resource", label: "Resource", icon: "link" },
];

export function getTaskTypeInfo(type: TaskType) {
  return TASK_TYPES.find((t) => t.value === type) || TASK_TYPES[3];
}
