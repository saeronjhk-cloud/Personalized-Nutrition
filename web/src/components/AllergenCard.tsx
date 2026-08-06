import type { CSSProperties } from 'react'
import { describeAllergens, type AllergenView } from '../domain/meokseon/allergens'
import type { MsProductResult } from '../lib/meokseon'

/**
 * 알레르기 카드.
 *
 * 2026-08-06 신설. 먹선 서버는 세션44부터 알레르기 3분리를 계산해 응답에 실어 왔지만
 * 이 앱은 **그 필드의 존재조차 몰랐다**(`MsProductResult` 에 항목이 없었다).
 * 서버가 여덟 세션 동안 만든 경고가 사용자에게 도달하는 경로가 없었다.
 *
 * ★ 시각 규칙 (먹선 서버 세션44 결정을 그대로 따른다)
 *   직접 함유  채운 태그      — 확정이다
 *   원재료 추정 옅게 채운 태그  — 실제로 들어 있지만 근거가 원재료명이다
 *   혼입 가능  «채우지 않고 점선» — 확정이 아니라는 신호. 같은 모양을 쓰면 과잉경고가 된다
 *
 * ★ 미수집일 때도 카드를 숨기지 않는다. 침묵은 「알레르겐 없음」으로 읽힌다.
 *
 * ★★★ 2026-08-06 세션53 — **불완전성 고지를 «항상» 표시한다.**
 * 외부검증 회신(`IP/외부검증_회신종합_2026-08-06_세션53.md`)의 P0 권고이고,
 * 그 근거를 세션53에 코드로 재확인했다. 현행 서버 판별기의 실측 상태:
 *   · `원재료명: 메밀가루` → 「밀」만 나오고 **메밀이 사라진다**(`_matchSet` 소비 매칭)
 *   · `원재료명: 땅콩기름` → 「대두」만 나오고 **땅콩이 사라진다**
 *   · `원재료명: 고등어`·`잣` → 법정 19종인데 **원재료 경로에서 검출 자체가 안 된다**
 *   · 원재료 전문의 밀 551건 중 465건 미검출
 * 즉 이 카드는 지금 **과소경고 상태**다. 고지 없이 안전 기능처럼 보이게 두면 안 된다.
 *
 * ⚠ 이 고지는 P1(구조적 FN) 수정이 운영에 도달하고 19종 경로별 sentinel 이 초록이 된
 *   뒤에야 내린다. **문구를 지우기 전에 반드시 그 두 조건을 확인할 것.**
 */

const TAG_BASE: CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 13,
  marginRight: 6,
  marginBottom: 6,
}

const STYLE = {
  contains: { ...TAG_BASE, background: '#fde8e8', color: '#b3261e', fontWeight: 600 },
  inferred: { ...TAG_BASE, background: '#fff8e1', color: '#8d6e00' },
  // 채우지 않는다 — 「확정이 아니다」를 모양으로 말한다.
  mayContain: { ...TAG_BASE, background: 'transparent', color: '#8a6d3b', border: '1px dashed #c9a227' },
  plain: { ...TAG_BASE, background: 'var(--bg-secondary, #f1f3f5)', color: 'var(--text)' },
} as const

function Row({ label, items, style }: { label: string; items: string[]; style: CSSProperties }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div>{items.map((a) => <span key={a} style={style}>{a}</span>)}</div>
    </div>
  )
}

function Body({ view }: { view: AllergenView }) {
  if (view.kind === 'uncollected') {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        이 제품의 알레르기 정보는 아직 수집되지 않았어요.{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>알레르겐이 없다는 뜻은 아니에요.</strong>{' '}
        포장의 알레르기 표기를 직접 확인해 주세요.
      </p>
    )
  }

  if (view.kind === 'flat') {
    return (
      <div>
        <div>{view.items.map((a) => <span key={a} style={STYLE.plain}>{a}</span>)}</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
          직접 함유와 혼입 가능이 구분되지 않은 목록이에요.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Row label="직접 함유" items={view.contains} style={STYLE.contains} />
      <Row label="원재료 추정" items={view.inferred} style={STYLE.inferred} />
      <Row label="혼입 가능" items={view.mayContain} style={STYLE.mayContain} />
      {view.mayContain.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
          「혼입 가능」은 같은 제조시설·라인에서 만든 제품에 들어 있는 물질이에요.
          제품에 직접 들어 있다는 뜻은 아니지만, 알레르기가 있다면 주의하세요.
        </p>
      )}
    </div>
  )
}

/**
 * 불완전성 고지. **모든 상태에서 보인다** — 미수집·3분리·flat 전부.
 *
 * 「미수집」 문구와 별개인 이유: 미수집 문구는 «이 제품은 자료가 없다»는 말이고,
 * 이 고지는 «자료가 있어도 우리 판별기가 놓치는 게 있다»는 말이다. 서로 다른 사실이다.
 * 둘을 합치면, 알레르겐이 표시된 제품에서는 고지가 사라져 가장 위험한 경우에 침묵하게 된다.
 */
function IncompleteNotice() {
  return (
    <p
      data-testid="allergen-incomplete-notice"
      style={{
        fontSize: 12,
        lineHeight: 1.6,
        color: '#8a5a00',
        background: '#fff8e1',
        border: '1px solid #ffe0a3',
        borderRadius: 8,
        padding: '8px 10px',
        marginTop: 12,
        marginBottom: 0,
      }}
    >
      이 알레르기 표시는 <strong>아직 검증 중인 기능</strong>이에요.
      표기가 있어도 <strong>목록에 나오지 않는 알레르겐이 있을 수 있어요.</strong>{' '}
      알레르기가 있다면 <strong>반드시 포장의 알레르기 표기를 직접 확인</strong>해 주세요.
    </p>
  )
}

export default function AllergenCard({ result }: { result: MsProductResult | null }) {
  const view = describeAllergens(result)
  return (
    <div className="survey-card" style={{ marginBottom: 16 }}>
      <h3 className="survey-step-title" style={{ fontSize: 16 }}>알레르기</h3>
      <Body view={view} />
      <IncompleteNotice />
    </div>
  )
}
