/** 설문 동의 v2 서버 래퍼 — A03·A04·A08 · 평가 IP/integration/survey_consent_v2_eval_v1.md
 *  규칙 79: reject 케이스는 vi.fn 스파이 대신 일반 함수 + 호출 기록 배열. */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Impl = (...a: any[]) => Promise<any>;
let impl: Impl = async () => ({ data: null, error: null });
const calls: any[][] = [];
vi.mock("../supabase", () => ({ supabase: { rpc: (...a: any[]) => { calls.push(a); return impl(...a); } } }));
import { fetchSurveyConsentStatus, giveSurveyConsent, revokeSurveyConsent, isSurveyConsentActive } from "../surveyConsent";

beforeEach(() => { calls.length = 0; impl = async () => ({ data: null, error: null }); });

describe("surveyConsent", () => {
  it("A03 give 인자(채널 그대로)", async () => {
    await giveSurveyConsent(true, true, "web_survey_gate");
    await giveSurveyConsent(true, true, "web_goals_card");
    expect(calls).toEqual([
      ["give_survey_consent", { p_pi: true, p_sensitive: true, p_channel: "web_survey_gate" }],
      ["give_survey_consent", { p_pi: true, p_sensitive: true, p_channel: "web_goals_card" }],
    ]);
  });
  it("A03 give 실패는 throw(조용한 성공 금지)", async () => {
    impl = async () => ({ data: null, error: { message: "x" } });
    await expect(giveSurveyConsent(true, true, "web_survey_gate")).rejects.toBeTruthy();
  });
  it("status 실패·예외 → null", async () => {
    impl = async () => ({ data: null, error: { message: "x" } });
    expect(await fetchSurveyConsentStatus()).toBeNull();
    impl = () => Promise.reject(new Error("net"));
    expect(await fetchSurveyConsentStatus()).toBeNull();
  });
  it("status 정규화", async () => {
    impl = async () => ({ data: { has_row: true, active: true, needs_reconsent: false, survey_count: 2, goals_exists: true, consented_at: "2026-10-12T00:00:00Z" }, error: null });
    expect(await fetchSurveyConsentStatus()).toEqual({ has_row: true, active: true, needs_reconsent: false, survey_count: 2, goals_exists: true, consented_at: "2026-10-12T00:00:00Z" });
    impl = async () => ({ data: {}, error: null });
    expect(await fetchSurveyConsentStatus()).toEqual({ has_row: false, active: false, needs_reconsent: false, survey_count: 0, goals_exists: false, consented_at: null });
  });
  it("revoke 건수·실패 throw", async () => {
    impl = async () => ({ data: { survey_responses: 4, user_goals: 1, anon_sessions: 1 }, error: null });
    expect(await revokeSurveyConsent()).toEqual({ survey_responses: 4, user_goals: 1, anon_sessions: 1 });
    expect(calls[0]).toEqual(["revoke_survey_consent"]);
    impl = async () => ({ data: null, error: { message: "x" } });
    await expect(revokeSurveyConsent()).rejects.toBeTruthy();
  });
  it("A08 active: true 만 true, 실패는 false(안전 쪽)", async () => {
    impl = async () => ({ data: true, error: null });
    expect(await isSurveyConsentActive("u")).toBe(true);
    expect(calls[0]).toEqual(["survey_consent_active", { p_uid: "u" }]);
    impl = async () => ({ data: null, error: { message: "x" } });
    expect(await isSurveyConsentActive("u")).toBe(false);
    impl = () => Promise.reject(new Error("net"));
    expect(await isSurveyConsentActive("u")).toBe(false);
  });
});
