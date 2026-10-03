/** 건강 변화 리포트 v2 L01~L12 · W1~W3 · 정본 IP/integration/health_report_layout_v2_eval.md */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkupPlacement, overallSummary, reportEntryCard } from "../report";
import type { CompareRow } from "../../checkup/compare";

const row = (classification: CompareRow["classification"]): CompareRow =>
  ({ key: Math.random().toString(), name: "x", unit: "", prev: 1, curr: 1, delta: 0, changeRate: 0, classification, currLabel: null });
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("L 리포트 v2", () => {
  it("L01~L04 검진 위치", () => {
    expect(checkupPlacement({ checkupEnabled: false, state: "ready", count: 3 })).toBe("none");
    expect(checkupPlacement({ checkupEnabled: true, state: "loading", count: 0 })).toBe("top");
    expect(checkupPlacement({ checkupEnabled: true, state: "ready", count: 2 })).toBe("top");
    expect(checkupPlacement({ checkupEnabled: true, state: "ready", count: 1 })).toBe("bottom");
    expect(checkupPlacement({ checkupEnabled: true, state: "ready", count: 0 })).toBe("bottom");
    expect(checkupPlacement({ checkupEnabled: true, state: "error", count: 0 })).toBe("bottom");
    expect(checkupPlacement({ checkupEnabled: true, state: "off", count: 0 })).toBe("none");
  });
  it("L05~L07 요약 줄", () => {
    const rows = [row("improving"), row("improving"), row("worsening"), row("watching"), row("needs_consult"), row("stable"), row("stable"), row("stable")];
    const s = overallSummary({ checkup: { rows }, survey: { diffs: [-3, -1, 0, 1, 2] }, supps: { added: 2, removed: 4, kept: 0 } });
    expect(s.map((l) => l.key)).toEqual(["checkup", "survey", "supps"]);
    expect(s[0].text).toBe("좋아짐 2 · 나빠짐 1 · 주의 2 (8개 수치)");
    expect(s[1].text).toBe("개선 2 · 악화 2 · 유지 1 (5개 영역)");
    expect(s[2].text).toBe("추가 2 · 제외 4 · 유지 0종");
  });
  it("L08 영역 생략", () => {
    expect(overallSummary({ checkup: null, survey: { diffs: [0] }, supps: null }).map((l) => l.key)).toEqual(["survey"]);
    expect(overallSummary({ checkup: null, survey: null, supps: null })).toEqual([]);
  });
  it("L09~L12 입구 카드", () => {
    expect(reportEntryCard({ checkupEnabled: true, isLoggedIn: false, checkupCount: 3, surveyCount: 3 }).show).toBe(false);
    expect(reportEntryCard({ checkupEnabled: true, isLoggedIn: true, checkupCount: 0, surveyCount: 2 })).toMatchObject({ show: true, canCompare: true, text: "설문 2건 — 변화를 비교할 수 있어요" });
    expect(reportEntryCard({ checkupEnabled: true, isLoggedIn: true, checkupCount: 1, surveyCount: 1 })).toMatchObject({ canCompare: false, text: "설문이나 검진을 한 번 더 하면 비교할 수 있어요" });
    expect(reportEntryCard({ checkupEnabled: false, isLoggedIn: true, checkupCount: 2, surveyCount: 0 }).canCompare).toBe(false);
    expect(reportEntryCard({ checkupEnabled: true, isLoggedIn: true, checkupCount: 2, surveyCount: 2 }).text).toBe("검진 2건 · 설문 2건 — 변화를 비교할 수 있어요");
  });
  it("W1 순서", () => {
    const s = read("../../../pages/HealthReport.tsx");
    const main = s.slice(s.indexOf("{/* 헤더 */}"));
    const iSum = main.indexOf("overallSummary(") >= 0 ? main.indexOf("종합 요약") : -1;
    const iChk = main.indexOf("placement === 'top'");
    const iSurvey = main.indexOf("📝");
    const iRec = main.indexOf("💊");
    expect(iSum).toBeGreaterThan(-1);
    expect(iSum).toBeLessThan(iChk);
    expect(iChk).toBeLessThan(iSurvey);
    expect(iSurvey).toBeLessThan(iRec);
  });
  it("W2·W3 입구", () => {
    const d = read("../../../pages/Dashboard.tsx");
    expect(d).toContain("reportEntryCard(");
    expect(d).toContain("/health-report");
    expect(read("../../../components/checkup/BiomarkerForm.tsx")).toContain("/health-report");
  });
});
