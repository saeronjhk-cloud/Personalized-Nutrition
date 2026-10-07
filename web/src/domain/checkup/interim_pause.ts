/**
 * 검진 임시 조치 v1 — 처리방침·동의 정정 배포 전까지 신규 저장·결합 이용 중단 (단일 출처)
 * 근거: IP/integration/검진동의_외부자문_회신기록_v1.md 공통 지적 C1·C2 · 평가 IP/integration/checkup_interim_pause_eval_v1.md
 * 해제 = 두 값을 false 로 + SQL 160 되돌리기(동의 서버 기록 SQL 161 적용 후)
 */
export const CHECKUP_SAVE_PAUSED = true;
export const CHECKUP_COMBINE_PAUSED = true;

export const PAUSE_NOTICE =
  "검진 기록 저장은 개인정보 처리 절차를 정비하는 동안 잠시 멈췄어요. 분석 결과는 지금처럼 이 화면에서 볼 수 있고, 입력한 수치는 서버에 저장되지 않아요. 저장해 둔 기록은 보기와 삭제만 할 수 있어요.";
export const PAUSE_SAVE_ERROR = "지금은 검진 기록을 저장할 수 없어요(처리 절차 정비 중).";
