/**
 * scanMiss — 먹선 바코드 미스 큐 리포터 (트랙 A-1, 2026-07-22)
 *
 * "DB에 제품 없음"(404) 바코드를 익명 큐(scan_miss)에 적재한다.
 *  - 개인 식별자(user_id·visit_id) 없음 — 바코드(제품 GTIN)만.
 *  - app_event 는 바코드 유입을 화이트리스트로 차단하므로(설계 유지) 별도 sink.
 *  - fire-and-forget: 실패해도 UX 에 절대 영향 없음. 수집 거부(declined) 존중.
 *  - 스키마: supabase/148_scan_miss_queue_v1.sql
 */
import { supabase } from './supabase'
import { hasDeclinedCollection } from './analytics'

const BARCODE_RE = /^\d{8,14}$/

export function reportScanMiss(barcode: string): void {
  try {
    if (hasDeclinedCollection()) return
    if (!BARCODE_RE.test(barcode)) return
    void supabase
      .from('scan_miss')
      .insert({ barcode, source: 'web_scan' })
      .then(({ error }) => {
        if (error) console.debug('[scanMiss] insert skipped:', error.message)
      })
  } catch {
    // 무시 — 계측은 UX 를 막지 않는다
  }
}
