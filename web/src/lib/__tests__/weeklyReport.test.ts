import { describe, it, expect } from 'vitest'
import {
  kstMonday, lastCompletedWeekStart, addDaysISO, prevWeek, nextWeek, weekEnd,
  isAfterLastCompleted, formatWeekRange, flagView, coverageCaption, isInsufficient,
  parseWeeklyEnvelope, WeeklyReportError,
  type MacroFlag, type WeeklyReportData, type WeeklyReport,
} from '../weeklyReport_view'

// 기준 시각: 2026-07-11(토) 12:00 KST = 03:00Z
const SAT = new Date('2026-07-11T03:00:00Z')

describe('주간 네비 (KST 월~일)', () => {
  it('1. kstMonday: 토요일 → 그 주 월요일(2026-07-06)', () => {
    expect(kstMonday(SAT)).toBe('2026-07-06')
  })
  it('2. lastCompletedWeekStart: 지난주 월요일(2026-06-29)', () => {
    expect(lastCompletedWeekStart(SAT)).toBe('2026-06-29')
  })
  it('3. KST 경계: 일요일 23시 KST(=14:00Z)는 아직 지난 월요일 주', () => {
    expect(kstMonday(new Date('2026-07-05T14:00:00Z'))).toBe('2026-06-29')
  })
  it('4. KST 경계: 월요일 05시 KST(=전날 20:00Z)는 새 월요일 주', () => {
    expect(kstMonday(new Date('2026-07-05T20:00:00Z'))).toBe('2026-07-06')
  })
  it('5. prev/next/weekEnd/addDays', () => {
    expect(prevWeek('2026-06-29')).toBe('2026-06-22')
    expect(nextWeek('2026-06-29')).toBe('2026-07-06')
    expect(weekEnd('2026-06-29')).toBe('2026-07-05')
    expect(addDaysISO('2026-06-29', 6)).toBe('2026-07-05')
  })
  it('6. 월 경계 넘김', () => {
    expect(nextWeek('2026-06-29')).toBe('2026-07-06')
    expect(prevWeek('2026-07-06')).toBe('2026-06-29')
  })
  it('7. isAfterLastCompleted: 이번(진행중) 주는 미래로 취급(다음 이동 차단)', () => {
    expect(isAfterLastCompleted('2026-07-06', SAT)).toBe(true)   // 진행중 주
    expect(isAfterLastCompleted('2026-06-29', SAT)).toBe(false)  // 최근 완결 주
    expect(isAfterLastCompleted('2026-06-22', SAT)).toBe(false)  // 과거
  })
  it('8. formatWeekRange 표기', () => {
    expect(formatWeekRange('2026-06-29')).toBe('6월 29일 ~ 7월 5일')
  })
})

describe('flagView 매핑(색/라벨/화살표)', () => {
  const mk = (nutrient: MacroFlag['nutrient'], direction: MacroFlag['direction'], severity: MacroFlag['severity']): MacroFlag =>
    ({ nutrient, direction, severity })
  it('9. 나트륨 초과 high → 빨강/▲', () => {
    const v = flagView(mk('sodium', 'over', 'high'))
    expect(v.label).toBe('나트륨 초과'); expect(v.arrow).toBe('▲'); expect(v.colorVar).toBe('var(--danger)')
  })
  it('10. 단백질 부족 medium → 경고색/▼', () => {
    const v = flagView(mk('protein', 'under', 'medium'))
    expect(v.label).toBe('단백질 부족'); expect(v.arrow).toBe('▼'); expect(v.colorVar).toBe('var(--warning)')
  })
  it('11. 열량/당류/식이섬유 라벨', () => {
    expect(flagView(mk('calories', 'over', 'medium')).label).toBe('열량 초과')
    expect(flagView(mk('sugar', 'over', 'high')).label).toBe('당류 초과')
    expect(flagView(mk('fiber', 'under', 'high')).label).toBe('식이섬유 부족')
  })
})

describe('coverage / insufficient', () => {
  it('12. coverageCaption 정상/빈주', () => {
    expect(coverageCaption({ days_logged: 3, meals: 5 })).toBe('이번 주 3일 · 5끼 기록')
    expect(coverageCaption({ days_logged: 0, meals: 0 })).toBe('이 주는 기록이 없어요.')
  })
  it('13. isInsufficient: meals 0 → true', () => {
    const empty = { coverage: { days_logged: 0, meals: 0 } } as WeeklyReportData
    const some = { coverage: { days_logged: 1, meals: 1 } } as WeeklyReportData
    expect(isInsufficient(empty)).toBe(true)
    expect(isInsufficient(some)).toBe(false)
  })
})

describe('parseWeeklyEnvelope', () => {
  const data: WeeklyReport = {
    report_id: 'r1', period: { start: '2026-06-29', end: '2026-07-05' },
    report: {
      top_food_groups: [{ name: '국·탕·찌개', count: 1 }],
      macro_balance: { avg: { total_sodium_mg: 2600 }, flags: [{ nutrient: 'sodium', direction: 'over', severity: 'high' }] },
      next_action: { source: 'rule', message: 'x', guardrail_passed: true },
      p2_teaser: { show: true, message: 'p2' },
      coverage: { days_logged: 1, meals: 1 },
    },
    cached: false, first_viewed_at: null,
  }
  it('14. ok:true → data 반환', () => {
    expect(parseWeeklyEnvelope({ ok: true, data }).report_id).toBe('r1')
  })
  it('15. ok:false → WeeklyReportError(code/retryable)', () => {
    try {
      parseWeeklyEnvelope({ ok: false, error: { code: 'UPSTREAM_TIMEOUT', message: 'engine timeout', retryable: true } })
      expect.unreachable('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(WeeklyReportError)
      expect((e as WeeklyReportError).code).toBe('UPSTREAM_TIMEOUT')
      expect((e as WeeklyReportError).retryable).toBe(true)
    }
  })
  it('16. 빈/깨진 응답 → 오류 throw', () => {
    expect(() => parseWeeklyEnvelope({})).toThrow()
    expect(() => parseWeeklyEnvelope(null)).toThrow()
  })
})
