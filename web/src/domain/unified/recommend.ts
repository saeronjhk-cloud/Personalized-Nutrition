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
import { dietToScores, type DietDailyAvg } from "./diet_adapter";

export interface UnifiedInput {
  surveyAnswers?: SurveyAnswers | null;
  checkupResults?: CategoryResult[] | null;
  /** 최근 7일 식이 일평균 (meal_records 집계) */
  dietSummary?: DietDailyAvg | null;
  profile?: { sex?: string | null; age?: number | null } | null;
}

export interface UnifiedResult extends RecommendationResult {
  /** 추천을 낼 신호가 하나라도 있었는지 */
  hasSignal: boolean;
  /** 전문가 상담 권장(중증) 검진 항목 */
  referralKeys: string[];
  /** 식이 기록 부족(신호화 안 됨) — UI 확신도↓ 표기용 */
  dietLowConfidence: boolean;
  sources: { survey: boolean; checkup: boolean; diet: boolean };
}

export function runUnifiedRecommendation(input: UnifiedInput): UnifiedResult {
  const survey = input.surveyAnswers ?? null;
  const checkup = input.checkupResults ?? null;

  const surveyScores = survey ? computeScores(survey) : {};
  const checkupSig = checkup
    ? checkupResultsToScores(checkup)
    : { scores: {}, referralCategories: [] as string[], referralKeys: [] as string[] };

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

  // 신체 정보 (식이 열량/단백 기준 + 아래 nutrition_info에서 공용 재사용)
  const height = baseAnswers.신장 || 170;
  const weight = baseAnswers.체중 || 65;
  const gender = baseAnswers.성별 || "male";
  const age = baseAnswers.나이 || 30;
  const activity = baseAnswers.운동 || "거의_안함";
  const bmr = calculateBMR(gender, weight, height, age);
  const tdee = calculateTDEE(bmr, activity);

  // 식이 신호 (최근 7일 일평균 → 카테고리 점수). 기록 부족 시 신호 0 + lowConfidence.
  // Step 4: 나트륨·당류 재가동(enableMicroSignals). 실제 발화는 dietSummary의 데이터 가드
  // (sodium_known/sugar_known)도 통과해야 함. 식이섬유는 커버리지 낮아 계속 OFF.
  const dietSig = input.dietSummary
    ? dietToScores(input.dietSummary, { sex: gender, weightKg: weight, kcalTarget: tdee, enableMicroSignals: true })
    : { scores: {} as Record<string, number>, lowConfidence: false };

  // 설문 + 검진 + 식이 병합
  const merged = mergeScores(mergeScores(surveyScores, checkupSig.scores), dietSig.scores);
  // 중증 카테고리 억제 (검진 force_medical_referral)
  for (const cat of checkupSig.referralCategories) delete merged[cat];

  const hasSignal = Object.values(merged).some((v) => v > 0);

  const persona = getPersona(baseAnswers, merged);
  const personaData = PERSONAS.find((p) => p.id === persona.id) || null;
  const current_ids = new Set(baseAnswers.현재복용영양제 || []);
  const raw_recs = getRecommendations(baseAnswers, merged, personaData, { current_ids });

  // 신체 정보 (위에서 계산한 bmr/tdee 재사용)
  const bmi = calculateBMI(weight, height);
  const { label: bmi_label, color: bmi_color, advice: bmi_advice } = getBMICategory(bmi);
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
    dietLowConfidence: dietSig.lowConfidence,
    sources: { survey: !!survey, checkup: !!checkup, diet: !!input.dietSummary },
  };
}
