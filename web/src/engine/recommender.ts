/**
 * 영양제 추천 엔진
 */

import type { SurveyAnswers, RecommendationResult, Supplement, Persona, NutritionInfo, MonthlySummary } from '../types';
import type { SupplementData, PersonaData } from './data';
import {
  SUPPLEMENTS,
  PERSONAS,
  SUPPLEMENT_MONTHLY_DATA,
  SUPPLEMENT_FOOD_AVOID,
} from './data';
import {
  computeScores,
  calculateBMI,
  getBMICategory,
  calculateBMR,
  calculateTDEE,
  calculateProteinTarget,
} from './scorer';

function toPersona(p: PersonaData): Persona {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    description: p.tagline || p.description || '',
    tip: p.tip || '',
  };
}

export function getPersona(answers: SurveyAnswers, scores: Record<string, number>): Persona {
  const findPersona = (id: string): Persona => {
    const found = PERSONAS.find((p) => p.id === id);
    return toPersona(found || PERSONAS[PERSONAS.length - 1]);
  };

  const age = answers.나이 || 30;
  const gender = answers.성별 || 'male';
  const conditions = answers.기저질환 || [];
  const alcohol = answers.음주 || '거의_안마심';
  const exercise = answers.운동 || '거의_안함';

  // 절대 우선순위
  if (conditions.includes('임산부_수유부')) return findPersona('pregnant');

  // 카테고리 기반 매칭
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topCat = sorted[0]?.[0];
  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);

  if (totalScore < 6) return findPersona('general_wellness');

  if (topCat === '간건강' && alcohol !== '거의_안마심') return findPersona('dine_out_drinker');
  if (topCat === '갱년기' && gender === 'female') return findPersona('menopause_woman');
  if (topCat === '혈당대사') return findPersona('blood_sugar_manager');
  if (topCat === '심혈관' && gender === 'male' && age >= 40) return findPersona('middle_aged_man');
  if (topCat === '수면') return findPersona('poor_sleeper');
  if (topCat === '스트레스' || (topCat === '피로' && (scores['스트레스'] || 0) > 3)) return findPersona('burnout');
  if (topCat === '근육관절' && (exercise === '주3-4회' || exercise === '거의_매일')) return findPersona('fitness_lover');
  if (topCat === '피부') return findPersona('skin_influencer');
  if (topCat === '장건강') return findPersona('gut_health_sensitive');
  if (topCat === '면역력') return findPersona('immunity_worrier');
  if (age >= 50) return findPersona('senior_wellness');

  return findPersona('general_wellness');
}

export function getRecommendations(
  answers: SurveyAnswers,
  scores: Record<string, number>,
  persona: PersonaData | null,
  options?: { current_ids?: Set<string>; max_recs?: number },
): Array<[SupplementData, string[]]> {
  const { current_ids = new Set(), max_recs = persona?.max_recommendations || 5 } = options || {};
  const symptoms = answers.증상 || [];
  const conditions = answers.기저질환 || [];

  const scored: Array<{ total: number; supp: SupplementData; matched: string[] }> = [];

  for (const supp of SUPPLEMENTS) {
    // 차단 조건 체크
    if (current_ids.has(supp.id)) continue;
    if (supp.blocked_conditions?.some((c: string) => conditions.includes(c))) continue;

    // 카테고리 점수 × 친화도
    let total = 0;
    for (const [cat, weight] of Object.entries(supp.affinity || {})) {
      total += (scores[cat] || 0) * (weight as number);
    }

    // 성별 부스트
    if (supp.gender_boost) {
      total += supp.gender_boost[answers.성별] || 0;
    }

    // 음주 부스트
    if (supp.drink_boost && answers.음주 && answers.음주 !== '거의_안마심') {
      total += supp.drink_boost;
    }

    // 증상 매칭 보너스
    const matched: string[] = [];
    if (supp.symptom_indicators) {
      for (const ind of supp.symptom_indicators) {
        if (symptoms.includes(ind)) {
          total += 8;
          matched.push(ind);
        }
      }
    }

    if (total >= 12) {
      scored.push({ total, supp, matched });
    }
  }

  scored.sort((a, b) => b.total - a.total);

  // 시너지 보너스
  const topIds = new Set(scored.slice(0, max_recs + 2).map((s) => s.supp.id));
  for (const item of scored) {
    if (item.supp.synergy) {
      for (const syn of item.supp.synergy) {
        if (topIds.has(syn.id)) {
          item.total += 5;
        }
      }
    }
  }

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, max_recs).map((s) => [s.supp, s.matched]);
}

