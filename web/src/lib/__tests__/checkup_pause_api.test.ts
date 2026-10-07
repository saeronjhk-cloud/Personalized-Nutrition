/** 검진 임시 조치 v1 P02~P05 · 정본 IP/integration/checkup_interim_pause_eval_v1.md */
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: string[] = [];
vi.mock("../supabase", () => {
  const chain: any = new Proxy({}, { get: (_t, k) => (k === "then" ? (r: any) => r({ data: [{ id: "r1" }], error: null }) : () => chain) });
  return { supabase: { from: (t: string) => { calls.push(t); return chain; } } };
});
import { saveCheckup, updateCheckup, restoreCheckup, deleteCheckup } from "../checkup_api";
import { PAUSE_SAVE_ERROR } from "../../domain/checkup/interim_pause";

beforeEach(() => { calls.length = 0; });

describe("검진 저장 중단(API)", () => {
  it("P02 saveCheckup", async () => {
    const r = await saveCheckup({ user_id: "u", sex: "M", birth_year: 1970, recorded_date: "2026-10-07", biomarker_input: { BMI: 22 }, rules_by_key: { BMI: { unit: "" } } });
    expect(r).toEqual({ record_id: null, values_count: 0, error: PAUSE_SAVE_ERROR });
    expect(calls).toEqual([]);
  });
  it("P03 updateCheckup", async () => {
    const r = await updateCheckup({ recordId: "r", userId: "u", biomarker_input: { BMI: 22 }, rules_by_key: {} });
    expect(r.error).toBe(PAUSE_SAVE_ERROR);
    expect(calls).toEqual([]);
  });
  it("P04 restoreCheckup", async () => {
    expect((await restoreCheckup("r", "u")).error).toBe(PAUSE_SAVE_ERROR);
    expect(calls).toEqual([]);
  });
  it("P05 deleteCheckup 은 그대로(삭제권)", async () => {
    const r = await deleteCheckup("r1", "u");
    expect(calls).toEqual(["checkup_records"]);
    expect(r).toEqual({ id: "r1", error: null });
  });
});
