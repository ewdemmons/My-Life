import { supabase } from "./supabase";

export interface LifeBubble {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  sort_order: number;
}

export const DEFAULT_BUBBLES = [
  {
    name: "Family",
    color: "#6B7AED",
    icon: "heart",
    description: "Family relationships and quality time",
    sort_order: 0,
  },
  {
    name: "Home",
    color: "#E57373",
    icon: "home",
    description: "Home management and living space",
    sort_order: 1,
  },
  {
    name: "Health",
    color: "#4CAF50",
    icon: "activity",
    description: "Physical and mental wellness",
    sort_order: 2,
  },
  {
    name: "Work",
    color: "#FF9800",
    icon: "briefcase",
    description: "Career and professional goals",
    sort_order: 3,
  },
  {
    name: "Learning",
    color: "#26A69A",
    icon: "monitor",
    description: "Education and personal growth",
    sort_order: 4,
  },
  {
    name: "Finance",
    color: "#2E7D6B",
    icon: "dollar-sign",
    description: "Financial planning and goals",
    sort_order: 5,
  },
  {
    name: "Hobbies",
    color: "#9C7AED",
    icon: "star",
    description: "Recreation and creative pursuits",
    sort_order: 6,
  },
];

export async function initializeDefaultBubbles(userId: string): Promise<boolean> {
  try {
    const { data: existingBubbles, error: fetchError } = await supabase
      .from("life_bubbles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (fetchError) {
      console.warn("Error checking bubbles:", fetchError.message);
      return false;
    }

    if (existingBubbles && existingBubbles.length > 0) {
      return true;
    }

    const bubblesWithUserId = DEFAULT_BUBBLES.map((bubble) => ({
      ...bubble,
      user_id: userId,
    }));

    const { error: insertError } = await supabase
      .from("life_bubbles")
      .insert(bubblesWithUserId);

    if (insertError) {
      console.warn("Error creating default bubbles:", insertError.message);
      return false;
    }

    console.log("Default bubbles created successfully");
    return true;
  } catch (err) {
    console.warn("Error initializing bubbles:", err);
    return false;
  }
}

export async function fetchUserBubbles(userId: string): Promise<LifeBubble[]> {
  try {
    const { data, error } = await supabase
      .from("life_bubbles")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Error fetching bubbles:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn("Error fetching bubbles:", err);
    return [];
  }
}
