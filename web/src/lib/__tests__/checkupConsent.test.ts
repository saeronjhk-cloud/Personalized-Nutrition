/** 검진 동의 v2 서버 래퍼 — A03·A04·A08(안전 쪽) · 평가 IP/integration/checkup_consent_v2_eval_v1.md */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.fn 스파이 대신 일반 함수 + 호출 기록: 스파이가 반환 promise 를 추적하면서 reject 를
// 실행 중 테스트의 실패로 올리는 현상(10-09 재현 — 코드는 catch 하는데 FAIL)을 피한다.
type Impl = (...a: any[]) => Promise<any>;
let impl: Impl = async () => ({ data: null, error: null });
const calls: any[][] = [];
const rpc = {
  mockResolvedValue: (v: any) => { impl = async () => v; },
  mockImplementation: (f: Impl) => { impl = f; },
};
vi.mock("../supabase", () => ({ supabase: { rpc: (...a: any[]) => { calls.push(a); return impl(...a); } } }));
import { giveCheckupConsent, fetchCheckupConsentStatus, isCheckupCombineActive, revokeCheckupConsent, revokeCheckupCombine } from "../checkupConsent";

beforeEach(() => { calls.length = 0; impl = async () => ({ data: null, error: null }); });

describe("checkupConsent", () => {
  it("A03 give 인자", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await giveCheckupConsent(true, true, false);
    expect(calls).toEqual([["give_checkup_consent", { p_core: true, p_age14: true, p_combine: false, p_channel: "web_checkup_gate" }]]);
  });
  it("A04 give 실패는 throw(조용한 성공 금지)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(giveCheckupConsent(true, true, true)).rejects.toBeTruthy();
  });
  it("status 실패 → null", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await fetchCheckupConsentStatus()).toBeNull();
    rpc.mockImplementation(() => Promise.reject(new Error("net")));
    expect(await fetchCheckupConsentStatus()).toBeNull();
  });
  it("status 정규화", async () => {
    rpc.mockResolvedValue({ data: { has_row: true, core_active: true, combine_active: false, needs_reconsent: false, record_count: 3 }, error: null });
    expect(await fetchCheckupConsentStatus()).toEqual({ has_row: true, core_active: true, combine_active: false, needs_reconsent: false, record_count: 3 });
  });
  it("A08 combine_active: true 만 true, 실패는 false", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await isCheckupCombineActive("u")).toBe(true);
    expect(calls[calls.length - 1]).toEqual(["checkup_consent_combine_active", { p_uid: "u" }]);
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await isCheckupCombineActive("u")).toBe(false);
    rpc.mockImplementation(() => Promise.reject(new Error("net")));
    expect(await isCheckupCombineActive("u")).toBe(false);
  });
  it("철회 A·B 호출·실패 throw", async () => {
    rpc.mockResolvedValue({ data: { checkup_records: 2, biomarker_values: 9 }, error: null });
    expect(await revokeCheckupConsent()).toEqual({ checkup_records: 2, biomarker_values: 9 });
    expect(calls[calls.length - 1]).toEqual(["revoke_checkup_consent"]);
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(revokeCheckupCombine()).rejects.toBeTruthy();
    await expect(revokeCheckupConsent()).rejects.toBeTruthy();
  });
});
