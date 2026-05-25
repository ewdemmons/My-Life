/**
 * Shared Life Area permission helpers.
 *
 * INVESTIGATION (schema / app mapping):
 * - Life Areas: `life_bubbles` (owner = `user_id`, app: LifeCategory)
 * - Active shares: `bubble_shares` (`bubble_id`, `owner_id`, `shared_with_id`, `permission`)
 * - Pending invites: `pending_shares` (same `permission` column)
 * - Entries/events link via `tasks.bubble_id` / `events.bubble_id` (app: `categoryId`)
 *
 * Permission values in DB (exact strings):
 * - `view` — View Only (no edit/delete on entries in that Life Area)
 * - `edit` — Can view and edit (Full Control on others' entries)
 * - `co-owner` — Co-Owner / full access including sharing
 *
 * RLS: UPDATE on tasks/events already allows `permission IN ('edit', 'co-owner')`.
 * DELETE on tasks/events required an additional shared-bubble policy (see supabase/schema.sql).
 * Client previously blocked mutations via `.eq("user_id", currentUser)` on all updates/deletes.
 */

import type { LifeCategory, SharePermission } from "@/types";

/** Levels that may edit/delete/move any entry in a shared Life Area. */
const FULL_CONTROL_PERMISSIONS: SharePermission[] = ["edit", "co-owner"];

/** UI helper: shared Life Area allows entry edits (edit or co-owner, not view-only). */
export function canModifyEntriesInCategory(category: LifeCategory): boolean {
  if (!category.isShared) return true;
  return category.sharePermission !== "view";
}

/**
 * True if the user may fully manage entries in this Life Area (not view-only).
 * User A (owner): owned bubbles (`!isShared`) or `ownerId` match.
 * User B: `bubble_shares.permission` is `edit` or `co-owner` on this category.
 */
export function hasFullControlAccess(
  userId: string,
  categoryId: string,
  categories: LifeCategory[],
): boolean {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return false;
  if (!category.isShared) return true;
  if (category.ownerId === userId) return true;
  return (
    category.sharePermission != null &&
    FULL_CONTROL_PERMISSIONS.includes(category.sharePermission)
  );
}

/**
 * Whether the user may update/delete a specific task or event row.
 * View-only shared users cannot modify any entry in that Life Area.
 * Uncategorized items (no categoryId) are limited to the row owner.
 */
export function canModifyEntryInLifeArea(
  userId: string,
  entryUserId: string,
  categoryId: string | null,
  categories: LifeCategory[],
): boolean {
  if (!categoryId) return entryUserId === userId;
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return entryUserId === userId;
  if (!category.isShared) return true;
  if (category.sharePermission === "view") return false;
  return hasFullControlAccess(userId, categoryId, categories);
}

/** For bulk event mutations (.in) when rows share one Life Area. */
export function applyBulkLifeAreaOwnerFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  categoryId: string | null,
  currentUserId: string,
  categories: LifeCategory[],
): T {
  if (categoryId && hasFullControlAccess(currentUserId, categoryId, categories)) {
    return query;
  }
  return query.eq("user_id", currentUserId);
}

/** Apply user_id filter only when the user cannot modify via shared Life Area access. */
export function applyEntryOwnerFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  entryUserId: string,
  categoryId: string | null,
  currentUserId: string,
  categories: LifeCategory[],
): T {
  if (canModifyEntryInLifeArea(currentUserId, entryUserId, categoryId, categories)) {
    return query;
  }
  return query.eq("user_id", currentUserId);
}
