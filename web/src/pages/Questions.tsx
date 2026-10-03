import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Step, SurveyAnswers } from '../types'
import ProgressBar from '../components/ProgressBar'
import { GOAL_OPTIONS, surveySteps } from '../domain/goals/goals'
import { SYMPTOM_GROUPS } from '../domain/survey/symptoms'

interface Props {
  step: Step
  answers: SurveyAnswers
  onUpdate: (patch: Partial<SurveyAnswers>) => void
  onNext: (step: Step) => void
  onBack: (step: Step) => void
  onSubmit: () => void
  /** Phase G(D2): 로그인 + 식사 기록 ON 이면 목표 단계를 건너뛴다 — 목표는 식사 기록에서 관리. */
  skipGoals?: boolean
}

function WhyTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="why-tooltip-wrap">
      <button className="why-tooltip-btn" onClick={() => setOpen(!open)}>
        💡 왜 이 질문을 하나요?
      </button>
      {open && <div className="why-tooltip-content">{text}</div>}
    </div>
  )
}

const STEP_LABELS: Record<string, string> = {
  body: '기본 정보', symptoms: '증상 체크', goals: '건강 목표', sleep: '수면', stress: '스트레스',
  exercise: '운동', diet: '식습관', alcohol: '음주/흡연', supplements: '영양제', conditions: '건강 상태',
}


/* ── 증상 데이터 (백엔드 meta API에서도 가져올 수 있음) ── */

// GOAL_OPTIONS 는 domain/goals/goals.ts 로 이동 (식사 기록 목표 카드와 공용)

const CONDITIONS_LIST = [
  '고혈압', '당뇨', '고지혈증', '간질환', '신장질환', '갑상선질환',
  '자가면역질환', '위식도역류', '골다공증', '우울증_불안장애',
  '비만_대사증후군', '전립선비대', '갱년기증후군',
]

const FAMILY_HISTORY_LIST = [
  '당뇨', '고혈압', '고지혈증', '심장질환', '골다공증', '암', '치매',
]


export default function Questions({ step, answers, onUpdate, onNext, onBack, onSubmit, skipGoals = false }: Props) {
  const STEPS = surveySteps(skipGoals)
  const idx = STEPS.indexOf(step) + 1
  const next = (from: Step): Step => STEPS[STEPS.indexOf(from) + 1]
  const navigate = useNavigate()

  return (
    <div className="survey-container fade-in">
      <div className="survey-nav-row">
        <button className="survey-back-btn" onClick={() => {
          const prevIdx = STEPS.indexOf(step) - 1
          if (prevIdx < 0) navigate('/')
          else onBack(STEPS[prevIdx])
        }}>
          ← {STEPS.indexOf(step) === 0 ? '홈으로' : '이전'}
        </button>
        <span className="survey-time-hint">약 3분 소요</span>
      </div>

      <ProgressBar current={idx} total={STEPS.length} labels={STEPS.map((s) => STEP_LABELS[s])} />

      {step === 'body' && <StepBody answers={answers} onUpdate={onUpdate} onNext={() => onNext('symptoms')} />}
      {step === 'symptoms' && <StepSymptoms answers={answers} onUpdate={onUpdate} onNext={() => onNext(next('symptoms'))} />}
      {step === 'goals' && <StepGoals answers={answers} onUpdate={onUpdate} onNext={() => onNext('sleep')} />}
      {step === 'sleep' && <StepSleep answers={answers} onUpdate={onUpdate} onNext={() => onNext('stress')} />}
      {step === 'stress' && <StepStress answers={answers} onUpdate={onUpdate} onNext={() => onNext('exercise')} />}
      {step === 'exercise' && <StepExercise answers={answers} onUpdate={onUpdate} onNext={() => onNext('diet')} />}
      {step === 'diet' && <StepDiet answers={answers} onUpdate={onUpdate} onNext={() => onNext('alcohol')} />}
      {step === 'alcohol' && <StepAlcohol answers={answers} onUpdate={onUpdate} onNext={() => onNext('supplements')} />}
      {step === 'supplements' && <StepSupplements answers={answers} onUpdate={onUpdate} onNext={() => onNext('conditions')} />}
      {step === 'conditions' && <StepConditions answers={answers} onUpdate={onUpdate} onSubmit={onSubmit} />}
    </div>
  )
}


