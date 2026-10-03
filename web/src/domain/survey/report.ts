/**
 * 건강 변화 리포트 v2 — 배치·종합 요약·입구 카드 (순수)
 * 평가: IP/integration/health_report_layout_v2_eval.md (L01~L12)
 */
import type { CompareRow } from "../checkup/compare";

export type CheckupLoadState = "loading" | "off" | "error" | "ready";

/** 검진 섹션 위치: 비교 가능(≥2)·로딩 중 → 위 / 0·1건·오류 → 아래 한 줄 / 꺼짐 → 없음 */
export function checkupPlacement(i: { checkupEnabled: boolean; state: CheckupLoadState; count: number }): "top" | "bottom" | "none" {
  if (!i.checkupEnabled || i.state === "off") return "none";
  if (i.state === "loading") return "top";
  if (i.state === "ready" && i.count >= 2) return "top";
  return "bottom";
}

export interface SummaryLine { key: "checkup" | "survey" | "supps"; icon: string; label: string; text: string }

export function overallSummary(i: {
  checkup: { rows: readonly CompareRow[] } | null;
  survey: { diffs: readonly number[] } | null;
  supps: { added: number; removed: number; kept: number } | null;
}): SummaryLine[] {
  const out: SummaryLine[] = [];
  if (i.checkup && i.checkup.rows.length > 0) {
    const n = (c: CompareRow["classification"][]) => i.checkup!.rows.filter((r) => c.includes(r.classification)).length;
    out.push({ key: "checkup", icon: "🩺", label: "건강검진",
      text: `좋아짐 ${n(["improving"])} · 나빠짐 ${n(["worsening"])} · 주의 ${n(["watching", "needs_consult"])} (${i.checkup.rows.length}개 수치)` });
  }
  if (i.survey && i.survey.diffs.length > 0) {
    const d = i.survey.diffs;
    out.push({ key: "survey", icon: "📝", label: "설문",
      text: `개선 ${d.filter((x) => x <= -1).length} · 악화 ${d.filter((x) => x >= 1).length} · 유지 ${d.filter((x) => x > -1 && x < 1).length} (${d.length}개 영역)` });
  }
  if (i.supps) {
    out.push({ key: "supps", icon: "💊", label: "추천", text: `추가 ${i.supps.added} · 제외 ${i.supps.removed} · 유지 ${i.supps.kept}종` });
  }
  return out;
}

/** «내 건강» 화면의 리포트 입구 카드 */
export function reportEntryCard(i: { checkupEnabled: boolean; isLoggedIn: boolean; checkupCount: number; surveyCount: number }): { show: boolean; canCompare: boolean; text: string } {
  if (!i.isLoggedIn) return { show: false, canCompare: false, text: "" };
  const ck = i.checkupEnabled ? i.checkupCount : 0;
  const canCompare = ck >= 2 || i.surveyCount >= 2;
  if (!canCompare) return { show: true, canCompare, text: "설문이나 검진을 한 번 더 하면 비교할 수 있어요" };
  const parts = [ck >= 1 ? `검진 ${ck}건` : null, i.surveyCount >= 1 ? `설문 ${i.surveyCount}건` : null].filter(Boolean);
  return { show: true, canCompare, text: `${parts.join(" · ")} — 변화를 비교할 수 있어요` };
}
