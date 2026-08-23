import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { AdditiveColor, AdditiveListView, AdditiveView } from '../domain/meokseon/additives'
import {
  SHOW_RISK_GRADE, UNKNOWN_COLOR_NOTE,
  FUNCTION_LABEL, FUNCTION_CAVEAT, FUNCTION_MISSING_CAVEAT,
  EVIDENCE_TOGGLE_LABEL, EVIDENCE_SOURCE_NOTE, ADDITIVE_COUNT_CAVEAT,
} from '../domain/meokseon/additives'

/**
 * 첨가물 개별 목록.
 *
 * 2026-08-14 신설. 그 전까지 화면은 「첨가물 7종 / 안전 5 · 허용 1 · 주의 1 · 위해 0」이라는
 * **개수만** 보여줬다. 제이의 지적: 「그 «주의 1» 이 무엇인지 알 방법이 없다.」
 * 서버는 이름·용도·IARC·ADI·점수를 처음부터 다 내려보내고 있었다. 화면만 안 썼다.
 *
 * ★ 판정은 여기 없다. 전부 `domain/meokseon/additives.ts` 의 순수 함수다.
 *   이 파일은 «그리기»만 한다 (선례: `AllergenCard.tsx` + `domain/meokseon/allergens.ts`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ★★★★ 2026-08-23 외부검토 — 화면이 **두 벌**이 됐다. `SHOW_RISK_GRADE` 가 가른다.
 *
 *   OFF (지금) — 등급을 «표시하지» 않는다. 사실만 남긴다.
 *       이름 → 일반적 용도 → (접힌) 기관 평가 정보   ← identity → function → evidence
 *       · 색·등급 라벨·점수 없음. 목록은 이름 가나다순 한 벌(펼침/접기 없음).
 *       · IARC 는 «접힌 상세» 안에만 있다. 기본 줄에 두면 IARC 가 98.6% 비어 있는 탓에
 *         그것이 붙은 9종이 **사실상 새 빨간 배지**가 된다.
 *
 *   ON (재구축 후) — 종전 화면 그대로. 아래 `GradeSections` 가 그 코드다. 지우지 말 것.
 *
 * ★ IARC·ADI 를 «숫자만» 내지 않는 원칙은 **강등된 상세 안에서도 그대로**다.
 *   아스파탐 IARC 2B 는 알로에베라와 같은 칸인데, 「2B」만 보면 1군(석면)과 구분되지 않는다.
 *   ⇒ `Fact` 는 언제나 label 과 note 를 «같이» 그린다. 툴팁으로 숨기지 않는다.
 * ────────────────────────────────────────────────────────────────────────────
 */

const COLOR_HEX: Record<AdditiveColor, string> = {
  green: '#4a9e3f',
  yellow: '#f59e0b',
  orange: '#ea580c',
  red: '#ef4444',
  unknown: '#6b7280',   // 회색 — 「판정 없음」이지 「안전」이 아니다
}

const NOTE: CSSProperties = { fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)' }

/** 근거 한 줄 — 「제목: 값」 + 그 아래 «의미» 설명. 설명은 접지 않는다. */
function Fact({ term, label, note }: { term: string; label: string; note: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{term}</span>{' '}
        <strong style={{ fontWeight: 600 }}>{label}</strong>
      </div>
      <div style={NOTE}>{note}</div>
    </div>
  )
}

/**
 * 접힌 「기관 평가 정보」. IARC·ADI 는 여기 «안에만» 있다(A4 강등).
 * ⚠ 삭제가 아니라 강등이다 — 열면 종전과 같은 수치+설명이 그대로 나온다.
 */
