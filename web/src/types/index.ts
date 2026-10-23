/* ── API 타입 정의 ── */

export interface SurveyAnswers {
  성별: string;
  나이: number;
  신장: number;
  체중: number;
  체중변화: string;
  월경상태?: string;
  증상: string[];
  목표: string[];
  수면?: string;
  스트레스?: string;
  운동?: string;
  운동유형?: string;
  일조량?: string;
  식사패턴?: string;
  식이제한?: string[];
  음주?: string;
  흡연?: string;
  현재복용영양제: string[];
  기저질환: string[];
  복용약물?: string;
  /** 약 복용 유무(영양제 점검 v1.2 · 서박사 P2) */
  복용약있음?: "있음" | "없음";
  /** 철분을 진단·의사·약사 권고로 복용하는지(철분 선택 시만 · 서박사 P3) */
  철분권고?: "예" | "아니오";
  가족력: string[];
  /** 트랙 B 신설 문항(10-23, 모두 선택) — 명세 IP/integration/nutrient_track_b_v1 */
  유제품섭취?: "거의_안함" | "주몇번" | "매일";
  육류어패류섭취?: "거의_안함" | "주몇번" | "매일";
  채소과일섭취?: "거의_안함" | "하루1회" | "매끼";
  채식유형?: "아님" | "일부" | "비건";
  음주량?: "적게" | "보통" | "많이";
  월경량?: "보통" | "많음";
  임신단계?: "해당없음" | "임신준비" | "임신중" | "수유중";
  해당약물?: string[];
  음식상세?: Record<string, string>;
  혈액검사?: Record<string, number>;
}

export interface Supplement {
  id: string;
  name: string;
  score: number;
  rank: number;
  mfds_type?: string;
  mfds_function?: string;
  evidence?: { summary: string; studies: string[] };
  dosage_guide?: { amount: string; timing: string; duration: string };
  cautions?: string[];
  drug_interactions?: string[];
  symptom_indicators?: string[];
  coupang_url?: string;
  food_avoid?: string[];
  reason?: string;
}

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tip?: string;
  tagline?: string;
}

export interface ScoreBreakdown {
  category: string;
  score: number;
  max_score: number;
}

export interface BMIInfo {
  value: number;
  label: string;
  color: string;
  advice: string;
}

export interface NutritionInfo {
  bmi: BMIInfo;
  bmr: number;
  tdee: number;
  protein_min: number;
  protein_max: number;
}

export interface MonthlySummary {
  cost_min: number;
  cost_max: number;
  pills_per_day: number;
  items: { name: string; pills: number; unit: string }[];
}

export interface RecommendationResult {
  persona: Persona;
  scores: Record<string, number>;
  score_breakdown: ScoreBreakdown[];
  recommendations: Supplement[];
  excluded: Supplement[];
  nutrition_info: NutritionInfo;
  monthly_summary: MonthlySummary;
  warnings: string[];
  /** 트랙 B «부족하기 쉬운 영양소» (H154) */
  nutrient_track?: import('../domain/nutrient/track_b').TrackBResult;
}

export interface SymptomItem {
  id: string;
  text: string;
  scores: Record<string, number>;
}

export interface SymptomGroup {
  group: string;
  symptoms: SymptomItem[];
}

export interface GoalItem {
  id: string;
  emoji: string;
  label: string;
}

/* ── 설문 기록 (before/after 비교용) ── */
export interface SurveyRecord {
  id: string;
  date: string;             // ISO 8601
  answers: SurveyAnswers;
  result: RecommendationResult;
}

/* ── UI 상태 ── */
export type Step =
  | 'home'
  | 'body'
  | 'symptoms'
  | 'goals'
  | 'sleep'
  | 'stress'
  | 'exercise'
  | 'diet'
  | 'alcohol'
  | 'supplements'
  | 'conditions'
  | 'loading'
  | 'results';
