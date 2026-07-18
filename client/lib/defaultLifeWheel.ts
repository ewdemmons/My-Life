import type { LifeCategory } from "@/types";

const DEFAULT_LIFE_AREAS: Array<{ name: string; color: string; icon: string }> = [
  { name: "Home", color: "#06B6D4", icon: "home" },
  { name: "Family", color: "#EC4899", icon: "users" },
  { name: "Health", color: "#10B981", icon: "activity" },
  { name: "Work", color: "#3B82F6", icon: "briefcase" },
  { name: "Finances", color: "#F59E0B", icon: "dollar-sign" },
  { name: "Hobbies", color: "#8B5CF6", icon: "star" },
];

type AddCategoryFn = (category: Omit<LifeCategory, "id" | "createdAt">) => Promise<LifeCategory | void>;

export async function createDefaultLifeWheel(
  addCategory: AddCategoryFn,
  categories: LifeCategory[]
): Promise<LifeCategory[]> {
  if (categories.length > 0) return categories;

  const created: LifeCategory[] = [];
  for (const area of DEFAULT_LIFE_AREAS) {
    const result = await addCategory({
      name: area.name,
      description: "",
      color: area.color,
      icon: area.icon,
      peopleIds: [],
    });
    if (result) created.push(result);
  }
  return created;
}
