/**
 * 설문 증상 목록 — 단일 출처 (설문 화면·건강 변화 리포트 공용)
 * 평가: IP/integration/survey_history_server_eval_v1.md v1.1 (S01~S03 · W3) · 2026-10-03 Questions.tsx 에서 이동
 */
export const SYMPTOM_GROUPS = [
  { group: '⚡ 에너지 / 피로', symptoms: [
    { id: 'chronic_fatigue', text: '항상 무겁고 피곤해요 (충분히 쉬어도 회복이 안 됨)' },
    { id: 'afternoon_slump', text: '오후만 되면 극심하게 졸리고 처져요' },
    { id: 'brain_fog', text: '집중이 안 되고 머릿속이 안개 낀 느낌이에요' },
    { id: 'eye_fatigue', text: '눈이 자주 충혈되거나 침침하고 피로해요' },
  ]},
  { group: '😴 수면', symptoms: [
    { id: 'leg_cramps_night', text: '자다가 다리·발에 쥐가 자주 나요' },
    { id: 'cant_fall_asleep', text: '잠들기까지 30분~1시간 이상 걸려요' },
    { id: 'wake_night', text: '새벽에 자꾸 깨고 다시 잠들기 어려워요' },
    { id: 'unrefreshing', text: '충분히 잤는데도 개운하지 않아요' },
  ]},
  { group: '✨ 피부 / 모발', symptoms: [
    { id: 'hair_loss', text: '머리카락이 유독 많이 빠져요' },
    { id: 'brittle_nails', text: '손발톱이 쉽게 부러지거나 세로줄이 생겨요' },
    { id: 'dry_skin', text: '피부가 항상 건조하고 각질이 심해요' },
    { id: 'easy_bruising', text: '살짝 부딪혀도 멍이 잘 들어요' },
  ]},
  { group: '🦴 근육 / 관절', symptoms: [
    { id: 'joint_pain', text: '관절이 뻣뻣하거나 움직일 때 아파요' },
    { id: 'muscle_weakness', text: '근력이 약해진 느낌이에요' },
  ]},
  { group: '🤧 면역 / 소화', symptoms: [
    { id: 'frequent_cold', text: '감기나 잔병에 자주 걸려요' },
    { id: 'slow_wound', text: '상처가 늦게 아물어요' },
    { id: 'bloating', text: '배가 자주 빵빵하고 가스가 차요' },
    { id: 'irregular_bowel', text: '변비나 설사가 반복돼요' },
  ]},
  { group: '😟 스트레스 / 기분', symptoms: [
    { id: 'anxiety', text: '별일 아닌데 불안하거나 초조해요' },
    { id: 'irritability', text: '사소한 일에 짜증이 나고 예민해요' },
    { id: 'low_mood', text: '기분이 가라앉고 의욕이 없어요' },
    { id: 'heart_palpitations', text: '가슴이 두근거리거나 답답해요' },
  ]},
  { group: '👁️ 눈 / 시력', symptoms: [
    { id: 'blurry_vision', text: '시야가 흐릿하거나 초점이 안 맞아요' },
    { id: 'dry_eyes', text: '눈이 자주 건조하고 뻑뻑해요' },
    { id: 'floaters', text: '눈앞에 날파리 같은 게 보여요' },
  ]},
  { group: '🔥 대사 / 혈당', symptoms: [
    { id: 'sugar_cravings', text: '단 것이 자꾸 당기고 참기 어려워요' },
    { id: 'post_meal_drowsy', text: '식후에 극심하게 졸려요' },
    { id: 'thirst_frequent_urination', text: '갈증이 심하고 소변을 자주 봐요' },
  ]},
  { group: '❤️ 심혈관', symptoms: [
    { id: 'chest_tightness', text: '가슴이 조이거나 답답한 느낌이에요' },
    { id: 'cold_hands_feet', text: '손발이 항상 차가워요' },
    { id: 'leg_swelling', text: '다리가 잘 붓고 무거워요' },
  ]},
  { group: '🌸 갱년기 / 호르몬', symptoms: [
    { id: 'hot_flashes', text: '갑자기 얼굴이 화끈 달아올라요' },
    { id: 'mood_swings', text: '감정 기복이 심해졌어요' },
    { id: 'vaginal_dryness', text: '질 건조감이나 불편감이 있어요' },
  ]},
]

const LABELS: Record<string, string> = Object.fromEntries(SYMPTOM_GROUPS.flatMap((g) => g.symptoms.map((s) => [s.id, s.text])))

/** 증상 id → 설문 문장(없으면 id) */
export function symptomLabel(id: string): string {
  return LABELS[id] ?? id
}
