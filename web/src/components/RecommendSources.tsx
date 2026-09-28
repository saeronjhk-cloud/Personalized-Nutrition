import { Link } from "react-router-dom";
import { CHECKUP_ENABLED, MEAL_ENABLED } from "../lib/flags";
import type { UnifiedResult } from "../domain/unified/recommend";

/**
 * 통합 추천 «참조한 기록» 안내 (Phase G) — /recommend 와 /survey(로그인) 결과 공용.
 * 식이는 실제 기여했을 때만(저확신 제외) ✓.
 */
export default function RecommendSources({ result, goalCount }: { result: UnifiedResult; goalCount: number | null }) {
  const dietUsed = result.sources.diet && !result.dietLowConfidence;
  const parts: string[] = [`설문 ${result.sources.survey ? "✓" : "–"}`];
  if (CHECKUP_ENABLED) parts.push(`검진 ${result.sources.checkup ? "✓" : "–"}`);
  if (MEAL_ENABLED) parts.push(`식사 7일 ${dietUsed ? "✓" : result.sources.diet ? "–(기록 부족)" : "–"}`);

  const box = (bg: string, border: string) => ({
    padding: "var(--space-2) var(--space-4)",
    marginBottom: "var(--space-3)",
    background: bg,
    border: `1px solid ${border}`,
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  });

  return (
    <>
      <div className="card" style={box("rgba(142, 202, 230, 0.08)", "rgba(142, 202, 230, 0.25)")}>
        ✅ 참조한 기록: {parts.join(" · ")}
      </div>
      {MEAL_ENABLED && result.sources.diet && result.dietLowConfidence && (
        <div className="card" style={box("rgba(255, 183, 3, 0.08)", "rgba(255, 183, 3, 0.25)")}>
          🍽️ 식사 기록이 아직 부족해(2일 미만) 이번 추천엔 반영하지 못했어요. 며칠만 더 기록하면 식이까지 반영해 더 정밀해집니다.
        </div>
      )}
      {MEAL_ENABLED && goalCount === 0 && (
        <div className="card" style={box("rgba(142, 202, 230, 0.05)", "rgba(142, 202, 230, 0.20)")}>
          🎯 건강 목표가 아직 없어요. <Link to="/meal#goals" className="text-link">식사 기록에서 목표를 정하면</Link> 추천이 목표에 맞춰집니다.
        </div>
      )}
    </>
  );
}
