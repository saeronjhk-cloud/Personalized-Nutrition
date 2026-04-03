"""
내 몸에 맞는 영양제 찾기 — 맞춤형 건강기능식품 추천 앱
실행: streamlit run supplement_app.py
"""

import streamlit as st
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from tools.tool_recommender import (
    compute_scores, compute_score_breakdown, get_persona, get_recommendations,
    get_excluded_candidates, apply_toxicity_guardrail,
    SYMPTOM_GROUPS, SYMPTOM_TEXT_MAP, CONDITIONS,
    SUPPLEMENT_FOOD_AVOID,
    CURRENT_SUPPLEMENT_OPTIONS, FAT_SOLUBLE_IDS,
    SUPPLEMENT_MONTHLY_DATA, calculate_monthly_summary,
    FAMILY_HISTORY_DATA, apply_family_history_boosts,
    FOOD_DETAIL_BOOSTS, apply_food_detail_boosts,
    DRUG_INTERACTION_QUESTIONS, apply_drug_interaction_boosts,
    SUPPLEMENT_CLINICAL_EFFECT,
)
from tools.tool_coupang_search import get_coupang_url
from tools.tool_pdf_export import generate_pdf_bytes

# ── 페이지 설정 ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="내 몸에 맞는 영양제 찾기",
    page_icon="💊",
    layout="centered",
    initial_sidebar_state="collapsed",
)