export function calculateMonthlySummary(recommendations: Array<[SupplementData, string[]]>): MonthlySummary {
  let cost_min = 0;
  let cost_max = 0;
  let pills_per_day = 0;
  const items: Array<{ name: string; pills: number; unit: string }> = [];

  for (const [supp] of recommendations) {
    const data = SUPPLEMENT_MONTHLY_DATA[supp.id];
    if (data) {
      cost_min += data.cost_min;
      cost_max += data.cost_max;
      pills_per_day += data.pills_per_day;
      items.push({ name: supp.name, pills: data.pills_per_day, unit: data.unit });
    }
  }

  return { cost_min, cost_max, pills_per_day, items };
}

export function runRecommendation(answers: SurveyAnswers): RecommendationResult {
  const scores = computeScores(answers);
  const persona = getPersona(answers, scores);

  const personaData = PERSONAS.find((p) => p.id === persona.id) || null;
  const current_ids = new Set(answers.현재복용영양제 || []);
  const raw_recs = getRecommendations(answers, scores, personaData, { current_ids });

  // 신체 정보
  const height = answers.신장 || 170;
  const weight = answers.체중 || 65;
  const gender = answers.성별 || 'male';
  const age = answers.나이 || 30;
  const activity = answers.운동 || '거의_안함';

  const bmi = calculateBMI(weight, height);
  const { label: bmi_label, color: bmi_color, advice: bmi_advice } = getBMICategory(bmi);
  const bmr = calculateBMR(gender, weight, height, age);
  const tdee = calculateTDEE(bmr, activity);
  const [protein_min, protein_max] = calculateProteinTarget(weight, answers.목표 || []);

  const nutrition_info: NutritionInfo = {
    bmi: { value: Math.round(bmi * 10) / 10, label: bmi_label, color: bmi_color, advice: bmi_advice },
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    protein_min: Math.round(protein_min),
    protein_max: Math.round(protein_max),
  };

  const monthly_summary = calculateMonthlySummary(raw_recs);

  const recommendations: Supplement[] = raw_recs.map(([supp, matched], idx) => ({
    id: supp.id,
    name: supp.name,
    score: 0,
    rank: idx + 1,
    mfds_type: supp.evidence?.mfds_type || supp.evidence?.summary || '',
    mfds_function: supp.evidence?.mfds_function || '',
    evidence: supp.evidence ? {
      summary: supp.evidence.summary || supp.evidence.mfds_function || '',
      studies: supp.evidence.study ? [supp.evidence.study] : [],
    } : undefined,
    dosage_guide: supp.dosage_guide ? {
      amount: supp.dosage_guide.amount || '',
      timing: supp.dosage_guide.timing || '',
      duration: supp.onset_weeks || '',
    } : undefined,
    cautions: supp.cautions || [],
    drug_interactions: supp.drug_interactions || [],
    symptom_indicators: matched,
    coupang_url: '',
    food_avoid: SUPPLEMENT_FOOD_AVOID[supp.id] || [],
  }));

  return {
    persona,
    scores,
    score_breakdown: Object.entries(scores).map(([category, score]) => ({
      category,
      score,
      max_score: 10.0,
    })),
    recommendations,
    excluded: [],
    nutrition_info,
    monthly_summary,
    warnings: [],
  };
}