function Evidence({ item }: { item: AdditiveView }) {
  return (
    <details style={{ marginTop: 6 }}>
      <summary style={{ fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        {EVIDENCE_TOGGLE_LABEL}
      </summary>
      <div style={{ paddingLeft: 2 }}>
        {/* identity 보조 — 국제번호. ⚠ E-number 가 아니라 INS 다(A3). */}
        {item.ins && (
          <div style={{ ...NOTE, marginTop: 6 }}>식품첨가물 국제번호 <strong>{item.ins}</strong></div>
        )}
        {item.iarc && <Fact term="국제암연구소(IARC)" label={item.iarc.label} note={item.iarc.note} />}
        <Fact term="하루 섭취 허용량" label={item.adi.label} note={item.adi.note} />
      </div>
    </details>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * 1. 등급 표시 OFF — 지금 사용자가 보는 화면
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 사실만 남은 한 줄.
 *   이름 → 일반적 용도 → (접힌) 기관 평가 정보.
 *
 * ⚠ 용도 결측도 «같은 모양»으로 그린다. 경고 색·아이콘을 쓰지 않는다 —
 *   결측을 붉게 칠하면 「이 첨가물이 문제」로 읽힌다. 그건 사실이 아니다(A8).
 */
function PlainItem({ item }: { item: AdditiveView }) {
  return (
    <li
      style={{
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        padding: '9px 11px',
        listStyle: 'none',
      }}
    >
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
      <div
        style={{
          fontSize: 12.5,
          marginTop: 3,
          color: item.functionKnown ? 'var(--text-secondary)' : 'var(--text-muted)',
        }}
      >
        {FUNCTION_LABEL}: {item.functionText}
      </div>
      <Evidence item={item} />
    </li>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2. 등급 표시 ON — 재구축 후 되살릴 화면. **지우지 말 것.**
 *    되살리는 법: `domain/meokseon/additives.ts` 의 `SHOW_RISK_GRADE` 를 true 로.
 * ────────────────────────────────────────────────────────────────────────── */

function GradedItem({ item }: { item: AdditiveView }) {
  const hex = COLOR_HEX[item.color]
  return (
    <li
      style={{
        borderLeft: `3px solid ${hex}`,
        background: `${hex}0d`,
        borderRadius: 8,
        padding: '9px 11px',
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14.5, color: 'var(--text)' }}>{item.name}</strong>
        <span style={{ fontSize: 12, fontWeight: 600, color: hex }}>{item.colorLabel}</span>
        {/* 기능이 결측이어도 빈칸을 두지 않는다 — 「현재 정보 없음」이라고 말한다. */}
        <span style={{ fontSize: 12.5, color: item.functionKnown ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {item.functionText}
        </span>
        {item.score !== null && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            위해성 {item.score} / 10 <span style={{ opacity: 0.8 }}>(높을수록 주의)</span>
          </span>
        )}
      </div>

      {/* 등급이 없는 첨가물은 침묵하면 「안전」으로 읽힌다. 반드시 말한다. */}
      {item.color === 'unknown' && <div style={{ ...NOTE, marginTop: 5 }}>{UNKNOWN_COLOR_NOTE}</div>}

      {/* ★ 근거는 주황·빨강·등급미상에서만 편다. 초록·노랑까지 다 펴면 소음이 되고,
          소음이 흔해지면 진짜 경고를 넘긴다(알레르기 축에서 배운 alarm fatigue). */}
      {item.alert && (
        <>
          {item.iarc && <Fact term="국제암연구소(IARC)" label={item.iarc.label} note={item.iarc.note} />}
          <Fact term="하루 섭취 허용량" label={item.adi.label} note={item.adi.note} />
        </>
      )}
    </li>
  )
}

function List({ items }: { items: AdditiveView[] }) {
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 7, listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((it) => <GradedItem key={it.key} item={it} />)}
    </ul>
  )
}

/** 종전(등급 ON) 화면 — 주황·빨강은 펼치고 초록·노랑은 접는다. */
function GradeSections({ view }: { view: AdditiveListView }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {view.alerts.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            주의해서 볼 첨가물 {view.alerts.length}종
          </div>
          <List items={view.alerts} />
        </>
      )}

      {view.calm.length > 0 && (
        <div style={{ marginTop: view.alerts.length ? 10 : 0 }}>
          {/* 개수는 «접혀 있어도» 보인다 — 「7종인데 왜 3개만?」을 만들지 않기 위해서다. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 13, color: 'var(--text-secondary)', textAlign: 'left',
            }}
          >
            {open ? '▾' : '▸'} 안전·허용으로 평가된 첨가물 {view.calm.length}종 {open ? '접기' : '보기'}
          </button>
          {open && <div style={{ marginTop: 7 }}><List items={view.calm} /></div>}
        </div>
      )}
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

export default function AdditiveList({ view }: { view: AdditiveListView }) {
  if (view.total === 0) return null

  return (
    <div style={{ marginTop: 14 }}>
      {SHOW_RISK_GRADE ? (
        <GradeSections view={view} />
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 7, listStyle: 'none', margin: 0, padding: 0 }}>
          {view.items.map((it) => <PlainItem key={it.key} item={it} />)}
        </ul>
      )}

      {/* ★ 「N개」라 써 놓고 목록이 그보다 짧으면 그 차이를 말한다. 조용히 지우지 않는다. */}
      {view.unlisted > 0 && (
        <p style={{ ...NOTE, marginTop: 10 }}>
          {view.unlisted}종은 상세 정보를 불러오지 못했어요. 화면에 보이는 목록이 전부가 아니에요.
        </p>
      )}

      {SHOW_RISK_GRADE ? (
        <p style={{ ...NOTE, marginTop: 10 }}>
          위해성 등급·근거는 먹선 위해성 평가(MFRAS) 기준이며, 국제기구(JECFA·EFSA·IARC) 공개 자료를 바탕으로 해요.
          진단이나 의학적 조언이 아니라 생활관리 참고 정보예요.
        </p>
      ) : (
        // 각주는 «섹션 끝에 한 번». 행마다 붙이면 그 자체가 경고가 된다(A7·A8).
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={NOTE}>{ADDITIVE_COUNT_CAVEAT}</p>
          <p style={NOTE}>{FUNCTION_CAVEAT}</p>
          <p style={NOTE}>{FUNCTION_MISSING_CAVEAT}</p>
          <p style={NOTE}>{EVIDENCE_SOURCE_NOTE}</p>
        </div>
      )}
    </div>
  )
}
