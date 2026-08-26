/**
 * 「내 제보」 이력 — 응답 정규화·문구 판정. 순수 함수(렌더 비의존, 테스트 대상).
 *
 * ★★ 왜 생겼나 (2026-08-23, 세션64b)
 *   제보를 보내고 나면 그걸로 끝이었다. 「감사합니다」 뒤에 아무것도 없었다.
 *   서버 `contributions` 에는 기록이 남는데 **그 기록을 사용자에게 돌려주는 경로가 없었다.**
 *
 * ★ 계약 — 서버 담당과 «동일». 임의로 바꾸지 말 것.
 *   `GET /api/contributions/mine?limit=20&offset=0`
 *     헤더 `Authorization: Bearer <supabase access token>` (**인증 필수**)
 *     → `{ success, data: { items: [{ contribution_id, created_at, barcode, product_name,
 *          status, nutrition_status, product_id }], total } }`
 *     → 401 `{ success:false, error:{ code:'AUTH_REQUIRED'|'AUTH_INVALID', message } }`
 *
 *   ★★ 2026-08-24 세션64c — **`device_id` 파라미터가 «없어졌다».**
 *     세션64b 에는 `?device_id=<uuid>` 였다. 앱(Supabase Auth)과 먹선 서버(Firebase Auth)의
 *     계정 체계가 연결돼 있지 않아 브라우저 저장소 UUID 말고는 붙일 것이 없었기 때문이다.
 *     제이 확정(2026-08-24)으로 서버 인증이 Supabase 로 전면 교체되면서 식별자가 «계정»이 됐다.
 *     ⇒ 저장소를 지워도, 기기를 바꿔도 **로그인하면 지난 제보가 그대로 보인다.**
 *     ⇒ 그래서 세션64b 의 `CONTRIBUTIONS_NO_DEVICE`(「이 기기에서는 불러올 수 없어요」)를
 *       **지웠다.** 더 이상 사실이 아닌 문구다. 되살리지 말 것.
 *
 *   ⚠ 2026-08-24 기준 서버에 이 엔드포인트는 **아직 없다**(구현 중). 이 파일과 테스트는 목 기반이다.
 *
 * ★★★ 「상태」에 대해 — **없는 상태를 지어내지 않는다.**
 *   서버 코드에서 확인한 사실(2026-08-23):
 *     · `INSERT INTO contributions (…, status, …) VALUES (…, 'pending', …)`
 *       (`crowdsourceService.js:564`) — 새 제보는 **언제나 `pending`** 이다.
 *     · `status` 를 바꾸는 곳은 «관리자 라우트 하나»뿐이다
 *       (`adminRoutes.js:212·231·258` → `'approved'` / `'rejected'`).
 *   ⇒ 즉 **사람이 검토하기 전까지 상태는 바뀌지 않는다.** 「검토 중」·「분석 중」처럼
 *     자동으로 진행되는 듯한 말을 쓰면 사용자는 오지 않을 변화를 기다린다.
 *   ⇒ 그래서 문구는 「접수됨」이고, 화면이 그 사실(사람이 본다)을 한 줄로 말한다.
 *   ⚠ 처음 보는 값이 오면 **지어내지 않고** 「상태 확인 중」으로 둔다(`known: false`).
 */

/** 정규화된 제보 한 건. 서버 원문 키를 화면까지 흘리지 않는다. */
export interface MyContribution {
  /** 서버 `contribution_id`. React key 이자 중복 제거 기준. */
  id: number
  /** ISO 문자열 원문. 표시는 `formatReportedAt` 이 한다. */
  createdAt: string | null
  barcode: string | null
  /** 제품명. 없으면 null — 「이름 미상」 같은 값으로 «메우지 않는다». */
  productName: string | null
  status: string | null
  nutritionStatus: string | null
  productId: number | null
}

export interface MyContributionPage {
  items: MyContribution[]
  /** 서버 `total`. 모르면 목록 길이를 쓴다(목록보다 «작은» 값은 쓰지 않는다). */
  total: number
}

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 문구 — ★★ 안전 계약이다. 정본은 여기 «한 곳».
 * ────────────────────────────────────────────────────────────────────────── */

export const CONTRIBUTIONS_TITLE = '내가 보낸 제보'

/** 빈 목록. 「없다」로 끝내지 않고 다음 행동을 준다. */
export const CONTRIBUTIONS_EMPTY = '아직 보낸 제보가 없어요.'
export const CONTRIBUTIONS_EMPTY_HINT =
  '제품 바코드를 스캔했을 때 정보가 없거나 빠져 있으면, 라벨 사진을 보내 채워 주실 수 있어요.'

/**
 * 상태가 왜 잘 안 바뀌는지 한 줄. **근거는 서버 코드다**(파일 상단 주석 참조).
 * ⚠ 「곧 반영됩니다」처럼 시점을 약속하지 않는다. 우리는 그 시점을 모른다.
 */
export const CONTRIBUTIONS_STATUS_HINT =
  '보내주신 제보는 사람이 확인한 뒤에 반영돼요. 확인 전까지는 「접수됨」으로 보여요.'

