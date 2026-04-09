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
  COUPANG_KEYWORDS,
  COUPANG_PARTNER_LINKS,
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
    description: p.description || p.tagline || '',
    tagline: p.tagline || '',
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
  const alcohol = answers.음주 || '거의_안함';
  const exercise = answers.운동 || '거의_안함';

  // 절대 우선순위
  if (conditions.includes('임산부_수유부')) return findPersona('pregnant');

  // 카테고리 기반 매칭
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topCat = sorted[0]?.[0];
  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);

  // 증상이 1개 이하이면 전반적 건강 관리형
  const symptomCount = (answers.증상 || []).length;
  if (totalScore < 8 || symptomCount <= 1) return findPersona('general_wellness');

  const topScore = sorted[0]?.[1] || 0;
  const scoreOf = (cat: string) => scores[cat] || 0;
  const isFemale = gender === 'female' || gender === '여성';
  const isMale = gender === 'male' || gender === '남성';
  const drinksOften = alcohol === '주3-4회' || alcohol === '매일';
  const exercisesOften = exercise === '주3-4회' || exercise === '거의_매일';

  // ── 우선 체크: 음주자 + 간건강 점수가 상위권이면 즉흥 외식형 ──
  if (drinksOften && scoreOf('간건강') >= topScore - 2) return findPersona('dine_out_drinker');
  if (alcohol !== '거의_안함' && topCat === '간건강') return findPersona('dine_out_drinker');

  // ── 우선 체크: 운동 자주 + 근육관절 상위권이면 근력 마니아 ──
  if (exercisesOften && scoreOf('근육관절') >= topScore - 2) return findPersona('fitness_lover');

  // 간건강 — 비음주자 (불규칙 생활)
  if (topCat === '간건강') return findPersona('low_willpower');

  // 갱년기
  if (topCat === '갱년기' && isFemale) return findPersona('menopause_woman');
  if (topCat === '갱년기' && isMale && age >= 40) return findPersona('middle_aged_man');

  // 혈당대사
  if (topCat === '혈당대사') return findPersona('blood_sugar_manager');

  // 심혈관
  if (topCat === '심혈관' && isMale && age >= 40) return findPersona('middle_aged_man');
  if (topCat === '심혈관') return findPersona(age >= 50 ? 'senior_wellness' : 'burnout');

  // 수면
  if (topCat === '수면') return findPersona('poor_sleeper');

  // 스트레스 / 피로
  if (topCat === '스트레스') return findPersona('burnout');
  if (topCat === '피로') return findPersona('burnout');

  // 근육관절 (운동 안 하는 경우)
  if (topCat === '근육관절') return findPersona(age >= 50 ? 'senior_wellness' : 'burnout');

  // 피부
  if (topCat === '피부') return findPersona('skin_influencer');

  // 장건강
  if (topCat === '장건강') return findPersona('gut_health_sensitive');

  // 면역력
  if (topCat === '면역력') return findPersona('immunity_worrier');

  // 눈건강
  if (topCat === '눈건강') return findPersona('burnout');

  // 체중관리
  if (topCat === '체중관리') return findPersona('dieter');

  // 인지기능
  if (topCat === '인지기능') return findPersona(age >= 50 ? 'senior_wellness' : 'burnout');

  // 나이 기반 폴백
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
    if (supp.drink_boost && answers.음주 && answers.음주 !== '거의_안함') {
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
    coupang_url: COUPANG_PARTNER_LINKS[supp.id] || `https://www.coupang.com/np/search?q=${encodeURIComponent(COUPANG_KEYWORDS[supp.id] || supp.name + ' 건강기능식품')}&channel=user&sorter=scoreDesc`,
    food_avoid: (SUPPLEMENT_FOOD_AVOID[supp.id] || []).map((f: any) => typeof f === 'string' ? f : f.item || ''),
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
