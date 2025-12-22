export interface LifeCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
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
