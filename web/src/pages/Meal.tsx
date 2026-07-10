import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  reencodeImage, analyzeMeal, saveMeal, genMealId, defaultMealSlot, nutrilensConfigured,
  type AnalyzeResult,
} from '../lib/nutrilens'
import MealHistory from '../components/MealHistory'
import MealResult from '../components/MealResult'
import MealConsentGate from '../components/MealConsentGate'
import { hasConsentedMeal } from '../lib/mealConsent'
import {
  openMealSession, closeMealSession, getCurrentOpenSession,
  type SessionSummary,
} from '../lib/mealSession'
import { sessionBadgeText } from '../lib/session_math'
import { adjustSliderSession } from '../lib/mealLeftover'

// NutriLens 사진 식사기록 — 사진 한 장 → 분석(칼로리·영양) → 저장. 로그인 필요(Edge JWT).
//   사진은 촬영/갤러리 지원(재인코딩으로 EXIF 제거·축소). 결과는 추정치. 근거 IP: 66~75.

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export default function Meal() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [consented, setConsented] = useState<boolean>(hasConsentedMeal())
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [slot, setSlot] = useState<Slot>(defaultMealSlot())
  const [saved, setSaved] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [session, setSession] = useState<SessionSummary | null>(null)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [closed, setClosed] = useState<{ sessionId: string; plateCount: number; kcal: number } | null>(null)
  const [closedRatio, setClosedRatio] = useState(100)
  const [closedBusy, setClosedBusy] = useState(false)
  const [closedErr, setClosedErr] = useState<string | null>(null)
  const [closedResultKcal, setClosedResultKcal] = useState<number | null>(null)

  const blobRef = useRef<Blob | null>(null)
  const shaRef = useRef<string | null>(null)
  const mealIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))
  }, [])

  useEffect(() => {
    if (authed && consented) getCurrentOpenSession().then(setSession).catch(() => {})
  }, [authed, consented])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function reset() {
    setError(null); setResult(null); setSaved(false); setWaiting(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    blobRef.current = null; shaRef.current = null; mealIdRef.current = null
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    setBusy(true)
    try {
      const blob = await reencodeImage(file)
      blobRef.current = blob
      setPreviewUrl(URL.createObjectURL(blob))
      const mealId = genMealId()
      mealIdRef.current = mealId
      const state = await analyzeMeal(blob, mealId, { onWait: () => setWaiting(true) })
      setWaiting(false)
      if (state.status === 'done' && state.result) {
        shaRef.current = state.photo_sha256 ?? null
        setResult(state.result)
      } else {
        setError(state.errorMessage || '분석에 실패했어요. 다른 사진으로 다시 시도해 주세요.')
      }
    } catch (err) {
      setError((err as Error).message || '분석 중 오류가 발생했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function onSave() {
    if (!result || !blobRef.current || !shaRef.current || !mealIdRef.current) return
    setBusy(true)
    try {
      const r = await saveMeal({
        blob: blobRef.current, result, photo_sha256: shaRef.current,
        clientMealId: mealIdRef.current, mealSlot: slot,
        mealSessionId: session?.session_id,
      })
      if (r.ok) { setSaved(true); setHistoryKey((k) => k + 1); if (session) await refreshSession() }
      else setError(r.error || '저장에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshSession() {
    const s = await getCurrentOpenSession().catch(() => null)
    setSession(s)
  }
  async function startSession() {
    setSessionBusy(true); setToast(null); setError(null)
    try {
      const r = await openMealSession(slot)
      if (r.auto_closed) setToast('이전 정찬이 자동 종료되었어요.')
      await refreshSession()
    } catch (e) {
      setError((e as Error).message)
    } finally { setSessionBusy(false) }
  }
  async function endSession() {
    if (!session) return
    const snap = { sessionId: session.session_id, plateCount: session.plate_count, kcal: Math.round(session.total_calories_kcal || 0) }
    setSessionBusy(true); setError(null)
    try {
      await closeMealSession(session.session_id)
      setSession(null)
      setToast(null)
      setClosed(snap); setClosedRatio(100); setClosedErr(null); setClosedResultKcal(null)
    } catch (e) {
      setError((e as Error).message)
    } finally { setSessionBusy(false) }
  }

  async function applySessionLeftover() {
    if (!closed) return
    setClosedBusy(true); setClosedErr(null)
    try {
      const res = await adjustSliderSession(closed.sessionId, closedRatio / 100)
      setClosedResultKcal(Math.round(Number(res.adjusted_summary.total_calories_kcal) || 0))
      setHistoryKey((k) => k + 1)
    } catch (e) {
      setClosedErr((e as Error).message)
    } finally { setClosedBusy(false) }
  }

  if (!nutrilensConfigured()) {
    return (
      <div className="survey-container fade-in"><div className="survey-card">
        <h2 className="survey-step-title">식사 기록</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>식사 분석 서비스 설정이 필요합니다.</p>
      </div></div>
    )
  }

  if (authed === false) {
    return (
      <div className="survey-container fade-in"><div className="survey-card">
        <h2 className="survey-step-title">사진으로 식사 기록</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
          식사 사진을 찍으면 칼로리·영양을 분석해 내 건강 그래프에 쌓아드려요. 기록을 저장하려면 로그인이 필요해요.
        </p>
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
          로그인하고 시작하기
        </button>
      </div></div>
    )
  }

  if (authed === null) {
    return <div className="survey-container fade-in" />
  }

  if (!consented) {
    return (
      <MealConsentGate
        onAccept={() => setConsented(true)}
        onDecline={() => navigate('/')}
      />
    )
  }

  return (
    <div className="survey-container fade-in">
      {toast && (
        <div className="survey-card" style={{ marginBottom: 12, background: 'rgba(142,202,230,0.10)', border: '1px solid rgba(142,202,230,0.30)', fontSize: 13, color: 'var(--text)', padding: '10px 14px' }}>
          {toast}
        </div>
      )}

      {closed && !result && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🍱 정찬 종료됨 · {closed.plateCount}개 접시 · 합계 {closed.kcal} kcal</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 10px' }}>정찬 전체에서 남긴 양이 있으면 반영해 실제 섭취로 기록해요.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>먹은 양</span><strong style={{ color: 'var(--text)' }}>{closedRatio}%</strong>
          </div>
          <input type="range" min={0} max={100} step={5} value={closedRatio}
            onChange={(e) => setClosedRatio(Number(e.target.value))} style={{ width: '100%' }} aria-label="정찬 전체 먹은 양" />
          {closedResultKcal != null && (
            <div style={{ fontSize: 13, color: 'var(--text)', margin: '6px 0' }}>✅ 실제 섭취 약 {closedResultKcal} kcal로 반영됐어요.</div>
          )}
          {closedErr && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{closedErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" disabled={closedBusy} style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} onClick={applySessionLeftover}>{closedBusy ? '반영 중…' : '남긴 양 반영'}</button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }} onClick={() => setClosed(null)}>닫기</button>
          </div>
        </div>
      )}

      {!result && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🍱 {sessionBadgeText(session.plate_count, session.total_calories_kcal)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>사진을 계속 찍으면 이 정찬에 접시가 쌓여요.</div>
              </div>
              <button type="button" className="btn btn-secondary" disabled={sessionBusy} style={{ width: 'auto', padding: '8px 14px', flexShrink: 0 }} onClick={endSession}>정찬 종료</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🍱 정찬 모드</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>한 끼에 여러 접시를 한 세션으로 묶어 기록해요.</div>
              </div>
              <button type="button" className="btn btn-primary" disabled={sessionBusy} style={{ width: 'auto', padding: '8px 14px', flexShrink: 0 }} onClick={startSession}>정찬 시작</button>
            </div>
          )}
        </div>
      )}

      {!result && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <h2 className="survey-step-title">사진으로 식사 기록</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
            먹은 음식을 찍으면 칼로리·영양을 추정해 드려요. (사진 기준 추정치예요.)
          </p>

          {previewUrl && (
            <img src={previewUrl} alt="선택한 식사 사진" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />
          )}

          {busy || waiting ? (
            <div style={{ textAlign: 'center', padding: '18px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {waiting ? '분석 중이에요… (조금 걸릴 수 있어요)' : '사진은 준비하고 있어요…'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <label className="btn btn-primary" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                📷 촬영
                <input type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
              </label>
              <label className="btn btn-secondary" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                🖼️ 갤러리
                <input type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
              </label>
            </div>
          )}
        </div>
      )}

      {!result && <MealHistory reloadKey={historyKey} />}

      {error && (
        <div className="survey-card" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={reset}>다시 시도</button>
        </div>
      )}

      {result && (
        <MealResult
          result={result} previewUrl={previewUrl} slot={slot} onSlot={setSlot}
          saved={saved} busy={busy} onSave={onSave} onReset={reset}
        />
      )}
    </div>
  )
}
