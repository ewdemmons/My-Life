import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationType, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, CalendarEvent } from "@/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

export interface ScheduledNotificationResult {
  advanceId: string | null;
  atStartId: string | null;
}

export async function scheduleEventNotifications(
  event: CalendarEvent,
  bubbleName: string,
  minutesBefore: number = 60
): Promise<ScheduledNotificationResult> {
  if (Platform.OS === "web") {
    return { advanceId: null, atStartId: null };
  }

  const now = new Date();
  const eventStartTime = calculateEventDateTime(event.startDate, event.startTime);
  const advanceTime = new Date(eventStartTime.getTime() - minutesBefore * 60 * 1000);

  let advanceId: string | null = null;
  let atStartId: string | null = null;

  if (advanceTime > now && minutesBefore > 0) {
    try {
      advanceId = await Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: `Reminder: ${event.title} in ${minutesBefore} min${bubbleName ? ` in ${bubbleName}` : ""}`,
          data: { 
            eventId: event.id, 
            bubbleId: event.categoryId,
            type: "event_reminder" as NotificationType,
            isAdvance: true
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: advanceTime,
        },
      });
    } catch (error) {
      console.error("Error scheduling advance notification:", error);
    }
  }

  if (eventStartTime > now) {
    try {
      const formattedTime = event.startTime;
      atStartId = await Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: `Starting now: ${event.title} at ${formattedTime}${bubbleName ? ` in ${bubbleName}` : ""}`,
          data: { 
            eventId: event.id, 
            bubbleId: event.categoryId,
            type: "event_reminder" as NotificationType,
            isAdvance: false
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: eventStartTime,
        },
      });
    } catch (error) {
      console.error("Error scheduling at-start notification:", error);
    }
  }

  return { advanceId, atStartId };
}

export async function scheduleEventReminder(
  eventId: string,
  title: string,
  body: string,
  triggerDate: Date
): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const now = new Date();
  if (triggerDate <= now) {
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { eventId, type: "event_reminder" as NotificationType },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    return identifier;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
}

export async function cancelScheduledNotification(identifier: string): Promise<void> {
  if (Platform.OS === "web") return;
  
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error("Error canceling notification:", error);
  }
}

export async function cancelEventNotifications(
  advanceId: string | null | undefined,
  atStartId: string | null | undefined
): Promise<void> {
  if (Platform.OS === "web") return;
  
  const promises: Promise<void>[] = [];
  if (advanceId) {
    promises.push(cancelScheduledNotification(advanceId));
  }
  if (atStartId) {
    promises.push(cancelScheduledNotification(atStartId));
  }
  await Promise.all(promises);
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling all notifications:", error);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error("Error sending local notification:", error);
  }
}

export async function sendBubbleShareNotification(
  bubbleName: string,
  senderName: string,
  bubbleId: string
): Promise<void> {
  await sendLocalNotification(
    "Bubble Shared with You",
    `${senderName} shared "${bubbleName}" with you`,
    { 
      type: "bubble_shared" as NotificationType, 
      bubbleId 
    }
  );
}

export async function sendTaskAssignmentNotification(
  taskTitle: string,
  bubbleName: string,
  taskId: string,
  bubbleId: string | null
): Promise<void> {
  await sendLocalNotification(
    "Task Assigned",
    `Assigned: ${taskTitle}${bubbleName ? ` in ${bubbleName}` : ""}`,
    { 
      type: "task_assigned" as NotificationType, 
      taskId,
      bubbleId 
    }
  );
}

export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === "web") return 0;
  
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web") return;
  
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("Error setting badge count:", error);
  }
}

export function getDefaultPreferences(): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export function calculateReminderTime(
  eventDate: string,
  eventTime: string,
  minutesBefore: number = 60
): Date {
  const [hours, minutes] = eventTime.split(":").map(Number);
  const date = new Date(eventDate);
  date.setHours(hours, minutes, 0, 0);
  date.setMinutes(date.getMinutes() - minutesBefore);
  return date;
}

export function calculateEventDateTime(eventDate: string, eventTime: string): Date {
  const [year, month, day] = eventDate.split("-").map(Number);
  const [hours, minutes] = eventTime.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}
