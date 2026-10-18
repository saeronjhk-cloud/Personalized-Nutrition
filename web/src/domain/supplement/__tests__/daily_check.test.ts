/** 오늘 영양제 챙기기 v1 — 평가셋 IP/evals/eval_supp_daily_v1.json(복사본 fixtures/) D01~D16 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dailyItems, toggle, dayView, prune, kstDate, parseStore, DAILY_TEXT, type DailyStore, type DailyItem } from "../daily_check";
import { BANNED_WORDS } from "../../checkup/compliance";
import { SUPP_DAILY_ENABLED } from "../../../lib/flags";

const EV = JSON.parse(readFileSync(resolve(__dirname, "fixtures/eval_supp_daily_v1.json"), "utf-8"));
const it2 = (ids: string[]): DailyItem[] => ids.map((id) => ({ id, label: id }));

describe("오늘 영양제 챙기기 평가셋", () => {
  for (const c of EV.items_cases) it(`${c.id} 목록`, () => {
    const got = dailyItems(c.answers);
    expect(got.map((x) => x.id)).toEqual(c.items);
    if (c.labels) expect(got.map((x) => x.label)).toEqual(c.labels);
  });
  for (const c of EV.store_cases) it(`${c.id}`, () => {
    let st: DailyStore = c.store;
    if (c.toggle) { for (const id of c.toggle) st = toggle(st, c.today, id); expect(st[c.today] ?? []).toEqual(c.checked); return; }
    if (c.afterPrune) { expect(Object.keys(prune(st, c.today)).sort()).toEqual(c.afterPrune); return; }
    const v = dayView(st, c.today, it2(c.items));
    if ("done" in c) expect(v.done).toBe(c.done);
    if ("streak" in c) expect(v.streak).toBe(c.streak);
    if ("text" in c) expect(v.doneText).toBe(c.text);
    if ("streakText" in c) expect(v.streakText).toBe(c.streakText);
  });
  for (const c of EV.date_cases) it(`${c.id} 한국 날짜`, () => expect(kstDate(new Date(c.utc))).toBe(c.kst));
  it("D15 손상된 저장값 → 빈 기록", () => {
    expect(parseStore("{not json")).toEqual({});
    expect(parseStore("[1,2]")).toEqual({});
    expect(parseStore(null)).toEqual({});
  });
  it("D16 문구 금지어·명령형 0", () => {
    for (const t of Object.values(DAILY_TEXT)) for (const w of [...BANNED_WORDS, "끊", "중단", "드세요"]) expect(t).not.toContain(w);
  });
});

describe("오늘 영양제 화면 연결", () => {
  it("기본 OFF · 재방문 홈에서 플래그로만 · 서버 저장 0", () => {
    expect(SUPP_DAILY_ENABLED).toBe(false);
    const home = readFileSync(resolve(__dirname, "../../../components/home/ReturningHome.tsx"), "utf-8");
    expect(home).toContain("{SUPP_DAILY_ENABLED && <SuppDaily />}");
    const comp = readFileSync(resolve(__dirname, "../../../components/home/SuppDaily.tsx"), "utf-8");
    const store = readFileSync(resolve(__dirname, "../../../lib/suppDailyStore.ts"), "utf-8");
    for (const src of [comp, store]) { expect(src).not.toContain("supabase"); expect(src).not.toContain("오늘 영양제를 모두"); }
  });
  it("알림은 네이티브에서만", () => {
    const r = readFileSync(resolve(__dirname, "../../../lib/reminder.ts"), "utf-8");
    expect(r).toContain("Capacitor.isNativePlatform()");
    expect(r).toContain('await import("@capacitor/local-notifications")');
  });
});
