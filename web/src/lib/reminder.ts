/**
 * 오늘 영양제 알림 — Android 앱(Capacitor 네이티브)에서만. 웹은 isReminderSupported()=false.
 * 매일 같은 시각 1회 · id 고정 · 켜기=권한 요청+예약 · 끄기=취소. 서버 0.
 */
import { Capacitor } from "@capacitor/core";
import { DAILY_TEXT } from "../domain/supplement/daily_check";

export const REMINDER_ID = 7101;

export function isReminderSupported(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

/** true = 예약됨 · false = 권한 거부/미지원 */
export async function enableReminder(hour: number): Promise<boolean> {
  if (!isReminderSupported()) return false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return false;
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID,
      title: DAILY_TEXT.reminderTitle,
      body: DAILY_TEXT.reminderBody,
      schedule: { on: { hour, minute: 0 }, allowWhileIdle: true },
    }],
  });
  return true;
}

export async function disableReminder(): Promise<void> {
  if (!isReminderSupported()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}
