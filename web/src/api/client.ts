/**
 * 백엔드 API 클라이언트
 * 로컬 추천 엔진으로 변경됨 (browser-side processing)
 */
import type { SurveyAnswers, RecommendationResult, SymptomGroup, GoalItem } from '../types';
import { runRecommendation } from '../engine';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

/** 설문 응답 → 맞춤 추천 (로컬 엔진 실행) */
export async function getRecommendation(answers: SurveyAnswers): Promise<RecommendationResult> {
  // 로컬 추천 엔진 실행 (동기 처리이지만 async 함수 유지)
  return Promise.resolve(runRecommendation(answers));
}

/** 증상 목록 가져오기 */
export async function getSymptoms(): Promise<SymptomGroup[]> {
  const data = await fetchJson<{ symptom_groups: SymptomGroup[] }>('/meta/symptoms');
  return data.symptom_groups;
}

/** 건강 목표 목록 */
export async function getGoals(): Promise<GoalItem[]> {
  const data = await fetchJson<{ goals: GoalItem[] }>('/meta/goals');
  return data.goals;
}

/** 질환 목록 */
export async function getConditions(): Promise<string[]> {
  const data = await fetchJson<{ conditions: string[] }>('/meta/conditions');
  return data.conditions;
}

/** 서버 상태 확인 */
export async function healthCheck(): Promise<boolean> {
  try {
    await fetchJson('/health');
    return true;
  } catch {
    return false;
  }
}
