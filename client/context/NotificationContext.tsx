import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AppNotification, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, NotificationType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { sendLocalNotification, setBadgeCount } from "@/utils/notifications";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  addNotification: (type: NotificationType, title: string, body: string, data?: Record<string, any>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  respondToConnectionRequest: (notificationId: string, personId: string, requesterId: string, accept: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading notifications:", error.message);
      return;
    }

    const mapped: AppNotification[] = (data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      data: n.data,
      isRead: n.is_read,
      createdAt: new Date(n.created_at).getTime(),
    }));

    setNotifications(mapped);
    setBadgeCount(mapped.filter((n) => !n.isRead).length);
  }, [user]);

  const loadPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error loading notification preferences:", error.message);
      return;
    }

    if (data?.notification_preferences) {
      setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...data.notification_preferences });
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, [loadNotifications, loadPreferences]);

  const shouldSendNotification = useCallback((type: NotificationType, prefs: NotificationPreferences): boolean => {
    if (!prefs.enabled) return false;
    
    switch (type) {
      case "bubble_shared":
      case "bubble_updated":
        return prefs.bubbleShares;
      case "task_assigned":
        return prefs.taskAssignments;
      case "event_reminder":
      case "event_updated":
        return prefs.eventReminders;
      case "connection_request":
      case "connection_accepted":
      case "connection_declined":
        return true;
      default:
        return true;
    }
  }, []);

  const handleConnectionResponse = useCallback(async (personId: string, accepted: boolean) => {
    if (!user) return;
    
    const newStatus = accepted ? "approved" : "declined";
    
    const { error } = await supabase
      .from("people")
      .update({ linked_consent_status: newStatus })
      .eq("id", personId)
      .eq("user_id", user.id);
    
    if (error) {
      console.error("Error updating consent status:", error.message);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const n = payload.new as any;
          const notificationType = n.type as NotificationType;
          const newNotification: AppNotification = {
            id: n.id,
            userId: n.user_id,
            type: notificationType,
            title: n.title,
            body: n.body,
            data: n.data,
            isRead: n.is_read,
            createdAt: new Date(n.created_at).getTime(),
          };
          setNotifications((prev) => {
            const updated = [newNotification, ...prev];
            const newUnreadCount = updated.filter((item) => !item.isRead).length;
            setBadgeCount(newUnreadCount);
            return updated;
          });
          
          if (shouldSendNotification(notificationType, preferences)) {
            sendLocalNotification(n.title, n.body, n.data);
          }

          if (notificationType === "connection_accepted" || notificationType === "connection_declined") {
            const personId = n.data?.personId as string;
            const accepted = n.data?.accepted as boolean;
            if (personId) {
              await handleConnectionResponse(personId, accepted);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, preferences, shouldSendNotification, handleConnectionResponse]);

  const addNotification = useCallback(
    async (type: NotificationType, title: string, body: string, data?: Record<string, any>) => {
      if (!user) return;

      const { error } = await supabase.from("notifications").insert({
        user_id: user.id,
        type,
        title,
        body,
        data: data || {},
        is_read: false,
      });

      if (error) {
        console.error("Error adding notification:", error.message);
      }
    },
    [user]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error marking notification as read:", error.message);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setBadgeCount(Math.max(0, unreadCount - 1));
    },
    [user, unreadCount]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error.message);
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setBadgeCount(0);
  }, [user]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!user) return;

      const notification = notifications.find((n) => n.id === id);
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting notification:", error.message);
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.isRead) {
        setBadgeCount(Math.max(0, unreadCount - 1));
      }
    },
    [user, notifications, unreadCount]
  );

  const clearAllNotifications = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error clearing notifications:", error.message);
      return;
    }

    setNotifications([]);
    setBadgeCount(0);
  }, [user]);

  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      if (!user) return;

      const newPrefs = { ...preferences, ...prefs };
      
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: newPrefs })
        .eq("id", user.id);

      if (error) {
        console.error("Error updating notification preferences:", error.message);
        return;
      }

      setPreferences(newPrefs);
    },
    [user, preferences]
  );

  const respondToConnectionRequest = useCallback(
    async (notificationId: string, personId: string, requesterId: string, accept: boolean) => {
      if (!user) return;

      try {
        await markAsRead(notificationId);

        const newConsentStatus = accept ? "approved" : "declined";
        
        const { error: updateError } = await supabase.rpc("respond_to_connection", {
          person_id: personId,
          responder_user_id: user.id,
          new_consent_status: newConsentStatus,
        });

        if (updateError) {
          console.error("Error updating consent status:", updateError);
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();

        const displayName = profileData?.display_name || user.email?.split("@")[0] || "A user";

        const notificationType = accept ? "connection_accepted" : "connection_declined";
        const title = accept ? "Connection Accepted" : "Connection Declined";
        const body = accept 
          ? `${displayName} has accepted your connection request. You can now notify them when assigning tasks or events.`
          : `${displayName} has declined your connection request.`;

        await supabase.from("notifications").insert({
          user_id: requesterId,
          type: notificationType,
          title,
          body,
          data: { personId, responderId: user.id, accepted: accept, url: "mylife://people" },
          is_read: false,
        });
      } catch (error) {
        console.error("Error responding to connection request:", error);
      }
    },
    [user, markAsRead]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        updatePreferences,
        refreshNotifications: loadNotifications,
        respondToConnectionRequest,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
