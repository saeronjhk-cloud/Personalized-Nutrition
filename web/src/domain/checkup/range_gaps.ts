/**
 * 검진 구간 틈·겹침 점검 (순수) — 엔진 판정식 min ≤ v < max 기준
 * 같은 biomarker·같은 성별 묶음에서 다음 구간 min ≠ 현재 max 이면 틈(gap) 또는 겹침(overlap).
 * 평가: IP/integration/checkup_range_gap_eval_v1.md
 */
export interface RangeLike { biomarker_key: string; range_min: number; range_max: number; sex_specific: string | null }
export interface RangeIssue { biomarker_key: string; sex_specific: string | null; kind: "gap" | "overlap"; from: number; to: number }

export function rangeIssues(ranges: readonly RangeLike[]): RangeIssue[] {
  const groups = new Map<string, RangeLike[]>();
  for (const r of ranges) {
    const g = `${r.biomarker_key}|${r.sex_specific ?? ""}`;
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  const out: RangeIssue[] = [];
  for (const rs of groups.values()) {
    const s = [...rs].sort((a, b) => a.range_min - b.range_min);
    for (let i = 0; i + 1 < s.length; i++) {
      const a = s[i], b = s[i + 1];
      if (b.range_min > a.range_max) out.push({ biomarker_key: a.biomarker_key, sex_specific: a.sex_specific, kind: "gap", from: a.range_max, to: b.range_min });
      else if (b.range_min < a.range_max) out.push({ biomarker_key: a.biomarker_key, sex_specific: a.sex_specific, kind: "overlap", from: b.range_min, to: a.range_max });
    }
  }
  return out;
}

/** biomarker_map(IP 정본 형식) → 엔진 Range 형식 */
export interface MapRange { min: number; max: number; level: string; label_ko: string; functional_needs: string[]; tone: string; force_medical_referral?: boolean; sex_specific?: string }
export interface BiomarkerMap { schema_version: string; biomarkers: Record<string, { ranges: MapRange[] }> }

export function rangesFromMap(map: BiomarkerMap) {
  return Object.entries(map.biomarkers).flatMap(([key, bm]) =>
    bm.ranges.map((r, i) => ({
      id: `${key}_${r.sex_specific ?? "all"}_${i}`,
      biomarker_key: key,
      range_min: r.min,
      range_max: r.max,
      level: r.level,
      label_ko: r.label_ko,
      functional_needs: r.functional_needs,
      tone: r.tone,
      force_medical_referral: r.force_medical_referral ?? false,
      sex_specific: r.sex_specific ?? null,
      sort_order: i + 1,
    })),
  );
}
