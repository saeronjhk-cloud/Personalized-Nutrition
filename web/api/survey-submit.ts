/**
 * POST /api/survey-submit
 *
 * 설문 응답과 추천 결과를 익명으로 Google Sheets에 기록한다.
 *
 * 요청 본문(JSON):
 * {
 *   "sessionId": "anon-xxxx",       // 클라이언트가 만든 익명 UUID
 *   "answers":    { ... SurveyAnswers ... },
 *   "recommendations": [ { id, name, rank, score } ],
 *   "device":     "mobile" | "desktop" | "tablet"
 * }
 *
 * 저장되는 열 (Responses 시트):
 *   A: timestamp (ISO)
 *   B: session_id (익명)
 *   C: device
 *   D: age_group ("20대", "30대", ...)
 *   E: gender
 *   F: height
 *   G: weight
 *   H: bmi
 *   I: symptoms (JSON)
 *   J: goals (JSON)
 *   K: lifestyle (JSON — 수면/스트레스/운동/식사패턴/음주/흡연 등)
 *   L: current_supplements (JSON)
 *   M: conditions (JSON — 기저질환)
 *   N: family_history (JSON)
 *   O: recommendations (JSON — [{rank,id,name,score}])
 *   P: persona_id
 *   Q: ip_hash (sha256(salt+ip), 앞 16자)
 *   R: ua_hash (sha256(salt+ua), 앞 16자)
 */

import { appendRow, hashWithSalt } from './_sheets.js'

function ageGroup(age: number): string {
  if (!age || age < 1) return 'unknown'
  if (age < 20) return '10대'
  if (age < 30) return '20대'
  if (age < 40) return '30대'
  if (age < 50) return '40대'
  if (age < 60) return '50대'
  if (age < 70) return '60대'
  return '70대+'
}

function computeBmi(heightCm?: number, weightKg?: number): number | null {
  if (!heightCm || !weightKg || heightCm < 50) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

function safeStringify(value: any): string {
  try {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0])
  }
  return req.socket?.remoteAddress || 'unknown'
}

export default async function handler(req: any, res: any) {
  // CORS (같은 도메인에서 호출되지만 방어적으로)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const {
      sessionId = '',
      answers = {},
      recommendations = [],
      device = '',
      personaId = '',
    } = body

    // 최소 검증: answers 없으면 무시 (빈 요청 차단)
    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
      res.status(400).json({ error: 'answers 필드가 필요합니다.' })
      return
    }

    const ip = getClientIp(req)
    const ua = String(req.headers['user-agent'] || '')

    const age = Number(answers['나이'] ?? 0)
    const height = Number(answers['신장'] ?? 0)
    const weight = Number(answers['체중'] ?? 0)

    const lifestyle = {
      수면: answers['수면'],
      스트레스: answers['스트레스'],
      운동: answers['운동'],
      운동유형: answers['운동유형'],
      일조량: answers['일조량'],
      식사패턴: answers['식사패턴'],
      식이제한: answers['식이제한'],
      음주: answers['음주'],
      흡연: answers['흡연'],
      체중변화: answers['체중변화'],
      월경상태: answers['월경상태'],
    }

    const row: (string | number | null)[] = [
      new Date().toISOString(),                        // A timestamp
      String(sessionId).slice(0, 64),                  // B session_id
      String(device).slice(0, 16),                     // C device
      ageGroup(age),                                   // D age_group
      String(answers['성별'] || ''),                   // E gender
      height || '',                                    // F height
      weight || '',                                    // G weight
      computeBmi(height, weight) ?? '',                // H bmi
      safeStringify(answers['증상']),                  // I symptoms
      safeStringify(answers['목표']),                  // J goals
      safeStringify(lifestyle),                        // K lifestyle
      safeStringify(answers['현재복용영양제']),        // L current_supplements
      safeStringify(answers['기저질환']),              // M conditions
      safeStringify(answers['가족력']),                // N family_history
      safeStringify(recommendations),                  // O recommendations
      String(personaId || ''),                         // P persona_id
      hashWithSalt(ip),                                // Q ip_hash
      hashWithSalt(ua),                                // R ua_hash
    ]

    await appendRow(row)
    res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('[survey-submit] error:', err)
    // 클라이언트에는 민감한 에러 세부를 내리지 않음
    res.status(500).json({ error: 'submission_failed' })
  }
}
