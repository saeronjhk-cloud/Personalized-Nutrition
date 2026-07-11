/**
 * 익명 제품 계측(먹선 스캔 + NutriLens 식사 + 주간 리포트 퍼널) — 컴플라이언스 안전 sink.
 *
 * 설계 원칙(작업지시서 62 계측 + 65 sink 결정):
 *  - [익명/집계] 영속 식별자를 만들지 않는다. visit_id는 페이지 로드마다 새로 생성되는
 *    "메모리 전용" 값으로, 한 방문 안의 퍼널을 잇는 용도로만 쓰이고 저장·교차세션 추적에 쓰지 않는다.
 *    user_id도 담지 않는다.
 *  - [PII 차단] props는 화이트리스트 키만 통과(카운트/enum/boolean). 자유 텍스트·설문값·음식명·건강값 불가.
 *  - [옵트아웃 존중] 수집 거부(sf_data_consent=declined)면 전송하지 않고 visit_id를 파기한다.
 *  - [UI 무영향] fire-and-forget. 실패·미마이그레이션 상태에서도 절대 throw하지 않는다.
 *
 * 적재: 자체 Supabase app_event(RLS insert-only, 익명 role 허용). 집계는 어드민 SECURITY DEFINER RPC.
 *   스키마: supabase/phase_p15_meokseon_events_and_scans_v1.sql + 98 meal 이벤트 확장 마이그레이션.
 *   순수 로직(유니온·surface·sanitize): events_core.ts (Eval 대상).
 */
import { supabase } from './supabase'
import { hasDeclinedCollection } from './analytics'
import { type AppEvent, type Props, surfaceOf, sanitize } from './events_core'

export type { AppEvent } from './events_core'
export { surfaceOf } from './events_core'

// 방문 단위 상관 id — 메모리 전용(저장 안 함, 교차세션 추적 아님).
function newVisitId(): string {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `v-${Math.random().toString(36).slice(2)}`
}
// mutable: 동의 철회 시 즉시 파기 — 이후 퍼널 상관이 끊긴다.
let VISIT_ID: string = newVisitId()

/** 수집 동의 철회(declined) 즉시 호출 — visit_id를 파기해 퍼널 상관을 끊는다. */
export function clearTelemetryVisit(): void {
  VISIT_ID = ''
}

const APP_VERSION: string = (import.meta.env.VITE_APP_VERSION as string) || ''

/**
 * 익명 이벤트 1건 적재. 절대 await 하지 말 것(fire-and-forget). 실패는 무시.
 * surface는 이벤트 접두에서 자동 도출(scan/meal/report).
 */
export function track(event: AppEvent, props?: Props): void {
  try {
    if (hasDeclinedCollection()) {
      if (VISIT_ID) VISIT_ID = ''   // 명시적 수집 거부 — 전송 안 함 + visit_id 즉시 파기
      return
    }
    void supabase
      .from('app_event')
      .insert({
        event,
        surface: surfaceOf(event),
        visit_id: VISIT_ID || null,
        props: sanitize(props),
        app_version: APP_VERSION || null,
      })
      .then(({ error }) => {
        if (error) console.debug('[events] insert skipped:', error.message)
      })
  } catch {
    // 무시 — 계측은 절대 UX를 막지 않는다
  }
}
