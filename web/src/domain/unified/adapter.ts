/**
 * 통합 추천 어댑터 (Phase E.3)
 * 검진 신호(CategoryResult[])를 설문 추천 엔진의 카테고리 점수로 변환.
 * 참조: D:\헬스픽\IP\integration\phase_e3_kickoff_v1.md
 *
 * 핵심: 설문 엔진(getRecommendations)은 카테고리 점수만으로 영양제를 고른다.
 * 검진 functional_needs → 같은 14개 카테고리로 매핑하면 "검진만으로도 추천"이 가능.
 */

import type { CategoryResult } from "../checkup/engine";

/** 검진 functional_need → 설문 추천 카테고리 (영양제 affinity로 검증된 매핑) */
export const FUNCTIONAL_NEED_TO_CATEGORY: Record<string, string> = {
  혈당조절: "혈당대사",
  콜레스테롤개선: "심혈관",
  혈중중성지방개선: "심혈관",
  혈행개선: "심혈관",
  혈압조절: "심혈관",
  간건강: "간건강",
  체지방감소: "체중관리",
  철분보충: "피로",
  비타민D보충: "면역력",
};

/** watch/low(비referral) 1건이 카테고리에 더하는 점수 */
const SCORE_PER_SIGNAL = 4;
/** 카테고리당 검진 기여 상한 (과추천 방지) */
const CATEGORY_CAP = 8;

export interface CheckupSignalResult {
  /** 카테고리별 검진 기여 점수 (referral 카테고리는 제외됨) */
  scores: Record<string, number>;
  /** 전문가 상담 권장(중증) 카테고리 — 영양제 푸시 억제 대상 */
  referralCategories: string[];
  /** 전문가 상담 권장 검진 항목 키 (배너 표시용) */
  referralKeys: string[];
}

/**
 * 검진 CategoryResult[] → 카테고리 점수 + referral 정보.
 * 규칙:
 *  - force_medical_referral=true(중증): 점수 0, 해당 카테고리 referral로 표시 → 추천 억제.
 *  - watch / low(비referral): 카테고리 +SCORE_PER_SIGNAL (상한 CATEGORY_CAP).
 *  - normal / unknown: 기여 없음.
 */
export function checkupResultsToScores(results: CategoryResult[]): CheckupSignalResult {
  const scores: Record<string, number> = {};
  const referralCategories = new Set<string>();
  const referralKeys: string[] = [];

  // 1차: referral 카테고리/항목 수집
  for (const r of results) {
    if (r.force_medical_referral) {
      referralKeys.push(r.biomarker_key);
      for (const need of r.functional_needs || []) {
        const cat = FUNCTIONAL_NEED_TO_CATEGORY[need];
        if (cat) referralCategories.add(cat);
      }
    }
  }

  // 2차: 비referral 이상 신호로 점수 부여 (referral 카테고리는 제외)
  for (const r of results) {
    if (r.force_medical_referral) continue;
    if (r.level === "normal" || r.level === "unknown") continue;
    for (const need of r.functional_needs || []) {
      const cat = FUNCTIONAL_NEED_TO_CATEGORY[need];
      if (!cat) continue;
      if (referralCategories.has(cat)) continue; // 중증 카테고리는 억제
      scores[cat] = Math.min((scores[cat] || 0) + SCORE_PER_SIGNAL, CATEGORY_CAP);
    }
  }

  return {
    scores,
    referralCategories: Array.from(referralCategories),
    referralKeys,
  };
}

/** 두 카테고리 점수맵 병합 (합산). referral 카테고리는 호출부에서 제거. */
export function mergeScores(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] || 0) + v;
  }
  return out;
}
