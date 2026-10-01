/**
 * 기능 플래그
 *
 * CHECKUP_ENABLED: 건강검진(검진 수치 입력/해석) 기능 노출 여부.
 *   - 컴플라이언스 게이트(개인정보처리방침 문구 확정 + 식약처 의료기기 해당여부 판단) 통과 전까지 비활성.
 *   - 엔진의 CHECKUP_ENABLED(미설정 시 404)와 동일 개념. 기본값 false.
 *   - 활성화하려면 배포 환경변수에 VITE_CHECKUP_ENABLED=true 설정.
 *   - 참고 IP: IP/통합앱_P1/25(검진 마스터), 48(컴플라이언스 확정), 52(식약처 브리프), 53(갭 리포트).
 */
export const CHECKUP_ENABLED = import.meta.env.VITE_CHECKUP_ENABLED === 'true'

/**
 * INSIGHTS_ENABLED: 어드민 익명 집계 대시보드(/insights) 노출 여부. 기본 false.
 *   - 실제 접근통제는 Supabase get_insights() RPC(어드민 허용목록)가 서버측에서 강제(이중 방어).
 *   - 활성화: 배포 환경변수 VITE_INSIGHTS_ENABLED=true. 참고 IP: 통합앱_P1/58(집계 설계).
 */
export const INSIGHTS_ENABLED = import.meta.env.VITE_INSIGHTS_ENABLED === 'true'

/**
 * MEOKSEON_ENABLED: 먹선 제품 스캔(무료 후킹) 노출 여부. 기본 false.
 *   - 무인증 공개 조회(개인정보 무관). 배포 시 VITE_MEOKSEON_API_URL(Railway)도 설정.
 *   - 근거 IP: 통합앱_P1/61(배치결정)·62(화면·계측).
 */
export const MEOKSEON_ENABLED = import.meta.env.VITE_MEOKSEON_ENABLED === 'true'

/**
 * MEAL_ENABLED: NutriLens 사진 식사기록(사진→분석→저장) 노출 여부. 기본 false.
 *   - 로그인 필요(Edge JWT). 배포 시 meal-analysis-jobs·analysis-status Edge 배포 선행(75 가이드).
 *   - 라이브 DB meal 스택(meal_log·analysis_job·meal-photos 버킷) 선행 필요(73).
 *   - ⚠️ 출시 게이트: 촬영 전 민감정보(건강추론)+국외이전(OpenAI Vision) 동의 앱 강제.
 *   - 활성화: 배포 환경변수 VITE_MEAL_ENABLED=true. 근거 IP: 통합앱_P1/66~75.
 */
export const MEAL_ENABLED = import.meta.env.VITE_MEAL_ENABLED === 'true'

/**
 * MEAL_CMIN_ENABLED: 잔반 정밀 비교(C-min, 식전+식후 2장) 노출. 기본 false.
 *   - 엔진 photo_ai_hybrid + Edge Signed URL 배포 선행 필요(IP 87 작업지시서) + 정밀도 Eval GO.
 *   - off면 식후 1장(Path B)만. 활성화: 배포 환경변수 VITE_MEAL_CMIN=true.
 */
export const MEAL_CMIN_ENABLED = import.meta.env.VITE_MEAL_CMIN === 'true'

/**
 * GOAL_COACHING_ENABLED: 목표 기반 식사 코칭 카드(/meal «오늘의 식사 코칭») 노출. 기본 false.
 *   - 판정: domain/coaching/goal_meal_coaching.ts (엔진 결정론). 값: goal_coaching_params.ts.
 *   - ⛔ 서박사 확정(IP/웹앱트랙_서박사_질의패킷_목표식사코칭_v1.md E1·E3·E4·G5) 전 운영 ON 금지.
 *   - 활성화: 배포 환경변수 VITE_GOAL_COACHING_ENABLED=true (MEAL_ENABLED 도 켜져 있어야 의미 있음).
 */
export const GOAL_COACHING_ENABLED = import.meta.env.VITE_GOAL_COACHING_ENABLED === 'true'

/**
 * MEAL_EDIT_ENABLED: 식사 결과 «음식 편집»(이름 바꾸기·삭제·추가) 노출. 기본 false.
 *   - 선행 배포: 엔진 /v1/food/{search,resolve}(NutriLens Railway) + Edge food-lookup.
 *     배포 확인 전 켜면 «지금은 음식을 찾을 수 없어요»만 보인다.
 *   - 설계 IP/integration/meal_food_edit_design_v1.md · 활성화: VITE_MEAL_EDIT_ENABLED=true
 */
export const MEAL_EDIT_ENABLED = import.meta.env.VITE_MEAL_EDIT_ENABLED === 'true'

/**
 * MEAL_GRAMMAR_ENABLED: 한식 끼니 문법 P1 카드(/meal «오늘의 밥상 코칭» — 단백질·채소 반찬 + 사진 검증) 노출. 기본 false.
 *   - 설계 IP/integration/meal_grammar_p1_design_v1.md · 평가 IP/integration/meal_grammar_p1_eval_v1.md
 *   - 활성화: VITE_MEAL_GRAMMAR_ENABLED=true (MEAL_ENABLED 도 켜져 있어야 의미 있음). 서박사 문구 회신 전 운영 ON 금지.
 */
export const MEAL_GRAMMAR_ENABLED = import.meta.env.VITE_MEAL_GRAMMAR_ENABLED === 'true'
