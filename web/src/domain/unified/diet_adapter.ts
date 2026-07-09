/**
 * 식이 신호 어댑터 (Phase F)
 * 최근 7일 식이 일평균 → 설문/검진과 같은 14개 카테고리 점수로 변환.
 * 참조: D:\헬스픽\IP\integration\phase_f_diet_design_v1.md (KDRIs 2020 확정 상수)
 *
 * 핵심: 추천은 외부 호출이 아니라 우리 meal_records 집계를 규칙 엔진이 읽어 계산(엔진 우선).
 * 점수 스케일·상한은 checkup adapter와 동일 → mergeScores로 그대로 합산.
 */

/** SCORE_PER_SIGNAL/CATEGORY_CAP는 adapter.ts와 동일 스케일 유지 */
const SCORE_PER_SIGNAL = 8;
const SCORE_WEAK = 6; // 열량부족 등 약한 신호
const CATEGORY_CAP = 10;

/** 신호화에 필요한 최소 기록 일수 (미만이면 과추천 방지로 신호 0) */
const MIN_DAYS = 2;

/** KDRIs 2020 확정 임계 (검증: 2026-06-22, 한국영양학회/보건복지부) */
export const DIET_THRESHOLDS = {
  /** 나트륨 만성질환위험감소섭취량(CDRR) mg/일 */
  SODIUM_CDRR_MG: 2300,
  /** 단백질: RNI 0.91 g/kg 대비 저단백 판정 배수 */
  PROTEIN_LOW_PER_KG: 0.7,
  /** 총당류: 적정 10~20% 상단 초과 비율 */
  SUGAR_HIGH_ENERGY_RATIO: 0.20,
  /** 식이섬유 충분섭취량(AI) g/일 */
  FIBER_AI_MALE_G: 30,
  FIBER_AI_FEMALE_G: 20,
  /** 열량 과잉/부족 배수 (추정필요량 대비) */
  KCAL_OVER_RATIO: 1.15,
  KCAL_UNDER_RATIO: 0.7,
} as const;

/** 최근 7일 식이 일평균 (meal_records 집계 결과) */
export interface DietDailyAvg {
  /** 기록된 일수 (MIN_DAYS 미만이면 신호화 안 함) */
  days: number;
  kcal: number;
  protein_g: number;
  sugar_g: number;
  sodium_mg: number;
  fiber_g: number;
  /**
   * 데이터 신뢰 가드(Step 4): 해당 영양소가 신뢰 가능한가(미상 항목 없음).
   * 집계부(meal_records)가 uncertainty.meal_nutrient().engine_usable로 채움.
   * false면 신호 보류(0으로 합산해 "저염·저당" 오판 방지). 미지정(undefined)은 허용으로 간주.
   */
  sodium_known?: boolean;
  sugar_known?: boolean;
  fiber_known?: boolean;
}

export interface DietContext {
  sex?: string | null; // 'male' | 'female'
  weightKg?: number | null;
  /** 추정필요열량(TDEE) — 없으면 열량 과잉/부족 신호 생략 */
  kcalTarget?: number | null;
  /**
   * 나트륨·당류 신호 활성화(정책 스위치).
   * Step 1에서 DB 신뢰도 문제로 OFF했다가, DB 재구축+불확실성 가드 도입 후 재가동.
   * 단 실제 발화는 데이터 가드(sodium_known/sugar_known)도 통과해야 함.
   * 참조: nutrilens_cleandb_verification_v1.md §6, nutrilens_uncertainty_model_v1.md
   */
  enableMicroSignals?: boolean;
  /**
   * 식이섬유 신호. 기본 false 유지 — clean DB에서도 식이섬유 보유율 6.8%로 낮아
   * 신호로 쓰기 부족(2-AI 공통). 커버리지 확보 후 별도 활성화.
   */
  enableFiberSignal?: boolean;
}

export interface DietSignalResult {
  /** 카테고리별 식이 기여 점수 */
  scores: Record<string, number>;
  /** 기록 부족(days < MIN_DAYS) — UI에서 확신도↓ 표기 */
  lowConfidence: boolean;
}

function add(scores: Record<string, number>, cat: string, pts: number) {
  scores[cat] = Math.min((scores[cat] || 0) + pts, CATEGORY_CAP);
}

/**
 * 식이 일평균 → 카테고리 점수.
 * 데이터 부족(days < MIN_DAYS) 시 scores 비우고 lowConfidence=true (과추천 방지).
 * referral 없음(식이는 중증 referral 신호 아님). 검진 referral 억제는 호출부에서.
 */
export function dietToScores(avg: DietDailyAvg, ctx: DietContext = {}): DietSignalResult {
  if (!avg || avg.days < MIN_DAYS) {
    return { scores: {}, lowConfidence: true };
  }

  const scores: Record<string, number> = {};
  const { SODIUM_CDRR_MG, PROTEIN_LOW_PER_KG, SUGAR_HIGH_ENERGY_RATIO, FIBER_AI_MALE_G, FIBER_AI_FEMALE_G, KCAL_OVER_RATIO, KCAL_UNDER_RATIO } = DIET_THRESHOLDS;

  // ── 나트륨·당류 신호(Step 4 재가동): 정책 스위치 + 데이터 신뢰 가드 둘 다 통과해야 발화 ──
  if (ctx.enableMicroSignals) {
    // 고나트륨 → 심혈관 (sodium_known === false면 보류)
    if (avg.sodium_known !== false && avg.sodium_mg >= SODIUM_CDRR_MG) {
      add(scores, "심혈관", SCORE_PER_SIGNAL);
    }
    // 고당류 → 혈당대사 (총당류 kcal > 20% 총열량; sugar_known === false면 보류)
    if (avg.sugar_known !== false && avg.kcal > 0 && avg.sugar_g * 4 > SUGAR_HIGH_ENERGY_RATIO * avg.kcal) {
      add(scores, "혈당대사", SCORE_PER_SIGNAL);
    }
  }

  // ── 식이섬유 → 장건강: 별도 스위치(기본 OFF, 커버리지 낮음) + 데이터 가드 ──
  if (ctx.enableFiberSignal && avg.fiber_known !== false) {
    const fiberAI = ctx.sex === "female" ? FIBER_AI_FEMALE_G : FIBER_AI_MALE_G;
    if (avg.fiber_g < fiberAI) add(scores, "장건강", SCORE_PER_SIGNAL);
  }

  // ── 칼로리·단백질 신호: 상대적으로 신뢰 가능 → 항상 가동 ──
  // 저단백 → 근육관절 (체중 있을 때만)
  if (ctx.weightKg && ctx.weightKg > 0 && avg.protein_g < PROTEIN_LOW_PER_KG * ctx.weightKg) {
    add(scores, "근육관절", SCORE_PER_SIGNAL);
  }

  // 열량 과잉/부족 (추정필요량 있을 때만)
  if (ctx.kcalTarget && ctx.kcalTarget > 0) {
    if (avg.kcal > ctx.kcalTarget * KCAL_OVER_RATIO) add(scores, "체중관리", SCORE_PER_SIGNAL);
    else if (avg.kcal < ctx.kcalTarget * KCAL_UNDER_RATIO) add(scores, "피로", SCORE_WEAK);
  }

  return { scores, lowConfidence: false };
}
