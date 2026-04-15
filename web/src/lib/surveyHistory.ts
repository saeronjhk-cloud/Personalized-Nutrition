import type { SurveyAnswers, RecommendationResult, SurveyRecord } from '../types'

const STORAGE_KEY = 'survey_history'

/** 고유 ID 생성 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 저장된 모든 설문 기록 가져오기 (최신순) */
export function getSurveyHistory(): SurveyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SurveyRecord[]
    return parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch {
    return []
  }
}

/** 설문 결과 저장 */
export function saveSurveyRecord(answers: SurveyAnswers, result: RecommendationResult): SurveyRecord {
  const record: SurveyRecord = {
    id: generateId(),
    date: new Date().toISOString(),
    answers,
    result,
  }
  const history = getSurveyHistory()
  history.unshift(record)
  // 최대 10개까지만 보관
  const trimmed = history.slice(0, 10)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  return record
}

/** 가장 최근 기록 */
export function getLatestRecord(): SurveyRecord | null {
  const history = getSurveyHistory()
  return history.length > 0 ? history[0] : null
}

/** 첫 번째(가장 오래된) 기록 */
export function getFirstRecord(): SurveyRecord | null {
  const history = getSurveyHistory()
  return history.length > 0 ? history[history.length - 1] : null
}

/** 재설문 필요 여부 (마지막 설문 후 30일 경과) */
export function shouldPromptResurvey(): boolean {
  const latest = getLatestRecord()
  if (!latest) return false
  const daysSince = (Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince >= 30
}

/** 마지막 설문 후 경과일 */
export function daysSinceLastSurvey(): number {
  const latest = getLatestRecord()
  if (!latest) return -1
  return Math.floor((Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24))
}
