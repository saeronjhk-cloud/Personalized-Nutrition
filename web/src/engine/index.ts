/**
 * 추천 엔진 공개 인터페이스
 * 주요 export: runRecommendation()
 */

export { runRecommendation } from './recommender';
export { computeScores, calculateBMI, getBMICategory, calculateBMR, calculateTDEE, calculateProteinTarget } from './scorer';
export { getPersona, getRecommendations, calculateMonthlySummary } from './recommender';
export * from './data';
