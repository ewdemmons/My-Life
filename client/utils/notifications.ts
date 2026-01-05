import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotificationType, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/types";

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
