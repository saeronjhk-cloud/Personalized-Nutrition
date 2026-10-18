/**
 * 오늘 영양제 챙기기 v1 (순수 · 결정론 · IO 0) — 재방문 장치(전체 리뷰 자문 J1)
 * 설계·평가셋: IP/integration/supplement_daily_v1/00_설계·평가셋_v1.md · IP/evals/eval_supp_daily_v1.json (D01~D16)
 * - 기록은 기기 안에만(lib/suppDailyStore.ts). 복용량·시간 권고 없음. 끊김을 탓하지 않음.
 */
import type { SurveyAnswers } from "../../types";
import { CURRENT_SUPPLEMENT_OPTIONS } from "../survey/supplement_options";

/** 날짜(YYYY-MM-DD, 한국 시간) → 그날 챙긴 id 목록 */
export type DailyStore = Record<string, string[]>;
export interface DailyItem { id: string; label: string }

export const KEEP_DAYS = 60;
export const STREAK_MIN = 2;
export const DAILY_TEXT = {
  title: "💊 오늘 영양제",
  allDone: "오늘 영양제를 모두 챙기셨어요.",
  streak: "{n}일째 모두 챙기는 중",
  reminderBody: "오늘 영양제 챙기셨나요?",
  reminderTitle: "서박사의 영양공식",
} as const;

const ORDER: { id: string; label: string }[] = CURRENT_SUPPLEMENT_OPTIONS.flatMap((o) => o.ids.map((id) => ({ id, label: o.label })));

/** 최근 설문의 현재 복용 영양제 → 설문 선택지 순서, 모르는 id 제외 */
export function dailyItems(a: Pick<SurveyAnswers, "현재복용영양제"> | null | undefined): DailyItem[] {
  const cur = new Set(a?.현재복용영양제 ?? []);
  return ORDER.filter((o) => cur.has(o.id));
}

/** 한국 시간 날짜 */
export function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function addDays(ymd: string, d: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + d * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function toggle(store: DailyStore, date: string, id: string): DailyStore {
  const cur = new Set(store[date] ?? []);
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  const next = { ...store };
  if (cur.size) next[date] = [...cur]; else delete next[date];
  return next;
}

/** 그날 지금 목록을 모두 챙겼나(목록이 바뀌면 지금 목록 기준 — 보수적) */
export function allDoneOn(store: DailyStore, date: string, items: DailyItem[]): boolean {
  if (items.length === 0) return false;
  const got = new Set(store[date] ?? []);
  return items.every((i) => got.has(i.id));
}

/** 모두 챙긴 날 연속 수 — 오늘이 미완이면 어제부터 셈(오늘 미완은 끊김 아님) */
export function streak(store: DailyStore, today: string, items: DailyItem[]): number {
  let d = allDoneOn(store, today, items) ? today : addDays(today, -1);
  let n = 0;
  while (allDoneOn(store, d, items)) { n++; d = addDays(d, -1); }
  return n;
}

export function prune(store: DailyStore, today: string): DailyStore {
  const min = addDays(today, -KEEP_DAYS);
  const out: DailyStore = {};
  for (const [k, v] of Object.entries(store)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k >= min && Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string");
  return out;
}

export interface DayView { checked: string[]; done: boolean; doneText: string | null; streak: number; streakText: string | null }
export function dayView(store: DailyStore, today: string, items: DailyItem[]): DayView {
  const done = allDoneOn(store, today, items);
  const n = streak(store, today, items);
  return {
    checked: (store[today] ?? []).filter((id) => items.some((i) => i.id === id)),
    done,
    doneText: done ? DAILY_TEXT.allDone : null,
    streak: n,
    streakText: n >= STREAK_MIN ? DAILY_TEXT.streak.replace("{n}", String(n)) : null,
  };
}

/** 저장 문자열 → 기록(손상이면 빈 기록) */
export function parseStore(raw: string | null | undefined): DailyStore {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as DailyStore) : {};
  } catch { return {}; }
}
