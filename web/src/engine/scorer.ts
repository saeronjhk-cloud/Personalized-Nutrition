/**
 * 점수 계산 엔진
 * - computeScores(): 설문 응답 → 14개 카테고리 점수
 */

import type { SurveyAnswers } from '../types';
import {
  SYMPTOM_SCORE_MAP,
} from './data';

const CATEGORIES = [
  '피로', '수면', '스트레스', '간건강', '면역력', '장건강', '근육관절', '피부',
  '눈건강', '혈당대사', '심혈관', '갱년기', '체중관리', '인지기능',
];

export function calculateBMI(weight: number, height: number): number {
  return weight / ((height / 100) ** 2);
}

export function getBMICategory(bmi: number): { label: string; color: string; advice: string } {
  if (bmi < 18.5) return { label: '저체중', color: '#74b9ff', advice: '영양 공급에 집중' };
  if (bmi < 23) return { label: '정상', color: '#00b894', advice: '현재 체중 유지' };
  if (bmi < 25) return { label: '과체중 초기', color: '#fdcb6e', advice: '가벼운 운동으로 관리' };
  return { label: '비만', color: '#d63031', advice: '체중감량이 건강을 위해 중요합니다' };
}

export function calculateBMR(gender: string, weight: number, height: number, age: number): number {
  if (gender === 'female' || gender === '여성') {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
  return 10 * weight + 6.25 * height - 5 * age + 5;
}

export function calculateTDEE(bmr: number, activity: string): number {
  const factors: Record<string, number> = {
    거의_안함: 1.2,
    '주1-2회': 1.375,
    '주3-4회': 1.55,
    거의_매일: 1.725,
  };
  return bmr * (factors[activity] || 1.2);
}

export function calculateProteinTarget(weight: number, goals: string[]): [number, number] {
  if (goals.includes('근육증가')) {
    return [Math.round(weight * 1.6), Math.round(weight * 2.0)];
  }
  if (goals.includes('체중관리') || goals.includes('체중감량')) {
    return [Math.round(weight * 1.4), Math.round(weight * 1.8)];
  }
  return [Math.round(weight * 1.0), Math.round(weight * 1.4)];
}

/**
 * 핵심 점수 계산 함수
 */
export function computeScores(answers: SurveyAnswers): Record<string, number> {
  const scores: Record<string, number> = {};
  CATEGORIES.forEach((cat) => {
    scores[cat] = 0;
  });

  // 1. 신체 증상
  for (const symptomId of answers.증상 || []) {
    const symptomScores = SYMPTOM_SCORE_MAP[symptomId] || {};
    for (const [cat, val] of Object.entries(symptomScores)) {
      scores[cat] = (scores[cat] || 0) + val;
    }
  }

  // 2. 나이 보정
  const age = answers.나이 || 30;
  if (age >= 40) {
    scores['피로'] = (scores['피로'] || 0) + 1;
    scores['근육관절'] = (scores['근육관절'] || 0) + 1;
    scores['면역력'] = (scores['면역력'] || 0) + 1;
    scores['심혈관'] = (scores['심혈관'] || 0) + 1;
    scores['인지기능'] = (scores['인지기능'] || 0) + 1;
  }
  if (age >= 50) {
    scores['근육관절'] = (scores['근육관절'] || 0) + 1;
    scores['피부'] = (scores['피부'] || 0) + 1;
    scores['갱년기'] = (scores['갱년기'] || 0) + 1;
  }

  // 3. BMI 기반 보정
  const weight = answers.체중;
  const height = answers.신장;
  if (weight && height && weight > 0 && height > 0) {
    const bmi = calculateBMI(weight, height);
    if (bmi < 18.5) {
      scores['피로'] = (scores['피로'] || 0) + 3;
      scores['면역력'] = (scores['면역력'] || 0) + 2;
    } else if (bmi >= 25) {
      scores['장건강'] = (scores['장건강'] || 0) + 3;
      scores['면역력'] = (scores['면역력'] || 0) + 1;
      scores['혈당대사'] = (scores['혈당대사'] || 0) + 2;
      scores['체중관리'] = (scores['체중관리'] || 0) + 2;
      scores['심혈관'] = (scores['심혈관'] || 0) + 1;
    }
  }

  // 4. 음주 기반 보정
  const alcohol = answers.음주 || '거의_안함';
  if (alcohol === '주1-2회') {
    scores['간건강'] = (scores['간건강'] || 0) + 1;
  } else if (alcohol === '주3-4회') {
    scores['간건강'] = (scores['간건강'] || 0) + 4;
  } else if (alcohol === '매일') {
    scores['간건강'] = (scores['간건강'] || 0) + 6;
  }

  // 5. 흡연 기반 보정
  if (answers.흡연 === '현재흡연') {
    scores['면역력'] = (scores['면역력'] || 0) + 2;
    scores['피부'] = (scores['피부'] || 0) + 1;
  }

  // 6. 목표 기반 보정 — 사용자가 선택한 관심 영역에 가중치
  const goalBoostMap: Record<string, Record<string, number>> = {
    '피로회복': { '피로': 2 },
    '수면개선': { '수면': 2 },
    '면역력강화': { '면역력': 2 },
    '체중관리': { '체중관리': 2, '혈당대사': 1 },
    '간건강': { '간건강': 3 },
    '소화장건강': { '장건강': 2 },
    '근육증가': { '근육관절': 2 },
    '피부개선': { '피부': 2 },
    '혈당관리': { '혈당대사': 2 },
    '눈건강': { '눈건강': 2 },
    '심혈관건강': { '심혈관': 2 },
    '갱년기관리': { '갱년기': 3 },
    '인지력향상': { '인지기능': 2 },
  };
  for (const goal of answers.목표 || []) {
    const boosts = goalBoostMap[goal];
    if (boosts) {
      for (const [cat, val] of Object.entries(boosts)) {
        scores[cat] = (scores[cat] || 0) + val;
      }
    }
  }

  return scores;
}

export function computeScoreBreakdown(answers: SurveyAnswers): Record<string, number> {
  return computeScores(answers);
}
