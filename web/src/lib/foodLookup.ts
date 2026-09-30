/**
 * 음식 검색·확정 IO (식사 결과 «음식 편집» v1) — Edge POST /functions/v1/food-lookup
 * 영양 계산은 엔진 단일 소스(food_lookup.py → match_with_db). 여기서는 받아서 넘기기만 한다.
 * 실패는 throw 하지 않고 { ok:false, message } — 화면은 «지금은 수정할 수 없어요» 만 보여준다.
 */
import { supabase } from './supabase'
import type { ResolvedFood } from './foodEdit'

const BASE = import.meta.env.VITE_SUPABASE_URL || ''
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const ENDPOINT = `${BASE}/functions/v1/food-lookup`

export interface FoodCandidate {
  name_ko: string
  source: 'core' | 'gold'
  match: 'exact' | 'prefix' | 'contains'
  serving_g: number
  calories_kcal: number
}

export type LookupFail = { ok: false; message: string }
export const LOOKUP_FAIL_MSG = '지금은 음식을 찾을 수 없어요. 잠시 후 다시 시도해 주세요.'

async function post(body: Record<string, unknown>): Promise<{ ok: true; data: any } | LookupFail> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { ok: false, message: '로그인이 필요합니다' }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.ok) {
      console.warn('[foodLookup]', res.status, json?.error?.code ?? '')
      return { ok: false, message: LOOKUP_FAIL_MSG }
    }
    return { ok: true, data: json.data ?? {} }
  } catch (e) {
    console.warn('[foodLookup] network', (e as Error).message)
    return { ok: false, message: LOOKUP_FAIL_MSG }
  }
}

export async function searchFoods(q: string, limit = 10): Promise<{ ok: true; items: FoodCandidate[] } | LookupFail> {
  const query = q.trim()
  if (!query) return { ok: true, items: [] }
  const r = await post({ action: 'search', q: query.slice(0, 30), limit })
  if (!r.ok) return r
  return { ok: true, items: Array.isArray(r.data.items) ? (r.data.items as FoodCandidate[]) : [] }
}

/** matched=false → food=null (목록에 없는 음식) */
export async function resolveFood(name: string, servingG: number | null): Promise<{ ok: true; food: ResolvedFood | null } | LookupFail> {
  const r = await post({ action: 'resolve', name, serving_g: servingG })
  if (!r.ok) return r
  return { ok: true, food: r.data.matched && r.data.food ? (r.data.food as ResolvedFood) : null }
}
