/**
 * 설문 기록 서버 우선 — 배선 가드 W1·W2 · 정본 IP/integration/survey_history_server_eval_v1.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("W 설문 기록 배선", () => {
  it("W1 4개 페이지는 useSurveyHistory 사용 · localStorage 직접 읽기 0", () => {
    for (const p of ["../Home.tsx", "../HealthReport.tsx", "../Results.tsx", "../Scan.tsx"]) {
      const s = read(p);
      expect(s, p).toContain("useSurveyHistory(");
      expect(s, p).not.toMatch(/getSurveyHistory\(|getLatestRecord\(|shouldPromptResurvey\(|daysSinceLastSurvey\(/);
    }
  });
  it("W2 로더: deleted_at null · runRecommendation · 상한 20", () => {
    const api = read("../../lib/survey_api.ts");
    const remote = read("../../lib/surveyHistoryRemote.ts");
    expect(api).toContain("export async function fetchSurveyResponsesWithAnswers(");
    expect(api.slice(api.indexOf("fetchSurveyResponsesWithAnswers("))).toContain('.is("deleted_at", null)');
    expect(remote).toContain("runRecommendation");
    expect(remote).toContain("fetchSurveyResponsesWithAnswers(user.id, 20)");
  });
});