st.markdown("""
<style>
    .stApp { background-color: #f8f9fa; }

    .main-title {
        text-align: center;
        font-size: 2.2em;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        padding: 10px 0 5px;
    }
    .sub-title {
        text-align: center;
        color: #636e72;
        font-size: 1.05em;
        margin-bottom: 30px;
    }
    .question-box {
        background: white;
        border-radius: 16px;
        padding: 28px 32px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.07);
        margin: 10px 0 20px;
    }
    .symptom-group-label {
        font-weight: 700;
        font-size: 1em;
        color: #2d3436;
        margin: 18px 0 6px;
        padding-bottom: 4px;
        border-bottom: 2px solid #f0f0f0;
    }
    .persona-card {
        border-radius: 20px;
        padding: 32px;
        text-align: center;
        color: white;
        margin: 20px 0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .persona-emoji { font-size: 3.5em; }
    .persona-name { font-size: 1.7em; font-weight: 800; margin: 8px 0; }
    .persona-desc { font-size: 0.95em; opacity: 0.92; line-height: 1.6; }
    .supp-card {
        background: white;
        border-radius: 16px;
        padding: 22px 26px;
        margin: 14px 0;
        box-shadow: 0 2px 10px rgba(0,0,0,0.06);
        border-left: 5px solid #667eea;
    }
    .supp-name { font-size: 1.2em; font-weight: 700; color: #2d3436; }
    .supp-desc { color: #636e72; margin: 6px 0; font-size: 0.95em; line-height: 1.55; }
    .mfds-badge {
        display: inline-block;
        background: #e8f4fd;
        color: #0984e3;
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 0.8em;
        margin: 5px 4px 5px 0;
        font-weight: 600;
    }
    .grade-a { background: #d4edda; color: #155724; }
    .grade-b { background: #fff3cd; color: #856404; }
    .symptom-match-box {
        background: #f0f0ff;
        border-left: 3px solid #667eea;
        border-radius: 6px;
        padding: 8px 12px;
        margin: 8px 0;
        font-size: 0.85em;
        color: #4a4a8a;
    }
    .caution-box {
        background: #fff3cd;
        border-left: 4px solid #ffc107;
        border-radius: 6px;
        padding: 8px 12px;
        margin: 8px 0;
        font-size: 0.85em;
        color: #856404;
    }
    .warning-banner {
        background: #fff8e1;
        border: 1px solid #ffcc02;
        border-radius: 12px;
        padding: 16px 20px;
        margin: 15px 0;
        font-size: 0.9em;
        color: #5d4037;
    }
    .step-indicator {
        text-align: center;
        color: #b2bec3;
        font-size: 0.85em;
        margin-bottom: 5px;
    }
    div.stButton > button {
        border-radius: 10px;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)


# ── 세션 초기화 ────────────────────────────────────────────────────────────────
def reset():
    st.session_state.step = 0
    st.session_state.answers = {}
    st.session_state.nav_history = []

if "step" not in st.session_state:
    st.session_state.step = 0
if "answers" not in st.session_state:
    st.session_state.answers = {}
if "nav_history" not in st.session_state:
    st.session_state.nav_history = []

TOTAL_QUESTIONS = 11

SLEEP_SYMPTOM_IDS = {"leg_cramps_night", "cant_fall_asleep", "wake_night", "unrefreshing"}
STRESS_SYMPTOM_IDS = {"numbness", "anxiety", "low_mood"}


def _should_skip_sleep(answers):
    selected = set(answers.get("증상", []))
    return len(selected & SLEEP_SYMPTOM_IDS) >= 2


def _should_skip_stress(answers):
    selected = set(answers.get("증상", []))
    return len(selected & STRESS_SYMPTOM_IDS) >= 2


def go_to(next_step):
    st.session_state.nav_history.append(st.session_state.step)
    st.session_state.step = next_step
    st.rerun()


def _scroll_to_top():
    import streamlit.components.v1 as components
    components.html("""
    <script>
        var el = window.parent.document.querySelector('.main') ||
                 window.parent.document.querySelector('section.main') ||
                 window.parent.document.querySelector('[data-testid="stMain"]') ||
                 window.parent.document.querySelector('[data-testid="stAppViewContainer"]');
        if (el) el.scrollTop = 0;
    </script>
    """, height=0)


def show_progress(current):
    _scroll_to_top()
    if st.session_state.nav_history:
        if st.button("← 이전", key=f"back_{current}"):
            prev = st.session_state.nav_history.pop()
            st.session_state.step = prev
            st.rerun()
    st.markdown(f'<div class="step-indicator">Q{current} / {TOTAL_QUESTIONS}</div>', unsafe_allow_html=True)
    st.progress(current / TOTAL_QUESTIONS)


# ── 스텝 함수 ─────────────────────────────────────────────────────────────────

def step_welcome():
    st.markdown('<div class="main-title">💊 내 몸에 맞는 영양제 찾기</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-title">신체 증상과 라이프스타일 분석으로 맞춤 추천해 드려요</div>', unsafe_allow_html=True)

    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("""
        <div style="background:white;border-radius:14px;padding:18px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="font-size:1.8em">🔬</div>
            <div style="font-weight:700;font-size:0.9em;margin-top:6px">임상 근거 기반</div>
            <div style="color:#636e72;font-size:0.8em;margin-top:3px">식약처 인정 성분만</div>
        </div>""", unsafe_allow_html=True)
    with col2:
        st.markdown("""
        <div style="background:white;border-radius:14px;padding:18px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="font-size:1.8em">🩺</div>
            <div style="font-weight:700;font-size:0.9em;margin-top:6px">결핍 증상 분석</div>
            <div style="color:#636e72;font-size:0.8em;margin-top:3px">36가지 신체 신호 체크</div>
        </div>""", unsafe_allow_html=True)
    with col3:
        st.markdown("""
        <div style="background:white;border-radius:14px;padding:18px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="font-size:1.8em">🛒</div>
            <div style="font-weight:700;font-size:0.9em;margin-top:6px">쿠팡 바로 연결</div>
            <div style="color:#636e72;font-size:0.8em;margin-top:3px">최저가 제품 검색</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("✨ 시작하기 (약 3분)", use_container_width=True, type="primary"):
            go_to(1)


def step_basic_info():
    show_progress(1)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🙋 기본 신체 정보를 알려주세요")
    st.caption("Mifflin-St Jeor 공식으로 기초대사량과 일일 에너지 소비량을 계산해요")

    col1, col2 = st.columns(2)
    with col1:
        gender_options = {"남성 👨": "남성", "여성 👩": "여성"}
        gender_display = st.radio("성별", list(gender_options.keys()), horizontal=True)
    with col2:
        age = st.slider("나이", min_value=18, max_value=80, value=30, step=1, format="%d세")

    col1, col2 = st.columns(2)
    with col1:
        height = st.number_input("키 (cm)", min_value=140, max_value=220, value=168, step=1)
    with col2:
        weight = st.number_input("몸무게 (kg)", min_value=30.0, max_value=150.0, value=65.0, step=0.5, format="%.1f")

    # 체중 변화 추이
    st.markdown("<br>", unsafe_allow_html=True)
    weight_change_options = {
        "⚖️ 안정적이에요 (±3kg 이내)": "안정",
        "📈 최근 3개월 내 3kg 이상 증가했어요": "증가",
        "📉 최근 3개월 내 3kg 이상 감소했어요": "감소",
        "😓 의도치 않게 줄고 있어요 (식욕 저하 등)": "의도치않은감소",
    }
    weight_change_display = st.radio("최근 체중 변화", list(weight_change_options.keys()), label_visibility="visible")

    # 여성 특화 질문
    menstruation = None
    if gender_options[gender_display] == "여성":
        st.markdown("<br>", unsafe_allow_html=True)
        menstruation_options = {
            "📅 월경 중이에요 (규칙적, 양 보통 이하)": "규칙적",
            "🔴 월경량이 많거나 불규칙해요": "과다_불규칙",
            "🌸 폐경이에요 (자연 또는 수술)": "폐경",
            "🤰 임신 계획 중이에요 (3개월 내)": "임신계획",
        }
        menstruation_display = st.radio("월경 상태", list(menstruation_options.keys()), label_visibility="visible")
        menstruation = menstruation_options[menstruation_display]

    # 실시간 BMI 미리보기
    if height > 0 and weight > 0:
        from tools.tool_recommender import calculate_bmi, get_bmi_category
        bmi = calculate_bmi(weight, height)
        bmi_label, bmi_color, bmi_advice = get_bmi_category(bmi)
        st.markdown(f"""
        <div style="background:{bmi_color}22;border-left:4px solid {bmi_color};border-radius:8px;padding:10px 14px;margin-top:10px">
            <strong>BMI {bmi:.1f}</strong> — {bmi_label} &nbsp;|&nbsp; <span style="color:#636e72;font-size:0.9em">{bmi_advice}</span>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["성별"] = gender_options[gender_display]
        st.session_state.answers["나이"] = age
        st.session_state.answers["신장"] = height
        st.session_state.answers["체중"] = weight
        st.session_state.answers["체중변화"] = weight_change_options[weight_change_display]
        if menstruation:
            st.session_state.answers["월경상태"] = menstruation
        go_to(2)


def step_current_supplements():
    show_progress(9)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("💊 현재 드시고 있는 영양제가 있나요?")
    st.caption("중복 복용·과잉 섭취를 방지하고, 기존 영양제와 시너지 나는 성분을 추천해 드려요. 없으면 '없음'을 선택해 주세요.")

    st.markdown("""
    <div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:0.85em;color:#856404">
        ⚠️ 지용성 비타민(비타민D·종합비타민)을 이미 드시고 있다면 추가 보충 시 과잉 섭취 위험이 있어요. 정확히 체크해 주세요.
    </div>
    """, unsafe_allow_html=True)

    selected_labels = []
    cols = st.columns(2)
    for i, opt in enumerate(CURRENT_SUPPLEMENT_OPTIONS):
        with cols[i % 2]:
            if st.checkbox(opt["label"], key=f"cursupp_{i}"):
                selected_labels.append(opt["label"])

    none_selected = st.checkbox("❌ 현재 복용 중인 영양제 없음", key="cursupp_none")
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        if not selected_labels and not none_selected:
            st.warning("현재 복용 중인 영양제를 선택하거나 '없음'을 체크해 주세요.")
        else:
            # 선택한 라벨 → 영양제 ID 목록으로 변환
            current_ids = set()
            for opt in CURRENT_SUPPLEMENT_OPTIONS:
                if opt["label"] in selected_labels:
                    current_ids.update(opt["ids"])
            st.session_state.answers["현재복용영양제"] = list(current_ids)
            st.session_state.answers["현재복용영양제_라벨"] = selected_labels
            go_to(10)


def step_goals():
    show_progress(3)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🎯 지금 가장 신경 쓰이는 게 뭐예요?")
    st.caption("목표에 따라 핵심 추천 영양소가 달라집니다. 여러 개 선택 가능해요.")

    goal_options = {
        "💪 피로회복": "피로회복", "😴 수면개선": "수면개선",
        "🛡️ 면역력강화": "면역력강화", "⚖️ 체중감량": "체중감량",
        "🍺 간건강": "간건강", "🦠 소화장건강": "소화장건강",
        "🏋️ 근육증가": "근육증가", "✨ 피부개선": "피부개선",
        "🩸 혈당관리": "혈당관리", "⚖️ 체지방감소": "체지방감소",
        "👁️ 눈건강": "눈건강", "❤️ 심혈관건강": "심혈관건강",
        "🌸 갱년기관리": "갱년기관리", "🧠 인지력향상": "인지력향상",
    }

    selected = []
    cols = st.columns(2)
    for i, (display, value) in enumerate(goal_options.items()):
        with cols[i % 2]:
            if st.checkbox(display, key=f"goal_{i}"):
                selected.append(value)
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        if not selected:
            st.warning("최소 1개 이상 선택해주세요!")
        else:
            st.session_state.answers["목표"] = selected
            skip_sleep = _should_skip_sleep(st.session_state.answers)
            skip_stress = _should_skip_stress(st.session_state.answers)
            if skip_sleep and skip_stress:
                go_to(6)
            elif skip_sleep:
                go_to(5)
            else:
                go_to(4)


def step_symptoms():
    show_progress(2)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🩺 요즘 이런 증상이 있나요?")
    st.caption("현재 겪고 있는 증상이 영양소 우선순위를 결정합니다. 해당되는 증상을 모두 선택해 주세요. (없으면 그냥 넘어가도 돼요)")

    selected = []
    for group in SYMPTOM_GROUPS:
        st.markdown(f'<div class="symptom-group-label">{group["group"]}</div>', unsafe_allow_html=True)
        cols = st.columns(2)
        for i, symptom in enumerate(group["symptoms"]):
            with cols[i % 2]:
                if st.checkbox(symptom["text"], key=f"sym_{symptom['id']}"):
                    selected.append(symptom["id"])
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["증상"] = selected
        go_to(3)


def step_sleep():
    show_progress(4)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("😴 평소 수면 패턴이 어때요?")
    st.caption("수면 패턴은 마그네슘·GABA 등 추천 여부에 직결됩니다.")

    options = {
        "😌 잘 자고 있어요": "괜찮음",
        "😫 잠들기까지 한참 걸려요": "잠들기_어려움",
        "😵 중간에 자꾸 깨요": "중간에_자꾸_깸",
        "🥱 자도 자도 피곤해요": "자도_피곤함",
    }
    selected = st.radio("", list(options.keys()), label_visibility="collapsed")
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["수면"] = options[selected]
        if _should_skip_stress(st.session_state.answers):
            go_to(6)
        else:
            go_to(5)


def step_stress():
    show_progress(5)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("😤 스트레스 수준이 어느 정도예요?")
    st.caption("스트레스 수준은 비타민B·마그네슘 필요도를 결정합니다.")

    options = {
        "😌 거의 없어요": "거의_없음",
        "😐 가끔 있어요 — 일상적인 수준이에요": "가끔",
        "😤 자주 있어요 — 꽤 힘든 날이 많아요": "자주",
        "🤯 항상 폭발 직전이에요": "항상_폭발_직전",
    }
    selected = st.radio("", list(options.keys()), label_visibility="collapsed")
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["스트레스"] = options[selected]
        go_to(6)


def step_exercise():
    show_progress(6)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🏃 운동 패턴을 알려주세요")
    st.caption("운동 강도와 일조량은 비타민D·코엔자임Q10 필요도에 영향을 줍니다.")

    freq_options = {
        "🛋️ 거의 안 해요 (주 1회 미만)": "거의_안함",
        "🚶 주 1~2회 정도 해요": "주1-2회",
        "🏃 주 3~4회 꾸준히 해요": "주3-4회",
        "💪 거의 매일 해요": "거의_매일",
    }
    freq_display = st.radio("운동 빈도", list(freq_options.keys()), label_visibility="visible")

    type_options = {
        "🏋️ 근력 위주 (웨이트, 헬스)": "근력",
        "🏃 유산소 위주 (달리기, 수영, 자전거)": "유산소",
        "🤸 혼합 (유산소 + 근력)": "혼합",
        "🚶 가벼운 활동 (산책, 스트레칭)": "가벼운",
    }
    if freq_options[freq_display] != "거의_안함":
        type_display = st.radio("운동 유형", list(type_options.keys()), label_visibility="visible")
        exercise_type = type_options[type_display]
    else:
        exercise_type = "가벼운"

    st.markdown("<br>", unsafe_allow_html=True)
    sunlight_options = {
        "☀️ 하루 30분 이상 야외 활동해요": "충분",
        "🏢 주로 실내예요 (출퇴근 시 짧은 노출)": "부족",
        "🌙 거의 실내예요 (재택·야간·지하 근무 등)": "매우_부족",
    }
    sunlight_display = st.radio("일조량 / 실외 활동", list(sunlight_options.keys()), label_visibility="visible")

    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["운동"] = freq_options[freq_display]
        st.session_state.answers["운동유형"] = exercise_type
        st.session_state.answers["일조량"] = sunlight_options[sunlight_display]
        go_to(7)


def step_diet():
    show_progress(7)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🍽️ 식습관을 알려주세요")
    st.caption("식습관이 영양 결핍 가능성을 추정하는 핵심 지표입니다.")

    diet_options = {
        "🏠 집밥 위주예요": "집밥_위주",
        "🛵 배달·외식이 많아요": "배달_외식_많음",
        "🥦 채식 위주예요": "채식_위주",
        "⏰ 주로 뭘 먹는지 정해진 게 없어요": "불규칙함",
    }
    diet_display = st.radio("주요 식단", list(diet_options.keys()), label_visibility="visible")

    regularity_options = {
        "⏰ 규칙적으로 먹어요 (정해진 시간에)": "규칙적",
        "🎲 불규칙해요 (그때그때 달라요)": "불규칙",
    }
    reg_display = st.radio("식사 규칙성", list(regularity_options.keys()), label_visibility="visible")

    meal_freq = st.select_slider(
        "하루 평균 식사 횟수",
        options=["1끼", "2끼", "3끼", "4끼 이상"],
        value="3끼",
    )

    st.markdown("<br>**🥦 음식 섭취 빈도 (Food-First 분석)**")
    st.caption("특정 식품 섭취 습관이 영양 결핍의 주요 원인입니다. 솔직하게 선택해 주세요.")

    veg_options = {"매일 먹어요": "채소_매일", "주 3~4회": "채소_주3-4회", "주 1~2회": "채소_주1-2회", "거의 안 먹어요": "채소_거의안먹음"}
    fish_options = {"주 2회 이상": "생선_주2회이상", "주 1회 정도": "생선_주1회미만", "거의 안 먹어요": "생선_거의안먹음"}
    meat_options = {"주 3회 이상": "육류_주3회이상", "주 1~2회": "육류_주1-2회", "거의 안 먹어요": "육류_거의안먹음"}
    processed_options = {"주 4회 이상": "가공식품_주4회이상", "주 2~3회": "가공식품_주2-3회", "주 1회 이하": "가공식품_주1회이하"}
    sugar_options = {"거의 매일": "당류_매일", "주 3~4회": "당류_주3-4회", "주 1~2회 이하": "당류_주1-2회이하"}

    col1, col2 = st.columns(2)
    with col1:
        veg_display = st.selectbox("🥦 채소 (녹황색 채소) 섭취 빈도", list(veg_options.keys()))
        meat_display = st.selectbox("🥩 붉은 육류 섭취 빈도", list(meat_options.keys()))
        sugar_display = st.selectbox("🍬 단 음식·음료 섭취 빈도", list(sugar_options.keys()))
    with col2:
        fish_display = st.selectbox("🐟 등푸른 생선 섭취 빈도", list(fish_options.keys()))
        processed_display = st.selectbox("🍔 가공식품·패스트푸드 섭취 빈도", list(processed_options.keys()))

    st.markdown("<br>**💧 수분 섭취 습관**")
    water_options = {
        "💧 하루 2L 이상 마셔요": "충분",
        "💧 하루 1~2L 정도 마셔요": "보통",
        "💧 물을 잘 안 마셔요 (1L 미만)": "부족",
    }
    water_display = st.radio("하루 물 섭취량", list(water_options.keys()), label_visibility="visible")

    st.markdown("<br>**☕ 카페인 섭취 습관**")
    st.caption("카페인은 수면 품질, 스트레스 반응, 에너지 대사에 직접 영향을 줍니다.")
    caffeine_options = {
        "거의 안 마셔요 (하루 1잔 미만)": "거의안마심",
        "하루 1~2잔 (커피·녹차 등)": "하루1-2잔",
        "하루 3~4잔": "하루3-4잔",
        "하루 5잔 이상 (카페인 과다)": "하루5잔이상",
    }
    caffeine_display = st.selectbox("☕ 커피·에너지음료 등 카페인 음료 하루 섭취량", list(caffeine_options.keys()))
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["식습관"] = diet_options[diet_display]
        st.session_state.answers["식사규칙성"] = regularity_options[reg_display]
        st.session_state.answers["식사횟수"] = meal_freq
        st.session_state.answers["음식빈도"] = {
            "채소": veg_options[veg_display],
            "생선": fish_options[fish_display],
            "육류": meat_options[meat_display],
            "가공식품": processed_options[processed_display],
            "당류": sugar_options[sugar_display],
        }
        st.session_state.answers["수분섭취"] = water_options[water_display]
        st.session_state.answers["카페인"] = caffeine_options[caffeine_display]
        go_to(8)


def step_alcohol():
    show_progress(8)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🍷 음주는 얼마나 하세요?")
    st.caption("음주 빈도는 간 해독에 필요한 영양소 추천에 영향을 줍니다.")

    options = {
        "🚫 거의 안 마셔요": "거의_안마심",
        "🍺 주 1~2회 정도요": "주1-2회",
        "🍻 주 3회 이상이에요": "주3회이상",
    }
    selected = st.radio("", list(options.keys()), label_visibility="collapsed")

    drink_qty = None
    if options[selected] != "거의_안마심":
        st.markdown("<br>", unsafe_allow_html=True)
        qty_options = {
            "🍺 가벼운 편이에요 (맥주 1캔·소주 1~2잔 이하)": "가벼운",
            "🍻 보통이에요 (맥주 2캔·소주 3~4잔)": "보통",
            "🥴 과음하는 편이에요 (맥주 3캔 이상·소주 반병 이상)": "과음",
        }
        qty_display = st.radio("1회 평균 음주량이 어느 정도예요?", list(qty_options.keys()), label_visibility="visible", key="alcohol_qty")
        drink_qty = qty_options[qty_display]
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        st.session_state.answers["음주"] = options[selected]
        if drink_qty:
            st.session_state.answers["음주량"] = drink_qty
        go_to(9)


def step_family_history():
    show_progress(10)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("🧬 가족 중에 이런 질환이 있으신가요?")
    st.caption("가족력은 예방 차원의 영양소 우선순위 판단에 사용됩니다. 잠재적 취약 영역을 예측해 드려요.")

    selected_fh = []
    cols = st.columns(2)
    for i, (fh_id, fh_data) in enumerate(FAMILY_HISTORY_DATA.items()):
        with cols[i % 2]:
            if st.checkbox(fh_data["label"], key=f"fh_{fh_id}"):
                selected_fh.append(fh_id)

    none_fh = st.checkbox("✅ 특별한 가족력 없음", key="fh_none")
    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        if not selected_fh and not none_fh:
            st.warning("가족력을 선택하거나 '특별한 가족력 없음'을 체크해 주세요.")
        else:
            st.session_state.answers["가족력"] = selected_fh
            go_to(11)


def step_conditions():
    show_progress(11)
    st.markdown('<div class="question-box">', unsafe_allow_html=True)
    st.subheader("⚕️ 건강 상태와 특이사항을 알려주세요")
    st.caption("기저 질환과 약물 복용 여부는 금기 성분 필터링에 사용됩니다. 정확한 추천을 위해 꼭 확인해요.")

    # 섹션 1: 진단받은 질환
    st.markdown("**🏥 진단받은 질환이 있나요?** (해당하는 것 모두 선택)")
    selected_diseases = []
    cols = st.columns(2)
    for i, (cond_id, cond) in enumerate(CONDITIONS.items()):
        with cols[i % 2]:
            if st.checkbox(cond["label"], key=f"disease_{cond_id}"):
                selected_diseases.append(cond_id)

    st.markdown("<br>", unsafe_allow_html=True)

    # 섹션 2: 처방약 복용 여부
    st.markdown("**💊 현재 복용 중인 처방약이 있나요?** (해당하는 것 모두 선택)")
    st.caption("특정 약물은 특정 영양소를 고갈시킵니다. 선택하면 해당 영양소를 우선 추천해 드려요.")
    medication_options = {
        "💊 위산 억제제 (오메프라졸, 판토프라졸 등 PPI)": "PPI",
        "💊 경구 피임약": "피임약",
        "💊 진통소염제 (이부프로펜, 나프록센 등 NSAIDs)": "NSAIDs",
        "💊 고지혈증약 (스타틴 계열)": "스타틴",
        "💊 이뇨제 (히드로클로로티아지드 등)": "이뇨제",
        "💊 당뇨약 (메트포르민 계열)": "메트포르민",
    }
    selected_medications = []
    cols_med = st.columns(2)
    for i, (display, value) in enumerate(medication_options.items()):
        with cols_med[i % 2]:
            if st.checkbox(display, key=f"med_{value}"):
                selected_medications.append(value)
    no_medication = st.checkbox("✅ 처방약 복용 없음", key="med_none")

    st.markdown("<br>", unsafe_allow_html=True)

    # 섹션 3: 기타 특이사항
    st.markdown("**기타 특이사항**")
    special_options = {
        "🚬 현재 흡연 중이에요": "흡연",
        "🤱 임산부 또는 수유 중이에요": "임산부_수유부",
        "💊 위 항목 외 처방약을 복용 중이에요": "약물복용중",
        "✅ 해당 없어요": "해당없음",
    }
    selected_special = []
    for display, value in special_options.items():
        if st.checkbox(display, key=f"special_{value}"):
            selected_special.append(value)

    st.markdown("</div>", unsafe_allow_html=True)

    # 동적 꼬리 질문 — 특정 질환 선택 시 약물 복용 여부 추가 확인
    drug_answers = {}
    if selected_diseases:
        for cond_id, diq in DRUG_INTERACTION_QUESTIONS.items():
            if cond_id in selected_diseases:
                st.markdown("<br>", unsafe_allow_html=True)
                st.markdown(f"""
                <div style="background:#f0f4ff;border-left:4px solid #667eea;border-radius:8px;padding:10px 14px;font-size:0.9em">
                    💊 <strong>추가 확인:</strong> {diq['question']}
                </div>
                """, unsafe_allow_html=True)
                ans = st.radio("", ["예", "아니요", "모르겠어요"], horizontal=True, key=f"diq_{cond_id}")
                drug_answers[diq["key"]] = (ans == "예")

    st.markdown("</div>", unsafe_allow_html=True)

    if st.button("다음 →", use_container_width=True, type="primary"):
        if not selected_special:
            st.warning("기타 특이사항에서 최소 1개를 선택해주세요. (해당 없으면 '해당 없어요')")
        else:
            st.session_state.answers["질환"] = selected_diseases
            st.session_state.answers["복용약물"] = selected_medications
            st.session_state.answers["특이사항"] = selected_special
            st.session_state.answers["drug_interactions"] = drug_answers
            go_to(12)


def step_results():
    _scroll_to_top()
    if st.session_state.nav_history:
        if st.button("← 이전"):
            prev = st.session_state.nav_history.pop()
            st.session_state.step = prev
            st.rerun()

    from tools.tool_recommender import (
        calculate_bmi, get_bmi_category, calculate_bmr,
        calculate_tdee, calculate_protein_target, ACTIVITY_FACTORS,
    )

    answers = st.session_state.answers
    scores = compute_scores(answers)
    persona = get_persona(answers, scores)
    # 가족력 보정
    family_history = answers.get("가족력", [])
    fh_cat_boosts, fh_supp_boosts, fh_notes = apply_family_history_boosts(family_history)
    for cat, val in fh_cat_boosts.items():
        scores[cat] = scores.get(cat, 0) + val

    # 음식 빈도 보정
    food_detail = answers.get("음식빈도", {})
    fd_cat_boosts, fd_supp_boosts, food_advices = apply_food_detail_boosts(food_detail)
    for cat, val in fd_cat_boosts.items():
        scores[cat] = scores.get(cat, 0) + val

    # 약물 상호작용 보정
    drug_supp_boosts, drug_notes = apply_drug_interaction_boosts(answers)

    # 페르소나별 카테고리 가중치 보정
    persona_cat_boosts = persona.get("category_boosts", {})
    for cat, val in persona_cat_boosts.items():
        scores[cat] = scores.get(cat, 0) + val

    # 모든 추가 점수 합산
    extra_boosts = {}
    for d in [fh_supp_boosts, fd_supp_boosts, drug_supp_boosts]:
        for sid, val in d.items():
            extra_boosts[sid] = extra_boosts.get(sid, 0) + val

    max_recs = persona.get("max_recommendations", 5)
    current_supplement_ids = set(answers.get("현재복용영양제", []))
    recommendations = get_recommendations(
        answers, scores, None,
        max_recs=max_recs + 5,   # guardrail backfill용 여분
        extra_supp_boosts=extra_boosts,
        current_ids=current_supplement_ids,
    )
    score_breakdown = compute_score_breakdown(answers)
    recommendations, toxicity_warnings = apply_toxicity_guardrail(
        recommendations,
        current_ids=current_supplement_ids,
        max_recs=max_recs,
    )

    # ── 신체 지표 대시보드 ────────────────────────────────────────────────
    weight = answers.get("체중", 0)
    height = answers.get("신장", 0)
    age = answers.get("나이", 30)
    gender = answers.get("성별", "남성")
    goals = answers.get("목표", [])
    activity = answers.get("운동", "주1-2회")

    if weight > 0 and height > 0:
        bmi = calculate_bmi(weight, height)
        bmi_label, bmi_color, bmi_advice = get_bmi_category(bmi)
        bmr = calculate_bmr(gender, weight, height, age)
        tdee = calculate_tdee(bmr, activity)
        prot_min, prot_max = calculate_protein_target(weight, goals)

        st.markdown("### 📊 내 신체 지표 분석")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown(f"""
            <div style="background:white;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);border-top:4px solid {bmi_color}">
                <div style="font-size:0.8em;color:#636e72;margin-bottom:4px">BMI</div>
                <div style="font-size:1.8em;font-weight:800;color:{bmi_color}">{bmi:.1f}</div>
                <div style="font-size:0.85em;font-weight:600;color:{bmi_color}">{bmi_label}</div>
                <div style="font-size:0.75em;color:#b2bec3;margin-top:4px">{bmi_advice}</div>
            </div>
            """, unsafe_allow_html=True)
        with col2:
            st.markdown(f"""
            <div style="background:white;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);border-top:4px solid #667eea">
                <div style="font-size:0.8em;color:#636e72;margin-bottom:4px">일일 에너지 소비 (TDEE)</div>
                <div style="font-size:1.8em;font-weight:800;color:#667eea">{tdee:,}</div>
                <div style="font-size:0.85em;color:#636e72">kcal/일</div>
                <div style="font-size:0.75em;color:#b2bec3;margin-top:4px">Mifflin-St Jeor 공식</div>
            </div>
            """, unsafe_allow_html=True)
        with col3:
            st.markdown(f"""
            <div style="background:white;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);border-top:4px solid #00b894">
                <div style="font-size:0.8em;color:#636e72;margin-bottom:4px">단백질 권장량</div>
                <div style="font-size:1.8em;font-weight:800;color:#00b894">{prot_min}~{prot_max}g</div>
                <div style="font-size:0.85em;color:#636e72">하루 권장 섭취량</div>
                <div style="font-size:0.75em;color:#b2bec3;margin-top:4px">목표 체중 기준</div>
            </div>
            """, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

    # ── 건강 밸런스 레이더 차트 ────────────────────────────────────────
    import plotly.graph_objects as go

    cat_keys = ["피로", "수면", "스트레스", "간건강", "면역력", "장건강", "근육관절", "피부", "눈건강", "혈당대사", "심혈관", "갱년기", "체중관리", "인지기능"]
    cat_display = ["피로", "수면", "스트레스", "간 건강", "면역력", "장 건강", "근육·관절", "피부", "눈 건강", "혈당·대사", "심혈관", "갱년기", "체중관리", "인지기능"]
    radar_vals = [scores.get(k, 0) for k in cat_keys]
    max_val = max(max(radar_vals), 8)

    # 3개월 후 기대 점수: 임상시험 보고 개선율 기반 (곱셈 누적 — 보수적 추정)
    expected_scores = dict(scores)
    for supp, _, _ in recommendations:
        for cat, rate in SUPPLEMENT_CLINICAL_EFFECT.get(supp["id"], {}).items():
            if cat in expected_scores:
                expected_scores[cat] = max(0, expected_scores[cat] * (1 - rate))
    expected_vals = [expected_scores.get(k, 0) for k in cat_keys]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=radar_vals + [radar_vals[0]],
        theta=cat_display + [cat_display[0]],
        fill="toself",
        fillcolor="rgba(102, 126, 234, 0.20)",
        line=dict(color="#667eea", width=2.5),
        name="현재 상태",
        hovertemplate="%{theta}: %{r}점<extra>현재</extra>",
    ))
    fig.add_trace(go.Scatterpolar(
        r=expected_vals + [expected_vals[0]],
        theta=cat_display + [cat_display[0]],
        fill="toself",
        fillcolor="rgba(0, 184, 148, 0.12)",
        line=dict(color="#00b894", width=2, dash="dash"),
        name="3개월 후 기대",
        hovertemplate="%{theta}: %{r:.1f}점<extra>3개월 후</extra>",
    ))
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, max_val + 2],
                tickfont=dict(size=9),
                gridcolor="#e0e0e0",
            ),
            angularaxis=dict(tickfont=dict(size=11)),
            bgcolor="white",
        ),
        showlegend=True,
        legend=dict(orientation="h", x=0.5, xanchor="center", y=-0.15),
        height=360,
        margin=dict(l=30, r=30, t=30, b=40),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    st.markdown("### 📊 내 건강 밸런스")
    st.caption("🔵 현재 상태 / 🟢 임상시험 3개월 기준 기대값 (낮을수록 개선됨)")
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    st.markdown("<br>", unsafe_allow_html=True)

    # ── 페르소나 카드 ────────────────────────────────────────────────────
    st.markdown(f"""
    <div class="persona-card" style="background: linear-gradient(135deg, {persona['color']}, {persona['color']}bb);">
        <div class="persona-emoji">{persona['emoji']}</div>
        <div style="font-size:0.9em;opacity:0.85;margin-bottom:4px;font-style:italic">"{persona.get('tagline', '')}"</div>
        <div class="persona-name">당신은 <strong>{persona['name']}</strong>!</div>
        <div class="persona-desc">{persona['description']}</div>
    </div>
    """, unsafe_allow_html=True)

    # ── 이 유형이 피해야 할 것 ──────────────────────────────────────────
    avoidances = persona.get("avoidances", [])
    if avoidances:
        st.markdown("#### 🚫 이 유형에게 특히 주의가 필요한 것들")
        st.caption("과학 문헌 기반 — 영양제와 별개로 식습관·생활 습관에서 피해야 할 항목이에요.")
        for av in avoidances:
            st.markdown(f"""
            <div style="background:white;border-left:4px solid #d63031;border-radius:0 10px 10px 0;padding:10px 14px;margin:6px 0;box-shadow:0 1px 5px rgba(0,0,0,0.05)">
                <div style="font-weight:700;color:#2d3436;margin-bottom:3px">❌ {av['item']}</div>
                <div style="font-size:0.88em;color:#636e72;margin-bottom:2px">{av['reason']}</div>
                <div style="font-size:0.78em;color:#b2bec3">📄 근거: {av['evidence']}</div>
            </div>
            """, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

    # ── Food-First 처방 리포트 ────────────────────────────────────────────
    if food_advices or fh_notes or drug_notes:
        st.markdown("#### 🥗 영양제 전에 식생활부터 — Food-First 처방")
        st.caption("영양제는 좋은 식습관을 보완하는 도구입니다. 아래 식이 가이드를 먼저 실천해 보세요.")
        if food_advices:
            for advice in food_advices:
                st.markdown(f"""
                <div style="background:#f0fff4;border-left:4px solid #00b894;border-radius:0 10px 10px 0;padding:9px 14px;margin:5px 0;font-size:0.9em">
                    🥦 {advice}
                </div>
                """, unsafe_allow_html=True)
        if fh_notes:
            st.markdown("**🧬 가족력 기반 예방 포인트:**")
            for note in fh_notes:
                st.markdown(f"- {note}")
        if drug_notes:
            st.markdown("**💊 약물 상호작용 반영:**")
            for note in drug_notes:
                st.markdown(f"- {note}")
        st.markdown("<br>", unsafe_allow_html=True)

    # ── 현재 복용 영양제 경고 ────────────────────────────────────────────
    current_ids = set(answers.get("현재복용영양제", []))
    current_labels = answers.get("현재복용영양제_라벨", [])
    if current_ids:
        fat_soluble_overlap = current_ids & FAT_SOLUBLE_IDS
        if fat_soluble_overlap:
            st.markdown(f"""
            <div class="warning-banner">
                ⚠️ <strong>지용성 비타민 중복 주의:</strong> 현재 복용 중인 영양제에 지용성 성분이 포함되어 있습니다.
                아래 추천 영양제와 병용 시 과잉 섭취 위험이 있을 수 있어요. 복용량을 꼭 확인하세요.
            </div>
            """, unsafe_allow_html=True)
        already = [s["name"] for s, *_ in recommendations if s["id"] in current_ids]
        if already:
            st.markdown(f"""
            <div style="background:#e8f4f8;border-left:4px solid #74b9ff;border-radius:0 10px 10px 0;padding:10px 14px;margin:8px 0;font-size:0.88em">
                ℹ️ <strong>이미 복용 중인 성분 감지:</strong> {', '.join(already)}는 현재 드시는 영양제와 겹칩니다. 용량 중복에 주의하세요.
            </div>
            """, unsafe_allow_html=True)

    # ── 선택한 증상 요약 ──────────────────────────────────────────────────
    user_symptoms = answers.get("증상", [])
    if user_symptoms:
        symptom_texts = [SYMPTOM_TEXT_MAP.get(s, s) for s in user_symptoms if s in SYMPTOM_TEXT_MAP]
        with st.expander(f"📋 분석에 반영된 내 증상 ({len(symptom_texts)}개)"):
            for t in symptom_texts:
                st.markdown(f"• {t}")

    # ── 안전 경고 ─────────────────────────────────────────────────────────
    special = answers.get("특이사항", [])
    user_diseases = answers.get("질환", [])

    if "약물복용중" in special:
        st.markdown("""
        <div class="warning-banner">
            ⚠️ <strong>처방약 복용 중:</strong> 영양제도 약과 상호작용할 수 있습니다.
            아래 추천을 복용하기 전에 반드시 담당 의사·약사와 상담하세요.
        </div>
        """, unsafe_allow_html=True)

    if "임산부_수유부" in special:
        st.markdown("""
        <div class="warning-banner">
            🤱 <strong>임산부·수유부 주의:</strong> 이 시기에는 대부분의 영양제 복용 전
            산부인과 전문의 상담이 필요해요.
        </div>
        """, unsafe_allow_html=True)

    disease_notes = [
        (CONDITIONS[d]["label"], CONDITIONS[d]["note"])
        for d in user_diseases
        if CONDITIONS.get(d, {}).get("note")
    ]
    for label, note in disease_notes:
        st.markdown(f"""
        <div class="warning-banner">
            🏥 <strong>{label} 관련 주의:</strong> {note}
        </div>
        """, unsafe_allow_html=True)

    # ── 영양제 추천 ────────────────────────────────────────────────────────
    st.markdown("---")
    rec_count = len(recommendations)
    if rec_count == 0:
        st.markdown("### ✅ 추천 영양제")
        st.markdown(f"""
        <div style="background:#f0fff4;border:2px solid #00b894;border-radius:16px;padding:24px 28px;text-align:center;margin:10px 0">
            <div style="font-size:2em;margin-bottom:8px">🌿</div>
            <div style="font-size:1.1em;font-weight:700;color:#00b894;margin-bottom:8px">현재는 특별히 추천할 영양제가 없어요</div>
            <div style="font-size:0.92em;color:#636e72;line-height:1.6">
                설문 분석 결과, 지금 상태에서 영양제가 유의미한 도움을 줄 가능성이 낮습니다.<br>
                규형 잡힌 식사와 충분한 수면·운동이 가장 좋은 영양제예요.<br>
                <br>
                증상이 생기거나 건강 목표가 생기면 다시 분석해 보세요 😊
            </div>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown(f"### 🏆 맞춤 영양제 추천 TOP {rec_count}")
        st.caption("⚕️ 이 결과는 의학적 진단이 아닙니다. 복용 전 전문의와 상담하세요.")

        # 종합비타민 복용자 안내
        current_labels_for_check = answers.get("현재복용영양제_라벨", [])
        if any("종합비타민" in lbl for lbl in current_labels_for_check):
            st.warning("종합비타민을 복용 중이시면, 아래 개별 영양제와 중복 성분을 확인하세요. 특히 지용성 비타민(A·D·E·K)은 과잉 복용에 주의하세요.")
        # 성분 중복 초과 경고
        for tw in toxicity_warnings:
            st.warning(f"🛡️ {tw}")

        # 우선순위 가이드 박스
        top_supp = recommendations[0][0] if recommendations else None
        if top_supp:
            top_symptom_label = recommendations[0][1][0] if recommendations[0][1] else None
            top_symptom_text = SYMPTOM_TEXT_MAP.get(top_symptom_label, "") if top_symptom_label else ""
            goal_text = top_symptom_text[:20] + "…" if len(top_symptom_text) > 20 else top_symptom_text
            if not goal_text and answers.get("목표"):
                goal_text = answers["목표"][0]
            st.info(
                f"**오늘 당장 시작할 영양제:** {top_supp['emoji']} {top_supp['name']}  \n"
                f"**이번 달 목표:** {goal_text or '전반적 건강 유지'}  \n"
                f"**복용 순서:** 점수 높은 순서대로 1~2가지씩 추가하세요."
            )

    grade_label = {
        "A": "🟢 A등급 (RCT·메타분석)",
        "B": "🟡 B등급 (코호트·전문가 권고)",
    }

    # 카테고리 점수 레이블
    cat_labels = {
        "피로": "피로·에너지", "수면": "수면", "스트레스": "스트레스",
        "간건강": "간 건강", "면역력": "면역력", "장건강": "장 건강",
        "근육관절": "근육·관절", "피부": "피부",
    }

    def build_personal_narrative(supp_id, ans, bd):
        """각 영양제에 대해 개인화된 한 줄 서사를 생성합니다."""
        narratives = {
            "vitamin_b": lambda: f"스트레스 {sum(v for _, v in bd.get('스트레스', []))}점 + 피로 {sum(v for _, v in bd.get('피로', []))}점 — B군 비타민 소모가 빠릅니다.",
            "magnesium": lambda: f"수면 {sum(v for _, v in bd.get('수면', []))}점 + 스트레스 {sum(v for _, v in bd.get('스트레스', []))}점 — 긴장 이완에 마그네슘이 필요합니다.",
            "vitamin_d": lambda: "실내 생활 비중이 높아 햇빛 합성이 부족할 수 있습니다." if ans.get("일조량") in ["부족", "매우_부족"] else "면역 유지와 뼈 건강에 비타민D가 도움이 됩니다.",
            "iron": lambda: "월경량이 많아 철분 손실 보충이 필요합니다." if ans.get("월경상태") == "과다_불규칙" else "피로 점수가 높아 빈혈 예방에 도움이 됩니다.",
            "coq10": lambda: "스타틴 계열 약물은 체내 CoQ10을 고갈시킵니다." if "스타틴" in ans.get("복용약물", []) else "에너지 대사 효율 개선에 CoQ10이 도움이 됩니다.",
            "probiotics": lambda: "장 점막 보호와 수분 흡수 개선에 유산균이 필요합니다." if ans.get("수분섭취") == "부족" else f"장건강 {sum(v for _, v in bd.get('장건강', []))}점 — 장내 환경 개선이 필요합니다.",
            "folic_acid": lambda: "경구 피임약 복용 시 엽산·B9 결핍이 생길 수 있습니다." if "피임약" in ans.get("복용약물", []) else "세포 분열과 DNA 합성에 엽산이 필요합니다.",
        }
        fn = narratives.get(supp_id)
        return fn() if fn else ""

    for i, (supp, matched_symptoms, rec_score) in enumerate(recommendations, 1):
        ev = supp["evidence"]
        coupang = get_coupang_url(supp["search_keyword"])

        # 추천 이유 — 가장 연관된 카테고리 + 점수
        affinity = supp.get("affinity", {})
        top_cat = max(affinity, key=affinity.get) if affinity else ""
        user_score = scores.get(top_cat, 0)
        cat_label = cat_labels.get(top_cat, top_cat)

        if user_score >= 7:
            score_badge = f'<span style="background:#d63031;color:white;border-radius:20px;padding:2px 10px;font-size:0.8em;font-weight:700">{cat_label} 위험 수준</span>'
            reason_text = f"설문 분석 결과 <strong>{cat_label}</strong> 지표가 높게 나타났습니다. 이 성분이 직접적으로 해당 부족을 보완합니다."
        elif user_score >= 4:
            score_badge = f'<span style="background:#e17055;color:white;border-radius:20px;padding:2px 10px;font-size:0.8em;font-weight:700">{cat_label} 관리 필요</span>'
            reason_text = f"<strong>{cat_label}</strong> 개선이 필요한 것으로 분석됩니다. 이 성분이 해당 영역을 지원합니다."
        elif user_score >= 2:
            score_badge = f'<span style="background:#fdcb6e;color:#2d3436;border-radius:20px;padding:2px 10px;font-size:0.8em;font-weight:700">{cat_label} 예방 관리</span>'
            reason_text = f"<strong>{cat_label}</strong>을 미리 챙기는 예방적 보충입니다."
        else:
            score_badge = ""
            reason_text = supp["description"]

        # 우선순위 티어 배지
        if rec_score >= 30:
            tier_label, tier_color = "🔴 필수 보충", "#d63031"
        elif rec_score >= 20:
            tier_label, tier_color = "🟡 권장 보충", "#e17055"
        else:
            tier_label, tier_color = "🟢 선택 보충", "#00b894"
        tier_badge = f'<span style="background:{tier_color}22;color:{tier_color};border:1px solid {tier_color}55;border-radius:20px;padding:2px 10px;font-size:0.78em;font-weight:700">{tier_label}</span>'

        # 효과 체감 타임라인
        onset = supp.get("onset_weeks", "")
        onset_html = f'<div style="font-size:0.8em;color:#74b9ff;margin:4px 0">⏱️ 체감까지 약 {onset} — 꾸준히 복용이 중요해요</div>' if onset else ""

        # 개인화 서사 (빈 문자열 대신 주석 처리 → 빈 줄로 인한 HTML 파싱 오류 방지)
        narrative = build_personal_narrative(supp["id"], answers, score_breakdown)
        narrative_html = f'<div style="font-size:0.82em;color:#0984e3;background:#e8f4fd;border-radius:6px;padding:6px 10px;margin:6px 0">💡 {narrative}</div>' if narrative else "<!-- -->"

        matched_html = ""
        if matched_symptoms:
            items = "".join(f'<li style="margin:3px 0">{SYMPTOM_TEXT_MAP.get(s, s)}</li>' for s in matched_symptoms)
            matched_html = f'<div class="symptom-match-box">🎯 <strong>내 증상과 직접 연관:</strong><ul style="margin:4px 0 0 16px;padding:0;font-size:0.9em">{items}</ul></div>'

        caution_html = ""
        if supp.get("caution"):
            caution_items = " / ".join(supp["caution"])
            caution_html = f'<div class="caution-box">⚠️ {caution_items}</div>'

        st.markdown(f"""
        <div class="supp-card">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <div class="supp-name" style="margin:0">{i}. {supp['emoji']} {supp['name']}</div>
                {tier_badge}
                {score_badge}
            </div>
            {onset_html}
            <div style="font-size:0.88em;color:#636e72;margin-bottom:8px;line-height:1.5">{reason_text}</div>
            {narrative_html}
            <span class="mfds-badge">🏛️ {ev['mfds_type']}</span>
            <span class="mfds-badge">📋 {ev['mfds_function']}</span>
            <span class="mfds-badge" style="background:#e8f5e9;color:#2e7d32">{grade_label.get(ev['grade'], '')}</span>
            {matched_html}
            {caution_html}
        </div>
        """, unsafe_allow_html=True)

        # 확장 섹션: 임상 근거 + 피해야 할 것
        with st.expander(f"📚 임상 근거 상세 & 함께 피해야 할 것 보기"):
            st.markdown(f"**🔬 연구:** {ev['study']}")
            st.markdown(f"**📊 결과:** {ev['finding']}")

            # 점수 분해 근거
            top_sources = sorted(score_breakdown.get(top_cat, []), key=lambda x: -x[1])[:4]
            if top_sources:
                st.markdown("---")
                total_cat_score = sum(v for _, v in score_breakdown.get(top_cat, []))
                st.markdown(f"**🔍 {cat_label} 점수 {total_cat_score}점 — 구성 내역:**")
                for src_name, src_val in top_sources:
                    bar = "█" * src_val + "░" * max(0, 5 - src_val)
                    st.markdown(f"<span style='font-size:0.88em;color:#636e72'>{bar} &nbsp; {src_name} (+{src_val}점)</span>", unsafe_allow_html=True)

            food_avoids = SUPPLEMENT_FOOD_AVOID.get(supp["id"], [])
            if food_avoids:
                st.markdown("---")
                st.markdown("**🚫 이 영양소 복용 시 함께 피해야 할 것:**")
                for fa in food_avoids:
                    st.markdown(f"""
                    <div style="background:#fff5f5;border-left:3px solid #d63031;border-radius:0 8px 8px 0;padding:8px 12px;margin:5px 0">
                        <span style="font-weight:600;color:#c0392b">❌ {fa['item']}</span><br>
                        <span style="font-size:0.87em;color:#636e72">{fa['reason']}</span><br>
                        <span style="font-size:0.78em;color:#b2bec3">📄 {fa['evidence']}</span>
                    </div>
                    """, unsafe_allow_html=True)

        st.link_button(coupang["label"], coupang["url"], use_container_width=False)
        if coupang["mode"] == "search":
            st.caption("💡 쿠팡 파트너스 연동 후 구매 수익이 발생합니다")
        st.markdown("<br>", unsafe_allow_html=True)

    if not recommendations:
        st.markdown("---")
        st.markdown("""
        <div style="text-align:center;color:#b2bec3;font-size:0.8em;padding:10px 0">
            ※ 본 분석은 일반적인 건강 정보 제공을 목적으로 하며, 의학적 진단·치료를 대체하지 않습니다.<br>
            건강 이상이 있을 경우 반드시 전문의와 상담하세요.
        </div>
        """, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)
        col1, col2, col3 = st.columns([1, 1, 1])
        with col2:
            if st.button("🔄 다시 하기", use_container_width=True):
                reset()
                st.rerun()
        return

    # ── 복용 스케줄 ────────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("### 📅 추천 복용 스케줄")

    schedule_groups = {"🌅 아침 식후": [], "🌙 저녁 식후·취침 전": [], "🍽️ 식사와 함께": [], "🌿 공복·식전": []}
    timing_map = {
        "아침 식후": "🌅 아침 식후",
        "저녁 식후 또는 취침 1시간 전": "🌙 저녁 식후·취침 전",
        "취침 30~60분 전": "🌙 저녁 식후·취침 전",
        "식사와 함께 (지방 있는 식사 시 흡수 최적)": "🍽️ 식사와 함께",
        "지방 포함 식사와 함께 (아침 또는 점심)": "🍽️ 식사와 함께",
        "지방 포함 식사와 함께 (아침 또는 점심 권장)": "🍽️ 식사와 함께",
        "공복(식전 30분) 또는 식후 — 제품에 따라 다름": "🌿 공복·식전",
        "식전 또는 식사와 함께": "🍽️ 식사와 함께",
        "음주 전후 또는 식후": "🍽️ 식사와 함께",
        "아침 식후 (규칙적 복용 중요)": "🌅 아침 식후",
        "식후 (공복 시 위장 자극 가능)": "🌅 아침 식후",
        "식간(공복)이 최적이나 위장 자극 시 식후 — 비타민C와 함께 복용": "🌿 공복·식전",
        "식후 (공복 시 구역감 가능)": "🌅 아침 식후",
        "저녁 식후 (비타민C 함유 음료와 함께)": "🌙 저녁 식후·취침 전",
    }

    _group_order = ["🌅 아침 식후", "🌿 공복·식전", "🍽️ 식사와 함께", "🌙 저녁 식후·취침 전"]
    _placed = {}  # supp_id → group_name

    for supp, *_ in recommendations:
        timing = supp.get("dosage_guide", {}).get("timing", "아침 식후")
        default_group = timing_map.get(timing, "🌅 아침 식후")

        # Check if any conflict partner is already in the same default group
        conflict_in_group = [
            con["id"] for con in supp.get("conflict", [])
            if _placed.get(con["id"]) == default_group
        ]

        if conflict_in_group:
            # Find alternate group without conflict
            assigned = default_group
            for alt in _group_order:
                if alt == default_group:
                    continue
                if not any(_placed.get(con["id"]) == alt for con in supp.get("conflict", [])):
                    assigned = alt
                    break
            schedule_groups[assigned].append(supp)
            _placed[supp["id"]] = assigned
        else:
            schedule_groups[default_group].append(supp)
            _placed[supp["id"]] = default_group

    for group_name, supps in schedule_groups.items():
        if supps:
            items = " &nbsp;·&nbsp; ".join(f"{s['emoji']} {s['name']}" for s in supps)
            st.markdown(f"""
            <div style="background:white;border-radius:10px;padding:12px 16px;margin:6px 0;box-shadow:0 1px 6px rgba(0,0,0,0.05)">
                <span style="font-weight:700;color:#2d3436">{group_name}</span><br>
                <span style="color:#636e72;font-size:0.9em">{items}</span>
            </div>
            """, unsafe_allow_html=True)

    # 용량 안내 상세
    with st.expander("💊 각 영양제별 권장 용량 및 형태 보기"):
        for supp, *_ in recommendations:
            dg = supp.get("dosage_guide", {})
            if dg:
                st.markdown(f"**{supp['emoji']} {supp['name']}**")
                st.markdown(f"- 권장량: {dg.get('amount', '-')}")
                st.markdown(f"- 복용 시간: {dg.get('timing', '-')}")
                st.markdown(f"- 제품 선택 팁: {dg.get('form', '-')}")
                st.markdown("")

    # ── 영양제 조합 시너지 & 주의사항 ────────────────────────────────────
    recommended_ids = {s["id"] for s, *_ in recommendations}
    synergies_shown = set()
    conflicts_shown = set()
    synergy_items = []
    conflict_items = []

    for supp, *_ in recommendations:
        for syn in supp.get("synergy", []):
            if syn["id"] in recommended_ids:
                key = tuple(sorted([supp["id"], syn["id"]]))
                if key not in synergies_shown:
                    synergies_shown.add(key)
                    other = next((s for s, *_ in recommendations if s["id"] == syn["id"]), None)
                    if other:
                        synergy_items.append(f"✅ **{supp['emoji']} {supp['name']} + {other['emoji']} {other['name']}:** {syn['note']}")
        for con in supp.get("conflict", []):
            if con["id"] in recommended_ids:
                key = tuple(sorted([supp["id"], con["id"]]))
                if key not in conflicts_shown:
                    conflicts_shown.add(key)
                    other = next((s for s, *_ in recommendations if s["id"] == con["id"]), None)
                    if other:
                        conflict_items.append(f"⚠️ **{supp['emoji']} {supp['name']} + {other['emoji']} {other['name']}:** {con['note']}")

    # ── 월간 비용 및 하루 알약 수 요약 ──────────────────────────────────────
    monthly = calculate_monthly_summary(recommendations)
    if monthly["pills_per_day"] > 0:
        st.markdown("---")
        st.markdown("### 💰 예상 월간 비용 & 복용 계획")
        col1, col2 = st.columns(2)
        with col1:
            st.markdown(f"""
            <div style="background:white;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);border-top:4px solid #667eea">
                <div style="font-size:0.8em;color:#636e72;margin-bottom:4px">월간 예상 비용</div>
                <div style="font-size:1.6em;font-weight:800;color:#667eea">{monthly['cost_min']//10000}~{monthly['cost_max']//10000}만원</div>
                <div style="font-size:0.78em;color:#b2bec3;margin-top:4px">쿠팡 기준 추정가 · 브랜드에 따라 다를 수 있음</div>
            </div>
            """, unsafe_allow_html=True)
        with col2:
            st.markdown(f"""
            <div style="background:white;border-radius:12px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);border-top:4px solid #00b894">
                <div style="font-size:0.8em;color:#636e72;margin-bottom:4px">하루 복용량</div>
                <div style="font-size:1.6em;font-weight:800;color:#00b894">{monthly['pills_per_day']}정·캡슐</div>
                <div style="font-size:0.78em;color:#b2bec3;margin-top:4px">{' · '.join(f"{it['name']} {it['pills']}{it['unit']}" for it in monthly['items'])}</div>
            </div>
            """, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

    if synergy_items or conflict_items:
        st.markdown("### ⚡ 추천 조합 분석")
        if synergy_items:
            st.markdown("**함께 복용하면 좋은 조합:**")
            for item in synergy_items:
                st.markdown(item)
        if conflict_items:
            st.markdown("**복용 시간을 분리해야 하는 조합:**")
            for item in conflict_items:
                st.markdown(item)

    # ── 체감 효과 타임라인 ────────────────────────────────────────────────────
    if recommendations:
        st.markdown("---")
        st.markdown("### ⏱️ 체감 효과 타임라인")
        st.caption("추천 영양제별 효과를 느끼기까지 예상 기간입니다. 꾸준한 복용이 핵심이에요.")
        week_map = {"1~2주": (1, 2), "2~4주": (2, 4), "4~8주": (4, 8), "8~12주": (8, 12)}
        color_map = {"1~2주": "#00b894", "2~4주": "#fdcb6e", "4~8주": "#e17055", "8~12주": "#d63031"}
        names_tl, starts_tl, widths_tl, colors_tl, onsets_tl = [], [], [], [], []
        for supp, *_ in recommendations[:6]:
            onset = supp.get("onset_weeks", "4~8주")
            s_w, e_w = week_map.get(onset, (4, 8))
            names_tl.append(supp["name"])
            starts_tl.append(s_w)
            widths_tl.append(e_w - s_w)
            colors_tl.append(color_map.get(onset, "#636e72"))
            onsets_tl.append(onset)
        fig_tl = go.Figure()
        for name, start, width, color, onset in zip(names_tl, starts_tl, widths_tl, colors_tl, onsets_tl):
            fig_tl.add_trace(go.Bar(
                x=[width], base=start, y=[name], orientation="h",
                marker_color=color, name=name, showlegend=False,
                hovertemplate=f"{name}: {onset} 후 체감<extra></extra>",
                text=onset, textposition="inside", textfont=dict(color="white", size=11),
            ))
        fig_tl.update_layout(
            xaxis=dict(title="주(weeks)", tickvals=[1, 2, 4, 8, 12], range=[0, 14]),
            height=max(160, len(names_tl) * 42),
            margin=dict(l=0, r=10, t=10, b=30),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            barmode="overlay",
        )
        st.plotly_chart(fig_tl, use_container_width=True, config={"displayModeBar": False})

    # ── 제외된 영양제 이유 ────────────────────────────────────────────────────
    excluded_candidates = get_excluded_candidates(answers, scores, recommendations, top_n=3)
    if excluded_candidates:
        with st.expander("❌ 이번에 제외된 영양제 (이유 보기)"):
            for ex_supp, ex_reason in excluded_candidates:
                st.markdown(f"**{ex_supp.get('emoji', '')} {ex_supp['name']}** — {ex_reason}")

    # ── 재검사 가이드 ─────────────────────────────────────────────────────────
    st.markdown("### 📅 다음 점검 시기")
    blood_values_check = answers.get("blood_values", {})
    if blood_values_check:
        st.info("혈액 검사 결과를 입력하셨어요. **6개월 후 재검사** 후 결과를 비교해 보세요.")
    else:
        st.info("**3개월 꾸준히 복용** 후 같은 설문을 다시 해보세요. 변화가 점수로 보입니다.")

    st.markdown("---")
    st.markdown("""
    <div style="text-align:center;color:#b2bec3;font-size:0.8em;padding:10px 0">
        ※ 본 추천은 일반적인 건강 정보 제공을 목적으로 하며, 의학적 진단·치료를 대체하지 않습니다.<br>
        건강 이상이 있을 경우 반드시 전문의와 상담하세요.
    </div>
    """, unsafe_allow_html=True)

    # PDF 생성 및 다운로드
    from datetime import date
    pdf_bytes = generate_pdf_bytes(
        answers, scores, persona, recommendations,
        toxicity_warnings, food_advices, fig,
    )
    col1, col2, col3 = st.columns([1, 1, 1])
    with col1:
        st.download_button(
            label="📄 PDF로 저장",
            data=pdf_bytes,
            file_name=f"영양제_추천결과_{date.today().strftime('%Y%m%d')}.pdf",
            mime="application/pdf",
            use_container_width=True,
        )
    with col2:
        if st.button("🔄 다시 하기", use_container_width=True):
            reset()
            st.rerun()


# ── 라우팅 ─────────────────────────────────────────────────────────────────────
STEPS = [
    step_welcome,              # 0
    step_basic_info,           # 1
    step_symptoms,             # 2  ← 증상 먼저
    step_goals,                # 3  ← 목표는 증상 뒤
    step_sleep,                # 4
    step_stress,               # 5
    step_exercise,             # 6
    step_diet,                 # 7
    step_alcohol,              # 8
    step_current_supplements,  # 9  ← 현재 복용 영양제는 후반부로
    step_family_history,       # 10
    step_conditions,           # 11 ← 동적 꼬리 질문 포함
    step_results,              # 12
]

STEPS[st.session_state.step]()
