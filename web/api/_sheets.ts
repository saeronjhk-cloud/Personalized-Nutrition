/**
 * Google Apps Script 웹훅 클라이언트 (경량)
 *
 * 서비스 계정·JWT 대신, 사장님 본인 계정으로 배포한 Apps Script 웹앱을
 * HTTPS POST로 호출해 스프레드시트에 한 행을 append한다.
 *
 * 필요한 환경변수:
 * - SHEETS_WEBHOOK_URL    : Apps Script 웹앱 URL (https://script.google.com/macros/s/.../exec)
 * - SHEETS_WEBHOOK_SECRET : 웹훅 공유 시크릿 (Apps Script 쪽 SECRET과 동일해야 함)
 * - ANALYTICS_IP_SALT     : IP·UA 단방향 해시에 쓰는 솔트
 */

import crypto from 'crypto'

/** Apps Script 웹훅으로 한 행 append */
export async function appendRow(values: (string | number | null)[]): Promise<void> {
  const url = process.env.SHEETS_WEBHOOK_URL
  const secret = process.env.SHEETS_WEBHOOK_SECRET
  if (!url) {
    throw new Error('SHEETS_WEBHOOK_URL 환경변수가 없습니다.')
  }
  if (!secret) {
    throw new Error('SHEETS_WEBHOOK_SECRET 환경변수가 없습니다.')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, values }),
    // Apps Script는 302 리디렉트 후 실제 응답을 주므로 follow 필요 (Node fetch 기본 동작)
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Sheets webhook 실패: ${res.status} ${txt}`)
  }

  // Apps Script 쪽에서 {ok:true} JSON을 반환하도록 약속
  let parsed: any = null
  try {
    parsed = await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    throw new Error(`Sheets webhook 응답 파싱 실패: ${txt}`)
  }
  if (!parsed || parsed.ok !== true) {
    throw new Error(`Sheets webhook 거부: ${JSON.stringify(parsed)}`)
  }
}

/** 민감 정보 (IP, UA) 단방향 해시 */
export function hashWithSalt(input: string): string {
  const salt = process.env.ANALYTICS_IP_SALT || 'seoboksa-default-salt-change-me'
  return crypto.createHash('sha256').update(salt + input).digest('hex').slice(0, 16)
}
