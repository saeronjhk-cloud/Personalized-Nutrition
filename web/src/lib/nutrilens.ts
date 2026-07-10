// NutriLens 사진 식사분석 클라이언트 — 라이브 Edge 소비. 로그인 필요. 저장=meal-photos+meal_log.
import { supabase } from './supabase'

const BASE = import.meta.env.VITE_SUPABASE_URL || ''
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function nutrilensConfigured(): boolean {
  return !!BASE && !!ANON
}

export interface MealFood {
  name_ko: string
  name_en?: string
  amount?: string
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sodium_mg: number
  sugar_g: number
  fiber_g: number
  db_matched?: boolean
  db_name?: string | null
  match_confidence?: string
  quality_flags?: string[]
}
export interface MealSummary {
  total_calories_kcal: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_sodium_mg: number
  total_sugar_g: number
  total_fiber_g: number
}
export interface AnalyzeResult {
  foods: MealFood[]
  summary: MealSummary
  reference?: unknown
  quality_flags?: string[]
  engine_version?: string
  schema_version?: string
}

interface Envelope { ok?: boolean; data?: any; error?: any; engine_version?: string }

// 무엇이 오든 문자열로([object Object] 방지)
function msgOf(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'string') return x
  if (typeof x === 'object') {
    const o = x as any
    if (typeof o.message === 'string') return o.message
    if (typeof o.error === 'string') return o.error
    if (o.error && typeof o.error.message === 'string') return o.error.message
    try { return JSON.stringify(x) } catch { return '오류' }
  }
  return String(x)
}

export interface AnalyzeState {
  jobId?: string
  status: 'done' | 'processing' | 'failed'
  result?: AnalyzeResult
  photo_sha256?: string
  errorCode?: string
  errorMessage?: string
  engineVersion?: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  return { Authorization: `Bearer ${token}`, apikey: ANON }
}

// 재인코딩: EXIF 제거 + 축소
export function reencodeImage(file: File | Blob, maxDim = 1280, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let width = img.naturalWidth || img.width
      let height = img.naturalHeight || img.height
      if (!width || !height) return reject(new Error('이미지 크기를 읽을 수 없어요'))
      if (width > maxDim || height > maxDim) {
        const s = maxDim / Math.max(width, height)
        width = Math.round(width * s); height = Math.round(height * s)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('이 브라우저는 이미지 처리를 지원하지 않아요'))
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 인코딩 실패'))), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요')) }
    img.src = url
  })
}

function toState(json: Envelope): AnalyzeState {
  const d = json?.data ?? {}
  return {
    jobId: d.job_id,
    status: (d.status as AnalyzeState['status']) ?? 'failed',
    result: d.result as AnalyzeResult | undefined,
    photo_sha256: d.photo_sha256,
    errorCode: d.error_code ?? json?.error?.code,
    errorMessage: msgOf(d.error_message ?? json?.error) || undefined,
    engineVersion: json?.engine_version,
  }
}

async function readBody(res: Response): Promise<{ json: Envelope; raw: string }> {
  const raw = await res.text().catch(() => '')
  let json: Envelope = {}
  try { json = raw ? JSON.parse(raw) : {} } catch { /* 비-JSON */ }
  return { json, raw }
}

async function postAnalyze(blob: Blob, idem: string, mode: string): Promise<AnalyzeState> {
  const fd = new FormData()
  fd.append('image', blob, 'meal.jpg')
  fd.append('mode', mode)
  const res = await fetch(`${BASE}/functions/v1/meal-analysis-jobs`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'X-Idempotency-Key': idem, 'X-Request-Id': idem },
    body: fd,
  })
  const { json, raw } = await readBody(res)
  console.debug('[nutrilens] analyze', res.status, raw.slice(0, 800))
  if (res.status === 401) throw new Error('로그인이 필요합니다')
  if (res.status === 413) throw new Error('사진 용량이 너무 커요(8MB 이하).')
  if (res.status === 429) throw new Error('오늘 분석 한도를 초과했어요. 내일 다시 시도해 주세요.')
  if (res.status === 409) throw new Error('이미 기록한 사진이에요.')
  if (!res.ok && !json?.data) {
    throw new Error(msgOf(json?.error) || raw.slice(0, 300) || `분석 요청 실패 (${res.status})`)
  }
  return toState(json)
}

async function getStatus(jobId: string): Promise<AnalyzeState> {
  const res = await fetch(`${BASE}/functions/v1/analysis-status?job_id=${encodeURIComponent(jobId)}`, {
    headers: await authHeaders(),
  })
  const { json, raw } = await readBody(res)
  console.debug('[nutrilens] status', res.status, raw.slice(0, 400))
  return toState(json)
}

// 분석: 즉시 or 202 폴링(3초)
export async function analyzeMeal(
  blob: Blob,
  idem: string,
  opts: { mode?: string; timeoutMs?: number; onWait?: () => void } = {},
): Promise<AnalyzeState> {
  const first = await postAnalyze(blob, idem, opts.mode ?? 'default')
  if (first.status !== 'processing' || !first.jobId) return first
  opts.onWait?.()
  const timeoutMs = opts.timeoutMs ?? 90_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await getStatus(first.jobId)
    if (s.status !== 'processing') return s
  }
  return { ...first, status: 'failed', errorCode: 'UPSTREAM_TIMEOUT', errorMessage: '분석이 오래 걸려요. 잠시 후 다시 시도해 주세요.' }
}

// 저장: 사진 업로드 + meal_log insert(멱등)
export async function saveMeal(params: {
  blob: Blob
  result: AnalyzeResult
  photo_sha256: string
  clientMealId: string
  mealSlot?: string
  eatenAt?: string
}): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다' }
  const path = `${user.id}/${params.photo_sha256}.jpg`
  const up = await supabase.storage.from('meal-photos').upload(path, params.blob, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (up.error) return { ok: false, error: `사진 저장 실패: ${up.error.message}` }
  const { error } = await supabase.from('meal_log').insert({
    user_id: user.id,
    client_meal_id: params.clientMealId,
    eaten_at: params.eatenAt ?? new Date().toISOString(),
    meal_slot: params.mealSlot ?? null,
    foods: params.result.foods,
    summary: params.result.summary,
    photo_path: path,
    photo_sha256: params.photo_sha256,
    engine_version: params.result.engine_version ?? null,
    source: 'photo',
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') return { ok: true }
    return { ok: false, error: `기록 저장 실패: ${error.message}` }
  }
  return { ok: true }
}

export function genMealId(): string {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultMealSlot(d: Date = new Date()): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
