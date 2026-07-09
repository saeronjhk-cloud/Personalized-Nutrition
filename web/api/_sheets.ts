/**
 * [비활성화 2026-07-08] Google Sheets(Apps Script 웹훅) 클라이언트 — 폐지됨.
 *
 * 컴플라이언스 사유(개인별 설문 민감정보를 처리방침 미고지 수탁자 Google/미국에 이중 전송,
 * 삭제권 미이행)로 Sheets 전송 경로를 제거했다. 이 모듈은 더 이상 어디서도 import되지 않는다.
 * 환경변수 SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_SECRET / ANALYTICS_IP_SALT 는 미사용 -> 배포에서 제거 권장.
 * (파일 삭제는 저장소 권한상 이 세션에서 불가하여 무해한 스텁으로 대체. 제이가 파일 삭제 가능.)
 *
 * 통계는 Supabase 익명 집계(뷰/RPC, k-익명성)로 대체 — 작업지시서 58.
 */

export async function appendRow(_values: (string | number | null)[]): Promise<void> {
  throw new Error('appendRow disabled: Google Sheets 전송 경로 폐지(컴플라이언스). 작업지시서 58 참조.')
}
