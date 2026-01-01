export type RelationshipType = "family" | "friend" | "colleague" | "pet" | "teammate" | "other";

export type SharePermission = "view" | "edit" | "co-owner";

export interface ShareRecord {
  personId: string;
  permission: SharePermission;
  sharedAt: number;
  inviteCode?: string;
  inviteSentAt?: number;
  inviteAccepted?: boolean;
}

export interface CategoryInvite {
  categoryId: string;
  permission: SharePermission;
  status: "pending" | "accepted" | "declined";
  invitedAt: number;
  acceptedAt?: number;
}

export interface Person {
  id: string;
  name: string;
  relationship: RelationshipType;
  email?: string;
  phone?: string;
  photoUri?: string;
  notes?: string;
  createdAt: number;
  categoryIds?: string[];
  categoryInvites?: CategoryInvite[];
  inviteCode?: string;
  inviteSentAt?: number;
  isAppUser?: boolean;
}

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string; icon: string }[] = [
  { value: "family", label: "Family", icon: "heart" },
  { value: "friend", label: "Friend", icon: "smile" },
  { value: "colleague", label: "Colleague", icon: "briefcase" },
  { value: "pet", label: "Pet", icon: "github" },
  { value: "teammate", label: "Teammate", icon: "users" },
  { value: "other", label: "Other", icon: "user" },
];

export interface LifeCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  createdAt: number;
  peopleIds?: string[];
  sharedWith?: ShareRecord[];
  isShared?: boolean;
  sharePermission?: SharePermission;
  ownerId?: string;
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
  | "resource"
  | "appointment";

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  categoryId: string;
  parentId: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  createdAt: number;
  orderIndex?: number;
  assigneeIds?: string[];
  sharedWith?: ShareRecord[];
}

export interface DeletedItem {
  id: string;
  type: "task" | "category";
  data: Task | LifeCategory;
  relatedTasks?: Task[];
  deletedAt: number;
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
  { value: "appointment", label: "Appointment", icon: "calendar" },
  { value: "idea", label: "Idea", icon: "zap" },
  { value: "list", label: "List", icon: "list" },
  { value: "item", label: "Item", icon: "circle" },
  { value: "resource", label: "Resource", icon: "link" },
];

export function getTaskTypeInfo(type: TaskType) {
  return TASK_TYPES.find((t) => t.value === type) || TASK_TYPES[3];
}

export type EventType = "reminder" | "appointment" | "meeting" | "due_date";

export type RecurrenceType = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  eventType: EventType;
  recurrence: RecurrenceType;
  linkedTaskId: string | null;
  categoryId: string | null;
  createdAt: number;
  seriesId?: string | null;
  isException?: boolean;
  originalDate?: string;
  attendeeIds?: string[];
  sharedWith?: ShareRecord[];
}

export const EVENT_TYPES: { value: EventType; label: string; icon: string; color: string }[] = [
  { value: "reminder", label: "Reminder", icon: "bell", color: "#F59E0B" },
  { value: "appointment", label: "Appointment", icon: "calendar", color: "#3B82F6" },
  { value: "meeting", label: "Meeting", icon: "users", color: "#8B5CF6" },
  { value: "due_date", label: "Due Date", icon: "clock", color: "#EF4444" },
];

export const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function getEventTypeInfo(type: EventType) {
  return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[0];
}

export const SHARE_PERMISSIONS: { value: SharePermission; label: string; description: string; icon: string }[] = [
  { value: "view", label: "View Only", description: "Can view but not edit", icon: "eye" },
  { value: "edit", label: "Edit", description: "Can view and edit", icon: "edit-2" },
  { value: "co-owner", label: "Co-Owner", description: "Full access including sharing", icon: "users" },
];

export interface PendingShare {
  id: string;
  userId: string;
  bubbleId: string;
  inviteCode: string;
  contactType: "email" | "phone";
  contactValue: string;
  permission: SharePermission;
  status: "pending" | "accepted" | "expired";
  senderName?: string;
  bubbleName?: string;
  createdAt: number;
  acceptedAt?: number;
  expiresAt?: number;
}

export interface BubbleShare {
  id: string;
  bubbleId: string;
  ownerId: string;
  sharedWithId: string;
  permission: SharePermission;
  createdAt: number;
  updatedAt: number;
}
