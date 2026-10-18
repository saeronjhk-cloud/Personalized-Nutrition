/** 오늘 영양제 챙기기 — 기기 안 저장(서버 전송 0). 실패해도 화면은 빈 기록으로 동작. */
import { parseStore, prune, type DailyStore } from "../domain/supplement/daily_check";

const KEY = "nf_supp_daily_v1";
const REMINDER_KEY = "nf_supp_reminder_v1";

export function loadDaily(today: string): DailyStore {
  try { return prune(parseStore(localStorage.getItem(KEY)), today); } catch { return {}; }
}
export function saveDaily(store: DailyStore): void {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 저장 실패는 무시 */ }
}

export type ReminderPref = { on: boolean; hour: 8 | 12 | 20 };
export function loadReminderPref(): ReminderPref {
  try {
    const v = JSON.parse(localStorage.getItem(REMINDER_KEY) || "null");
    if (v && typeof v.on === "boolean" && [8, 12, 20].includes(v.hour)) return v;
  } catch { /* 손상 → 기본값 */ }
  return { on: false, hour: 20 };
}
export function saveReminderPref(p: ReminderPref): void {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(p)); } catch { /* 무시 */ }
}
