/**
 * 맞춤형 건강기능식품 추천 엔진 — TypeScript 포트
 * data.ts: 모든 상수 데이터 (30개 영양제, 증상 맵, 페르소나 등)
 */

import type { SurveyAnswers } from '../types';

// ── 내부 데이터 타입 ─────────────────────────────────────────────────────
export interface SupplementData {
  id: string;
  name: string;
  emoji: string;
  onset_weeks: string;
  affinity: Record<string, number>;
  symptom_indicators?: string[];
  evidence?: Record<string, any>;
  dosage_guide?: Record<string, any>;
  cautions?: string[];
  synergy?: Array<{ id: string; note: string }>;
  conflict?: Array<{ id: string; note: string }>;
  gender_boost?: Record<string, number>;
  drink_boost?: number;
  blocked_conditions?: string[];
  required_conditions?: string[];
  drug_interactions?: string[];
  [key: string]: any;
}

export interface PersonaData {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description?: string;
  tip?: string;
  max_recommendations: number;
  category_boosts?: Record<string, number>;
  avoidances?: any[];
  [key: string]: any;
}

// ── 신체 증상 점수 매핑 ────────────────────────────────────────────────────
export const SYMPTOM_SCORE_MAP: Record<string, Record<string, number>> = {
  "chronic_fatigue": {
    "피로": 4
  },
  "afternoon_slump": {
    "피로": 3,
    "면역력": 1
  },
  "brain_fog": {
    "피로": 2,
    "스트레스": 1
  },
  "eye_fatigue": {
    "피로": 2,
    "스트레스": 1,
    "눈건강": 3
  },
  "leg_cramps_night": {
    "수면": 3,
    "근육관절": 2
  },
  "cant_fall_asleep": {
    "수면": 4
  },
  "wake_night": {
    "수면": 3,
    "스트레스": 2
  },
  "unrefreshing": {
    "수면": 2,
    "피로": 3
  },
  "hair_loss": {
    "피부": 3,
    "피로": 1
  },
  "brittle_nails": {
    "피부": 3
  },
  "dry_skin": {
    "피부": 4
  },
  "easy_bruising": {
    "피부": 2,
    "면역력": 2
  },
  "gum_bleeding": {
    "피부": 1,
    "면역력": 3
  },
  "frequent_colds": {
    "면역력": 5
  },
  "slow_healing": {
    "면역력": 3,
    "피부": 1
  },
  "poor_digestion": {
    "장건강": 4
  },
  "irregular_bowel": {
    "장건강": 4
  },
  "bloating": {
    "장건강": 3
  },
  "muscle_cramps": {
    "근육관절": 3,
    "수면": 1
  },
  "joint_stiffness": {
    "근육관절": 4
  },
  "slow_recovery": {
    "근육관절": 3,
    "피로": 1
  },
  "numbness": {
    "스트레스": 2,
    "피로": 2
  },
  "anxiety": {
    "스트레스": 4
  },
  "low_mood": {
    "스트레스": 2,
    "면역력": 1,
    "피로": 1
  },
  "blurry_vision": {
    "눈건강": 4
  },
  "dry_eyes": {
    "눈건강": 4
  },
  "floaters": {
    "눈건강": 3
  },
  "sugar_cravings": {
    "혈당대사": 4,
    "체중관리": 2
  },
  "post_meal_drowsy": {
    "혈당대사": 3,
    "피로": 2
  },
  "thirst_frequent_urination": {
    "혈당대사": 4
  },
  "chest_tightness": {
    "심혈관": 4
  },
  "cold_hands_feet": {
    "심혈관": 3,
    "피로": 1
  },
  "leg_swelling": {
    "심혈관": 3,
    "체중관리": 1
  },
  "hot_flashes": {
    "갱년기": 5
  },
  "mood_swings": {
    "갱년기": 3,
    "스트레스": 2
  },
  "vaginal_dryness": {
    "갱년기": 4,
    "피부": 2
  }
};

// ── 기본 카테고리 목록 ────────────────────────────────────────────────────
export const CATEGORIES = [
  '피로', '수면', '스트레스', '간건강', '면역력', '장건강', '근muscle관절', '피부',
  '눈건강', '혈당대사', '심혈관', '갱년기', '체중관리', '인지기능',
];

// ── 영양제 월간 데이터 ────────────────────────────────────────────────────
export const SUPPLEMENT_MONTHLY_DATA: Record<string, any> = {
  vitamin_b: { cost_min: 8000, cost_max: 20000, pills_per_day: 1, unit: '정' },
  magnesium: { cost_min: 10000, cost_max: 25000, pills_per_day: 1, unit: '정' },
  omega3: { cost_min: 15000, cost_max: 35000, pills_per_day: 2, unit: '캡슐' },
  vitamin_d: { cost_min: 5000, cost_max: 15000, pills_per_day: 1, unit: '정' },
  probiotics: { cost_min: 15000, cost_max: 40000, pills_per_day: 1, unit: '포' },
  milk_thistle: { cost_min: 10000, cost_max: 25000, pills_per_day: 1, unit: '정' },
  vitamin_c: { cost_min: 5000, cost_max: 15000, pills_per_day: 1, unit: '정' },
  lemon_balm: { cost_min: 12000, cost_max: 30000, pills_per_day: 1, unit: '정' },
  collagen: { cost_min: 15000, cost_max: 40000, pills_per_day: 1, unit: '포' },
  coq10: { cost_min: 20000, cost_max: 50000, pills_per_day: 1, unit: '캡슐' },
  iron: { cost_min: 8000, cost_max: 20000, pills_per_day: 1, unit: '정' },
  zinc: { cost_min: 5000, cost_max: 15000, pills_per_day: 1, unit: '정' },
  gaba: { cost_min: 12000, cost_max: 30000, pills_per_day: 1, unit: '정' },
  headache_tree: { cost_min: 8000, cost_max: 20000, pills_per_day: 1, unit: '정' },
  folic_acid: { cost_min: 5000, cost_max: 15000, pills_per_day: 1, unit: '정' },
  vitamin_e: { cost_min: 8000, cost_max: 25000, pills_per_day: 1, unit: '캡슐' },
  red_ginseng: { cost_min: 15000, cost_max: 50000, pills_per_day: 2, unit: '정' },
  calcium: { cost_min: 8000, cost_max: 25000, pills_per_day: 2, unit: '정' },
  lutein: { cost_min: 10000, cost_max: 30000, pills_per_day: 1, unit: '캡슐' },
  chromium: { cost_min: 8000, cost_max: 20000, pills_per_day: 1, unit: '정' },
  banaba_leaf: { cost_min: 10000, cost_max: 25000, pills_per_day: 1, unit: '정' },
  saw_palmetto: { cost_min: 12000, cost_max: 30000, pills_per_day: 1, unit: '정' },
  gamma_linolenic: { cost_min: 15000, cost_max: 35000, pills_per_day: 1, unit: '캡슐' },
  msm: { cost_min: 10000, cost_max: 25000, pills_per_day: 2, unit: '캡슐' },
  garcinia: { cost_min: 8000, cost_max: 20000, pills_per_day: 2, unit: '캡슐' },
  vitamin_k2: { cost_min: 12000, cost_max: 30000, pills_per_day: 1, unit: '정' },
  selenium: { cost_min: 8000, cost_max: 20000, pills_per_day: 1, unit: '정' },
  red_clover: { cost_min: 12000, cost_max: 30000, pills_per_day: 2, unit: '정' },
  coenzyme_pqq: { cost_min: 20000, cost_max: 50000, pills_per_day: 1, unit: '캡슐' },
  phosphatidylserine: { cost_min: 15000, cost_max: 40000, pills_per_day: 2, unit: '캡슐' },
};

