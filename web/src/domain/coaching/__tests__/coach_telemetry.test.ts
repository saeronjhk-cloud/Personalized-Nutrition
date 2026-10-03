/** IP/integration/coach_card_telemetry_eval_v1.md — T01~T12 (T13~T15 는 lib/__tests__) */
import { describe, expect, it } from "vitest";
import { coachCardId, grammarShownProps, shouldTrackShown, shownKey, v1ShownProps, type KV } from "../coach_telemetry";
import { sanitize } from "../../../lib/events_core";

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
};
const d = (s: string) => new Date(s);

describe("코칭 카드 노출 계측", () => {
  it("T01·T02 카드 id", () => {
    expect(coachCardId("G-PRO")).toBe("g_pro");
    expect(coachCardId("G-VEG")).toBe("g_veg");
    expect(coachCardId("G-AM")).toBe("g_am");
  });
  it("T03 키 = 로컬 날짜", () => {
    const now = new Date(2026, 9, 3, 9, 0);
    expect(shownKey(now, "g_pro")).toBe("coach_shown:2026-10-03:g_pro");
  });
  it("T04~T07 하루 1회 · 카드별", () => {
    const s = mem();
    const day1 = new Date(2026, 9, 3, 9), day1b = new Date(2026, 9, 3, 21), day2 = new Date(2026, 9, 4, 8);
    expect(shouldTrackShown(s, day1, "g_pro")).toBe(true);
    expect(s.m.get("coach_shown:2026-10-03:g_pro")).toBe("1");
    expect(shouldTrackShown(s, day1b, "g_pro")).toBe(false);
    expect(shouldTrackShown(s, day2, "g_pro")).toBe(true);
    expect(shouldTrackShown(s, day1b, "g_veg")).toBe(true);
  });
  it("T08 get 예외 → 전송", () => {
    const s: KV = { get: () => { throw new Error("x"); }, set: () => {} };
    expect(shouldTrackShown(s, d("2026-10-03T00:00:00Z"), "g_am")).toBe(true);
  });
  it("T09 set 예외 → 전송, 예외 없음", () => {
    const s: KV = { get: () => null, set: () => { throw new Error("quota"); } };
    expect(() => shouldTrackShown(s, d("2026-10-03T00:00:00Z"), "g_am")).not.toThrow();
    expect(shouldTrackShown(s, d("2026-10-03T00:00:00Z"), "g_am")).toBe(true);
  });
  it("T10·T11 props", () => {
    expect(grammarShownProps({ rule: "G-PRO" })).toEqual({ coach_card: "g_pro" });
    expect(v1ShownProps({ level: "strong" })).toEqual({ coach_card: "v1_protein", coach_level: "strong" });
  });
  it("T12 props 가 화이트리스트를 그대로 통과", () => {
    expect(sanitize(grammarShownProps({ rule: "G-VEG" }))).toEqual({ coach_card: "g_veg" });
    expect(sanitize(v1ShownProps({ level: "normal" }))).toEqual({ coach_card: "v1_protein", coach_level: "normal" });
  });
});
