/** 검진 임시 조치 해제 U03 — 해제 상태 saveCheckup 은 서버에 저장한다 · 정본 IP/integration/checkup_interim_pause_eval_v1.md */
import { describe, it, expect, vi } from "vitest";

const calls: string[] = [];
// 표별로 실제와 같은 응답 모양: checkup_records 는 .single() → 객체, 나머지는 배열(1행)
vi.mock("../supabase", () => {
  const mk = (t: string): any => {
    let single = false;
    const chain: any = new Proxy({}, {
      get: (_t, k) => {
        if (k === "then") return (r: any) => r({ data: single ? { id: "r1" } : [{ id: t === "biomarker_values" ? "v1" : "r1" }], error: null });
        if (k === "single") return () => { single = true; return chain; };
        return () => chain;
      },
    });
    return chain;
  };
  return { supabase: { from: (t: string) => { calls.push(t); return mk(t); } } };
});
import { saveCheckup } from "../checkup_api";
import { CHECKUP_SAVE_PAUSED, PAUSE_SAVE_ERROR } from "../../domain/checkup/interim_pause";

describe("검진 저장 해제(API)", () => {
  it("U03 saveCheckup → profiles(upsert) → checkup_records → biomarker_values", async () => {
    expect(CHECKUP_SAVE_PAUSED).toBe(false);
    const r = await saveCheckup({ user_id: "u", sex: "M", birth_year: 1970, recorded_date: "2026-10-11", biomarker_input: { BMI: 22 }, rules_by_key: { BMI: { unit: "" } } });
    expect(r.error).not.toBe(PAUSE_SAVE_ERROR);
    expect(calls).toEqual(["profiles", "checkup_records", "biomarker_values"]);
    expect(r).toEqual({ record_id: "r1", values_count: 1, error: null });
  });
});