/** 조회 실패. 「제보가 없다」와 «절대» 섞지 않는다 — 없는 것과 못 불러온 것은 다르다. */
export const CONTRIBUTIONS_LOAD_ERROR = '제보 이력을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'

/**
 * ★ 계정 기준이라 기기를 바꿔도 보인다는 사실. 세션64b 의 「이 기기에만」 한계 고지를 대체한다.
 * ⚠ 「어디서든 보여요」로 과장하지 않는다 — «같은 계정으로 로그인했을 때»가 조건이다.
 */
export const CONTRIBUTIONS_ACCOUNT_NOTICE =
  '제보 이력은 계정에 저장돼요. 같은 계정으로 로그인하면 다른 기기에서도 보여요.'

/** 바코드 없이 사진만으로 보낸 제보 — 눌러도 갈 곳이 없다. 왜인지 말한다. */
export const CONTRIBUTION_NO_BARCODE_NOTE = '바코드 없이 보낸 제보라 제품 화면으로 이동할 수 없어요.'

export interface ContributionStatusView {
  label: string
  /** 이 저장소가 문구를 갖고 있는 값인가. false = 서버가 새 상태를 만들었다는 신호. */
  known: boolean
}

const STATUS_LABEL: Record<string, string> = {
  pending: '접수됨',
  approved: '반영됨',
  rejected: '반영되지 않음',
}

/** 상태 문구. ⚠ 서버 원문 문자열을 화면에 그대로 쓰지 않는다(사용자용 문구가 아니다). */
export function describeContributionStatus(status: unknown): ContributionStatusView {
  const v = typeof status === 'string' ? status.trim().toLowerCase() : ''
  const hit = STATUS_LABEL[v]
  if (hit) return { label: hit, known: true }
  // 처음 보는 값 · 빈 값 — 지어내지 않는다.
  return { label: '상태 확인 중', known: false }
}

/**
 * 영양정보가 함께 저장됐는가.
 * ⚠ **`'ok'` 만 ok 다.** 모르는 값·빈 값은 「저장 안 됨」쪽으로 읽는다(Render Conservative,
 *   `photoReport.ts:classifyPhotoReportOutcome` 과 같은 규칙).
 * ⚠ null(서버가 말하지 않음)이면 **아무 말도 하지 않는다** — 없는 사실을 지어내지 않는다.
 */
export function describeContributionNutrition(nutritionStatus: unknown): string | null {
  if (nutritionStatus === null || nutritionStatus === undefined) return null
  const v = typeof nutritionStatus === 'string' ? nutritionStatus.trim() : ''
  if (!v) return null
  return v === 'ok' ? '영양정보까지 저장됨' : '영양정보는 저장되지 않음'
}

/** 목록에 그릴 이름. 없으면 바코드, 그것도 없으면 «이름을 지어내지 않고» 그렇게 말한다. */
export function describeContributionTitle(item: MyContribution): string {
  const name = (item.productName || '').trim()
  if (name) return name
  const code = (item.barcode || '').trim()
  if (code) return `바코드 ${code}`
  return '제품명 없이 보낸 제보'
}

/** 그 제품 화면으로 갈 수 있는가. 앱의 제품 조회는 «바코드»가 키다(product_id 조회 경로 없음). */
export function contributionBarcode(item: MyContribution): string | null {
  const code = (item.barcode || '').trim()
  return /^\d{8,14}$/.test(code) ? code : null
}

/**
 * 보낸 시각 — `YYYY-MM-DD HH:mm`(기기 현지 시각).
 * ⚠ 「3시간 전」 같은 상대 표기를 쓰지 않는다. 다시 열 때마다 값이 달라져
 *   같은 제보가 다른 건처럼 보인다.
 */
export function formatReportedAt(iso: unknown): string | null {
  if (typeof iso !== 'string' || !iso.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 응답 정규화
 * ────────────────────────────────────────────────────────────────────────── */

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function str(v: unknown): string | null {
  return (typeof v === 'string' && v.trim()) ? v.trim() : null
}

/**
 * 한 건 정규화. **`contribution_id` 가 없으면 버린다** —
 * key 를 인덱스로 만들면 목록이 갱신될 때 다른 제보의 상태가 엉뚱한 줄에 붙는다.
 */
export function normalizeContribution(raw: unknown): MyContribution | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = num(r.contribution_id)
  if (id === null) return null
  return {
    id,
    createdAt: str(r.created_at),
    barcode: str(r.barcode),
    productName: str(r.product_name),
    status: str(r.status),
    nutritionStatus: str(r.nutrition_status),
    productId: num(r.product_id),
  }
}

/**
 * `data` → 화면용 목록.
 * ⚠ `total` 이 목록보다 «작으면» 목록 길이를 쓴다. 화면에 그리는 줄보다 적은 숫자를
 *   「총 N건」이라 쓰는 쪽이 더 나쁜 거짓말이다(`additives.ts:buildAdditiveList` 와 같은 규칙).
 */
export function normalizeContributionPage(data: unknown): MyContributionPage {
  const d = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {}
  const rawItems = Array.isArray(d.items) ? d.items : []
  const items = rawItems
    .map(normalizeContribution)
    .filter((x): x is MyContribution => x !== null)
  const total = num(d.total)
  return { items, total: total !== null ? Math.max(total, items.length) : items.length }
}
