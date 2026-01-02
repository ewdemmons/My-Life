import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_INVITE_CODE_KEY = "@mylife_pending_invite_code";

export async function savePendingInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, code);
    console.log("Saved pending invite code:", code);
  } catch (error) {
    console.error("Error saving invite code:", error);
  }
}

export async function getPendingInviteCode(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(PENDING_INVITE_CODE_KEY);
    return code;
  } catch (error) {
    console.error("Error getting invite code:", error);
    return null;
  }
}

export async function clearPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_CODE_KEY);
  } catch (error) {
    console.error("Error clearing invite code:", error);
  }
}

export async function activatePendingInvite(userId: string, userEmail: string): Promise<{
  success: boolean;
  bubbleName?: string;
  senderName?: string;
  count?: number;
  error?: string;
}> {
  try {
    const inviteCode = await getPendingInviteCode();
    if (!inviteCode) {
      const emailResult = await checkPendingInvitesByEmail(userId, userEmail);
      return emailResult;
    }

    const { data, error } = await supabase.rpc("activate_pending_invite", {
      p_invite_code: inviteCode,
    });

    await clearPendingInviteCode();

    if (error) {
      console.error("Error calling activate_pending_invite RPC:", error);
      return { success: false, error: "Failed to activate invite" };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || "Invalid or expired invite code" };
    }

    return {
      success: true,
      bubbleName: data.bubble_name,
      senderName: data.sender_name,
      count: 1,
    };
  } catch (error) {
    console.error("Error activating pending invite:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function redeemInviteCode(code: string): Promise<{
  success: boolean;
  bubbleName?: string;
  senderName?: string;
  error?: string;
}> {
  try {
    console.log("DEBUG: Calling activate_pending_invite with code:", code.toUpperCase().trim());
    const { data, error } = await supabase.rpc("activate_pending_invite", {
      p_invite_code: code.toUpperCase().trim(),
    });

    console.log("DEBUG: RPC response - data:", JSON.stringify(data), "error:", JSON.stringify(error));

    if (error) {
      console.error("Error calling activate_pending_invite RPC:", error);
      return { success: false, error: "Failed to activate invite" };
    }

    if (!data || !data.success) {
      console.log("DEBUG: RPC returned unsuccessful:", data);
      return { success: false, error: data?.error || "Invalid or expired invite code" };
    }

    // Verify the share was actually created
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    console.log("DEBUG: Current user ID:", userId);
    
    const { data: shares, error: sharesError } = await supabase
      .from("bubble_shares")
      .select("*")
      .eq("shared_with_id", userId || "");
    console.log("DEBUG: Current bubble_shares for user:", JSON.stringify(shares), "error:", JSON.stringify(sharesError));

    return {
      success: true,
      bubbleName: data.bubble_name,
      senderName: data.sender_name,
    };
  } catch (error) {
    console.error("Error redeeming invite code:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function checkPendingInvitesByEmail(userId: string, userEmail: string): Promise<{
  success: boolean;
  bubbleName?: string;
  senderName?: string;
  count?: number;
  error?: string;
}> {
  try {
    const { data: invites, error: fetchError } = await supabase
      .from("pending_shares")
      .select("*")
      .eq("contact_type", "email")
      .eq("contact_value", userEmail.toLowerCase())
      .eq("status", "pending");

    if (fetchError || !invites || invites.length === 0) {
      return { success: false };
    }

    let activatedCount = 0;
    let lastBubbleName = "";
    let lastSenderName = "";

    for (const invite of invites) {
      const now = new Date();
      const expiresAt = new Date(invite.expires_at);

      if (now > expiresAt) {
        await supabase
          .from("pending_shares")
          .update({ status: "expired" })
          .eq("id", invite.id);
        continue;
      }

      const { error: shareError } = await supabase.from("bubble_shares").upsert(
        {
          bubble_id: invite.bubble_id,
          owner_id: invite.user_id,
          shared_with_id: userId,
          permission: invite.permission,
        },
        { onConflict: "bubble_id,shared_with_id" }
      );

      if (!shareError) {
        await supabase
          .from("pending_shares")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", invite.id);

        activatedCount++;
        lastBubbleName = invite.bubble_name;
        lastSenderName = invite.sender_name;
      }
    }

    if (activatedCount > 0) {
      return {
        success: true,
        bubbleName: lastBubbleName,
        senderName: lastSenderName,
        count: activatedCount,
      };
    }

    return { success: false };
  } catch (error) {
    console.error("Error checking pending invites by email:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
