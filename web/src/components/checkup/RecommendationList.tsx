import { useMemo } from "react";
import type { CategoryResult } from "../../domain/checkup/engine";
import {
  buildResultView,
  RESULT_DISCLAIMER,
  RESULT_SOURCE,
  type ItemStatus,
  type RuleLite,
  type ViewItem,
} from "../../domain/checkup/result_view";

/**
 * 검진 결과 화면 (BiomarkerForm·ViewCheckup 공용)
 * 영역별 묶음 · 범위 내는 접힘 · 면책 1회 — IP/integration/checkup_result_view_eval_v1.md
 * 판정·묶음은 buildResultView() 한 곳(새 판정 0). 톤 문구는 결정 D2 대로 현행.
 */
interface Props {
  results: CategoryResult[];
  rules: RuleLite[];
}

const COLOR: Record<ItemStatus, string> = {
  referral: "var(--danger)",
  out: "#b45309",
  in: "#047857",
  unknown: "var(--text-muted)",
};

function Item({ it }: { it: ViewItem }) {
  return (
    <li style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontSize: 14, lineHeight: 1.6, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span style={{ color: "var(--text)" }}>
        {it.name} <strong>{it.value}</strong>
        {it.unit && <span style={{ color: "var(--text-muted)", fontSize: 12 }}> {it.unit}</span>}
      </span>
      <span style={{ color: COLOR[it.status], fontWeight: 600, whiteSpace: "nowrap" }}>{it.label}</span>
    </li>
  );
}

export default function RecommendationList({ results, rules }: Props) {
  const view = useMemo(() => buildResultView(results, rules), [results, rules]);

  if (results.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "var(--space-4) 0" }}>
        분석 결과가 없습니다. 검진 수치를 입력한 뒤 분석하기를 눌러 주세요.
      </p>
    );
  }

  const s = view.summary;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }} data-testid="checkup-result-view">
      <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
        <strong>{s.referral + s.out + s.in + s.unknown}개 항목</strong>
        {" · "}
        {s.referral > 0 && <span style={{ color: COLOR.referral }}>의료진 상담 권장 {s.referral} · </span>}
        <span style={{ color: COLOR.out }}>참고범위 밖 {s.out}</span>
        {" · "}
        <span style={{ color: COLOR.in }}>참고범위 내 {s.in}</span>
        {s.unknown > 0 && <span style={{ color: COLOR.unknown }}> · 판정 기준 없음 {s.unknown}</span>}
      </p>

      {view.sections.map((sec) => (
        <article key={sec.area} className="card" style={{ padding: "var(--space-4) var(--space-5)", borderLeft: `4px solid ${COLOR[sec.status]}` }}>
          <h4 style={{ margin: "0 0 var(--space-2)", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{sec.area}</h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {sec.items.map((it) => <Item key={it.key} it={it} />)}
          </ul>
          {sec.toneBody && (
            <p style={{ margin: "var(--space-3) 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{sec.toneBody}</p>
          )}
        </article>
      ))}

      {view.inRange.length > 0 && (
        <details className="card" style={{ padding: "var(--space-3) var(--space-5)", borderLeft: `4px solid ${COLOR.in}` }} open={view.sections.length === 0}>
          <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>참고범위 내 {view.inRange.length}개</summary>
          <ul style={{ listStyle: "none", margin: "var(--space-2) 0 0", padding: 0 }}>
            {view.inRange.map((it) => <Item key={it.key} it={it} />)}
          </ul>
        </details>
      )}

      {view.unknown.length > 0 && (
        <article className="card" style={{ padding: "var(--space-3) var(--space-5)", borderLeft: `4px solid ${COLOR.unknown}` }}>
          <h4 style={{ margin: "0 0 var(--space-2)", fontSize: 15, fontWeight: 600 }}>판정 기준 없음</h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {view.unknown.map((it) => <Item key={it.key} it={it} />)}
          </ul>
        </article>
      )}

      <footer style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }} data-testid="checkup-result-disclaimer">
        <p style={{ margin: 0 }}>{RESULT_DISCLAIMER}</p>
        <p style={{ margin: "var(--space-1) 0 0" }}>{RESULT_SOURCE}</p>
      </footer>
    </section>
  );
}
