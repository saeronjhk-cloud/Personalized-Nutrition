/** 설문 동의 v2 배선(소스 단정) — A05·A07·A08·A10·A11 · 평가 IP/integration/survey_consent_v2_eval_v1.md */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(join(SRC, p), "utf-8");
function walk(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== "__tests__") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

describe("설문 동의 v2 배선", () => {
  it("A07 운영 코드에 옛 localStorage 동의 키 쓰기·읽기 0 (sf_data_consent 는 'declined' 판정만)", () => {
    const files = walk(SRC);
    for (const f of files) {
      const s = readFileSync(f, "utf-8");
      expect(s, f).not.toMatch(/sf_sensitive_consent['"`]/);
      expect(s, f).not.toMatch(/sf_checkup_consent['"`]/);
      expect(s, f).not.toMatch(/setItem\(CONSENT_KEY/);
      expect(s, f).not.toMatch(/=== 'accepted'[^\n]*CONSENT_KEY|CONSENT_KEY\)\s*===\s*'accepted'/);
    }
  });
  it("A11 죽은 코드·옛 함수 제거", () => {
    expect(existsSync(join(SRC, "components/DataCollectionNotice.tsx"))).toBe(false);
    const all = walk(SRC).map((f) => readFileSync(f, "utf-8")).join("\n");
    for (const fn of ["hasConsentedCollection", "markConsentAcknowledged", "hasConsentedSensitive", "markSensitiveConsent", "hasConsentedCheckup", "markCheckupConsent"])
      expect(all).not.toContain(fn);
  });
  it("A05 설문 화면 = 서버 상태로 게이트 결정 · 로그인 동의는 give_survey_consent", () => {
    const s = read("App.tsx");
    expect(s).toContain("fetchSurveyConsentStatus()");
    expect(s).toContain("decideSurveyGateMode(");
    expect(s).toContain("giveSurveyConsent(c.pi, c.sensitive, SURVEY_CHANNEL_GATE)");
    expect(s).toContain("submitSurveyAnalytics(effective, res, consent)");
    expect(s).toContain("GATE_STATUS_ERROR");
  });
  it("A04 목표 카드 = 서버 확인 + 채널 web_goals_card", () => {
    const s = read("components/GoalsCard.tsx");
    expect(s).toContain("fetchSurveyConsentStatus()");
    expect(s).toContain("giveSurveyConsent(c.pi, c.sensitive, SURVEY_CHANNEL_GOALS)");
  });
  it("A06 비로그인 저장 = RPC 만", () => {
    const s = read("lib/analytics.ts");
    expect(s).toContain("supabase.rpc('submit_anon_survey'");
    expect(s).not.toMatch(/from\('anon_sessions'\)\.insert/);
  });
  it("A08 목표 시드는 서버 active 일 때만", () => {
    expect(read("lib/userGoals.ts")).toContain("r.needsSeed && (await isSurveyConsentActive(userId))");
  });
  it("A09 계정 화면 설문 동의 블록·확인 대화상자", () => {
    const s = read("pages/Account.tsx");
    expect(s).toContain('data-testid="account-survey-consent"');
    expect(s).toContain("SC.surveyRevokeEnabled(surveyStatus)");
    expect(s).toContain("description={SC.ACCOUNT_CONFIRM_REVOKE}");
    expect(s).toContain("SC.ACCOUNT_DONE_REVOKE(r.survey_responses)");
  });
  it("A10 처리방침 13_v5.2", () => {
    const s = read("pages/Privacy.tsx");
    expect(s).toContain("버전 13_v5.2");
    expect(s).toContain("식사 사진·건강검진·설문 동의 증빙(최소 메타)");
    expect(s).toContain("건강정보·설문 응답값·검진 수치·사진·음식/영양값 제외");
    expect(s).toContain("비회원 설문 동의 기록:");
    expect(s).toContain("‘설문 동의 철회’로 설문 민감정보 동의를 언제든 철회할 수 있으며");
    expect(s).toContain("13_v5.2 ({SURVEY_POLICY_EFFECTIVE} 시행)");
  });
});
