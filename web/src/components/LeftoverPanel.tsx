import { useState } from 'react'
import {
  adjustSliderSingle, adjustPerFood, suggestPhotoAi, suggestPhotoAiHybrid, confirmPhotoAi, splitRatio, perFoodShares,
} from '../lib/mealLeftover'
import { MEAL_CMIN_ENABLED } from '../lib/flags'
import { track } from '../lib/events'
import type { MealSummary, MealFood } from '../lib/nutrilens'

/**
 * «먹은 양» 패널 — 식사 1건(meal_log id)에 남긴 양을 반영한다. MealHistory 에서 분리(식사 흐름 v2, 동작 동일).
 *   전체 %(Path A) · 음식별 %(per_food) · 식후 사진(Path B / C-min). 숫자는 서버 adjusted_summary 만(원칙5).
 *   order 'v1' = [전체 · 음식별 · 사진 추정] (기존) · 'v2' = [📷 식후 사진 · 전체 % · 음식별 %] (식후 사진 추천·맨 앞)
 */
export type LeftoverMode = 'all' | 'perfood' | 'photo'
export const MODES_V1: { key: LeftoverMode; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'perfood', label: '음식별' }, { key: 'photo', label: '사진 추정' },
]
export const MODES_V2: { key: LeftoverMode; label: string }[] = [
  { key: 'photo', label: '📷 식후 사진' }, { key: 'all', label: '전체 %' }, { key: 'perfood', label: '음식별 %' },
]

