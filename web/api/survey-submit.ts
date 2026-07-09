/**
 * POST /api/survey-submit  — [비활성화 2026-07-08]
 *
 * 이 엔드포인트는 과거 설문 응답을 Google Sheets(Apps Script 웹훅)에 개인별로 기록했다.
 * 컴플라이언스 사유(개인별 민감정보를 처리방침 미고지 수탁자 Google/미국에 이중 전송,
 * 삭제권 미이행)로 전송 경로를 제거했다. 클라이언트(analytics.ts)는 더 이상 호출하지 않는다.
 * 통계는 Supabase 익명 집계(뷰/RPC, k-익명성)로 대체한다(작업지시서 58).
 *
 * 우회 호출을 막기 위해 이 핸들러는 데이터를 저장하지 않고 410 Gone을 반환한다.
 */

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  // 저장 로직 없음(Sheets 전송 폐지). 어떤 메서드든 410으로 응답.
  res.status(410).json({ error: 'gone', detail: 'survey-submit endpoint disabled (compliance): data is stored only in Supabase.' })
}
