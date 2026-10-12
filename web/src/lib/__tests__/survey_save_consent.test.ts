/** 설문 저장 — 동의 v2 배선 A05·A06 · 평가 IP/integration/survey_consent_v2_eval_v1.md
 *  규칙 79: 일반 함수 + 호출 기록. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: any[][] = [];
let user: { id: string } | null = null;
vi.mock("../supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (t: string) => ({ insert: async (row: any) => { calls.push(["insert", t, row]); return { error: null }; } }),
    rpc: async (fn: string, args: any) => { calls.push(["rpc", fn, args]); return { data: null, error: null }; },
  },
}));
import { submitSurveyAnalytics } from "../analytics";

const answers: any = { 나이: 30, 성별: "female", 신장: 160, 체중: 55, 증상: ["피로"], 목표: ["수면"], 현재복용영양제: [], 기저질환: [], 가족력: [], 수면: "6" };
const result: any = { recommendations: [{ rank: 1, id: "a", name: "A", score: 9 }], persona: { id: "p1" } };

beforeEach(() => { calls.length = 0; user = null; });

describe("submitSurveyAnalytics × 동의 v2", () => {
  it("동의 하나라도 false → 서버 호출 0", async () => {
    await submitSurveyAnalytics(answers, result, { pi: true, sensitive: false });
    await submitSurveyAnalytics(answers, result, { pi: false, sensitive: true });
    expect(calls).toEqual([]);
  });
  it("A06 비로그인 → submit_anon_survey RPC(동의·나이 포함), anon_sessions 직접 insert 0", async () => {
    await submitSurveyAnalytics(answers, result, { pi: true, sensitive: true });
    expect(calls).toHaveLength(1);
    const [kind, fn, args] = calls[0];
    expect([kind, fn]).toEqual(["rpc", "submit_anon_survey"]);
    expect(args.p_pi).toBe(true);
    expect(args.p_sensitive).toBe(true);
    expect(args.p_age).toBe(30);
    expect(typeof args.p_session_id).toBe("string");
    expect(args.p_payload.symptoms).toEqual(["피로"]);
    expect(args.p_payload.age_group).toBe("30대");
    expect(args.p_payload).not.toHaveProperty("ip_hash");
  });
  it("A05 로그인 → survey_responses insert(서버 RLS 가 동의 강제), RPC 0", async () => {
    user = { id: "u1" };
    await submitSurveyAnalytics(answers, result, { pi: true, sensitive: true });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("insert");
    expect(calls[0][1]).toBe("survey_responses");
    expect(calls[0][2].user_id).toBe("u1");
  });
});