// ── 30개 영양제 전체 데이터 ──────────────────────────────────────────────
export const SUPPLEMENTS: SupplementData[] = [
  {
    "id": "vitamin_b",
    "onset_weeks": "2~4주",
    "name": "비타민 B 복합체",
    "emoji": "⚙️",
    "description": "에너지 대사의 핵심 조효소. 만성 피로, 집중력 저하, 신경계 기능에 광범위하게 필요해요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "에너지 생성, 신경기능 유지, 피로 회복에 도움",
      "study": "Kennedy et al. (2016). Psychopharmacology, 211(1):55–68",
      "finding": "건강한 성인 남성 대상 무작위 이중맹검 시험. B군 비타민 복합 보충 후 피로 점수 및 인지 기능 유의미하게 개선.",
      "grade": "A"
    },
    "caution": [],
    "search_keyword": "비타민B 복합체",
    "affinity": {
      "피로": 5,
      "스트레스": 3,
      "장건강": 1
    },
    "dosage_guide": {
      "amount": "비타민B군 각 25~100mg/일",
      "timing": "아침 식후",
      "form": "B-Complex 형태(종합) 추천"
    },
    "synergy": [
      {
        "id": "magnesium",
        "note": "마그네슘과 함께 에너지 대사 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "chronic_fatigue",
      "afternoon_slump",
      "brain_fog",
      "numbness",
      "low_mood"
    ]
  },
  {
    "id": "magnesium",
    "onset_weeks": "1~2주",
    "name": "마그네슘",
    "emoji": "💤",
    "description": "스트레스·긴장으로 소모된 마그네슘 보충. 수면 질 개선, 근육 이완, 신경 안정에 도움돼요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "에너지 생성, 신경·근육 기능 유지에 필요",
      "study": "Abbasi B, et al. (2012). J Res Med Sci, 17(12):1161–1169",
      "finding": "불면증 노인 환자 46명 대상 8주 이중맹검 임상시험. 마그네슘 보충군에서 수면 효율, 수면 시간, 불면증 점수(ISI) 모두 유의미하게 개선.",
      "grade": "A"
    },
    "caution": [
      "신장질환자는 전문의 상담 필요"
    ],
    "search_keyword": "마그네슘 글리시네이트",
    "affinity": {
      "수면": 4,
      "스트레스": 4,
      "피로": 2,
      "근육관절": 2,
      "혈당대사": 2,
      "심혈관": 1
    },
    "dosage_guide": {
      "amount": "300~400mg/일 (원소 마그네슘 기준)",
      "timing": "저녁 식후 또는 취침 1시간 전",
      "form": "글리시네이트·말레이트 형태 추천 (산화마그네슘보다 흡수율 4배)"
    },
    "synergy": [
      {
        "id": "vitamin_d",
        "note": "비타민D 활성화에 마그네슘 필수 — 함께 복용 시 두 가지 효과 모두 극대화"
      },
      {
        "id": "vitamin_b",
        "note": "에너지 대사 경로 공동 작용"
      }
    ],
    "conflict": [
      {
        "id": "iron",
        "note": "마그네슘과 철분은 흡수 경쟁 — 2시간 간격 복용 권장"
      }
    ],
    "symptom_indicators": [
      "leg_cramps_night",
      "cant_fall_asleep",
      "wake_night",
      "muscle_cramps",
      "anxiety"
    ]
  },
  {
    "id": "omega3",
    "onset_weeks": "4~8주",
    "name": "오메가-3",
    "emoji": "🐟",
    "description": "혈중 중성지방 감소, 뇌·눈 건강, 항염 효과. 외식이 잦을수록 특히 중요해요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "혈중 중성지방 개선, 혈행 개선에 도움",
      "study": "Bhatt DL, et al. (2019). REDUCE-IT Trial. N Engl J Med, 380:11–22",
      "finding": "8,179명 대상 대규모 무작위 임상시험. 고순도 EPA 보충 시 심혈관 이상 위험 25% 감소, 혈중 중성지방 유의미한 개선.",
      "grade": "A"
    },
    "caution": [
      "항혈전제(와파린 등) 복용 시 의사 상담 필요"
    ],
    "search_keyword": "오메가3 EPA DHA",
    "affinity": {
      "피부": 2,
      "면역력": 2,
      "간건강": 1,
      "장건강": 1,
      "피로": 1,
      "심혈관": 3,
      "인지기능": 2
    },
    "dosage_guide": {
      "amount": "EPA+DHA 합계 1,000~2,000mg/일",
      "timing": "식사와 함께 (지방 있는 식사 시 흡수 최적)",
      "form": "rTG 형태 추천 (EE 형태보다 흡수율 약 70% 높음)"
    },
    "synergy": [
      {
        "id": "vitamin_d",
        "note": "지용성 영양소 — 함께 복용 시 오메가-3가 비타민D 흡수 도움"
      },
      {
        "id": "vitamin_e",
        "note": "항산화 보호 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "dry_skin",
      "joint_stiffness",
      "anxiety",
      "low_mood"
    ]
  },
  {
    "id": "vitamin_d",
    "onset_weeks": "8~12주",
    "name": "비타민 D3",
    "emoji": "☀️",
    "description": "실내 생활이 많은 현대인의 필수 비타민. 면역력·뼈 건강·기분 안정에 영향을 줘요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "칼슘·인 흡수 촉진, 면역기능 유지에 필요",
      "study": "Martineau AR, et al. (2017). BMJ, 356:i6583 (메타분석)",
      "finding": "11,321명 대상 25개 무작위 임상시험 메타분석. 비타민D 보충 시 급성 호흡기 감염 위험 12% 감소. 결핍자에서는 42% 감소.",
      "grade": "A"
    },
    "caution": [
      "고용량(4,000IU 이상) 장기 복용 시 전문가 상담 권장"
    ],
    "search_keyword": "비타민D3 2000IU",
    "affinity": {
      "면역력": 4,
      "피로": 2,
      "근육관절": 2,
      "스트레스": 1,
      "갱년기": 1
    },
    "dosage_guide": {
      "amount": "1,000~2,000 IU/일 (결핍 시 4,000 IU)",
      "timing": "지방 포함 식사와 함께 (아침 또는 점심 권장)",
      "form": "D3 형태 추천 (D2보다 체내 이용률 2배)"
    },
    "synergy": [
      {
        "id": "magnesium",
        "note": "마그네슘이 비타민D 대사 효소 활성화 — 상호 보완"
      },
      {
        "id": "omega3",
        "note": "지용성 영양소 흡수 상호 도움"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "frequent_colds",
      "chronic_fatigue",
      "low_mood",
      "afternoon_slump",
      "joint_stiffness"
    ]
  },
  {
    "id": "probiotics",
    "onset_weeks": "2~4주",
    "name": "프로바이오틱스",
    "emoji": "🦠",
    "description": "장내 유익균 증식, 소화 개선, 면역력 강화. 장이 건강해야 몸 전체가 건강해요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "장내 유익균 증식·유해균 억제에 도움",
      "study": "Hempel S, et al. (2012). JAMA, 307(18):1959–1969 (메타분석)",
      "finding": "82개 임상시험 메타분석. 유산균 섭취 그룹에서 장 기능 이상 비율 42% 유의미하게 감소.",
      "grade": "A"
    },
    "caution": [],
    "search_keyword": "프로바이오틱스 유산균",
    "affinity": {
      "장건강": 5,
      "면역력": 3,
      "피부": 2,
      "체중관리": 1
    },
    "dosage_guide": {
      "amount": "1억~100억 CFU/일",
      "timing": "공복(식전 30분) 또는 식후 — 제품에 따라 다름",
      "form": "다균주(5종 이상) 제품 추천, 냉장 보관 필수"
    },
    "synergy": [
      {
        "id": "vitamin_b",
        "note": "장내 유익균이 비타민B군 합성에 기여"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "poor_digestion",
      "irregular_bowel",
      "bloating",
      "frequent_colds"
    ]
  },
  {
    "id": "milk_thistle",
    "onset_weeks": "4~8주",
    "name": "밀크씨슬",
    "emoji": "🌿",
    "description": "간세포 보호의 대명사. 음주·약물·환경독소로부터 간을 지키는 핵심 성분이에요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "간 기능 개선에 도움",
      "study": "Saller R, et al. (2008). Drugs, 68(10):1–29 (체계적 문헌고찰)",
      "finding": "실리마린(밀크씨슬 활성 성분) 임상연구 체계적 고찰. 간 손상 지표(ALT·AST) 유의미한 감소 및 간세포 보호 효과 확인.",
      "grade": "A"
    },
    "caution": [
      "임산부·수유부 전문의 상담 권장"
    ],
    "search_keyword": "밀크씨슬 실리마린",
    "affinity": {
      "간건강": 5,
      "피로": 2
    },
    "dosage_guide": {
      "amount": "실리마린 140~420mg/일 (밀크씨슬 70% 추출물 기준)",
      "timing": "식전 또는 식사와 함께",
      "form": "실리마린 함량 70% 이상 추출물 확인"
    },
    "synergy": [],
    "conflict": [],
    "symptom_indicators": [
      "chronic_fatigue",
      "afternoon_slump"
    ]
  },
  {
    "id": "vitamin_c",
    "onset_weeks": "1~2주",
    "name": "비타민 C",
    "emoji": "🍊",
    "description": "항산화의 기본. 면역력 강화, 피부 콜라겐 합성, 피로 회복에 다방면으로 활약해요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "항산화, 피부 건강, 면역기능 유지에 도움",
      "study": "Hemilä H & Chalker E. (2013). Cochrane Database Syst Rev (메타분석)",
      "finding": "29개 임상시험(11,306명) 메타분석. 비타민C 정기 복용 시 감기 지속기간 성인 8%, 아동 14% 단축. 멍·잇몸 출혈은 결핍의 초기 신호.",
      "grade": "A"
    },
    "caution": [],
    "search_keyword": "비타민C 고함량 1000mg",
    "affinity": {
      "면역력": 4,
      "피부": 3,
      "피로": 3,
      "스트레스": 2
    },
    "dosage_guide": {
      "amount": "500~1,000mg/일 (상한 2,000mg)",
      "timing": "식후 (공복 시 위장 자극 가능)",
      "form": "일반 L-아스코르빈산 또는 완충형(Ester-C) 추천"
    },
    "synergy": [
      {
        "id": "iron",
        "note": "철분과 함께 복용 시 철분 흡수율 2~3배 향상"
      },
      {
        "id": "collagen",
        "note": "콜라겐 합성에 비타민C 필수 — 시너지 효과"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "frequent_colds",
      "slow_healing",
      "easy_bruising",
      "gum_bleeding",
      "dry_skin"
    ]
  },
  {
    "id": "lemon_balm",
    "onset_weeks": "1~2주",
    "name": "레몬밤 추출물",
    "emoji": "🍋",
    "description": "천연 허브로 수면 질 개선, 불안 완화. 자기 전 복용으로 자연스러운 수면 유도.",
    "evidence": {
      "mfds_type": "개별인정형 기능성 원료 (인정번호 제2013-22호)",
      "mfds_function": "수면의 질 개선에 도움",
      "study": "Cases J, et al. (2011). Mediterr J Nutr Metab, 4(3):211–218",
      "finding": "불안·수면 장애 성인 225명 대상 15일 임상시험. 레몬밤 추출물 복용 후 불안 증상 18%, 불면 증상 42% 개선.",
      "grade": "B"
    },
    "caution": [
      "수면제·항우울제·갑상선 약물 복용 시 반드시 의사 상담",
      "임산부·수유부 사용 금지"
    ],
    "blocked_conditions": [
      "임산부_수유부",
      "약물복용중"
    ],
    "search_keyword": "레몬밤 추출물 수면",
    "affinity": {
      "수면": 4,
      "스트레스": 4
    },
    "dosage_guide": {
      "amount": "300~600mg/일 (레몬밤 추출물)",
      "timing": "취침 30~60분 전",
      "form": "로즈마린산 함량 확인"
    },
    "synergy": [
      {
        "id": "magnesium",
        "note": "마그네슘과 함께 수면 질 개선 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "cant_fall_asleep",
      "wake_night",
      "anxiety"
    ]
  },
  {
    "id": "collagen",
    "onset_weeks": "4~8주",
    "name": "저분자 콜라겐",
    "emoji": "✨",
    "description": "피부 탄력·보습, 관절 건강에 도움. 30대 이후 콜라겐 생성이 자연스럽게 줄어들어요.",
    "evidence": {
      "mfds_type": "개별인정형 기능성 원료",
      "mfds_function": "피부 보습에 도움",
      "study": "Proksch E, et al. (2014). Skin Pharmacol Physiol, 27(1):47–55",
      "finding": "건강한 여성 69명 대상 8주 이중맹검 임상시험. 저분자 콜라겐 펩타이드 복용 후 피부 탄력 15%, 보습도 유의미하게 개선.",
      "grade": "A"
    },
    "caution": [],
    "search_keyword": "저분자 콜라겐 펩타이드",
    "affinity": {
      "피부": 5,
      "근육관절": 3
    },
    "dosage_guide": {
      "amount": "5,000~10,000mg/일 (콜라겐 펩타이드)",
      "timing": "저녁 식후 (비타민C 함유 음료와 함께)",
      "form": "저분자(분자량 2,000 Da 이하) 가수분해 콜라겐 추천"
    },
    "synergy": [
      {
        "id": "vitamin_c",
        "note": "비타민C는 체내 콜라겐 합성 필수 보조인자 — 함께 복용 강력 권장"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "dry_skin",
      "brittle_nails",
      "hair_loss",
      "joint_stiffness"
    ]
  },
  {
    "id": "coq10",
    "onset_weeks": "4~8주",
    "name": "코엔자임 Q10",
    "emoji": "⚡",
    "description": "세포 에너지 생산의 핵심 조효소. 극심한 피로, 스태미나 저하에 효과적이에요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "항산화에 도움",
      "study": "Mizuno K, et al. (2008). Nutrition, 24(4):293–299",
      "finding": "만성피로 호소 성인 대상 8주 무작위 임상시험. CoQ10 보충군에서 피로 점수(VAS) 및 주관적 피로감 유의미하게 감소.",
      "grade": "A"
    },
    "caution": [
      "혈압약·항응고제 복용 시 의사 상담 필요"
    ],
    "search_keyword": "코큐텐 CoQ10",
    "affinity": {
      "피로": 5,
      "근육관절": 2,
      "심혈관": 3
    },
    "dosage_guide": {
      "amount": "100~300mg/일",
      "timing": "지방 포함 식사와 함께 (아침 또는 점심)",
      "form": "유비퀴놀(Ubiquinol) 형태 추천 (유비퀴논보다 흡수율 높음, 특히 40대 이상)"
    },
    "synergy": [
      {
        "id": "omega3",
        "note": "지용성 영양소 — 함께 복용 시 상호 흡수 도움"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "chronic_fatigue",
      "afternoon_slump",
      "slow_recovery"
    ]
  },
  {
    "id": "iron",
    "onset_weeks": "4~8주",
    "name": "철분 (헴철)",
    "emoji": "🩸",
    "description": "빈혈 예방, 산소 운반 능력 향상. 특히 여성·채식주의자에게 중요한 영양소예요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "혈액 생성, 산소 운반에 필요",
      "study": "Vaucher P, et al. (2012). CMAJ, 184(11):1247–1254",
      "finding": "페리틴 낮은 월경 여성 198명 대상 12주 무작위 임상시험. 철분 보충 후 피로 점수 48% 개선.",
      "grade": "A"
    },
    "caution": [
      "공복 복용 시 위장 불편감 가능",
      "남성 과다 복용 주의"
    ],
    "search_keyword": "헴철 철분 영양제",
    "affinity": {
      "피로": 4,
      "면역력": 2
    },
    "gender_boost": {
      "여성": 3
    },
    "dosage_guide": {
      "amount": "18~45mg/일 (원소 철분 기준, 여성 기준)",
      "timing": "식간(공복)이 최적이나 위장 자극 시 식후 — 비타민C와 함께 복용",
      "form": "헴철 또는 피로인산철 추천 (황산철보다 흡수율 높고 부작용 적음)"
    },
    "synergy": [
      {
        "id": "vitamin_c",
        "note": "비타민C와 동시 복용 시 철분 흡수율 2~3배 증가"
      }
    ],
    "conflict": [
      {
        "id": "magnesium",
        "note": "마그네슘과 동시 복용 시 철분 흡수 감소 — 2시간 간격 권장"
      },
      {
        "id": "zinc",
        "note": "아연과 동시 복용 시 상호 흡수 경쟁 — 시간대 분리 권장"
      }
    ],
    "symptom_indicators": [
      "chronic_fatigue",
      "afternoon_slump",
      "hair_loss",
      "unrefreshing"
    ]
  },
  {
    "id": "zinc",
    "onset_weeks": "2~4주",
    "name": "아연",
    "emoji": "🛡️",
    "description": "면역의 최전선. 감기·바이러스 저항력, 피부 재생, 남성 건강에도 중요한 미네랄이에요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "면역기능, 세포분열에 필요",
      "study": "Hemilä H. (2011). Open Respir Med J, 5:51–58 (메타분석)",
      "finding": "아연 관련 13개 임상시험 메타분석. 감기 발병 24시간 이내 복용 시 감기 지속기간 33% 단축.",
      "grade": "A"
    },
    "caution": [
      "과다 복용(40mg/일 이상) 시 구역감 가능"
    ],
    "search_keyword": "아연 징크 영양제",
    "affinity": {
      "면역력": 4,
      "피부": 3,
      "피로": 1
    },
    "dosage_guide": {
      "amount": "8~25mg/일 (원소 아연 기준)",
      "timing": "식후 (공복 시 구역감 가능)",
      "form": "아연 글루코네이트·피콜리네이트·시트레이트 형태 추천"
    },
    "synergy": [],
    "conflict": [
      {
        "id": "iron",
        "note": "철분과 동시 복용 시 상호 흡수 경쟁 — 시간대 분리 권장"
      }
    ],
    "symptom_indicators": [
      "frequent_colds",
      "slow_healing",
      "hair_loss",
      "brittle_nails"
    ]
  },
  {
    "id": "gaba",
    "onset_weeks": "1~2주",
    "name": "GABA (가바)",
    "emoji": "🧘",
    "description": "뇌의 흥분을 억제하는 천연 안정제. 스트레스 완화, 숙면 유도에 도움돼요.",
    "evidence": {
      "mfds_type": "개별인정형 기능성 원료 (인정번호 제2018-4호)",
      "mfds_function": "스트레스 완화, 수면의 질 개선에 도움",
      "study": "Byun JI, et al. (2018). J Clin Neurol, 14(3):291–295",
      "finding": "수면장애 성인 40명 대상 4주 무작위 이중맹검 임상시험. GABA 보충 후 수면 잠복기 5.3분 단축, 수면 효율 유의미하게 개선.",
      "grade": "A"
    },
    "caution": [
      "임산부·수유부 주의",
      "고칼슘혈증 환자 주의"
    ],
    "blocked_conditions": [
      "임산부_수유부"
    ],
    "search_keyword": "가바 GABA 수면",
    "affinity": {
      "수면": 5,
      "스트레스": 4
    },
    "dosage_guide": {
      "amount": "100~300mg/일",
      "timing": "취침 30~60분 전",
      "form": "발효 GABA(PharmaGABA) 추천"
    },
    "synergy": [
      {
        "id": "lemon_balm",
        "note": "레몬밤과 함께 수면 질 개선 효과 강화"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "cant_fall_asleep",
      "wake_night",
      "anxiety",
      "leg_cramps_night"
    ]
  },
  {
    "id": "headache_tree",
    "onset_weeks": "1~2주",
    "name": "헛개나무과병추출물",
    "emoji": "🌳",
    "description": "음주 후 간 보호, 숙취 해소. 식약처 인정 성분으로 간 손상 보호에 탁월해요.",
    "evidence": {
      "mfds_type": "개별인정형 기능성 원료",
      "mfds_function": "음주로 인한 피로 회복에 도움",
      "study": "Song YO, et al. (2011). Food Chem Toxicol, 49(7):1550–1555",
      "finding": "동물 모델 및 세포 실험에서 헛개나무 추출물의 간세포 보호 효과(ALT·AST 감소) 및 항산화 활성 확인.",
      "grade": "B"
    },
    "caution": [],
    "search_keyword": "헛개나무 과병추출물",
    "affinity": {
      "간건강": 3,
      "피로": 1
    },
    "drink_boost": 4,
    "dosage_guide": {
      "amount": "헛개나무과병추출물 900~1,500mg/일",
      "timing": "음주 전후 또는 식후",
      "form": "식약처 인정 기능성 함량 확인"
    },
    "synergy": [
      {
        "id": "milk_thistle",
        "note": "밀크씨슬과 함께 간 보호 이중 작용"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "chronic_fatigue",
      "afternoon_slump"
    ]
  },
  {
    "id": "folic_acid",
    "onset_weeks": "4~8주",
    "name": "엽산",
    "emoji": "🤱",
    "description": "임신 초기 필수 영양소. 태아 신경관 발달에 매우 중요하며 임신 계획 중에도 복용 권장해요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "세포분열, 태아 신경관 발달에 도움",
      "study": "MRC Vitamin Study Research Group. (1991). Lancet, 338(8760):131–137",
      "finding": "신경관 결손 위험 여성 1,817명 대상 무작위 임상시험. 엽산 보충 시 신경관 결손 발생률 72% 감소.",
      "grade": "A"
    },
    "caution": [
      "임신 계획 3개월 전부터 복용 권장"
    ],
    "required_conditions": [
      "임산부_수유부"
    ],
    "search_keyword": "엽산 임산부 영양제",
    "affinity": {
      "면역력": 1,
      "피로": 1
    },
    "dosage_guide": {
      "amount": "400~800mcg/일 (임신 중 600mcg)",
      "timing": "아침 식후 (규칙적 복용 중요)",
      "form": "메틸폴레이트(5-MTHF) 형태 추천 (MTHFR 유전변이 시 더 효과적)"
    },
    "synergy": [
      {
        "id": "vitamin_b",
        "note": "비타민B12와 함께 엽산 대사 최적화"
      }
    ],
    "conflict": [],
    "symptom_indicators": []
  },
  {
    "id": "vitamin_e",
    "onset_weeks": "4~8주",
    "name": "비타민 E",
    "emoji": "🌻",
    "description": "강력한 지용성 항산화제. 세포막 산화 손상을 막고 피부 노화 방지와 면역 기능을 지원해요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "항산화에 도움",
      "study": "Sies H, et al. (2019). Nat Rev Mol Cell Biol, 20:674–688",
      "finding": "비타민E(토코페롤)는 지질 과산화 억제를 통해 세포막 산화 손상을 방지하며, 면역세포 활성 및 항염 기능 지원이 다수 연구에서 확인됨.",
      "grade": "B"
    },
    "caution": [
      "고용량(400 IU 이상) 장기 복용 시 출혈 경향 증가 가능",
      "항응고제 복용 시 의사 상담 필수"
    ],
    "search_keyword": "비타민E 토코페롤",
    "affinity": {
      "피부": 3,
      "면역력": 2,
      "피로": 1
    },
    "dosage_guide": {
      "amount": "천연 비타민E(d-알파-토코페롤) 기준 15mg(22 IU)/일 — 상한선 1,000mg/일",
      "timing": "지방 포함 식사와 함께 (아침 또는 점심 권장)",
      "form": "천연형(d-알파-토코페롤) > 합성형(dl-알파-토코페롤), 혼합 토코페롤 제품 권장"
    },
    "synergy": [
      {
        "id": "omega3",
        "note": "오메가-3 불포화지방산 산화를 억제해 안정성과 효과 향상"
      },
      {
        "id": "vitamin_c",
        "note": "비타민C가 산화된 비타민E를 재생 → 항산화 사이클 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "dry_skin",
      "hair_loss",
      "easy_bruising"
    ]
  },
  {
    "id": "red_ginseng",
    "onset_weeks": "4~8주",
    "name": "홍삼",
    "emoji": "🌿",
    "description": "면역력 향상과 피로 개선의 대표 성분. 스트레스 반응 조절과 활력 회복에 도움을 줍니다.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "면역력 증진, 피로 개선, 항산화에 도움",
      "study": "Kim SH, et al. (2013). J Ginseng Res, 37(1):123–133",
      "finding": "홍삼 추출물 8주 복용 시 NK세포 활성 유의미하게 증가, 피로 지표(VAS) 개선 — 다수 RCT 및 코호트 연구에서 일관된 결과 확인.",
      "grade": "B"
    },
    "caution": [
      "혈압약·항응고제 복용 시 상호작용 가능 — 의사 상담",
      "불면증·두근거림 발생 시 복용 중단"
    ],
    "search_keyword": "홍삼 6년근 홍삼정",
    "affinity": {
      "면역력": 3,
      "피로": 3,
      "스트레스": 2
    },
    "dosage_guide": {
      "amount": "홍삼 진세노사이드 기준 2.4~80mg/일 (제품별 함량 확인)",
      "timing": "아침 식후 (규칙적 복용 중요)",
      "form": "진세노사이드 Rg1·Rb1 함량 명시 제품 선택"
    },
    "synergy": [
      {
        "id": "vitamin_c",
        "note": "비타민C가 홍삼의 항산화 효과를 증폭"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "chronic_fatigue",
      "frequent_colds",
      "brain_fog"
    ]
  },
  {
    "id": "calcium",
    "onset_weeks": "8~12주",
    "name": "칼슘",
    "emoji": "🦴",
    "description": "뼈와 치아의 기본 재료. 근육 수축, 신경 전달, 혈액 응고에도 필수적인 미네랄이에요.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "뼈와 치아 형성에 필요, 신경 및 근육 기능 유지에 필요",
      "study": "Reid IR, et al. (2008). Lancet, 372(9638):543–544",
      "finding": "칼슘 보충제 복용 시 골밀도 유지 및 골절 위험 감소 — 특히 폐경 이후 여성과 50대 이상에서 효과 뚜렷.",
      "grade": "A"
    },
    "caution": [
      "고용량(1,000mg 이상/일) 장기 복용 시 심혈관 위험 논란 있음 — 식이 우선 권고",
      "신장결석 이력 있으면 의사 상담"
    ],
    "search_keyword": "칼슘 마그네슘 비타민D",
    "affinity": {
      "근육관절": 4,
      "피로": 1,
      "갱년기": 2
    },
    "gender_boost": {
      "여성": 4
    },
    "dosage_guide": {
      "amount": "500~1,000mg/일 (원소 칼슘 기준, 1회 500mg 이하로 분할 복용)",
      "timing": "식사와 함께 (지방 있는 식사 시 흡수 최적)",
      "form": "구연산칼슘(Calcium Citrate) 추천 — 공복 흡수 가능, 탄산칼슘보다 부작용 적음"
    },
    "synergy": [
      {
        "id": "vitamin_d",
        "note": "비타민D가 칼슘 흡수율을 최대 40% 향상"
      },
      {
        "id": "magnesium",
        "note": "칼슘·마그네슘 2:1 비율이 근육·신경 균형 유지"
      }
    ],
    "conflict": [
      {
        "id": "iron",
        "note": "칼슘이 철분 흡수를 억제 — 2시간 간격 복용 권장"
      },
      {
        "id": "zinc",
        "note": "고용량 칼슘이 아연 흡수 감소 가능 — 식사 시 분리"
      }
    ],
    "symptom_indicators": [
      "leg_cramps_night",
      "muscle_cramps",
      "joint_stiffness"
    ]
  },
  {
    "id": "lutein",
    "onset_weeks": "4~8주",
    "name": "루테인",
    "emoji": "👁️",
    "description": "눈 황반의 핵심 색소. 청색광 차단, 황반변성 예방, 눈 피로 개선에 도움을 줍니다.",
    "evidence": {
      "mfds_type": "고시형 기능성 원료",
      "mfds_function": "노화로 인한 황반변성 위험 감소에 도움",
      "study": "AREDS2 Research Group. (2013). JAMA, 309(19):2005–2015",
      "finding": "4,203명 대규모 임상시험. 루테인·지아잔틴 보충 시 황반변성 진행 위험 18~25% 감소. 디지털 눈 피로 감소 효과도 다수 연구에서 확인.",
      "grade": "A"
    },
    "caution": [
      "흡연자는 베타카로틴 복합제품 주의 (폐암 위험 연구 있음)"
    ],
    "search_keyword": "루테인 지아잔틴 마리골드",
    "affinity": {
      "피로": 3,
      "피부": 1,
      "눈건강": 5
    },
    "dosage_guide": {
      "amount": "루테인 10~20mg/일 + 지아잔틴 2mg 이상 포함 제품",
      "timing": "지방 포함 식사와 함께 (아침 또는 점심 권장)",
      "form": "마리골드 추출물 형태, 지아잔틴 포함 제품 추천"
    },
    "synergy": [
      {
        "id": "omega3",
        "note": "오메가-3 DHA가 망막 세포막 구성 지원 — 눈 건강 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "eye_fatigue",
      "brain_fog",
      "blurry_vision",
      "dry_eyes",
      "floaters"
    ]
  },
  {
    "id": "chromium",
    "onset_weeks": "4~8주",
    "name": "크롬 (크롬 피콜리네이트)",
    "emoji": "🩸",
    "description": "인슐린 민감성 향상, 혈당 조절 보조. 식약처 인정 기능성 원료.",
    "evidence": {
      "mfds_type": "고시형",
      "mfds_function": "체내 탄수화물·지방·단백질 대사에 필요",
      "study": "Anderson RA, et al. (1997). Diabetes, 46(11):1786-1791",
      "finding": "180명 2형 당뇨 환자 대상 4개월 무작위 임상시험. 크롬 보충 시 HbA1c, 공복혈당 유의미하게 감소.",
      "grade": "A"
    },
    "caution": [
      "당뇨약(메트포르민 등) 복용 시 저혈당 가능 — 의사 상담 필수",
      "신장질환자 주의"
    ],
    "search_keyword": "크롬 피콜리네이트 혈당",
    "affinity": {
      "혈당대사": 5,
      "체중관리": 2,
      "피로": 1
    },
    "dosage_guide": {
      "amount": "200~1,000mcg/일",
      "timing": "식사와 함께",
      "form": "크롬 피콜리네이트 형태 추천"
    },
    "synergy": [
      {
        "id": "magnesium",
        "note": "인슐린 신호 전달 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "sugar_cravings",
      "post_meal_drowsy",
      "thirst_frequent_urination"
    ]
  },
  {
    "id": "banaba_leaf",
    "onset_weeks": "2~4주",
    "name": "바나바잎 추출물",
    "emoji": "🍃",
    "description": "코로솔산 성분이 혈당 흡수 억제. 식약처 개별인정 원료.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "식후 혈당 상승 억제에 도움",
      "study": "Fukushima M, et al. (2006). J Ethnopharmacol, 104(3):326-331",
      "finding": "당뇨 환자 대상 코로솔산 혈당 강하 효과 확인.",
      "grade": "B"
    },
    "caution": [
      "당뇨약 병용 시 저혈당 주의"
    ],
    "search_keyword": "바나바잎 코로솔산 혈당",
    "affinity": {
      "혈당대사": 4,
      "체중관리": 2
    },
    "dosage_guide": {
      "amount": "코로솔산 0.45~0.9mg/일",
      "timing": "식전 30분",
      "form": "바나바잎 추출물"
    },
    "synergy": [
      {
        "id": "chromium",
        "note": "혈당 조절 이중 작용"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "sugar_cravings",
      "post_meal_drowsy"
    ]
  },
  {
    "id": "saw_palmetto",
    "onset_weeks": "4~8주",
    "name": "쏘팔메토",
    "emoji": "🌴",
    "description": "전립선 건강의 대표 성분. 중년 남성 배뇨 기능 개선.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "전립선 건강에 도움",
      "study": "Wilt T, et al. (2000). Cochrane Database Syst Rev",
      "finding": "18개 RCT 메타분석, 배뇨 증상 개선 확인.",
      "grade": "A"
    },
    "caution": [
      "항응고제 복용 시 주의",
      "전립선암 검사(PSA) 수치에 영향 가능 — 검사 전 의사에게 고지"
    ],
    "search_keyword": "쏘팔메토 전립선 영양제",
    "affinity": {
      "갱년기": 3,
      "면역력": 1
    },
    "gender_boost": {
      "남성": 5
    },
    "dosage_guide": {
      "amount": "쏘팔메토 추출물 320mg/일",
      "timing": "식사와 함께",
      "form": "표준화된 추출물"
    },
    "synergy": [],
    "conflict": [],
    "symptom_indicators": []
  },
  {
    "id": "gamma_linolenic",
    "onset_weeks": "4~8주",
    "name": "감마리놀렌산 (GLA)",
    "emoji": "🌻",
    "description": "달맞이꽃종자유의 핵심 성분. 월경 전 불편함 완화, 피부 건강 개선.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "월경 전 변화에 의한 불편함 개선에 도움",
      "study": "Khoo SK, et al. (2008). Complement Ther Med, 16(4):196-203",
      "finding": "PMS 여성 대상 RCT, GLA 복용 후 증상 유의미하게 감소.",
      "grade": "B"
    },
    "caution": [
      "항응고제 복용 시 출혈 위험",
      "간질 약물 병용 주의"
    ],
    "search_keyword": "감마리놀렌산 GLA 달맞이꽃종자유",
    "affinity": {
      "갱년기": 4,
      "피부": 3
    },
    "gender_boost": {
      "여성": 4
    },
    "dosage_guide": {
      "amount": "GLA 180~240mg/일 (달맞이꽃종자유 1,000~2,000mg)",
      "timing": "식사와 함께",
      "form": "달맞이꽃종자유 추출물"
    },
    "synergy": [
      {
        "id": "omega3",
        "note": "항염 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "mood_swings",
      "dry_skin",
      "vaginal_dryness"
    ]
  },
  {
    "id": "msm",
    "onset_weeks": "4~12주",
    "name": "MSM (메틸설포닐메탄)",
    "emoji": "💪",
    "description": "관절 건강과 연골 보호. 식약처 인정 관절 건강 기능성 원료.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "관절 및 연골 건강에 도움",
      "study": "Kim LS, et al. (2006). Osteoarthritis Cartilage, 14(3):286-294",
      "finding": "50명 골관절염 환자 12주 RCT, 관절 통증·기능 유의미하게 개선.",
      "grade": "A"
    },
    "caution": [
      "혈액 희석제 복용 시 주의"
    ],
    "search_keyword": "MSM 메틸설포닐메탄 관절",
    "affinity": {
      "근육관절": 5,
      "피부": 1
    },
    "dosage_guide": {
      "amount": "1,500~3,000mg/일",
      "timing": "식사와 함께 2~3회 분할 복용",
      "form": "순수 MSM 분말 또는 캡슐"
    },
    "synergy": [
      {
        "id": "collagen",
        "note": "관절 건강 시너지"
      },
      {
        "id": "vitamin_c",
        "note": "MSM 흡수 보조"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "joint_stiffness",
      "slow_recovery",
      "muscle_cramps"
    ]
  },
  {
    "id": "garcinia",
    "onset_weeks": "4~8주",
    "name": "가르시니아캄보지아 (HCA)",
    "emoji": "🍋",
    "description": "체지방 감소 도움. 식약처 인정 기능성 원료. 탄수화물→지방 전환 억제.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "체지방 감소에 도움",
      "study": "Onakpoya I, et al. (2011). J Obes, 2011:509038",
      "finding": "12개 RCT 메타분석, 체지방 감소 효과 확인 (단기).",
      "grade": "B"
    },
    "caution": [
      "간독성 보고 사례 있음 — 권장량 초과 금지",
      "당뇨약 병용 시 주의"
    ],
    "search_keyword": "가르시니아 HCA 체지방",
    "affinity": {
      "체중관리": 5,
      "혈당대사": 2
    },
    "dosage_guide": {
      "amount": "HCA 750~1,500mg/일",
      "timing": "식전 30~60분",
      "form": "HCA 50% 이상 함유 제품"
    },
    "synergy": [
      {
        "id": "chromium",
        "note": "혈당·체지방 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "sugar_cravings"
    ]
  },
  {
    "id": "vitamin_k2",
    "onset_weeks": "8~12주",
    "name": "비타민 K2 (MK-7)",
    "emoji": "🦴",
    "description": "칼슘을 뼈로 보내고 혈관 석회화 방지. 비타민D와 필수 파트너.",
    "evidence": {
      "mfds_type": "고시형",
      "mfds_function": "정상적인 혈액 응고, 뼈 건강에 필요",
      "study": "Knapen MH, et al. (2013). Osteoporos Int, 24(9):2499-2507",
      "finding": "폐경 여성 244명 3년 RCT, MK-7 보충 시 골밀도 유지·혈관 탄력 개선.",
      "grade": "A"
    },
    "caution": [
      "와파린 복용 시 절대 금기 — 항응고 효과 상쇄",
      "항응고제 복용자는 반드시 의사 상담"
    ],
    "search_keyword": "비타민K2 MK-7 나토",
    "affinity": {
      "근육관절": 3,
      "심혈관": 3
    },
    "dosage_guide": {
      "amount": "MK-7 100~200mcg/일",
      "timing": "지방 포함 식사와 함께",
      "form": "MK-7 형태 추천"
    },
    "synergy": [
      {
        "id": "vitamin_d",
        "note": "칼슘 대사 최적화 필수 파트너"
      },
      {
        "id": "calcium",
        "note": "칼슘의 올바른 침착 유도"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "joint_stiffness"
    ]
  },
  {
    "id": "selenium",
    "onset_weeks": "4~8주",
    "name": "셀레늄",
    "emoji": "🛡️",
    "description": "강력한 항산화 미네랄. 갑상선 기능, 면역력, 정자 건강에 중요.",
    "evidence": {
      "mfds_type": "고시형",
      "mfds_function": "유해산소로부터 세포 보호에 필요",
      "study": "Rayman MP. (2012). Lancet, 379(9822):1256-1268",
      "finding": "셀레늄 보충이 면역 기능 향상, 갑상선 기능 지원에 유효.",
      "grade": "A"
    },
    "caution": [
      "고용량(400mcg 이상) 독성 주의",
      "브라질넛 과다 섭취 시 과잉 가능"
    ],
    "search_keyword": "셀레늄 셀레노메티오닌",
    "affinity": {
      "면역력": 3,
      "갱년기": 2,
      "피부": 1
    },
    "dosage_guide": {
      "amount": "50~200mcg/일",
      "timing": "식사와 함께",
      "form": "셀레노메티오닌 형태 추천"
    },
    "synergy": [
      {
        "id": "vitamin_e",
        "note": "항산화 시너지"
      },
      {
        "id": "zinc",
        "note": "면역 기능 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "frequent_colds",
      "hair_loss"
    ]
  },
  {
    "id": "red_clover",
    "onset_weeks": "4~12주",
    "name": "레드클로버 (이소플라본)",
    "emoji": "🌺",
    "description": "식물성 에스트로겐. 갱년기 안면홍조, 골밀도 저하 완화.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "갱년기 여성 건강에 도움",
      "study": "Tice JA, et al. (2003). JAMA, 290(2):207-214",
      "finding": "252명 폐경 여성 RCT, 이소플라본 보충 후 안면홍조 빈도 감소.",
      "grade": "B"
    },
    "caution": [
      "유방암·자궁암 병력 시 사용 금지",
      "호르몬 치료 중 의사 상담 필수",
      "임산부·수유부 금기"
    ],
    "search_keyword": "레드클로버 이소플라본 갱년기",
    "affinity": {
      "갱년기": 5,
      "근육관절": 2
    },
    "gender_boost": {
      "여성": 5
    },
    "blocked_conditions": [
      "임산부_수유부"
    ],
    "dosage_guide": {
      "amount": "이소플라본 40~80mg/일",
      "timing": "식사와 함께",
      "form": "레드클로버 추출물"
    },
    "synergy": [
      {
        "id": "calcium",
        "note": "골밀도 유지 시너지"
      },
      {
        "id": "vitamin_d",
        "note": "칼슘 흡수 보조"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "hot_flashes",
      "mood_swings",
      "vaginal_dryness"
    ]
  },
  {
    "id": "coenzyme_pqq",
    "onset_weeks": "4~8주",
    "name": "PQQ (피롤로퀴놀린퀴논)",
    "emoji": "🧠",
    "description": "미토콘드리아 생합성 촉진. 인지 기능 개선, 뇌 건강 지원.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "인지 기능 개선에 도움",
      "study": "Itoh Y, et al. (2016). Funct Foods Health Dis, 6(7):416-427",
      "finding": "건강한 중년 성인 41명 12주 RCT, PQQ 보충 후 기억력·주의력 유의미하게 개선.",
      "grade": "B"
    },
    "caution": [
      "고용량(40mg 이상) 장기 복용 안전성 미확립"
    ],
    "search_keyword": "PQQ 피롤로퀴놀린 인지기능",
    "affinity": {
      "인지기능": 5,
      "피로": 2
    },
    "dosage_guide": {
      "amount": "10~20mg/일",
      "timing": "식사와 함께",
      "form": "순수 PQQ"
    },
    "synergy": [
      {
        "id": "coq10",
        "note": "미토콘드리아 기능 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "brain_fog"
    ]
  },
  {
    "id": "phosphatidylserine",
    "onset_weeks": "4~12주",
    "name": "포스파티딜세린",
    "emoji": "🧠",
    "description": "뇌세포막의 핵심 인지질. 기억력 개선, 인지 기능 유지에 도움.",
    "evidence": {
      "mfds_type": "개별인정형",
      "mfds_function": "인지력 개선에 도움",
      "study": "Kato-Kataoka A, et al. (2010). J Clin Biochem Nutr, 47(3):246-255",
      "finding": "건강한 노인 78명 6개월 RCT, 포스파티딜세린 보충 후 기억력 유의미하게 개선.",
      "grade": "A"
    },
    "caution": [
      "항응고제 병용 주의",
      "대두 알레르기 주의 (대두 유래 제품)"
    ],
    "search_keyword": "포스파티딜세린 PS 기억력",
    "affinity": {
      "인지기능": 5,
      "스트레스": 2
    },
    "dosage_guide": {
      "amount": "100~300mg/일",
      "timing": "식사와 함께",
      "form": "분리된 포스파티딜세린"
    },
    "synergy": [
      {
        "id": "omega3",
        "note": "DHA가 뇌세포막 구성 시너지"
      }
    ],
    "conflict": [],
    "symptom_indicators": [
      "brain_fog",
      "anxiety"
    ]
  }
];

// ── 15개 페르소나 ──────────────────────────────────────────────────────
export const PERSONAS: PersonaData[] = [
  {
    "id": "pregnant",
    "name": "예비 맘 / 수유 중",
    "tagline": "둘을 위해 먹는 지금, 영양이 두 배로 중요한 시기예요",
    "max_recommendations": 3,
    "category_boosts": {},
    "emoji": "🤱",
    "description": "이 시기는 나와 아기 모두를 위한 특별한 영양 관리가 필요해요. 전문의와 꼭 상담하세요.",
    "color": "#e17055",
    "avoidances": [
      {
        "item": "비타민 A 과다 복용 (하루 10,000 IU 이상)",
        "reason": "태아 기형 유발 가능 — 임신 중 레티놀 형태 보충제는 엄격히 제한",
        "evidence": "WHO Vitamin A Supplementation Guidelines"
      },
      {
        "item": "카페인 200mg 초과 (아메리카노 약 2잔 이상)",
        "reason": "유산 및 저체중아 출산 위험 증가 — 200mg 이하 유지 권장",
        "evidence": "ACOG Committee Opinion No.462, 2010"
      },
      {
        "item": "날생선·덜 익힌 육류 (초밥, 생고기 등)",
        "reason": "리스테리아균·살모넬라균 감염 시 태아에 치명적 영향 가능",
        "evidence": "CDC Food Safety for Pregnant Women, 2023"
      },
      {
        "item": "감초 성분 함유 한방 보충제",
        "reason": "글리시리진 과다 섭취 시 조산 위험 연관 보고",
        "evidence": "Strandberg et al., Am J Epidemiol, 2002"
      }
    ]
  },
  {
    "id": "dine_out_drinker",
    "name": "즉흥 외식형",
    "tagline": "간이 오늘도 야근 중인데 퇴근 시간이 없어요",
    "max_recommendations": 4,
    "category_boosts": {
      "간건강": 4
    },
    "emoji": "🍻",
    "description": "사람 만나고 먹고 마시는 걸 즐기는 분이시군요. 간과 장이 특히 관리가 필요해요.",
    "color": "#fdcb6e",
    "avoidances": [
      {
        "item": "아세트아미노펜(타이레놀) + 음주 병용",
        "reason": "간독성 시너지 — 음주 후 타이레놀 복용은 간 손상 위험 최대 10배 증가",
        "evidence": "Watkins et al., JAMA, 2006"
      },
      {
        "item": "고과당 음료 (액상과당 함유 탄산음료, 과일주스)",
        "reason": "과당은 간에서만 대사 → 지방간(NAFLD) 직결, 알코올 없이도 지방간 유발",
        "evidence": "Lim et al., J Hepatol, 2010"
      },
      {
        "item": "가공육·고지방 안주 반복 섭취 (삼겹살, 소시지 등)",
        "reason": "간 지방 축적 + 만성 저등급 염증 유발, 음주와 시너지로 간 손상 가속",
        "evidence": "Promrat et al., Hepatology, 2010"
      }
    ]
  },
  {
    "id": "burnout",
    "name": "번아웃 직장인",
    "tagline": "배터리가 늘 5% 이하인 분, 충전이 아니라 패턴 교체가 필요해요",
    "max_recommendations": 5,
    "category_boosts": {
      "피로": 3,
      "스트레스": 2
    },
    "emoji": "😮‍💨",
    "description": "열심히 달려왔더니 몸이 먼저 지쳤네요. 에너지 탱크가 바닥 신호를 보내고 있어요.",
    "color": "#d63031",
    "avoidances": [
      {
        "item": "카페인 과다 (하루 400mg 이상 / 커피 4잔 이상)",
        "reason": "일시적 각성 후 더 깊은 피로 유발, 코르티솔 과분비로 부신 피로 악화",
        "evidence": "Lovallo et al., Psychosom Med, 2005"
      },
      {
        "item": "단순당·정제 탄수화물 (과자, 흰빵, 탄산음료)",
        "reason": "혈당 스파이크 → 인슐린 급상승 → 급격한 에너지 저하 (혈당 롤러코스터)",
        "evidence": "Jenkins et al., Am J Clin Nutr, 2002"
      },
      {
        "item": "알코올 (피로 해소 목적의 저녁 음주)",
        "reason": "미토콘드리아 ATP 생성 저해 + REM 수면 억제 → 다음 날 더 심한 피로",
        "evidence": "Thakkar et al., Alcohol, 2015"
      }
    ]
  },
  {
    "id": "poor_sleeper",
    "name": "수면 부족형",
    "tagline": "눈은 감는데 뇌가 퇴근을 못 하고 있어요",
    "max_recommendations": 3,
    "category_boosts": {
      "수면": 4
    },
    "emoji": "😴",
    "description": "잠자리에 누워도 뒤척이는 밤이 많죠. 제대로 된 수면 하나가 삶의 질을 통째로 바꿔요.",
    "color": "#6c5ce7",
    "avoidances": [
      {
        "item": "카페인 오후 2시 이후 섭취",
        "reason": "카페인 반감기 5~7시간 — 오후 2시 커피가 자정까지 수면 방해, 수면 효율 20% 저하",
        "evidence": "Drake et al., J Clin Sleep Med, 2013"
      },
      {
        "item": "알코올 (수면 유도 목적)",
        "reason": "초반 졸음 유발하지만 REM 수면 강력 억제 → 수면 구조 파괴, 새벽 각성 증가",
        "evidence": "Ebrahim et al., Alcohol Clin Exp Res, 2013"
      },
      {
        "item": "취침 전 스마트폰·모니터 블루라이트",
        "reason": "멜라토닌 분비 최대 50% 억제 — 생체시계를 1~3시간 후퇴시킴",
        "evidence": "Chang et al., PNAS, 2015"
      },
      {
        "item": "취침 3시간 내 격렬한 유산소 운동",
        "reason": "체온 상승·교감신경 자극 → 수면 잠복기 연장, 심부 체온 하강 필요",
        "evidence": "Stutz et al., Sports Med, 2019"
      }
    ]
  },
  {
    "id": "fitness_lover",
    "name": "근력 마니아",
    "tagline": "운동은 열심히 하는데, 회복이 빠지면 절반의 효과예요",
    "max_recommendations": 4,
    "category_boosts": {
      "근육관절": 4
    },
    "emoji": "💪",
    "description": "운동은 열심히 하는데, 회복과 영양 보충이 따라줘야 실력이 더 올라요.",
    "color": "#00b894",
    "avoidances": [
      {
        "item": "운동 직전 고용량 항산화제 (비타민C·E 1g 이상)",
        "reason": "운동 적응 신호(활성산소)를 차단 → 근력·지구력 향상 효과 오히려 감소",
        "evidence": "Ristow et al., PNAS, 2009"
      },
      {
        "item": "이부프로펜·NSAIDs 상시 복용",
        "reason": "근단백질 합성 mTOR 경로 억제 → 운동 후 근육 회복 및 성장 방해",
        "evidence": "Trappe et al., Acta Physiol Scand, 2001"
      },
      {
        "item": "운동 후 알코올 섭취 (회식)",
        "reason": "근단백질 합성 최대 37% 감소, 테스토스테론 일시 저하 — 효과 48시간 지속",
        "evidence": "Parr et al., PLOS ONE, 2014"
      }
    ]
  },
  {
    "id": "dieter",
    "name": "다이어터",
    "tagline": "의지력 문제가 아니라 영양 전략이 필요한 거예요",
    "max_recommendations": 3,
    "category_boosts": {
      "장건강": 2,
      "피로": 1
    },
    "emoji": "⚖️",
    "description": "체중 관리를 위해 노력 중이시군요. 균형 잡힌 영양 보충이 다이어트 성공의 열쇠예요.",
    "color": "#0984e3",
    "avoidances": [
      {
        "item": "인공감미료 (아스파탐, 수크랄로스, 사카린)",
        "reason": "장내 미생물 불균형 유발 → 혈당 조절 악화, 오히려 체중 증가 촉진 가능",
        "evidence": "Suez et al., Nature, 2022"
      },
      {
        "item": "무지방·저칼로리 가공식품",
        "reason": "지방 빠진 자리에 당·전분 첨가 → 포만감 저하, 혈당 더 불안정",
        "evidence": "Ludwig et al., JAMA, 2018"
      },
      {
        "item": "탄수화물 극단적 제한 (하루 50g 미만)",
        "reason": "코르티솔 상승 → 근육 분해 가속 + 갑상선 기능 저하 가능 → 기초대사량 감소",
        "evidence": "Serog et al., Int J Obes, 1982"
      }
    ]
  },
  {
    "id": "low_willpower",
    "name": "불규칙 생활형",
    "tagline": "패턴이 나쁜 거지, 의지력 탓이 아니에요. 시스템을 바꿔봐요",
    "max_recommendations": 3,
    "category_boosts": {
      "장건강": 3,
      "피로": 2
    },
    "emoji": "🛋️",
    "description": "의지력 문제가 아니에요. 불규칙한 패턴 자체가 영양 불균형을 만들고 있어요. 시스템을 바꿔봐요.",
    "color": "#b2bec3",
    "avoidances": [
      {
        "item": "식사 거르기 + 무계획 간헐적 단식",
        "reason": "공복 호르몬 그렐린 급상승 → 과식·폭식 유발, 기초대사율 저하 악순환",
        "evidence": "Chapelot et al., J Nutr, 2011"
      },
      {
        "item": "초가공식품 위주 식사 (과자, 편의점 음식 반복)",
        "reason": "도파민 보상 회로 과자극 → 일반 음식에 대한 식욕 조절 점점 어려워짐",
        "evidence": "Schulte et al., PLOS ONE, 2015"
      },
      {
        "item": "정제 탄수화물 위주 식사",
        "reason": "혈당 불안정 → 더 강한 식탐 유발 반복 사이클, 피로·집중력 저하 악화",
        "evidence": "Lennerz et al., Am J Clin Nutr, 2013"
      }
    ]
  },
  {
    "id": "immunity_worrier",
    "name": "면역력 걱정형",
    "tagline": "조금만 무리해도 먼저 아픈 분, 면역 시스템이 SOS를 보내고 있어요",
    "max_recommendations": 4,
    "category_boosts": {
      "면역력": 4
    },
    "emoji": "🛡️",
    "description": "조금만 피곤하면 금방 아프는 것 같죠? 지금이 면역 시스템을 탄탄히 할 시간이에요.",
    "color": "#a29bfe",
    "avoidances": [
      {
        "item": "정제당 과다 섭취 (설탕, 시럽류)",
        "reason": "혈당 상승 후 2시간 동안 백혈구(호중구) 탐식 능력 최대 40% 저하",
        "evidence": "Sanchez et al., Am J Clin Nutr, 1973"
      },
      {
        "item": "수면 6시간 미만 지속",
        "reason": "NK세포(자연살해세포) 활성 저하, 감기 감수성 4배 증가 — 영양제로 대체 불가",
        "evidence": "Prather et al., Sleep, 2015"
      },
      {
        "item": "알코올 과다 섭취",
        "reason": "T세포·B세포 기능 저하 + 장 점막 면역 약화 → 바이러스 방어력 감소",
        "evidence": "Sarkar et al., Alcohol Res, 2015"
      },
      {
        "item": "초가공식품 위주 식사",
        "reason": "장내 미생물 다양성 감소 → 전신 면역력 약화 (장-면역 축 교란)",
        "evidence": "Zinöcker & Lindseth, Front Nutr, 2018"
      }
    ]
  },
  {
    "id": "skin_influencer",
    "name": "피부 관리형",
    "tagline": "SNS에 올리는 그 피부, 안에서부터 채워야 진짜예요",
    "max_recommendations": 3,
    "category_boosts": {
      "피부": 4
    },
    "emoji": "📱",
    "description": "보여지는 것도 중요하지만, 진짜 건강이 피부와 몸매로 드러나요. 안에서부터 채워드릴게요.",
    "color": "#fd79a8",
    "avoidances": [
      {
        "item": "고당분 식품 (케이크, 탄산음료, 정제 탄수화물)",
        "reason": "최종당화산물(AGEs) 형성 → 콜라겐 교차결합 손상 → 피부 탄력 저하·노화 가속",
        "evidence": "Danby, Clin Dermatol, 2010"
      },
      {
        "item": "트랜스지방 (일부 마가린, 패스트푸드 튀김류)",
        "reason": "피부 장벽 지질층 손상 + 전신 염증 촉진 → 피부 트러블·건조 악화",
        "evidence": "Calder, Am J Clin Nutr, 2006"
      },
      {
        "item": "알코올 (특히 과음)",
        "reason": "피부 탈수 + 비타민B군 결핍 + 모세혈관 확장 → 칙칙하고 붉어지는 피부",
        "evidence": "NHANES Data, J Am Acad Dermatol, 2019"
      },
      {
        "item": "유제품·유청단백질 과다 (여드름성 피부)",
        "reason": "IGF-1 자극 → 피지선 과활성 → 여드름성 피부에 악영향 (체질별 차이 있음)",
        "evidence": "Adebamowo et al., JAAD, 2018"
      }
    ]
  },
  {
    "id": "gut_health_sensitive",
    "name": "예민한 장 타입",
    "tagline": "장이 예민하면 몸 전체가 흔들려요. 장부터 잡아드릴게요",
    "max_recommendations": 4,
    "category_boosts": {
      "장건강": 3,
      "면역력": 2
    },
    "emoji": "🫙",
    "description": "소화기관이 예민하거나 장 건강이 주요 관심사인 분이에요. 장 건강이 면역력의 70%를 좌우합니다.",
    "color": "#00b894",
    "avoidances": [
      {
        "item": "고용량 철분 보충제 단독 복용",
        "reason": "장 점막 자극 → 변비·소화 불편 악화, 비타민C와 함께 소량씩 복용 권장",
        "evidence": "Tolkien et al., PLOS ONE, 2015"
      },
      {
        "item": "과도한 항생제 복용 (처방 외)",
        "reason": "장내 유익균 대량 사멸 → 장 투과성 증가(Leaky Gut) 위험",
        "evidence": "Palleja et al., Nat Microbiol, 2018"
      },
      {
        "item": "고지방·저섬유 식단 지속",
        "reason": "장내 미생물 다양성 감소 → 짧은사슬지방산 생성 저하 → 장 염증 악화",
        "evidence": "Sonnenburg et al., Nature, 2016"
      }
    ]
  },
  {
    "id": "senior_wellness",
    "name": "시니어 건강형",
    "tagline": "지금 채우는 영양이 10년 후 활동성을 결정해요",
    "max_recommendations": 5,
    "category_boosts": {
      "근육관절": 2,
      "피로": 2,
      "면역력": 2
    },
    "emoji": "🌳",
    "description": "50대 이후의 몸은 더 세심한 관리가 필요해요. 지금 챙기는 게 10년 후 건강을 결정해요.",
    "color": "#00cec9",
    "avoidances": [
      {
        "item": "고용량 레티놀(비타민A) 보충제",
        "reason": "50대 이상에서 골밀도 감소·골절 위험 증가 — 베타카로틴 형태는 비교적 안전",
        "evidence": "Melhus et al., Ann Intern Med, 1998"
      },
      {
        "item": "그레이프프루트 (음료·주스 포함)",
        "reason": "CYP450 효소 억제 → 50대 이상이 복용하는 혈압약·콜레스테롤약 등 수십 종 약물 농도 2~5배 변화",
        "evidence": "Bailey et al., CMAJ, 2013"
      },
      {
        "item": "과도한 나트륨 섭취 (염분 하루 2g 초과)",
        "reason": "혈압 상승 + 칼슘 소변 배출 증가 → 골밀도 저하 가속 (골다공증 위험)",
        "evidence": "Devine et al., Am J Clin Nutr, 1995"
      },
      {
        "item": "음주 (근육 유지 관점)",
        "reason": "근감소증(사코페니아) 가속 + 낙상 위험 증가 + 인지 기능 저하와 연관",
        "evidence": "Molina et al., Alcohol Clin Exp Res, 2014"
      }
    ]
  },
  {
    "id": "general_wellness",
    "name": "전반적 건강 관리형",
    "tagline": "지금 당장 큰 문제는 없지만, 예방이 최고의 치료예요",
    "max_recommendations": 2,
    "category_boosts": {},
    "emoji": "🌱",
    "description": "크게 아픈 곳은 없지만, 건강을 미리미리 챙기는 현명한 분이시네요.",
    "color": "#636e72",
    "avoidances": [
      {
        "item": "초가공식품 위주 식사 (가공육, 인스턴트, 패스트푸드)",
        "reason": "만성 저등급 염증 유발 → 장기적으로 심혈관질환·당뇨·암 위험 증가",
        "evidence": "Monteiro et al., Public Health Nutr, 2018"
      },
      {
        "item": "하루 수면 7시간 미만 지속",
        "reason": "심혈관질환·당뇨·비만·면역 저하 위험 모두 증가 — 영양제로 대체 불가능",
        "evidence": "Walker, Why We Sleep / Nat Rev Neurosci, 다수"
      },
      {
        "item": "장시간 앉아있기 (하루 8시간 이상)",
        "reason": "운동 여부와 무관한 독립적 대사 이상 위험인자 — 매시간 5분 움직임 권장",
        "evidence": "Biswas et al., Ann Intern Med, 2015"
      }
    ]
  },
  {
    "id": "menopause_woman",
    "name": "갱년기 여성",
    "tagline": "호르몬이 변하는 시기, 몸이 보내는 신호에 맞춰 채워드릴게요",
    "max_recommendations": 4,
    "category_boosts": {
      "갱년기": 4,
      "근육관절": 2
    },
    "emoji": "🌸",
    "description": "호르몬 변화로 인한 불편함을 겪고 계신가요? 이 시기는 특별한 영양 전략이 필요합니다.",
    "color": "#fd79a8",
    "avoidances": [
      {
        "item": "고용량 비타민 A (레티놀 형태, 하루 10,000 IU 이상)",
        "reason": "골밀도 감소 가속화 — 갱년기에 골다공증 위험이 높으므로 주의",
        "evidence": "Penniston & Tanumihardjo, Nutr Rev, 2006"
      },
      {
        "item": "카페인 과다 (하루 400mg 이상 / 커피 4잔)",
        "reason": "안면홍조 빈도 증가, 수면 방해, 칼슘 배출 촉진",
        "evidence": "Sagari et al., Menopause Rev, 2015"
      },
      {
        "item": "매운 음식·알코올 (특히 열감 민감할 때)",
        "reason": "안면홍조 증상 유발·악화 가능",
        "evidence": "Menopause symptom management data, 2018"
      }
    ]
  },
  {
    "id": "blood_sugar_manager",
    "name": "혈당 관리형",
    "tagline": "혈당 스파이크를 잡으면 에너지와 체중이 동시에 안정돼요",
    "max_recommendations": 4,
    "category_boosts": {
      "혈당대사": 4,
      "체중관리": 2
    },
    "emoji": "🩸",
    "description": "혈당 불안정으로 에너지 기복이 크신가요? 혈당을 안정화하면 피로도 줄어듭니다.",
    "color": "#d63031",
    "avoidances": [
      {
        "item": "정제 탄수화물 (흰쌀밥, 식빵, 파스타)",
        "reason": "혈당 스파이크 직결 → 인슐린 급상승 → 급격한 저혈당 → 피로·식탐",
        "evidence": "Jenkins et al., Am J Clin Nutr, 2002"
      },
      {
        "item": "고과당 음료·과자 (탄산음료, 과자, 초콜릿)",
        "reason": "단순당 섭취 → 혈당 롤러코스터 → 대사 스트레스",
        "evidence": "Lim et al., J Hepatol, 2010"
      },
      {
        "item": "장시간 공복",
        "reason": "저혈당 → 코르티솔 과분비 → 근력 분해·체지방 축적·피로",
        "evidence": "Chapelot et al., J Nutr, 2011"
      }
    ]
  },
  {
    "id": "middle_aged_man",
    "name": "중년 남성 건강형",
    "tagline": "지금이 남성 건강의 전환점, 전립선부터 심혈관까지 챙길 타이밍이에요",
    "max_recommendations": 4,
    "category_boosts": {
      "심혈관": 3,
      "갱년기": 2
    },
    "emoji": "💼",
    "description": "40대 이후로는 심혈관과 전립선 건강이 중요해집니다. 적극적인 영양 관리의 시작점이에요.",
    "color": "#0984e3",
    "avoidances": [
      {
        "item": "과음 (주 3회 이상 음주)",
        "reason": "간 손상 + 테스토스테론 저하 + 전립선 염증 증가",
        "evidence": "Sarkar et al., Alcohol Res, 2015"
      },
      {
        "item": "고지방·고염분 식단 (특히 가공육·패스트푸드)",
        "reason": "혈압 상승·혈관 경화·전립선 염증 촉진",
        "evidence": "De Stefani et al., Nutr Cancer, 2000"
      },
      {
        "item": "과도한 스트레스 + 불충분한 수면",
        "reason": "코르티솔 과분비 → 테스토스테론 저하 → 성기능 저하·피로·비만 악화",
        "evidence": "Lovallo et al., Psychosom Med, 2005"
      }
    ]
  }
];

// ── 음식 회피 데이터 ───────────────────────────────────────────────────────
export const SUPPLEMENT_FOOD_AVOID: Record<string, Array<any>> = {
  "vitamin_b": [
    {
      "item": "알코올",
      "reason": "비타민 B1·B6·B12 흡수 방해 및 소변 배출 촉진 → 장기 음주 시 B군 결핍의 주원인",
      "evidence": "Thomson, Am J Clin Nutr, 2000"
    },
    {
      "item": "항경련제 (페니토인, 카르바마제핀)",
      "reason": "B군 대사 효소 방해 → B6·B12 수치 저하, 복용 중이면 의사 상담 필수",
      "evidence": "Rivey et al., Drug Intell Clin Pharm, 1984"
    }
  ],
  "magnesium": [
    {
      "item": "알코올",
      "reason": "신장에서 마그네슘 배출 증가 → 음주자의 마그네슘 결핍 위험 2~3배 높음",
      "evidence": "Elisaf et al., Magnes Res, 1995"
    },
    {
      "item": "고용량 칼슘 보충제 동시 복용",
      "reason": "장에서 흡수 경쟁 → 두 영양소 모두 흡수 감소, 2시간 간격 복용 권장",
      "evidence": "Andon et al., J Am Coll Nutr, 1996"
    }
  ],
  "omega3": [
    {
      "item": "와파린·아스피린 등 항응고제 병용",
      "reason": "출혈 위험 증가 가능 — 심혈관 질환자·수술 예정자는 반드시 의사 상담",
      "evidence": "Buckley et al., Ann Pharmacother, 2004"
    },
    {
      "item": "산화된 생선·오래된 오메가-3 보충제",
      "reason": "산화지방(과산화지질) 섭취 시 오히려 산화스트레스 증가 → 보관 주의, 유통기한 확인 필수",
      "evidence": "Albert et al., J Nutr Biochem, 2013"
    }
  ],
  "vitamin_d": [
    {
      "item": "고용량 비타민 A 보충제 (레티놀 형태) 병용",
      "reason": "비타민D 수용체 경쟁 → 상호 효과 감소 가능, 각각 적정량 이하 유지 권장",
      "evidence": "Cannell et al., Prog Biophys Mol Biol, 2008"
    },
    {
      "item": "마그네슘 심각한 결핍 상태",
      "reason": "비타민D 활성화 효소에 마그네슘 필수 → 마그네슘 부족 시 비타민D 보충 효과 반감",
      "evidence": "Uwitonze & Razzaque, J Am Osteopath, 2018"
    }
  ],
  "probiotics": [
    {
      "item": "항생제와 동시 복용",
      "reason": "항생제가 유산균 직접 사멸 → 항생제 복용 후 2시간 뒤에 섭취 권장",
      "evidence": "Swidsinski et al., Gut, 2009"
    },
    {
      "item": "뜨거운 음료와 함께 복용 (50°C 이상)",
      "reason": "열에 약한 유산균이 사멸 → 미지근하거나 차가운 물·음료와 함께 섭취",
      "evidence": "Gardiner et al., J Appl Microbiol, 2000"
    }
  ],
  "milk_thistle": [
    {
      "item": "지속적 과음",
      "reason": "밀크씨슬이 간 손상을 완화하지만 알코올 재손상이 반복되면 효과 한계 — 근본 원인 해결 필요",
      "evidence": "Saller et al., Drugs, 2008"
    },
    {
      "item": "에스트로겐 관련 호르몬 약물 병용",
      "reason": "실리마린의 에스트로겐 유사 작용 → 에스트로겐 수용체 민감 환자는 주의",
      "evidence": "Greenlee et al., Integr Cancer Ther, 2007"
    }
  ],
  "vitamin_c": [
    {
      "item": "고용량(하루 2,000mg 이상) 장기 복용 + 신장결석 병력",
      "reason": "옥살산칼슘 결석 위험 증가 — 결석 병력 있으면 500mg 이하 유지 권장",
      "evidence": "Taylor et al., J Am Soc Nephrol, 2004"
    },
    {
      "item": "과다한 철분 보충과 동시 고용량 복용 (철 과부하 환자)",
      "reason": "비타민C가 철분 흡수를 크게 높여 혈색소증(철 과부하) 환자에서 위험",
      "evidence": "Hallberg et al., Am J Clin Nutr, 1987"
    }
  ],
  "lemon_balm": [
    {
      "item": "갑상선 약물 (레보티록신 등)",
      "reason": "레몬밤이 갑상선 자극 호르몬 결합 억제 가능 → 갑상선 환자는 반드시 의사 상담",
      "evidence": "Auf'mkolk et al., Endocrinology, 1984"
    },
    {
      "item": "수면제·항불안제 (벤조디아제핀 계열) 병용",
      "reason": "진정 효과 중첩 → 과도한 졸음·반응 저하 위험, 병용 시 용량 조절 필요",
      "evidence": "Kennedy et al., Phytomedicine, 2004"
    }
  ],
  "collagen": [
    {
      "item": "고당분 식품 (케이크, 탄산음료, 흰쌀 과다)",
      "reason": "최종당화산물(AGEs) 형성 → 섭취한 콜라겐도 함께 분해 가속 → 효과 상쇄",
      "evidence": "Danby, Clin Dermatol, 2010"
    },
    {
      "item": "흡연",
      "reason": "활성산소 급증 + 비타민C 파괴 → 콜라겐 합성 효소 억제, 피부 노화 2~5배 가속",
      "evidence": "Schectman et al., Am J Clin Nutr, 1991"
    }
  ],
  "coq10": [
    {
      "item": "와파린 (항응고제)",
      "reason": "CoQ10이 와파린 항응고 효과 감소시킬 수 있음 → 병용 시 INR 모니터링 필요",
      "evidence": "Combs, J Am Coll Nutr, 1994"
    },
    {
      "item": "스타틴 계열 콜레스테롤약 (리피토, 크레스토 등)",
      "reason": "스타틴이 CoQ10 체내 합성을 저해 → 오히려 CoQ10 보충이 더 필요한 상황, 의사 상담 권장",
      "evidence": "Littarru & Tiano, Biofactors, 2010"
    }
  ],
  "iron": [
    {
      "item": "커피·홍차·녹차 (탄닌 성분)",
      "reason": "탄닌이 철분과 결합하여 흡수 최대 50~60% 저해 → 철분 복용 전후 1시간은 피할 것",
      "evidence": "Hallberg & Rossander, Hum Nutr, 1982"
    },
    {
      "item": "칼슘 보충제·유제품과 동시 복용",
      "reason": "칼슘이 철분 흡수 수송체 경쟁 → 두 영양소 분리 복용(2시간 간격) 권장",
      "evidence": "Hallberg et al., Am J Clin Nutr, 1991"
    }
  ],
  "zinc": [
    {
      "item": "고함량 철분 보충제 동시 복용",
      "reason": "철분과 아연이 동일 흡수 경로 경쟁 → 비율 2:1 이상이면 아연 흡수 급감",
      "evidence": "Sandström, J Trace Elem Med Biol, 2001"
    },
    {
      "item": "하루 40mg 이상 장기 과잉 복용",
      "reason": "구리 결핍 유발 → 빈혈·신경 손상 가능, 상한 섭취량 준수 필수",
      "evidence": "Nations et al., Neurology, 2008"
    }
  ],
  "gaba": [
    {
      "item": "알코올 병용",
      "reason": "GABA 수용체 과자극 → 내성 발생 가능, 알코올 섭취 시 GABA 보충 효과도 감소",
      "evidence": "Mehta & Bhatt, Pharmacol Rev, 1999"
    },
    {
      "item": "수면제·항불안제 (벤조디아제핀) 병용",
      "reason": "진정 효과 과도하게 중첩될 수 있음 → 병용 전 반드시 의사 상담",
      "evidence": "Gottesmann, Neurosci Biobehav Rev, 2002"
    }
  ],
  "headache_tree": [
    {
      "item": "지속적 과음",
      "reason": "헛개나무가 간 보호 효과를 부분적으로 제공하지만, 알코올 손상이 지속되면 효과 한계 — 음주량 자체를 줄이는 것이 핵심",
      "evidence": "Song et al., Food Chem Toxicol, 2011"
    },
    {
      "item": "아세트아미노펜 + 음주 병용",
      "reason": "타이레놀+알코올은 간독성 극대화 → 헛개나무로 상쇄 불가, 병용 자체를 피해야 함",
      "evidence": "Watkins et al., JAMA, 2006"
    }
  ],
  "folic_acid": [
    {
      "item": "메토트렉세이트 (류마티스·항암 약물)",
      "reason": "엽산 길항제 약물 — 복용 중이면 엽산 보충 여부·용량을 반드시 의사와 결정",
      "evidence": "Morgan et al., Arthritis Rheum, 1994"
    },
    {
      "item": "하루 1mg 이상 단독 고용량 복용",
      "reason": "비타민B12 결핍을 마스킹 → 신경 손상 진행 중 발견 지연 위험",
      "evidence": "Morris et al., J Nutr, 2007"
    }
  ],
  "vitamin_e": [
    {
      "item": "항응고제 (와파린, 아스피린 고용량)",
      "reason": "비타민E 400IU 이상 시 혈소판 응집 억제 효과 중첩 → 출혈 위험 증가",
      "evidence": "Booth et al., Nutr Rev, 1999"
    },
    {
      "item": "고용량 오메가-3 동시 복용",
      "reason": "항혈전 효과 중첩 가능 — 각 권장량 내 복용 시 문제없음",
      "evidence": "Harris et al., Am J Clin Nutr, 2007"
    }
  ],
  "red_ginseng": [
    {
      "item": "혈압강하제 (ACE억제제, 칼슘채널차단제)",
      "reason": "홍삼의 혈관 확장 효과가 중첩 → 저혈압 위험. 복용 중이면 반드시 의사 상담",
      "evidence": "Janetzky & Morreale, Am J Health Syst Pharm, 1997"
    },
    {
      "item": "카페인 과다 (커피 4잔 이상)",
      "reason": "홍삼+카페인 동시 자극 → 심박수 증가·불안감 악화 가능",
      "evidence": "Kim et al., Food Chem Toxicol, 2012"
    }
  ],
  "calcium": [
    {
      "item": "철분제 동시 복용",
      "reason": "칼슘이 비헴철 흡수를 최대 60% 억제 → 반드시 2시간 간격 복용",
      "evidence": "Hallberg et al., Eur J Clin Nutr, 1991"
    },
    {
      "item": "시금치·수산 함유 식품 (과다)",
      "reason": "옥살산이 칼슘과 결합 → 칼슘 흡수 방해 및 신장결석 위험 증가",
      "evidence": "Holmes et al., J Am Soc Nephrol, 2001"
    }
  ],
  "lutein": [
    {
      "item": "베타카로틴 고용량 보충제 (흡연자)",
      "reason": "흡연자에서 폐암 위험 증가 연관 — 루테인 단독 제품 선택 권장",
      "evidence": "ATBC Study Group, NEJM, 1994"
    }
  ],
  "chromium": [
    {
      "item": "알코올 과다",
      "reason": "크롬 배출 증가 → 혈당 조절 효과 감소",
      "evidence": "Anderson et al., Diabetes, 1997"
    },
    {
      "item": "고용량 비타민C 동시 복용",
      "reason": "크롬 흡수 경쟁 가능",
      "evidence": "Chromium supplementation data, 2015"
    }
  ],
  "banaba_leaf": [
    {
      "item": "당뇨약 병용",
      "reason": "저혈당 위험 증가 — 모니터링 필수",
      "evidence": "Fukushima et al., J Ethnopharmacol, 2006"
    }
  ],
  "saw_palmetto": [
    {
      "item": "항응고제 병용",
      "reason": "출혈 위험 증가",
      "evidence": "Gerber et al., J Urol, 2001"
    },
    {
      "item": "호르몬 치료제",
      "reason": "효과 간섭 가능",
      "evidence": "Saw palmetto review, 2000"
    }
  ],
  "gamma_linolenic": [
    {
      "item": "항응고제·NSAIDs 병용",
      "reason": "출혈 경향 증가",
      "evidence": "Zurier & Rossetti, Am J Clin Nutr, 2012"
    }
  ],
  "msm": [
    {
      "item": "항응고제 병용",
      "reason": "혈액 희석 효과 중첩 가능",
      "evidence": "MSM safety data, 2008"
    }
  ],
  "garcinia": [
    {
      "item": "스타틴 계열 약물",
      "reason": "간 부담 증가 가능",
      "evidence": "Garcinia safety review, 2011"
    },
    {
      "item": "당뇨약 병용",
      "reason": "저혈당 위험",
      "evidence": "Onakpoya et al., J Obes, 2011"
    }
  ],
  "vitamin_k2": [
    {
      "item": "와파린 절대 금기",
      "reason": "항응고 효과 상쇄 — 치명적 위험",
      "evidence": "FDA warning, Warfarin interaction, 2015"
    },
    {
      "item": "항응고제 병용",
      "reason": "항응고 효과 감소",
      "evidence": "Vitamin K2 interactions, 2018"
    }
  ],
  "selenium": [
    {
      "item": "고용량 비타민C 동시",
      "reason": "셀레늄 형태 변환 저해 가능",
      "evidence": "Selenium interaction data, 2012"
    }
  ],
  "red_clover": [
    {
      "item": "호르몬 치료제",
      "reason": "에스트로겐 효과 중첩",
      "evidence": "Tice et al., JAMA, 2003"
    },
    {
      "item": "타목시펜 (유방암 약)",
      "reason": "효과 상쇄",
      "evidence": "Red clover isoflavones data, 2010"
    }
  ],
  "coenzyme_pqq": [
    {
      "item": "특별한 금기 없음",
      "reason": "단 고용량 장기 복용 자료 부족 — 권장량 준수",
      "evidence": "PQQ safety review, 2016"
    }
  ],
  "phosphatidylserine": [
    {
      "item": "항응고제 병용",
      "reason": "출혈 위험 소폭 증가 가능",
      "evidence": "Phosphatidylserine interactions, 2014"
    }
  ]
};

// ── 쿠팡 검색 키워드 (평점순 정렬 + 정밀 키워드) ──────────────────────────
// 규칙: 성분명 + 함량/형태 + "건강기능식품"
// 소비자 평점 높은 순 정렬 → URL에 &sorter=scoreDesc 적용
export const COUPANG_KEYWORDS: Record<string, string> = {
  "vitamin_b": "비타민B 컴플렉스 고함량 건강기능식품",
  "magnesium": "마그네슘 비스글리시네이트 400mg 건강기능식품",
  "omega3": "오메가3 rTG 1000mg 건강기능식품",
  "vitamin_d": "비타민D3 2000IU 건강기능식품",
  "probiotics": "프로바이오틱스 100억 유산균 건강기능식품",
  "milk_thistle": "밀크씨슬 실리마린 130mg 건강기능식품",
  "vitamin_c": "비타민C 1000mg 건강기능식품",
  "lemon_balm": "레몬밤 추출물 건강기능식품",
  "collagen": "저분자 콜라겐 펩타이드 어류 건강기능식품",
  "coq10": "코엔자임Q10 100mg 건강기능식품",
  "iron": "철분 비스글리시네이트 건강기능식품",
  "zinc": "아연 피콜리네이트 15mg 건강기능식품",
  "gaba": "가바 GABA 300mg 건강기능식품",
  "headache_tree": "편두통 피버퓨 건강기능식품",
  "folic_acid": "엽산 활성형 800mcg 건강기능식품",
  "vitamin_e": "비타민E 토코페롤 400IU 건강기능식품",
  "red_ginseng": "홍삼 진세노사이드 건강기능식품",
  "calcium": "칼슘 마그네슘 비타민D 건강기능식품",
  "lutein": "루테인 지아잔틴 20mg 건강기능식품",
  "chromium": "크롬 피콜리네이트 200mcg 건강기능식품",
  "banaba_leaf": "바나바잎 코로솔산 건강기능식품",
  "saw_palmetto": "쏘팔메토 320mg 건강기능식품",
  "gamma_linolenic": "감마리놀렌산 달맞이꽃종자유 건강기능식품",
  "msm": "MSM 글루코사민 관절 건강기능식품",
  "garcinia": "가르시니아 HCA 건강기능식품",
  "vitamin_k2": "비타민K2 MK7 건강기능식품",
  "selenium": "셀레늄 셀렌 100mcg 건강기능식품",
  "red_clover": "레드클로버 이소플라본 건강기능식품",
  "coenzyme_pqq": "PQQ 피롤로퀴놀린퀴논 건강기능식품",
  "phosphatidylserine": "포스파티딜세린 PS 100mg 건강기능식품",
};
