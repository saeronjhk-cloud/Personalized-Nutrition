/**
 * 통합 추천 엔진 (Phase E.3)
 * 검진·설문 중 무엇을 입력하든(일부만이라도) 병합 점수로 동일 영양제 엔진 실행.
 * 기존 엔진(scorer/recommender/checkup engine) 미수정 — 읽기 재사용 + 어댑터.
 */

import type { SurveyAnswers, RecommendationResult, Supplement } from "../../types";
import type { CategoryResult } from "../checkup/engine";
import type { SupplementData } from "../../engine/data";
import {
  getPersona,
  getRecommendations,
  calculateMonthlySummary,
  computeScores,
  calculateBMI,
  getBMICategory,
  calculateBMR,
  calculateTDEE,
  calculateProteinTarget,
  PERSONAS,
  COUPANG_KEYWORDS,
  COUPANG_PARTNER_LINKS,
  SUPPLEMENT_FOOD_AVOID,
} from "../../engine";
import { checkupResultsToScores, mergeScores } from "./adapter";

export interface UnifiedInput {
  surveyAnswers?: SurveyAnswers | null;
  checkupResults?: CategoryResult[] | null;
  profile?: { sex?: string | null; age?: number | null } | null;
}

export interface UnifiedResult extends RecommendationResult {
  /** 추천을 낼 신호가 하나라도 있었는지 */
  hasSignal: boolean;
  /** 전문가 상담 권장(중증) 검진 항목 */
  referralKeys: string[];
  sources: { survey: boolean; checkup: boolean };
}

export function runUnifiedRecommendation(input: UnifiedInput): UnifiedResult {
  const survey = input.surveyAnswers ?? null;
  const checkup = input.checkupResults ?? null;

  const surveyScores = survey ? computeScores(survey) : {};
  const checkupSig = checkup
    ? checkupResultsToScores(checkup)
    : { scores: {}, referralCategories: [] as string[], referralKeys: [] as string[] };

  const merged = mergeScores(surveyScores, checkupSig.scores);
  // 중증 카테고리 억제 (검진 force_medical_referral)
  for (const cat of checkupSig.referralCategories) delete merged[cat];

  const hasSignal = Object.values(merged).some((v) => v > 0);

  // baseAnswers: 설문 있으면 그대로, 없으면 profile 기반 최소 객체
  const baseAnswers: SurveyAnswers = survey ?? {
    성별: (input.profile?.sex as string) || "male",
    나이: input.profile?.age || 30,
    신장: 170,
    체중: 65,
    체중변화: "변화없음",
    증상: [],
    목표: [],
    현재복용영양제: [],
    기저질환: [],
    가족력: [],
  };

  const persona = getPersona(baseAnswers, merged);
  const personaData = PERSONAS.find((p) => p.id === persona.id) || null;
  const current_ids = new Set(baseAnswers.현재복용영양제 || []);
  const raw_recs = getRecommendations(baseAnswers, merged, personaData, { current_ids });

  // 신체 정보 (설문 있으면 정확, 없으면 가능 범위)
  const height = baseAnswers.신장 || 170;
  const weight = baseAnswers.체중 || 65;
  const gender = baseAnswers.성별 || "male";
  const age = baseAnswers.나이 || 30;
  const activity = baseAnswers.운동 || "거의_안함";
  const bmi = calculateBMI(weight, height);
  const { label: bmi_label, color: bmi_color, advice: bmi_advice } = getBMICategory(bmi);
  const bmr = calculateBMR(gender, weight, height, age);
  const tdee = calculateTDEE(bmr, activity);
  const [protein_min, protein_max] = calculateProteinTarget(weight, baseAnswers.목표 || []);

  const nutrition_info = {
    bmi: { value: Math.round(bmi * 10) / 10, label: bmi_label, color: bmi_color, advice: bmi_advice },
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    protein_min: Math.round(protein_min),
    protein_max: Math.round(protein_max),
  };

  const monthly_summary = calculateMonthlySummary(raw_recs);

  const recommendations: Supplement[] = raw_recs.map(([supp, matched]: [SupplementData, string[]], idx: number) => ({
    id: supp.id,
    name: supp.name,
    score: 0,
    rank: idx + 1,
    mfds_type: supp.evidence?.mfds_type || supp.evidence?.summary || "",
    mfds_function: supp.evidence?.mfds_function || "",
    evidence: supp.evidence
      ? {
          summary: supp.evidence.summary || supp.evidence.mfds_function || "",
          studies: supp.evidence.study ? [supp.evidence.study] : [],
        }
      : undefined,
    dosage_guide: supp.dosage_guide
      ? {
          amount: supp.dosage_guide.amount || "",
          timing: supp.dosage_guide.timing || "",
          duration: supp.onset_weeks || "",
        }
      : undefined,
    cautions: supp.cautions || [],
    drug_interactions: supp.drug_interactions || [],
    symptom_indicators: matched,
    coupang_url:
      COUPANG_PARTNER_LINKS[supp.id] ||
      `https://www.coupang.com/np/search?q=${encodeURIComponent(COUPANG_KEYWORDS[supp.id] || supp.name + " 건강기능식품")}&channel=user&sorter=scoreDesc`,
    food_avoid: (SUPPLEMENT_FOOD_AVOID[supp.id] || []).map((f: any) =>
      typeof f === "string" ? f : f.item || "",
    ),
  }));

  const warnings: string[] = [];
  if (checkupSig.referralKeys.length > 0) {
    warnings.push(
      `다음 검사 항목은 전문가 상담이 권장되는 범위입니다: ${checkupSig.referralKeys.join(", ")}. 건강기능식품은 보조 수단이며 진단·치료를 대체하지 않습니다.`,
    );
  }

  return {
    persona,
    scores: merged,
    score_breakdown: Object.entries(merged).map(([category, score]) => ({
      category,
      score,
      max_score: 10.0,
    })),
    recommendations,
    excluded: [],
    nutrition_info,
    monthly_summary,
    warnings,
    hasSignal,
    referralKeys: checkupSig.referralKeys,
    sources: { survey: !!survey, checkup: !!checkup },
  };
}