export default function LeftoverPanel(props: {
  mealId: string
  foods: MealFood[]
  /** 되돌리기 버튼 노출(보정이 살아 있음) */
  hasAdjustment: boolean
  initialPct?: number
  order?: 'v1' | 'v2'
  /** 제목 숨김(상위 카드가 이미 제목을 가질 때) */
  hideTitle?: boolean
  /** 처음 열 탭(없으면 순서의 첫 탭) */
  startMode?: LeftoverMode
  /** 인원을 상위 카드가 이미 물었으면 그 값(이때 패널 안 인원 선택은 숨김) — AfterSaveLeftover */
  people?: number
  onApplied: (adjusted: MealSummary) => void
}) {
  const { mealId, foods, hasAdjustment, order = 'v1', hideTitle, onApplied } = props
  const modes = order === 'v2' ? MODES_V2 : MODES_V1
  const [mode, setMode] = useState<LeftoverMode>(props.startMode ?? modes[0].key)
  const [pct, setPct] = useState<number>(props.initialPct ?? 100)
  const [peopleState, setPeople] = useState(1)
  const peopleControlled = typeof props.people === 'number' && props.people >= 1
  const people = peopleControlled ? Math.floor(props.people as number) : peopleState
  const [pcts, setPcts] = useState<number[]>(() => foods.map(() => 100))
  const [photoPreview, setPhotoPreview] = useState(false)
  const [note, setNote] = useState<string | undefined>()
  const [previewKcal, setPreviewKcal] = useState<number | undefined>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | undefined>()
  const perFoodAvail = foods.length >= 1

  async function run(fn: () => Promise<{ adjusted_summary: MealSummary }>, ev: Record<string, string>) {
    setBusy(true); setErr(undefined)
    try {
      const res = await fn()
      track('meal_leftover_apply', ev)
      setBusy(false); setPhotoPreview(false); setNote(undefined); setPreviewKcal(undefined)
      onApplied(res.adjusted_summary)
    } catch (e) {
      setBusy(false); setErr((e as Error).message)
    }
  }
  // 인원(÷N): v2 는 세 방식 공통(탭 위 1곳). v1 은 기존대로 «전체» 탭에서만 적용(음식별·사진은 1명 — 동작 불변).
  const sharePeople = order === 'v2' ? people : 1
  const applyRatio = (p: number) => { setPct(p); return run(() => adjustSliderSingle(mealId, splitRatio(p / 100, people)), { method: 'slider', mode: 'all' }) }
  const revert = () => { setPct(100); return run(() => adjustSliderSingle(mealId, 1), { method: 'slider', mode: 'all' }) }
  const applyPerFood = () => run(() => adjustPerFood(mealId, perFoodShares(foods, pcts, sharePeople)), { method: 'slider', mode: 'perfood' })
  const confirmPhoto = () => run(() => confirmPhotoAi(mealId, splitRatio(pct / 100, sharePeople)), { method: 'photo_ai', mode: 'photo' })

  async function onPickAfter(file: File) {
    setBusy(true); setErr(undefined)
    try {
      const sug = await (MEAL_CMIN_ENABLED ? suggestPhotoAiHybrid : suggestPhotoAi)(mealId, file)
      setPct(Math.round(sug.estimatedEatenRatio * 100))
      setNote(sug.suggestedNote)
      setPreviewKcal(sug.previewSummary ? Math.round(Number(sug.previewSummary.total_calories_kcal) || 0) : undefined)
      setPhotoPreview(true)
    } catch (e) {
      setPhotoPreview(false); setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  const photoHint = order === 'v2'
    ? (MEAL_CMIN_ENABLED ? '다 드신 뒤 남은 음식을 찍으면, 처음 찍은 사진(식전)과 비교해 먹은 양을 추정해요. 확인 후에만 저장돼요.' : '다 드신 뒤 남은 음식을 찍으면 AI가 먹은 양을 추정해요. 확인 후에만 저장돼요.')
    : '식후 남은 음식을 촬영하면 AI가 먹은 양을 추정해요. 확인 후에만 저장됩니다.'
  const btn = { width: '100%', minHeight: 44, padding: 'var(--space-2) var(--space-3)', fontSize: 13 } as const

  const peopleRow = (label: string) => (
    <div data-testid="people-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', margin: 'var(--space-1) 0' }}>
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <button type="button" className="btn btn-secondary" aria-label="인원 줄이기" disabled={busy} style={{ width: 'auto', minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 15 }} onClick={() => setPeople((p) => Math.max(1, p - 1))}>−</button>
        <strong style={{ color: 'var(--text)', minWidth: 34, textAlign: 'center' }}>{people}명</strong>
        <button type="button" className="btn btn-secondary" aria-label="인원 늘리기" disabled={busy} style={{ width: 'auto', minHeight: 40, padding: 'var(--space-1) var(--space-3)', fontSize: 15 }} onClick={() => setPeople((p) => Math.min(12, p + 1))}>+</button>
      </span>
    </div>
  )

  return (
    <div role="region" aria-label="먹은 양 조절" data-testid="leftover-panel"
      style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--border-light)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {!hideTitle && <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>먹은 양 조절</div>}

      {order === 'v2' && !peopleControlled && peopleRow('몇 명이 함께 드셨나요?')}
      {order === 'v2' && !peopleControlled && people > 1 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4 }}>먹은 양을 {people}명으로 나눠 내 몫만 기록해요.</div>
      )}

      <div role="tablist" aria-label="먹은 양 조절 방식"
        style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-1)', background: 'var(--border)', borderRadius: 'var(--radius-sm, 8px)' }}>
        {modes.map((m) => {
          const selected = mode === m.key
          const disabled = m.key === 'perfood' && !perFoodAvail
          return (
            <button key={m.key} type="button" role="tab" aria-selected={selected} disabled={disabled || busy}
              onClick={() => { setMode(m.key); setErr(undefined) }}
              style={{
                flex: 1, minHeight: 44, padding: '9px var(--space-2)', fontSize: 13,
                border: 'none', borderRadius: 'var(--radius-sm, 6px)', cursor: disabled ? 'not-allowed' : 'pointer',
                background: selected ? 'var(--bg-card)' : 'transparent',
                color: disabled ? 'var(--text-muted)' : selected ? 'var(--text)' : 'var(--text-secondary)',
                fontWeight: selected ? 700 : 500, boxShadow: selected ? 'var(--shadow-sm)' : 'none',
              }}>{m.label}</button>
          )
        })}
      </div>

      {mode === 'all' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>전체 먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
          </div>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ width: '100%' }} aria-label="전체 먹은 양 비율" />
          {order !== 'v2' && peopleRow('함께 먹은 인원')}
          <button type="button" className="btn btn-primary" disabled={busy} style={btn} onClick={() => applyRatio(pct)}>{busy ? '반영 중…' : '전체 반영'}</button>
        </>
      )}

      {mode === 'perfood' && (
        perFoodAvail ? (
          <>
            {foods.map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name_ko || `음식 ${i + 1}`}</span>
                  <strong style={{ color: 'var(--text)' }}>{pcts[i] ?? 100}%</strong>
                </div>
                <input type="range" min={0} max={100} step={5} value={pcts[i] ?? 100}
                  onChange={(e) => { const np = [...pcts]; np[i] = Number(e.target.value); setPcts(np) }}
                  style={{ width: '100%' }} aria-label={`${f.name_ko || `음식 ${i + 1}`} 먹은 양`} />
              </div>
            ))}
            <button type="button" className="btn btn-primary" disabled={busy} style={btn} onClick={applyPerFood}>{busy ? '반영 중…' : '음식별로 반영'}</button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>음식 항목이 없어 음식별 조절을 쓸 수 없어요. '전체'에서 조절해 주세요.</div>
        )
      )}

      {mode === 'photo' && (
        photoPreview ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              🤖 {note}
              {typeof previewKcal === 'number' && <><br />미리보기: 약 {previewKcal} kcal (저장 전{sharePeople > 1 ? ` · 식탁 전체 기준, 반영할 때 ${sharePeople}명으로 나눠요` : ''})</>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>먹은 양</span><strong style={{ color: 'var(--text)' }}>{pct}%</strong>
            </div>
            <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ width: '100%' }} aria-label="먹은 양 비율" />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className="btn btn-primary" disabled={busy} style={{ flex: 1, minHeight: 44, padding: 'var(--space-2) var(--space-3)', fontSize: 13 }} onClick={confirmPhoto}>{busy ? '저장 중…' : (order === 'v2' ? '이대로 반영' : '추정값 적용')}</button>
              <button type="button" className="btn btn-secondary" disabled={busy} style={{ width: 'auto', minHeight: 44, padding: 'var(--space-2) var(--space-3)', fontSize: 13 }} onClick={() => { setPhotoPreview(false); setNote(undefined); setPreviewKcal(undefined) }}>다시 찍기</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{photoHint}</div>
            <label className="btn btn-primary" style={{ ...btn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer' }}>
              {busy ? '분석 중…' : (order === 'v2' ? '📷 남긴 음식 찍기' : '식후 사진 찍기')}
              <input type="file" accept="image/*" capture="environment" disabled={busy} style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickAfter(f) }} />
            </label>
          </>
        )
      )}

      {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}

      {hasAdjustment && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-2)' }}>
          <button type="button" disabled={busy} onClick={revert}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 'var(--space-2) var(--space-1)', minHeight: 40 }}>↩ 마지막 보정 되돌리기</button>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        남긴 양을 반영하면 실제 섭취로 기록돼요. 여러 명이 나눠 먹었다면 인원을 설정하면 내 몫(먹은 양÷인원)으로 계산됩니다.
      </div>
    </div>
  )
}
