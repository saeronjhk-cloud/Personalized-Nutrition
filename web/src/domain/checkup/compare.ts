/**
 * 건강검진 두 기록 비교 — 순수 · 결정론 (건강 변화 리포트 «🩺 건강검진 변화» 섹션)
 * 평가: IP/integration/health_report_checkup_compare_eval_v1.md (K01~K12) · 의료 자문 아님
 * 판정은 기존 timeseries.classifyChange(구간 기반) 재사용 — 새 임계 없음.
 */
import type { Range } from "./engine";
import { classifyChange, getChangeRate, type ChangeClass, type HistoryPoint } from "./timeseries";
import { comparePair } from "../survey/history";

export interface CheckupRuleLite {
  biomarker_key: string;
  display_name_ko: string;
  unit: string;
}

export interface CompareRow {
  key: string;
  name: string;
  unit: string;
  prev: number;
  curr: number;
  delta: number;
  changeRate: number;
  classification: ChangeClass;
  currLabel: string | null;
}

export interface CheckupComparison {
  beforeDate: string;
  afterDate: string;
  rows: CompareRow[];
  /** 한쪽 기록에만 있는 수치 개수(비교 제외) */
  onlyOneSide: number;
}

export const CHANGE_LABEL_KO: Record<ChangeClass, string> = {
  needs_consult: "의료진 상담 권장",
  worsening: "나빠짐",
  watching: "관찰 필요",
  improving: "좋아짐",
  stable: "유지",
};

const ORDER: ChangeClass[] = ["needs_consult", "worsening", "watching", "improving", "stable"];
const r1 = (x: number) => Math.round(x * 10) / 10;

function currRangeLabel(key: string, v: number, ranges: Range[]): string | null {
  return ranges.find((r) => r.biomarker_key === key && r.range_min <= v && v < r.range_max)?.label_ko ?? null;
}

/** history = normalizeHistory 결과(오래된 순). 비교 불가(기록<2, 같은 기록)면 null */
export function compareCheckups(
  history: readonly HistoryPoint[],
  beforeIdx: number,
  afterIdx: number,
  ranges: Range[],
  rules: readonly CheckupRuleLite[],
): CheckupComparison | null {
  if (history.length < 2) return null;
  const pair = comparePair(beforeIdx, afterIdx, history.length);
  if (!pair || pair.before === pair.after) return null;
  const a = history[pair.before], b = history[pair.after];
  const rule = new Map(rules.map((r) => [r.biomarker_key, r]));
  const keys = new Set([...Object.keys(a.biomarkers), ...Object.keys(b.biomarkers)]);
  const rows: CompareRow[] = [];
  let onlyOneSide = 0;
  for (const key of keys) {
    const prev = a.biomarkers[key], curr = b.biomarkers[key];
    if (typeof prev !== "number" || typeof curr !== "number" || !Number.isFinite(prev) || !Number.isFinite(curr)) { onlyOneSide++; continue; }
    rows.push({
      key,
      name: rule.get(key)?.display_name_ko ?? key,
      unit: rule.get(key)?.unit ?? "",
      prev, curr,
      delta: r1(curr - prev),
      changeRate: r1(getChangeRate(prev, curr)),
      classification: classifyChange(key, prev, curr, ranges),
      currLabel: currRangeLabel(key, curr, ranges),
    });
  }
  rows.sort((x, y) => ORDER.indexOf(x.classification) - ORDER.indexOf(y.classification) || Math.abs(y.changeRate) - Math.abs(x.changeRate));
  return { beforeDate: a.recorded_date, afterDate: b.recorded_date, rows, onlyOneSide };
}

/** 추이 그래프 대상: «유지» 제외 상위 n, 부족하면 |변화율| 순으로 채움 */
export function trendKeys(rows: readonly CompareRow[], n = 5): string[] {
  const out = rows.filter((r) => r.classification !== "stable").map((r) => r.key).slice(0, n);
  const rest = rows.filter((r) => !out.includes(r.key)).sort((x, y) => Math.abs(y.changeRate) - Math.abs(x.changeRate));
  for (const r of rest) { if (out.length >= n) break; out.push(r.key); }
  return out;
}