/* ── Q1: 기본 정보 ── */
function StepBody({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const [heightText, setHeightText] = useState(String(answers.신장 || ''))
  const [weightText, setWeightText] = useState(String(answers.체중 || ''))

  const handleHeight = (val: string) => {
    setHeightText(val)
    const num = parseFloat(val)
    if (!isNaN(num)) onUpdate({ 신장: num })
  }

  const handleWeight = (val: string) => {
    setWeightText(val)
    const num = parseFloat(val)
    if (!isNaN(num)) onUpdate({ 체중: num })
  }

  return (
    <div className="survey-card">
      <h2 className="section-title">기본 신체 정보를 알려주세요</h2>
      <p className="section-subtitle">기초대사량과 일일 에너지 소비량을 계산해요</p>
      <WhyTooltip text="키, 체중, 나이를 기반으로 기초대사량(BMR)과 일일 에너지 소비량(TDEE)을 계산해요. 이 수치가 단백질 목표량과 영양소 필요량의 기준이 됩니다." />

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        {['male', 'female'].map(g => (
          <div key={g} className={`radio-card ${answers.성별 === g ? 'selected' : ''}`}
            onClick={() => onUpdate({ 성별: g })} style={{ flex: 1 }}>
            <div className="radio-dot" />
            <span>{g === 'male' ? '남성 👨' : '여성 👩'}</span>
          </div>
        ))}
      </div>

      <div className="input-group">
        <label>나이</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input type="range" min={10} max={90} value={answers.나이}
            onChange={e => onUpdate({ 나이: +e.target.value })} style={{ flex: 1 }} />
          <span style={{ fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{answers.나이}세</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label>키 (cm)</label>
          <input type="number" className="input-field" value={heightText}
            onChange={e => handleHeight(e.target.value)}
            onBlur={() => { if (!heightText) { setHeightText('170'); onUpdate({ 신장: 170 }); } }} />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label>몸무게 (kg)</label>
          <input type="number" className="input-field" step="0.1" value={weightText}
            onChange={e => handleWeight(e.target.value)}
            onBlur={() => { if (!weightText) { setWeightText('65'); onUpdate({ 체중: 65 }); } }} />
        </div>
      </div>

      <div className="input-group">
        <label>최근 체중 변화</label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[['변화없음', '변화 없음'], ['증가', '📈 증가'], ['감소', '📉 감소']].map(([val, label]) => (
            <div key={val} className={`radio-card ${answers.체중변화 === val ? 'selected' : ''}`}
              onClick={() => onUpdate({ 체중변화: val })} style={{ flex: 1, minWidth: 100 }}>
              <div className="radio-dot" />
              <span style={{ fontSize: 14 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {answers.성별 === 'female' && (
        <div className="input-group">
          <label>월경 상태</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {[['정상', '정상'], ['불규칙', '불규칙'], ['폐경', '폐경']].map(([val, label]) => (
              <div key={val} className={`radio-card ${answers.월경상태 === val ? 'selected' : ''}`}
                onClick={() => onUpdate({ 월경상태: val })} style={{ flex: 1 }}>
                <div className="radio-dot" />
                <span style={{ fontSize: 14 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-4)' }}>
        다음 →
      </button>
    </div>
  )
}


/* ── Q2: 증상 체크 ── */
function StepSymptoms({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const toggle = (id: string) => {
    const prev = answers.증상
    onUpdate({ 증상: prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id] })
  }

  return (
    <div className="survey-card">
      <h2 className="section-title">요즘 이런 증상이 있나요?</h2>
      <p className="section-subtitle">해당되는 증상을 모두 선택해 주세요. 없으면 그냥 넘어가도 돼요.</p>
      <WhyTooltip text="선택하신 증상에 따라 14개 건강 카테고리의 필요도 점수가 계산됩니다. 점수가 높은 카테고리와 관련된 영양제가 우선 추천돼요." />

      {SYMPTOM_GROUPS.map(group => (
        <div key={group.group} style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            {group.group}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {group.symptoms.map(s => (
              <div key={s.id} className={`check-card ${answers.증상.includes(s.id) ? 'selected' : ''}`}
                onClick={() => toggle(s.id)}>
                <div className="check-icon">✓</div>
                <span className="check-text">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-4)' }}>
        다음 → {answers.증상.length > 0 && `(${answers.증상.length}개 선택)`}
      </button>
    </div>
  )
}


/* ── Q3: 건강 목표 ── */
function StepGoals({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const toggle = (id: string) => {
    const prev = answers.목표
    onUpdate({ 목표: prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id] })
  }

  return (
    <div className="survey-card">
      <h2 className="section-title">가장 신경 쓰이는 건 뭐예요?</h2>
      <p className="section-subtitle">목표에 따라 핵심 추천 영양소가 달라집니다. 여러 개 선택 가능해요.</p>
      <WhyTooltip text="목표에 가중치를 부여해서 관련 영양소의 추천 우선순위가 올라갑니다. 여러 개 선택하면 교집합에 해당하는 영양소가 더 높은 점수를 받아요." />

      <div className="grid-2">
        {GOAL_OPTIONS.map(g => (
          <div key={g.id} className={`check-card ${answers.목표.includes(g.id) ? 'selected' : ''}`}
            onClick={() => toggle(g.id)}>
            <div className="check-icon">✓</div>
            <span className="check-text">{g.emoji} {g.label}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext}
        disabled={answers.목표.length === 0} style={{ marginTop: 'var(--space-5)' }}>
        다음 → {answers.목표.length > 0 && `(${answers.목표.length}개 선택)`}
      </button>
    </div>
  )
}


/* ── Q4: 수면 ── */
function StepSleep({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const options = [
    { value: '괜찮음', label: '😌 잘 자고 있어요' },
    { value: '잠들기_어려움', label: '😫 잠들기까지 한참 걸려요' },
    { value: '중간에_자꾸_깸', label: '😵 중간에 자꾸 깨요' },
    { value: '자도_피곤함', label: '🥱 자도 자도 피곤해요' },
  ]

  return (
    <div className="survey-card">
      <h2 className="section-title">평소 수면 패턴이 어때요?</h2>
      <p className="section-subtitle">수면 패턴은 마그네슘·GABA 등 추천 여부에 직결됩니다.</p>
      <WhyTooltip text="수면 패턴은 마그네슘, GABA, 테아닌 등 수면 관련 영양소의 추천 여부를 결정하는 핵심 지표입니다." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {options.map(o => (
          <div key={o.value} className={`radio-card ${answers.수면 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 수면: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-5)' }}>다음 →</button>
    </div>
  )
}


/* ── Q5: 스트레스 ── */
function StepStress({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const options = [
    { value: '거의_없음', label: '😌 거의 없어요' },
    { value: '가끔', label: '😐 가끔 있어요 — 일상적인 수준이에요' },
    { value: '자주', label: '😤 자주 있어요 — 꽤 힘든 날이 많아요' },
    { value: '항상_폭발_직전', label: '🤯 항상 폭발 직전이에요' },
  ]

  return (
    <div className="survey-card">
      <h2 className="section-title">스트레스 수준이 어느 정도예요?</h2>
      <p className="section-subtitle">스트레스 수준은 비타민B·마그네슘 필요도를 결정합니다.</p>
      <WhyTooltip text="만성 스트레스는 비타민B군과 마그네슘의 소모를 크게 높여요. 스트레스 수준에 따라 추천 용량도 달라집니다." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {options.map(o => (
          <div key={o.value} className={`radio-card ${answers.스트레스 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 스트레스: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-5)' }}>다음 →</button>
    </div>
  )
}


/* ── Q6: 운동 ── */
function StepExercise({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const freqOptions = [
    { value: '거의_안함', label: '🛋️ 거의 안 해요 (주 1회 미만)' },
    { value: '주1-2회', label: '🚶 주 1~2회 정도 해요' },
    { value: '주3-4회', label: '🏃 주 3~4회 꾸준히 해요' },
    { value: '거의_매일', label: '💪 거의 매일 해요' },
  ]
  const sunOptions = [
    { value: '충분', label: '☀️ 하루 30분 이상 야외 활동' },
    { value: '부족', label: '🏢 주로 실내 (출퇴근 시 짧은 노출)' },
    { value: '매우_부족', label: '🌙 거의 실내 (재택·야간·지하)' },
  ]

  return (
    <div className="survey-card">
      <h2 className="section-title">운동 패턴을 알려주세요</h2>
      <p className="section-subtitle">운동 강도와 일조량은 비타민D·코엔자임Q10 필요도에 영향을 줍니다.</p>
      <WhyTooltip text="운동 강도는 코엔자임Q10, BCAA 등의 필요도를 높이고, 일조량 부족은 비타민D 보충 필요성을 결정합니다." />

      <div style={{ fontWeight: 500, marginBottom: 'var(--space-2)', fontSize: 14 }}>운동 빈도</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
        {freqOptions.map(o => (
          <div key={o.value} className={`radio-card ${answers.운동 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 운동: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 500, marginBottom: 'var(--space-2)', fontSize: 14 }}>일조량 / 실외 활동</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {sunOptions.map(o => (
          <div key={o.value} className={`radio-card ${answers.일조량 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 일조량: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-5)' }}>다음 →</button>
    </div>
  )
}


/* ── Q7: 식습관 ── */
function StepDiet({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const options = [
    { value: '규칙적', label: '🍽️ 하루 세끼 규칙적으로 먹어요' },
    { value: '불규칙', label: '⏰ 불규칙해요 (자주 건너뜀)' },
    { value: '야식_잦음', label: '🌙 야식을 자주 먹어요' },
    { value: '간헐적단식', label: '⏳ 간헐적 단식 중이에요' },
  ]

  return (
    <div className="survey-card">
      <h2 className="section-title">식사 패턴이 어때요?</h2>
      <p className="section-subtitle">식습관에 따라 특정 영양소 결핍 가능성이 달라져요.</p>
      <WhyTooltip text="불규칙한 식사나 편식은 특정 영양소 결핍 위험을 높여요. 식사 패턴에 맞는 보충 전략을 세울 수 있습니다." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {options.map(o => (
          <div key={o.value} className={`radio-card ${answers.식사패턴 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 식사패턴: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-5)' }}>다음 →</button>
    </div>
  )
}


/* ── Q8: 알코올/흡연 ── */
function StepAlcohol({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const drinkOptions = [
    { value: '거의_안함', label: '🚫 거의 안 마셔요' },
    { value: '주1-2회', label: '🍺 주 1~2회' },
    { value: '주3-4회', label: '🍷 주 3~4회' },
    { value: '매일', label: '🥃 거의 매일' },
  ]
  const smokeOptions = [
    { value: '비흡연', label: '🚭 비흡연' },
    { value: '과거흡연', label: '🔄 과거 흡연 (현재 금연)' },
    { value: '현재흡연', label: '🚬 현재 흡연' },
  ]

  return (
    <div className="survey-card">
      <h2 className="section-title">음주와 흡연 습관을 알려주세요</h2>
      <p className="section-subtitle">알코올과 흡연은 비타민B·C 소모량을 크게 높여요.</p>
      <WhyTooltip text="음주는 비타민B1, 엽산, 마그네슘 흡수를 방해하고, 흡연은 비타민C 소모를 2배 이상 높입니다." />

      <div style={{ fontWeight: 500, marginBottom: 'var(--space-2)', fontSize: 14 }}>음주 빈도</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
        {drinkOptions.map(o => (
          <div key={o.value} className={`radio-card ${answers.음주 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 음주: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 500, marginBottom: 'var(--space-2)', fontSize: 14 }}>흡연 여부</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {smokeOptions.map(o => (
          <div key={o.value} className={`radio-card ${answers.흡연 === o.value ? 'selected' : ''}`}
            onClick={() => onUpdate({ 흡연: o.value })}>
            <div className="radio-dot" />
            <span>{o.label}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-5)' }}>다음 →</button>
    </div>
  )
}


/* ── Q9: 현재 영양제 ── */
function StepSupplements({ answers, onUpdate, onNext }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onNext: () => void }) {
  const [noneSelected, setNoneSelected] = useState(false)
  const suppOptions = [
    { label: '종합비타민', ids: ['multivitamin'] },
    { label: '비타민D', ids: ['vitamin_d'] },
    { label: '오메가3', ids: ['omega3'] },
    { label: '유산균', ids: ['probiotics'] },
    { label: '마그네슘', ids: ['magnesium'] },
    { label: '비타민C', ids: ['vitamin_c'] },
    { label: '칼슘', ids: ['calcium'] },
    { label: '철분', ids: ['iron'] },
    { label: '콜라겐', ids: ['collagen'] },
    { label: '루테인', ids: ['lutein'] },
    { label: '밀크시슬', ids: ['milk_thistle'] },
    { label: '코엔자임Q10', ids: ['coq10'] },
  ]

  const toggle = (ids: string[]) => {
    setNoneSelected(false)
    const prev = new Set(answers.현재복용영양제)
    ids.forEach(id => prev.has(id) ? prev.delete(id) : prev.add(id))
    onUpdate({ 현재복용영양제: [...prev] })
  }

  return (
    <div className="survey-card">
      <h2 className="section-title">현재 드시고 있는 영양제가 있나요?</h2>
      <p className="section-subtitle">중복 복용·과잉 섭취를 방지하고 시너지 나는 성분을 추천해 드려요.</p>
      <WhyTooltip text="이미 드시고 있는 영양제를 파악해야 중복 복용이나 지용성 비타민 과잉 섭취를 방지할 수 있어요." />

      <div className="alert alert-warning">⚠️ 지용성 비타민을 이미 드시고 있다면 추가 보충 시 과잉 섭취 위험이 있어요.</div>

      <div className="grid-2">
        {suppOptions.map(s => (
          <div key={s.label}
            className={`check-card ${s.ids.some(id => answers.현재복용영양제.includes(id)) ? 'selected' : ''}`}
            onClick={() => toggle(s.ids)}>
            <div className="check-icon">✓</div>
            <span className="check-text">{s.label}</span>
          </div>
        ))}
      </div>

      <div className={`check-card ${noneSelected ? 'selected' : ''}`}
        onClick={() => { setNoneSelected(!noneSelected); onUpdate({ 현재복용영양제: [] }) }}
        style={{ marginTop: 'var(--space-3)' }}>
        <div className="check-icon">✓</div>
        <span className="check-text">❌ 현재 복용 중인 영양제 없음</span>
      </div>

      <button className="btn btn-primary" onClick={onNext} style={{ marginTop: 'var(--space-5)' }}>다음 →</button>
    </div>
  )
}


/* ── Q10: 질환 + 가족력 (마지막) ── */
function StepConditions({ answers, onUpdate, onSubmit }: { answers: SurveyAnswers; onUpdate: (p: Partial<SurveyAnswers>) => void; onSubmit: () => void }) {
  const toggleCondition = (c: string) => {
    const prev = answers.기저질환
    onUpdate({ 기저질환: prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c] })
  }
  const toggleFamily = (f: string) => {
    const prev = answers.가족력
    onUpdate({ 가족력: prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f] })
  }

  return (
    <div className="survey-card">
      <h2 className="section-title">건강 상태를 알려주세요</h2>
      <p className="section-subtitle">안전한 추천을 위해 현재 질환과 가족력을 확인합니다.</p>
      <WhyTooltip text="기저질환에 따라 특정 영양소가 금기이거나 주의가 필요할 수 있어요. 안전한 추천을 위해 꼭 필요합니다." />

      <div style={{ fontWeight: 500, marginBottom: 'var(--space-2)', fontSize: 14 }}>현재 기저질환 (해당 사항 선택)</div>
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        {CONDITIONS_LIST.map(c => (
          <div key={c} className={`check-card ${answers.기저질환.includes(c) ? 'selected' : ''}`}
            onClick={() => toggleCondition(c)}>
            <div className="check-icon">✓</div>
            <span className="check-text">{c}</span>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 500, marginBottom: 'var(--space-2)', fontSize: 14 }}>가족력 (해당 사항 선택)</div>
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        {FAMILY_HISTORY_LIST.map(f => (
          <div key={f} className={`check-card ${answers.가족력.includes(f) ? 'selected' : ''}`}
            onClick={() => toggleFamily(f)}>
            <div className="check-icon">✓</div>
            <span className="check-text">{f}</span>
          </div>
        ))}
      </div>

      <div className="input-group">
        <label>현재 복용 약물 (선택사항)</label>
        <input type="text" className="input-field" placeholder="예: 혈압약, 당뇨약, 갑상선약..."
          value={answers.복용약물 || ''}
          onChange={e => onUpdate({ 복용약물: e.target.value || undefined })} />
      </div>

      <button className="btn btn-accent" onClick={onSubmit} style={{ marginTop: 'var(--space-4)', fontSize: 18 }}>
        🔬 맞춤 분석 시작
      </button>
    </div>
  )
}
