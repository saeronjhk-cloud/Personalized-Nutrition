"""
맞춤형 건강기능식품 추천 엔진
- 신체 증상 체크리스트 + 라이프스타일 → 카테고리 점수 → 페르소나 → 영양제 추천
"""

# ── 신체 증상 그룹 ─────────────────────────────────────────────────────────────
# 각 증상은 영양소 결핍의 의학적 신호에 기반합니다.
SYMPTOM_GROUPS = [
    {
        "group": "⚡ 에너지 / 피로",
        "symptoms": [
            {
                "id": "chronic_fatigue",
                "text": "항상 무겁고 피곤해요 (충분히 쉬어도 회복이 안 됨)",
                "scores": {"피로": 4},
            },
            {
                "id": "afternoon_slump",
                "text": "오후만 되면 극심하게 졸리고 처져요",
                "scores": {"피로": 3, "면역력": 1},
            },
            {
                "id": "brain_fog",
                "text": "집중이 안 되고 머릿속이 안개 낀 느낌이에요",
                "scores": {"피로": 2, "스트레스": 1},
            },
            {
                "id": "eye_fatigue",
                "text": "눈이 자주 충혈되거나 침침하고 피로해요 (스크린 노출 많음)",
                "scores": {"피로": 2, "스트레스": 1, "눈건강": 3},
            },
        ],
    },
    {
        "group": "😴 수면",
        "symptoms": [
            {
                "id": "leg_cramps_night",
                "text": "자다가 다리·발에 쥐가 자주 나요",
                "scores": {"수면": 3, "근육관절": 2},
            },
            {
                "id": "cant_fall_asleep",
                "text": "잠들기까지 30분~1시간 이상 걸려요",
                "scores": {"수면": 4},
            },
            {
                "id": "wake_night",
                "text": "새벽에 자꾸 깨고 다시 잠들기 어려워요",
                "scores": {"수면": 3, "스트레스": 2},
            },
            {
                "id": "unrefreshing",
                "text": "충분히 잤는데도 개운하지 않아요",
                "scores": {"수면": 2, "피로": 3},
            },
        ],
    },
    {
        "group": "✨ 피부 / 모발",
        "symptoms": [
            {
                "id": "hair_loss",
                "text": "머리카락이 유독 많이 빠져요",
                "scores": {"피부": 3, "피로": 1},
            },
            {
                "id": "brittle_nails",
                "text": "손발톱이 쉽게 부러지거나 세로줄이 생겨요",
                "scores": {"피부": 3},
            },
            {
                "id": "dry_skin",
                "text": "피부가 항상 건조하고 각질이 심해요",
                "scores": {"피부": 4},
            },
            {
                "id": "easy_bruising",
                "text": "살짝 부딪혀도 멍이 잘 들어요",
                "scores": {"피부": 2, "면역력": 2},
            },
            {
                "id": "gum_bleeding",
                "text": "양치할 때 잇몸에서 피가 나요",
                "scores": {"피부": 1, "면역력": 3},
            },
        ],
    },
    {
        "group": "🛡️ 면역 / 감염",
        "symptoms": [
            {
                "id": "frequent_colds",
                "text": "감기·바이러스에 자주 걸려요 (연 3~4회 이상)",
                "scores": {"면역력": 5},
            },
            {
                "id": "slow_healing",
                "text": "작은 상처도 회복이 유독 느려요",
                "scores": {"면역력": 3, "피부": 1},
            },
        ],
    },
    {
        "group": "🦠 소화 / 장",
        "symptoms": [
            {
                "id": "poor_digestion",
                "text": "식후 소화가 안 되고 더부룩해요",
                "scores": {"장건강": 4},
            },
            {
                "id": "irregular_bowel",
                "text": "변비나 설사가 반복돼요",
                "scores": {"장건강": 4},
            },
            {
                "id": "bloating",
                "text": "배에 가스가 자주 차요",
                "scores": {"장건강": 3},
            },
        ],
    },
    {
        "group": "💪 근육 / 관절",
        "symptoms": [
            {
                "id": "muscle_cramps",
                "text": "운동 중이나 쉴 때도 근육 경련(쥐)이 자주 나요",
                "scores": {"근육관절": 3, "수면": 1},
            },
            {
                "id": "joint_stiffness",
                "text": "아침에 일어날 때 관절이 뻣뻣하거나 아파요",
                "scores": {"근육관절": 4},
            },
            {
                "id": "slow_recovery",
                "text": "운동 후 회복이 느려요 (2~3일 이상 근육통)",
                "scores": {"근육관절": 3, "피로": 1},
            },
        ],
    },
    {
        "group": "🧠 기분 / 신경",
        "symptoms": [
            {
                "id": "numbness",
                "text": "손발이 자주 저리거나 따끔거려요",
                "scores": {"스트레스": 2, "피로": 2},
            },
            {
                "id": "anxiety",
                "text": "이유 없이 불안하거나 초조한 느낌이 자주 들어요",
                "scores": {"스트레스": 4},
            },
            {
                "id": "low_mood",
                "text": "무기력하거나 우울한 날이 많아요",
                "scores": {"스트레스": 2, "면역력": 1, "피로": 1},
            },
        ],
    },
    {
        "group": "👁️ 눈 / 시력",
        "symptoms": [
            {
                "id": "blurry_vision",
                "text": "먼 곳이 잘 안 보이거나 초점이 안 맞아요",
                "scores": {"눈건강": 4},
            },
            {
                "id": "dry_eyes",
                "text": "눈이 자주 건조하고 뻑뻑해요",
                "scores": {"눈건강": 4},
            },
            {
                "id": "floaters",
                "text": "눈앞에 날파리 같은 게 보여요",
                "scores": {"눈건강": 3},
            },
        ],
    },
    {
        "group": "🔥 대사 / 혈당",
        "symptoms": [
            {
                "id": "sugar_cravings",
                "text": "단 것이 자꾸 당기고 참기 어려워요",
                "scores": {"혈당대사": 4, "체중관리": 2},
            },
            {
                "id": "post_meal_drowsy",
                "text": "식후에 극심하게 졸려요",
                "scores": {"혈당대사": 3, "피로": 2},
            },
            {
                "id": "thirst_frequent_urination",
                "text": "갈증이 심하고 소변을 자주 봐요",
                "scores": {"혈당대사": 4},
            },
        ],
    },
    {
        "group": "❤️ 심혈관",
        "symptoms": [
            {
                "id": "chest_tightness",
                "text": "가끔 가슴이 답답하거나 두근거려요",
                "scores": {"심혈관": 4},
            },
            {
                "id": "cold_hands_feet",
                "text": "손발이 항상 차가워요",
                "scores": {"심혈관": 3, "피로": 1},
            },
            {
                "id": "leg_swelling",
                "text": "하루 끝에 다리가 자주 부어요",
                "scores": {"심혈관": 3, "체중관리": 1},
            },
        ],
    },
    {
        "group": "🌸 갱년기 / 호르몬",
        "symptoms": [
            {
                "id": "hot_flashes",
                "text": "갑자기 얼굴·상체가 확 달아올라요",
                "scores": {"갱년기": 5},
            },
            {
                "id": "mood_swings",
                "text": "감정 기복이 심하고 짜증이 잘 나요",
                "scores": {"갱년기": 3, "스트레스": 2},
            },
            {
                "id": "vaginal_dryness",
                "text": "피부·점막이 건조하고 불편해요",
                "scores": {"갱년기": 4, "피부": 2},
            },
        ],
    },
]

# 빠른 조회용 플랫 딕셔너리
SYMPTOM_SCORE_MAP = {
    s["id"]: s["scores"]
    for group in SYMPTOM_GROUPS
    for s in group["symptoms"]
}

SYMPTOM_TEXT_MAP = {
    s["id"]: s["text"]
    for group in SYMPTOM_GROUPS
    for s in group["symptoms"]
}


# ── 영양제 데이터베이스 ────────────────────────────────────────────────────────
SUPPLEMENTS = [
    {
        "id": "vitamin_b",
        "onset_weeks": "2~4주",
        "name": "비타민 B 복합체",
        "emoji": "⚙️",
        "description": "에너지 대사의 핵심 조효소. 만성 피로, 집중력 저하, 신경계 기능에 광범위하게 필요해요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "에너지 생성, 신경기능 유지, 피로 회복에 도움",
            "study": "Kennedy et al. (2016). Psychopharmacology, 211(1):55–68",
            "finding": "건강한 성인 남성 대상 무작위 이중맹검 시험. B군 비타민 복합 보충 후 피로 점수 및 인지 기능 유의미하게 개선.",
            "grade": "A",
        },
        "caution": [],
        "search_keyword": "비타민B 복합체",
        "affinity": {"피로": 5, "스트레스": 3, "장건강": 1},
        "dosage_guide": {"amount": "비타민B군 각 25~100mg/일", "timing": "아침 식후", "form": "B-Complex 형태(종합) 추천"},
        "synergy": [{"id": "magnesium", "note": "마그네슘과 함께 에너지 대사 시너지"}],
        "conflict": [],
        "symptom_indicators": ["chronic_fatigue", "afternoon_slump", "brain_fog", "numbness", "low_mood"],
    },
    {
        "id": "magnesium",
        "onset_weeks": "1~2주",
        "name": "마그네슘",
        "emoji": "💤",
        "description": "스트레스·긴장으로 소모된 마그네슘 보충. 수면 질 개선, 근육 이완, 신경 안정에 도움돼요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "에너지 생성, 신경·근육 기능 유지에 필요",
            "study": "Abbasi B, et al. (2012). J Res Med Sci, 17(12):1161–1169",
            "finding": "불면증 노인 환자 46명 대상 8주 이중맹검 임상시험. 마그네슘 보충군에서 수면 효율, 수면 시간, 불면증 점수(ISI) 모두 유의미하게 개선.",
            "grade": "A",
        },
        "caution": ["신장질환자는 전문의 상담 필요"],
        "search_keyword": "마그네슘 글리시네이트",
        "affinity": {"수면": 4, "스트레스": 4, "피로": 2, "근육관절": 2, "혈당대사": 2, "심혈관": 1},
        "dosage_guide": {"amount": "300~400mg/일 (원소 마그네슘 기준)", "timing": "저녁 식후 또는 취침 1시간 전", "form": "글리시네이트·말레이트 형태 추천 (산화마그네슘보다 흡수율 4배)"},
        "synergy": [
            {"id": "vitamin_d", "note": "비타민D 활성화에 마그네슘 필수 — 함께 복용 시 두 가지 효과 모두 극대화"},
            {"id": "vitamin_b", "note": "에너지 대사 경로 공동 작용"},
        ],
        "conflict": [{"id": "iron", "note": "마그네슘과 철분은 흡수 경쟁 — 2시간 간격 복용 권장"}],
        "symptom_indicators": ["leg_cramps_night", "cant_fall_asleep", "wake_night", "muscle_cramps", "anxiety"],
    },
    {
        "id": "omega3",
        "onset_weeks": "4~8주",
        "name": "오메가-3",
        "emoji": "🐟",
        "description": "혈중 중성지방 감소, 뇌·눈 건강, 항염 효과. 외식이 잦을수록 특히 중요해요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "혈중 중성지방 개선, 혈행 개선에 도움",
            "study": "Bhatt DL, et al. (2019). REDUCE-IT Trial. N Engl J Med, 380:11–22",
            "finding": "8,179명 대상 대규모 무작위 임상시험. 고순도 EPA 보충 시 심혈관 이상 위험 25% 감소, 혈중 중성지방 유의미한 개선.",
            "grade": "A",
        },
        "caution": ["항혈전제(와파린 등) 복용 시 의사 상담 필요"],
        "search_keyword": "오메가3 EPA DHA",
        "affinity": {"피부": 2, "면역력": 2, "간건강": 1, "장건강": 1, "피로": 1, "심혈관": 3, "인지기능": 2},
        "dosage_guide": {"amount": "EPA+DHA 합계 1,000~2,000mg/일", "timing": "식사와 함께 (지방 있는 식사 시 흡수 최적)", "form": "rTG 형태 추천 (EE 형태보다 흡수율 약 70% 높음)"},
        "synergy": [
            {"id": "vitamin_d", "note": "지용성 영양소 — 함께 복용 시 오메가-3가 비타민D 흡수 도움"},
            {"id": "vitamin_e", "note": "항산화 보호 시너지"},
        ],
        "conflict": [],
        "symptom_indicators": ["dry_skin", "joint_stiffness", "anxiety", "low_mood"],
    },
    {
        "id": "vitamin_d",
        "onset_weeks": "8~12주",
        "name": "비타민 D3",
        "emoji": "☀️",
        "description": "실내 생활이 많은 현대인의 필수 비타민. 면역력·뼈 건강·기분 안정에 영향을 줘요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "칼슘·인 흡수 촉진, 면역기능 유지에 필요",
            "study": "Martineau AR, et al. (2017). BMJ, 356:i6583 (메타분석)",
            "finding": "11,321명 대상 25개 무작위 임상시험 메타분석. 비타민D 보충 시 급성 호흡기 감염 위험 12% 감소. 결핍자에서는 42% 감소.",
            "grade": "A",
        },
        "caution": ["고용량(4,000IU 이상) 장기 복용 시 전문가 상담 권장"],
        "search_keyword": "비타민D3 2000IU",
        "affinity": {"면역력": 4, "피로": 2, "근육관절": 2, "스트레스": 1, "갱년기": 1},
        "dosage_guide": {"amount": "1,000~2,000 IU/일 (결핍 시 4,000 IU)", "timing": "지방 포함 식사와 함께 (아침 또는 점심 권장)", "form": "D3 형태 추천 (D2보다 체내 이용률 2배)"},
        "synergy": [
            {"id": "magnesium", "note": "마그네슘이 비타민D 대사 효소 활성화 — 상호 보완"},
            {"id": "omega3", "note": "지용성 영양소 흡수 상호 도움"},
        ],
        "conflict": [],
        "symptom_indicators": ["frequent_colds", "chronic_fatigue", "low_mood", "afternoon_slump", "joint_stiffness"],
    },
    {
        "id": "probiotics",
        "onset_weeks": "2~4주",
        "name": "프로바이오틱스",
        "emoji": "🦠",
        "description": "장내 유익균 증식, 소화 개선, 면역력 강화. 장이 건강해야 몸 전체가 건강해요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "장내 유익균 증식·유해균 억제에 도움",
            "study": "Hempel S, et al. (2012). JAMA, 307(18):1959–1969 (메타분석)",
            "finding": "82개 임상시험 메타분석. 유산균 섭취 그룹에서 장 기능 이상 비율 42% 유의미하게 감소.",
            "grade": "A",
        },
        "caution": [],
        "search_keyword": "프로바이오틱스 유산균",
        "affinity": {"장건강": 5, "면역력": 3, "피부": 2, "체중관리": 1},
        "dosage_guide": {"amount": "1억~100억 CFU/일", "timing": "공복(식전 30분) 또는 식후 — 제품에 따라 다름", "form": "다균주(5종 이상) 제품 추천, 냉장 보관 필수"},
        "synergy": [{"id": "vitamin_b", "note": "장내 유익균이 비타민B군 합성에 기여"}],
        "conflict": [],
        "symptom_indicators": ["poor_digestion", "irregular_bowel", "bloating", "frequent_colds"],
    },
    {
        "id": "milk_thistle",
        "onset_weeks": "4~8주",
        "name": "밀크씨슬",
        "emoji": "🌿",
        "description": "간세포 보호의 대명사. 음주·약물·환경독소로부터 간을 지키는 핵심 성분이에요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "간 기능 개선에 도움",
            "study": "Saller R, et al. (2008). Drugs, 68(10):1–29 (체계적 문헌고찰)",
            "finding": "실리마린(밀크씨슬 활성 성분) 임상연구 체계적 고찰. 간 손상 지표(ALT·AST) 유의미한 감소 및 간세포 보호 효과 확인.",
            "grade": "A",
        },
        "caution": ["임산부·수유부 전문의 상담 권장"],
        "search_keyword": "밀크씨슬 실리마린",
        "affinity": {"간건강": 5, "피로": 2},
        "dosage_guide": {"amount": "실리마린 140~420mg/일 (밀크씨슬 70% 추출물 기준)", "timing": "식전 또는 식사와 함께", "form": "실리마린 함량 70% 이상 추출물 확인"},
        "synergy": [],
        "conflict": [],
        "symptom_indicators": ["chronic_fatigue", "afternoon_slump"],
    },
    {
        "id": "vitamin_c",
        "onset_weeks": "1~2주",
        "name": "비타민 C",
        "emoji": "🍊",
        "description": "항산화의 기본. 면역력 강화, 피부 콜라겐 합성, 피로 회복에 다방면으로 활약해요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "항산화, 피부 건강, 면역기능 유지에 도움",
            "study": "Hemilä H & Chalker E. (2013). Cochrane Database Syst Rev (메타분석)",
            "finding": "29개 임상시험(11,306명) 메타분석. 비타민C 정기 복용 시 감기 지속기간 성인 8%, 아동 14% 단축. 멍·잇몸 출혈은 결핍의 초기 신호.",
            "grade": "A",
        },
        "caution": [],
        "search_keyword": "비타민C 고함량 1000mg",
        "affinity": {"면역력": 4, "피부": 3, "피로": 3, "스트레스": 2},
        "dosage_guide": {"amount": "500~1,000mg/일 (상한 2,000mg)", "timing": "식후 (공복 시 위장 자극 가능)", "form": "일반 L-아스코르빈산 또는 완충형(Ester-C) 추천"},
        "synergy": [
            {"id": "iron", "note": "철분과 함께 복용 시 철분 흡수율 2~3배 향상"},
            {"id": "collagen", "note": "콜라겐 합성에 비타민C 필수 — 시너지 효과"},
        ],
        "conflict": [],
        "symptom_indicators": ["frequent_colds", "slow_healing", "easy_bruising", "gum_bleeding", "dry_skin"],
    },
    {
        "id": "lemon_balm",
        "onset_weeks": "1~2주",
        "name": "레몬밤 추출물",
        "emoji": "🍋",
        "description": "천연 허브로 수면 질 개선, 불안 완화. 자기 전 복용으로 자연스러운 수면 유도.",
        "evidence": {
            "mfds_type": "개별인정형 기능성 원료 (인정번호 제2013-22호)",
            "mfds_function": "수면의 질 개선에 도움",
            "study": "Cases J, et al. (2011). Mediterr J Nutr Metab, 4(3):211–218",
            "finding": "불안·수면 장애 성인 225명 대상 15일 임상시험. 레몬밤 추출물 복용 후 불안 증상 18%, 불면 증상 42% 개선.",
            "grade": "B",
        },
        "caution": [
            "수면제·항우울제·갑상선 약물 복용 시 반드시 의사 상담",
            "임산부·수유부 사용 금지",
        ],
        "blocked_conditions": ["임산부_수유부", "약물복용중"],
        "search_keyword": "레몬밤 추출물 수면",
        "affinity": {"수면": 4, "스트레스": 4},
        "dosage_guide": {"amount": "300~600mg/일 (레몬밤 추출물)", "timing": "취침 30~60분 전", "form": "로즈마린산 함량 확인"},
        "synergy": [{"id": "magnesium", "note": "마그네슘과 함께 수면 질 개선 시너지"}],
        "conflict": [],
        "symptom_indicators": ["cant_fall_asleep", "wake_night", "anxiety"],
    },
    {
        "id": "collagen",
        "onset_weeks": "4~8주",
        "name": "저분자 콜라겐",
        "emoji": "✨",
        "description": "피부 탄력·보습, 관절 건강에 도움. 30대 이후 콜라겐 생성이 자연스럽게 줄어들어요.",
        "evidence": {
            "mfds_type": "개별인정형 기능성 원료",
            "mfds_function": "피부 보습에 도움",
            "study": "Proksch E, et al. (2014). Skin Pharmacol Physiol, 27(1):47–55",
            "finding": "건강한 여성 69명 대상 8주 이중맹검 임상시험. 저분자 콜라겐 펩타이드 복용 후 피부 탄력 15%, 보습도 유의미하게 개선.",
            "grade": "A",
        },
        "caution": [],
        "search_keyword": "저분자 콜라겐 펩타이드",
        "affinity": {"피부": 5, "근육관절": 3},
        "dosage_guide": {"amount": "5,000~10,000mg/일 (콜라겐 펩타이드)", "timing": "저녁 식후 (비타민C 함유 음료와 함께)", "form": "저분자(분자량 2,000 Da 이하) 가수분해 콜라겐 추천"},
        "synergy": [{"id": "vitamin_c", "note": "비타민C는 체내 콜라겐 합성 필수 보조인자 — 함께 복용 강력 권장"}],
        "conflict": [],
        "symptom_indicators": ["dry_skin", "brittle_nails", "hair_loss", "joint_stiffness"],
    },
    {
        "id": "coq10",
        "onset_weeks": "4~8주",
        "name": "코엔자임 Q10",
        "emoji": "⚡",
        "description": "세포 에너지 생산의 핵심 조효소. 극심한 피로, 스태미나 저하에 효과적이에요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "항산화에 도움",
            "study": "Mizuno K, et al. (2008). Nutrition, 24(4):293–299",
            "finding": "만성피로 호소 성인 대상 8주 무작위 임상시험. CoQ10 보충군에서 피로 점수(VAS) 및 주관적 피로감 유의미하게 감소.",
            "grade": "A",
        },
        "caution": ["혈압약·항응고제 복용 시 의사 상담 필요"],
        "search_keyword": "코큐텐 CoQ10",
        "affinity": {"피로": 5, "근육관절": 2, "심혈관": 3},
        "dosage_guide": {"amount": "100~300mg/일", "timing": "지방 포함 식사와 함께 (아침 또는 점심)", "form": "유비퀴놀(Ubiquinol) 형태 추천 (유비퀴논보다 흡수율 높음, 특히 40대 이상)"},
        "synergy": [{"id": "omega3", "note": "지용성 영양소 — 함께 복용 시 상호 흡수 도움"}],
        "conflict": [],
        "symptom_indicators": ["chronic_fatigue", "afternoon_slump", "slow_recovery"],
    },
    {
        "id": "iron",
        "onset_weeks": "4~8주",
        "name": "철분 (헴철)",
        "emoji": "🩸",
        "description": "빈혈 예방, 산소 운반 능력 향상. 특히 여성·채식주의자에게 중요한 영양소예요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "혈액 생성, 산소 운반에 필요",
            "study": "Vaucher P, et al. (2012). CMAJ, 184(11):1247–1254",
            "finding": "페리틴 낮은 월경 여성 198명 대상 12주 무작위 임상시험. 철분 보충 후 피로 점수 48% 개선.",
            "grade": "A",
        },
        "caution": ["공복 복용 시 위장 불편감 가능", "남성 과다 복용 주의"],
        "search_keyword": "헴철 철분 영양제",
        "affinity": {"피로": 4, "면역력": 2},
        "gender_boost": {"여성": 3},
        "dosage_guide": {"amount": "18~45mg/일 (원소 철분 기준, 여성 기준)", "timing": "식간(공복)이 최적이나 위장 자극 시 식후 — 비타민C와 함께 복용", "form": "헴철 또는 피로인산철 추천 (황산철보다 흡수율 높고 부작용 적음)"},
        "synergy": [{"id": "vitamin_c", "note": "비타민C와 동시 복용 시 철분 흡수율 2~3배 증가"}],
        "conflict": [
            {"id": "magnesium", "note": "마그네슘과 동시 복용 시 철분 흡수 감소 — 2시간 간격 권장"},
            {"id": "zinc", "note": "아연과 동시 복용 시 상호 흡수 경쟁 — 시간대 분리 권장"},
        ],
        "symptom_indicators": ["chronic_fatigue", "afternoon_slump", "hair_loss", "unrefreshing"],
    },
    {
        "id": "zinc",
        "onset_weeks": "2~4주",
        "name": "아연",
        "emoji": "🛡️",
        "description": "면역의 최전선. 감기·바이러스 저항력, 피부 재생, 남성 건강에도 중요한 미네랄이에요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "면역기능, 세포분열에 필요",
            "study": "Hemilä H. (2011). Open Respir Med J, 5:51–58 (메타분석)",
            "finding": "아연 관련 13개 임상시험 메타분석. 감기 발병 24시간 이내 복용 시 감기 지속기간 33% 단축.",
            "grade": "A",
        },
        "caution": ["과다 복용(40mg/일 이상) 시 구역감 가능"],
        "search_keyword": "아연 징크 영양제",
        "affinity": {"면역력": 4, "피부": 3, "피로": 1},
        "dosage_guide": {"amount": "8~25mg/일 (원소 아연 기준)", "timing": "식후 (공복 시 구역감 가능)", "form": "아연 글루코네이트·피콜리네이트·시트레이트 형태 추천"},
        "synergy": [],
        "conflict": [{"id": "iron", "note": "철분과 동시 복용 시 상호 흡수 경쟁 — 시간대 분리 권장"}],
        "symptom_indicators": ["frequent_colds", "slow_healing", "hair_loss", "brittle_nails"],
    },
    {
        "id": "gaba",
        "onset_weeks": "1~2주",
        "name": "GABA (가바)",
        "emoji": "🧘",
        "description": "뇌의 흥분을 억제하는 천연 안정제. 스트레스 완화, 숙면 유도에 도움돼요.",
        "evidence": {
            "mfds_type": "개별인정형 기능성 원료 (인정번호 제2018-4호)",
            "mfds_function": "스트레스 완화, 수면의 질 개선에 도움",
            "study": "Byun JI, et al. (2018). J Clin Neurol, 14(3):291–295",
            "finding": "수면장애 성인 40명 대상 4주 무작위 이중맹검 임상시험. GABA 보충 후 수면 잠복기 5.3분 단축, 수면 효율 유의미하게 개선.",
            "grade": "A",
        },
        "caution": ["임산부·수유부 주의", "고칼슘혈증 환자 주의"],
        "blocked_conditions": ["임산부_수유부"],
        "search_keyword": "가바 GABA 수면",
        "affinity": {"수면": 5, "스트레스": 4},
        "dosage_guide": {"amount": "100~300mg/일", "timing": "취침 30~60분 전", "form": "발효 GABA(PharmaGABA) 추천"},
        "synergy": [{"id": "lemon_balm", "note": "레몬밤과 함께 수면 질 개선 효과 강화"}],
        "conflict": [],
        "symptom_indicators": ["cant_fall_asleep", "wake_night", "anxiety", "leg_cramps_night"],
    },
    {
        "id": "headache_tree",
        "onset_weeks": "1~2주",
        "name": "헛개나무과병추출물",
        "emoji": "🌳",
        "description": "음주 후 간 보호, 숙취 해소. 식약처 인정 성분으로 간 손상 보호에 탁월해요.",
        "evidence": {
            "mfds_type": "개별인정형 기능성 원료",
            "mfds_function": "음주로 인한 피로 회복에 도움",
            "study": "Song YO, et al. (2011). Food Chem Toxicol, 49(7):1550–1555",
            "finding": "동물 모델 및 세포 실험에서 헛개나무 추출물의 간세포 보호 효과(ALT·AST 감소) 및 항산화 활성 확인.",
            "grade": "B",
        },
        "caution": [],
        "search_keyword": "헛개나무 과병추출물",
        "affinity": {"간건강": 3, "피로": 1},
        "drink_boost": 4,
        "dosage_guide": {"amount": "헛개나무과병추출물 900~1,500mg/일", "timing": "음주 전후 또는 식후", "form": "식약처 인정 기능성 함량 확인"},
        "synergy": [{"id": "milk_thistle", "note": "밀크씨슬과 함께 간 보호 이중 작용"}],
        "conflict": [],
        "symptom_indicators": ["chronic_fatigue", "afternoon_slump"],
    },
    {
        "id": "folic_acid",
        "onset_weeks": "4~8주",
        "name": "엽산",
        "emoji": "🤱",
        "description": "임신 초기 필수 영양소. 태아 신경관 발달에 매우 중요하며 임신 계획 중에도 복용 권장해요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "세포분열, 태아 신경관 발달에 도움",
            "study": "MRC Vitamin Study Research Group. (1991). Lancet, 338(8760):131–137",
            "finding": "신경관 결손 위험 여성 1,817명 대상 무작위 임상시험. 엽산 보충 시 신경관 결손 발생률 72% 감소.",
            "grade": "A",
        },
        "caution": ["임신 계획 3개월 전부터 복용 권장"],
        "required_conditions": ["임산부_수유부"],
        "search_keyword": "엽산 임산부 영양제",
        "affinity": {"면역력": 1, "피로": 1},
        "dosage_guide": {"amount": "400~800mcg/일 (임신 중 600mcg)", "timing": "아침 식후 (규칙적 복용 중요)", "form": "메틸폴레이트(5-MTHF) 형태 추천 (MTHFR 유전변이 시 더 효과적)"},
        "synergy": [{"id": "vitamin_b", "note": "비타민B12와 함께 엽산 대사 최적화"}],
        "conflict": [],
        "symptom_indicators": [],
    },
    {
        "id": "vitamin_e",
        "onset_weeks": "4~8주",
        "name": "비타민 E",
        "emoji": "🌻",
        "description": "강력한 지용성 항산화제. 세포막 산화 손상을 막고 피부 노화 방지와 면역 기능을 지원해요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "항산화에 도움",
            "study": "Sies H, et al. (2019). Nat Rev Mol Cell Biol, 20:674–688",
            "finding": "비타민E(토코페롤)는 지질 과산화 억제를 통해 세포막 산화 손상을 방지하며, 면역세포 활성 및 항염 기능 지원이 다수 연구에서 확인됨.",
            "grade": "B",
        },
        "caution": ["고용량(400 IU 이상) 장기 복용 시 출혈 경향 증가 가능", "항응고제 복용 시 의사 상담 필수"],
        "search_keyword": "비타민E 토코페롤",
        "affinity": {"피부": 3, "면역력": 2, "피로": 1},
        "dosage_guide": {
            "amount": "천연 비타민E(d-알파-토코페롤) 기준 15mg(22 IU)/일 — 상한선 1,000mg/일",
            "timing": "지방 포함 식사와 함께 (아침 또는 점심 권장)",
            "form": "천연형(d-알파-토코페롤) > 합성형(dl-알파-토코페롤), 혼합 토코페롤 제품 권장",
        },
        "synergy": [
            {"id": "omega3", "note": "오메가-3 불포화지방산 산화를 억제해 안정성과 효과 향상"},
            {"id": "vitamin_c", "note": "비타민C가 산화된 비타민E를 재생 → 항산화 사이클 시너지"},
        ],
        "conflict": [],
        "symptom_indicators": ["dry_skin", "hair_loss", "easy_bruising"],
    },
    {
        "id": "red_ginseng",
        "onset_weeks": "4~8주",
        "name": "홍삼",
        "emoji": "🌿",
        "description": "면역력 향상과 피로 개선의 대표 성분. 스트레스 반응 조절과 활력 회복에 도움을 줍니다.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "면역력 증진, 피로 개선, 항산화에 도움",
            "study": "Kim SH, et al. (2013). J Ginseng Res, 37(1):123–133",
            "finding": "홍삼 추출물 8주 복용 시 NK세포 활성 유의미하게 증가, 피로 지표(VAS) 개선 — 다수 RCT 및 코호트 연구에서 일관된 결과 확인.",
            "grade": "B",
        },
        "caution": ["혈압약·항응고제 복용 시 상호작용 가능 — 의사 상담", "불면증·두근거림 발생 시 복용 중단"],
        "search_keyword": "홍삼 6년근 홍삼정",
        "affinity": {"면역력": 3, "피로": 3, "스트레스": 2},
        "dosage_guide": {
            "amount": "홍삼 진세노사이드 기준 2.4~80mg/일 (제품별 함량 확인)",
            "timing": "아침 식후 (규칙적 복용 중요)",
            "form": "진세노사이드 Rg1·Rb1 함량 명시 제품 선택",
        },
        "synergy": [{"id": "vitamin_c", "note": "비타민C가 홍삼의 항산화 효과를 증폭"}],
        "conflict": [],
        "symptom_indicators": ["chronic_fatigue", "frequent_colds", "brain_fog"],
    },
    {
        "id": "calcium",
        "onset_weeks": "8~12주",
        "name": "칼슘",
        "emoji": "🦴",
        "description": "뼈와 치아의 기본 재료. 근육 수축, 신경 전달, 혈액 응고에도 필수적인 미네랄이에요.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "뼈와 치아 형성에 필요, 신경 및 근육 기능 유지에 필요",
            "study": "Reid IR, et al. (2008). Lancet, 372(9638):543–544",
            "finding": "칼슘 보충제 복용 시 골밀도 유지 및 골절 위험 감소 — 특히 폐경 이후 여성과 50대 이상에서 효과 뚜렷.",
            "grade": "A",
        },
        "caution": ["고용량(1,000mg 이상/일) 장기 복용 시 심혈관 위험 논란 있음 — 식이 우선 권고", "신장결석 이력 있으면 의사 상담"],
        "search_keyword": "칼슘 마그네슘 비타민D",
        "affinity": {"근육관절": 4, "피로": 1, "갱년기": 2},
        "gender_boost": {"여성": 4},
        "dosage_guide": {
            "amount": "500~1,000mg/일 (원소 칼슘 기준, 1회 500mg 이하로 분할 복용)",
            "timing": "식사와 함께 (지방 있는 식사 시 흡수 최적)",
            "form": "구연산칼슘(Calcium Citrate) 추천 — 공복 흡수 가능, 탄산칼슘보다 부작용 적음",
        },
        "synergy": [
            {"id": "vitamin_d", "note": "비타민D가 칼슘 흡수율을 최대 40% 향상"},
            {"id": "magnesium", "note": "칼슘·마그네슘 2:1 비율이 근육·신경 균형 유지"},
        ],
        "conflict": [
            {"id": "iron", "note": "칼슘이 철분 흡수를 억제 — 2시간 간격 복용 권장"},
            {"id": "zinc", "note": "고용량 칼슘이 아연 흡수 감소 가능 — 식사 시 분리"},
        ],
        "symptom_indicators": ["leg_cramps_night", "muscle_cramps", "joint_stiffness"],
    },
    {
        "id": "lutein",
        "onset_weeks": "4~8주",
        "name": "루테인",
        "emoji": "👁️",
        "description": "눈 황반의 핵심 색소. 청색광 차단, 황반변성 예방, 눈 피로 개선에 도움을 줍니다.",
        "evidence": {
            "mfds_type": "고시형 기능성 원료",
            "mfds_function": "노화로 인한 황반변성 위험 감소에 도움",
            "study": "AREDS2 Research Group. (2013). JAMA, 309(19):2005–2015",
            "finding": "4,203명 대규모 임상시험. 루테인·지아잔틴 보충 시 황반변성 진행 위험 18~25% 감소. 디지털 눈 피로 감소 효과도 다수 연구에서 확인.",
            "grade": "A",
        },
        "caution": ["흡연자는 베타카로틴 복합제품 주의 (폐암 위험 연구 있음)"],
        "search_keyword": "루테인 지아잔틴 마리골드",
        "affinity": {"피로": 3, "피부": 1, "눈건강": 5},
        "dosage_guide": {
            "amount": "루테인 10~20mg/일 + 지아잔틴 2mg 이상 포함 제품",
            "timing": "지방 포함 식사와 함께 (아침 또는 점심 권장)",
            "form": "마리골드 추출물 형태, 지아잔틴 포함 제품 추천",
        },
        "synergy": [{"id": "omega3", "note": "오메가-3 DHA가 망막 세포막 구성 지원 — 눈 건강 시너지"}],
        "conflict": [],
        "symptom_indicators": ["eye_fatigue", "brain_fog", "blurry_vision", "dry_eyes", "floaters"],
    },
    {
        "id": "chromium",
        "onset_weeks": "4~8주",
        "name": "크롬 (크롬 피콜리네이트)",
        "emoji": "🩸",
        "description": "인슐린 민감성 향상, 혈당 조절 보조. 식약처 인정 기능성 원료.",
        "evidence": {
            "mfds_type": "고시형",
            "mfds_function": "체내 탄수화물·지방·단백질 대사에 필요",
            "study": "Anderson RA, et al. (1997). Diabetes, 46(11):1786-1791",
            "finding": "180명 2형 당뇨 환자 대상 4개월 무작위 임상시험. 크롬 보충 시 HbA1c, 공복혈당 유의미하게 감소.",
            "grade": "A",
        },
        "caution": ["당뇨약(메트포르민 등) 복용 시 저혈당 가능 — 의사 상담 필수", "신장질환자 주의"],
        "search_keyword": "크롬 피콜리네이트 혈당",
        "affinity": {"혈당대사": 5, "체중관리": 2, "피로": 1},
        "dosage_guide": {"amount": "200~1,000mcg/일", "timing": "식사와 함께", "form": "크롬 피콜리네이트 형태 추천"},
        "synergy": [{"id": "magnesium", "note": "인슐린 신호 전달 시너지"}],
        "conflict": [],
        "symptom_indicators": ["sugar_cravings", "post_meal_drowsy", "thirst_frequent_urination"],
    },
    {
        "id": "banaba_leaf",
        "onset_weeks": "2~4주",
        "name": "바나바잎 추출물",
        "emoji": "🍃",
        "description": "코로솔산 성분이 혈당 흡수 억제. 식약처 개별인정 원료.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "식후 혈당 상승 억제에 도움",
            "study": "Fukushima M, et al. (2006). J Ethnopharmacol, 104(3):326-331",
            "finding": "당뇨 환자 대상 코로솔산 혈당 강하 효과 확인.",
            "grade": "B",
        },
        "caution": ["당뇨약 병용 시 저혈당 주의"],
        "search_keyword": "바나바잎 코로솔산 혈당",
        "affinity": {"혈당대사": 4, "체중관리": 2},
        "dosage_guide": {"amount": "코로솔산 0.45~0.9mg/일", "timing": "식전 30분", "form": "바나바잎 추출물"},
        "synergy": [{"id": "chromium", "note": "혈당 조절 이중 작용"}],
        "conflict": [],
        "symptom_indicators": ["sugar_cravings", "post_meal_drowsy"],
    },
    {
        "id": "saw_palmetto",
        "onset_weeks": "4~8주",
        "name": "쏘팔메토",
        "emoji": "🌴",
        "description": "전립선 건강의 대표 성분. 중년 남성 배뇨 기능 개선.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "전립선 건강에 도움",
            "study": "Wilt T, et al. (2000). Cochrane Database Syst Rev",
            "finding": "18개 RCT 메타분석, 배뇨 증상 개선 확인.",
            "grade": "A",
        },
        "caution": ["항응고제 복용 시 주의", "전립선암 검사(PSA) 수치에 영향 가능 — 검사 전 의사에게 고지"],
        "search_keyword": "쏘팔메토 전립선 영양제",
        "affinity": {"갱년기": 3, "면역력": 1},
        "gender_boost": {"남성": 5},
        "dosage_guide": {"amount": "쏘팔메토 추출물 320mg/일", "timing": "식사와 함께", "form": "표준화된 추출물"},
        "synergy": [],
        "conflict": [],
        "symptom_indicators": [],
    },
    {
        "id": "gamma_linolenic",
        "onset_weeks": "4~8주",
        "name": "감마리놀렌산 (GLA)",
        "emoji": "🌻",
        "description": "달맞이꽃종자유의 핵심 성분. 월경 전 불편함 완화, 피부 건강 개선.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "월경 전 변화에 의한 불편함 개선에 도움",
            "study": "Khoo SK, et al. (2008). Complement Ther Med, 16(4):196-203",
            "finding": "PMS 여성 대상 RCT, GLA 복용 후 증상 유의미하게 감소.",
            "grade": "B",
        },
        "caution": ["항응고제 복용 시 출혈 위험", "간질 약물 병용 주의"],
        "search_keyword": "감마리놀렌산 GLA 달맞이꽃종자유",
        "affinity": {"갱년기": 4, "피부": 3},
        "gender_boost": {"여성": 4},
        "dosage_guide": {"amount": "GLA 180~240mg/일 (달맞이꽃종자유 1,000~2,000mg)", "timing": "식사와 함께", "form": "달맞이꽃종자유 추출물"},
        "synergy": [{"id": "omega3", "note": "항염 시너지"}],
        "conflict": [],
        "symptom_indicators": ["mood_swings", "dry_skin", "vaginal_dryness"],
    },
    {
        "id": "msm",
        "onset_weeks": "4~12주",
        "name": "MSM (메틸설포닐메탄)",
        "emoji": "💪",
        "description": "관절 건강과 연골 보호. 식약처 인정 관절 건강 기능성 원료.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "관절 및 연골 건강에 도움",
            "study": "Kim LS, et al. (2006). Osteoarthritis Cartilage, 14(3):286-294",
            "finding": "50명 골관절염 환자 12주 RCT, 관절 통증·기능 유의미하게 개선.",
            "grade": "A",
        },
        "caution": ["혈액 희석제 복용 시 주의"],
        "search_keyword": "MSM 메틸설포닐메탄 관절",
        "affinity": {"근육관절": 5, "피부": 1},
        "dosage_guide": {"amount": "1,500~3,000mg/일", "timing": "식사와 함께 2~3회 분할 복용", "form": "순수 MSM 분말 또는 캡슐"},
        "synergy": [{"id": "collagen", "note": "관절 건강 시너지"}, {"id": "vitamin_c", "note": "MSM 흡수 보조"}],
        "conflict": [],
        "symptom_indicators": ["joint_stiffness", "slow_recovery", "muscle_cramps"],
    },
    {
        "id": "garcinia",
        "onset_weeks": "4~8주",
        "name": "가르시니아캄보지아 (HCA)",
        "emoji": "🍋",
        "description": "체지방 감소 도움. 식약처 인정 기능성 원료. 탄수화물→지방 전환 억제.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "체지방 감소에 도움",
            "study": "Onakpoya I, et al. (2011). J Obes, 2011:509038",
            "finding": "12개 RCT 메타분석, 체지방 감소 효과 확인 (단기).",
            "grade": "B",
        },
        "caution": ["간독성 보고 사례 있음 — 권장량 초과 금지", "당뇨약 병용 시 주의"],
        "search_keyword": "가르시니아 HCA 체지방",
        "affinity": {"체중관리": 5, "혈당대사": 2},
        "dosage_guide": {"amount": "HCA 750~1,500mg/일", "timing": "식전 30~60분", "form": "HCA 50% 이상 함유 제품"},
        "synergy": [{"id": "chromium", "note": "혈당·체지방 시너지"}],
        "conflict": [],
        "symptom_indicators": ["sugar_cravings"],
    },
    {
        "id": "vitamin_k2",
        "onset_weeks": "8~12주",
        "name": "비타민 K2 (MK-7)",
        "emoji": "🦴",
        "description": "칼슘을 뼈로 보내고 혈관 석회화 방지. 비타민D와 필수 파트너.",
        "evidence": {
            "mfds_type": "고시형",
            "mfds_function": "정상적인 혈액 응고, 뼈 건강에 필요",
            "study": "Knapen MH, et al. (2013). Osteoporos Int, 24(9):2499-2507",
            "finding": "폐경 여성 244명 3년 RCT, MK-7 보충 시 골밀도 유지·혈관 탄력 개선.",
            "grade": "A",
        },
        "caution": ["와파린 복용 시 절대 금기 — 항응고 효과 상쇄", "항응고제 복용자는 반드시 의사 상담"],
        "search_keyword": "비타민K2 MK-7 나토",
        "affinity": {"근육관절": 3, "심혈관": 3},
        "dosage_guide": {"amount": "MK-7 100~200mcg/일", "timing": "지방 포함 식사와 함께", "form": "MK-7 형태 추천"},
        "synergy": [{"id": "vitamin_d", "note": "칼슘 대사 최적화 필수 파트너"}, {"id": "calcium", "note": "칼슘의 올바른 침착 유도"}],
        "conflict": [],
        "symptom_indicators": ["joint_stiffness"],
    },
    {
        "id": "selenium",
        "onset_weeks": "4~8주",
        "name": "셀레늄",
        "emoji": "🛡️",
        "description": "강력한 항산화 미네랄. 갑상선 기능, 면역력, 정자 건강에 중요.",
        "evidence": {
            "mfds_type": "고시형",
            "mfds_function": "유해산소로부터 세포 보호에 필요",
            "study": "Rayman MP. (2012). Lancet, 379(9822):1256-1268",
            "finding": "셀레늄 보충이 면역 기능 향상, 갑상선 기능 지원에 유효.",
            "grade": "A",
        },
        "caution": ["고용량(400mcg 이상) 독성 주의", "브라질넛 과다 섭취 시 과잉 가능"],
        "search_keyword": "셀레늄 셀레노메티오닌",
        "affinity": {"면역력": 3, "갱년기": 2, "피부": 1},
        "dosage_guide": {"amount": "50~200mcg/일", "timing": "식사와 함께", "form": "셀레노메티오닌 형태 추천"},
        "synergy": [{"id": "vitamin_e", "note": "항산화 시너지"}, {"id": "zinc", "note": "면역 기능 시너지"}],
        "conflict": [],
        "symptom_indicators": ["frequent_colds", "hair_loss"],
    },
    {
        "id": "red_clover",
        "onset_weeks": "4~12주",
        "name": "레드클로버 (이소플라본)",
        "emoji": "🌺",
        "description": "식물성 에스트로겐. 갱년기 안면홍조, 골밀도 저하 완화.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "갱년기 여성 건강에 도움",
            "study": "Tice JA, et al. (2003). JAMA, 290(2):207-214",
            "finding": "252명 폐경 여성 RCT, 이소플라본 보충 후 안면홍조 빈도 감소.",
            "grade": "B",
        },
        "caution": ["유방암·자궁암 병력 시 사용 금지", "호르몬 치료 중 의사 상담 필수", "임산부·수유부 금기"],
        "search_keyword": "레드클로버 이소플라본 갱년기",
        "affinity": {"갱년기": 5, "근육관절": 2},
        "gender_boost": {"여성": 5},
        "blocked_conditions": ["임산부_수유부"],
        "dosage_guide": {"amount": "이소플라본 40~80mg/일", "timing": "식사와 함께", "form": "레드클로버 추출물"},
        "synergy": [{"id": "calcium", "note": "골밀도 유지 시너지"}, {"id": "vitamin_d", "note": "칼슘 흡수 보조"}],
        "conflict": [],
        "symptom_indicators": ["hot_flashes", "mood_swings", "vaginal_dryness"],
    },
    {
        "id": "coenzyme_pqq",
        "onset_weeks": "4~8주",
        "name": "PQQ (피롤로퀴놀린퀴논)",
        "emoji": "🧠",
        "description": "미토콘드리아 생합성 촉진. 인지 기능 개선, 뇌 건강 지원.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "인지 기능 개선에 도움",
            "study": "Itoh Y, et al. (2016). Funct Foods Health Dis, 6(7):416-427",
            "finding": "건강한 중년 성인 41명 12주 RCT, PQQ 보충 후 기억력·주의력 유의미하게 개선.",
            "grade": "B",
        },
        "caution": ["고용량(40mg 이상) 장기 복용 안전성 미확립"],
        "search_keyword": "PQQ 피롤로퀴놀린 인지기능",
        "affinity": {"인지기능": 5, "피로": 2},
        "dosage_guide": {"amount": "10~20mg/일", "timing": "식사와 함께", "form": "순수 PQQ"},
        "synergy": [{"id": "coq10", "note": "미토콘드리아 기능 시너지"}],
        "conflict": [],
        "symptom_indicators": ["brain_fog"],
    },
    {
        "id": "phosphatidylserine",
        "onset_weeks": "4~12주",
        "name": "포스파티딜세린",
        "emoji": "🧠",
        "description": "뇌세포막의 핵심 인지질. 기억력 개선, 인지 기능 유지에 도움.",
        "evidence": {
            "mfds_type": "개별인정형",
            "mfds_function": "인지력 개선에 도움",
            "study": "Kato-Kataoka A, et al. (2010). J Clin Biochem Nutr, 47(3):246-255",
            "finding": "건강한 노인 78명 6개월 RCT, 포스파티딜세린 보충 후 기억력 유의미하게 개선.",
            "grade": "A",
        },
        "caution": ["항응고제 병용 주의", "대두 알레르기 주의 (대두 유래 제품)"],
        "search_keyword": "포스파티딜세린 PS 기억력",
        "affinity": {"인지기능": 5, "스트레스": 2},
        "dosage_guide": {"amount": "100~300mg/일", "timing": "식사와 함께", "form": "분리된 포스파티딜세린"},
        "synergy": [{"id": "omega3", "note": "DHA가 뇌세포막 구성 시너지"}],
        "conflict": [],
        "symptom_indicators": ["brain_fog", "anxiety"],
    },
]


# ── 영양제별 피해야 할 음식·약물·습관 ─────────────────────────────────────────
# 과학 문헌 기반. 흡수 방해 / 약물 상호작용 / 효과 감소 요인.
SUPPLEMENT_FOOD_AVOID = {
    "vitamin_b": [
        {"item": "알코올", "reason": "비타민 B1·B6·B12 흡수 방해 및 소변 배출 촉진 → 장기 음주 시 B군 결핍의 주원인", "evidence": "Thomson, Am J Clin Nutr, 2000"},
        {"item": "항경련제 (페니토인, 카르바마제핀)", "reason": "B군 대사 효소 방해 → B6·B12 수치 저하, 복용 중이면 의사 상담 필수", "evidence": "Rivey et al., Drug Intell Clin Pharm, 1984"},
    ],
    "magnesium": [
        {"item": "알코올", "reason": "신장에서 마그네슘 배출 증가 → 음주자의 마그네슘 결핍 위험 2~3배 높음", "evidence": "Elisaf et al., Magnes Res, 1995"},
        {"item": "고용량 칼슘 보충제 동시 복용", "reason": "장에서 흡수 경쟁 → 두 영양소 모두 흡수 감소, 2시간 간격 복용 권장", "evidence": "Andon et al., J Am Coll Nutr, 1996"},
    ],
    "omega3": [
        {"item": "와파린·아스피린 등 항응고제 병용", "reason": "출혈 위험 증가 가능 — 심혈관 질환자·수술 예정자는 반드시 의사 상담", "evidence": "Buckley et al., Ann Pharmacother, 2004"},
        {"item": "산화된 생선·오래된 오메가-3 보충제", "reason": "산화지방(과산화지질) 섭취 시 오히려 산화스트레스 증가 → 보관 주의, 유통기한 확인 필수", "evidence": "Albert et al., J Nutr Biochem, 2013"},
    ],
    "vitamin_d": [
        {"item": "고용량 비타민 A 보충제 (레티놀 형태) 병용", "reason": "비타민D 수용체 경쟁 → 상호 효과 감소 가능, 각각 적정량 이하 유지 권장", "evidence": "Cannell et al., Prog Biophys Mol Biol, 2008"},
        {"item": "마그네슘 심각한 결핍 상태", "reason": "비타민D 활성화 효소에 마그네슘 필수 → 마그네슘 부족 시 비타민D 보충 효과 반감", "evidence": "Uwitonze & Razzaque, J Am Osteopath, 2018"},
    ],
    "probiotics": [
        {"item": "항생제와 동시 복용", "reason": "항생제가 유산균 직접 사멸 → 항생제 복용 후 2시간 뒤에 섭취 권장", "evidence": "Swidsinski et al., Gut, 2009"},
        {"item": "뜨거운 음료와 함께 복용 (50°C 이상)", "reason": "열에 약한 유산균이 사멸 → 미지근하거나 차가운 물·음료와 함께 섭취", "evidence": "Gardiner et al., J Appl Microbiol, 2000"},
    ],
    "milk_thistle": [
        {"item": "지속적 과음", "reason": "밀크씨슬이 간 손상을 완화하지만 알코올 재손상이 반복되면 효과 한계 — 근본 원인 해결 필요", "evidence": "Saller et al., Drugs, 2008"},
        {"item": "에스트로겐 관련 호르몬 약물 병용", "reason": "실리마린의 에스트로겐 유사 작용 → 에스트로겐 수용체 민감 환자는 주의", "evidence": "Greenlee et al., Integr Cancer Ther, 2007"},
    ],
    "vitamin_c": [
        {"item": "고용량(하루 2,000mg 이상) 장기 복용 + 신장결석 병력", "reason": "옥살산칼슘 결석 위험 증가 — 결석 병력 있으면 500mg 이하 유지 권장", "evidence": "Taylor et al., J Am Soc Nephrol, 2004"},
        {"item": "과다한 철분 보충과 동시 고용량 복용 (철 과부하 환자)", "reason": "비타민C가 철분 흡수를 크게 높여 혈색소증(철 과부하) 환자에서 위험", "evidence": "Hallberg et al., Am J Clin Nutr, 1987"},
    ],
    "lemon_balm": [
        {"item": "갑상선 약물 (레보티록신 등)", "reason": "레몬밤이 갑상선 자극 호르몬 결합 억제 가능 → 갑상선 환자는 반드시 의사 상담", "evidence": "Auf'mkolk et al., Endocrinology, 1984"},
        {"item": "수면제·항불안제 (벤조디아제핀 계열) 병용", "reason": "진정 효과 중첩 → 과도한 졸음·반응 저하 위험, 병용 시 용량 조절 필요", "evidence": "Kennedy et al., Phytomedicine, 2004"},
    ],
    "collagen": [
        {"item": "고당분 식품 (케이크, 탄산음료, 흰쌀 과다)", "reason": "최종당화산물(AGEs) 형성 → 섭취한 콜라겐도 함께 분해 가속 → 효과 상쇄", "evidence": "Danby, Clin Dermatol, 2010"},
        {"item": "흡연", "reason": "활성산소 급증 + 비타민C 파괴 → 콜라겐 합성 효소 억제, 피부 노화 2~5배 가속", "evidence": "Schectman et al., Am J Clin Nutr, 1991"},
    ],
    "coq10": [
        {"item": "와파린 (항응고제)", "reason": "CoQ10이 와파린 항응고 효과 감소시킬 수 있음 → 병용 시 INR 모니터링 필요", "evidence": "Combs, J Am Coll Nutr, 1994"},
        {"item": "스타틴 계열 콜레스테롤약 (리피토, 크레스토 등)", "reason": "스타틴이 CoQ10 체내 합성을 저해 → 오히려 CoQ10 보충이 더 필요한 상황, 의사 상담 권장", "evidence": "Littarru & Tiano, Biofactors, 2010"},
    ],
    "iron": [
        {"item": "커피·홍차·녹차 (탄닌 성분)", "reason": "탄닌이 철분과 결합하여 흡수 최대 50~60% 저해 → 철분 복용 전후 1시간은 피할 것", "evidence": "Hallberg & Rossander, Hum Nutr, 1982"},
        {"item": "칼슘 보충제·유제품과 동시 복용", "reason": "칼슘이 철분 흡수 수송체 경쟁 → 두 영양소 분리 복용(2시간 간격) 권장", "evidence": "Hallberg et al., Am J Clin Nutr, 1991"},
    ],
    "zinc": [
        {"item": "고함량 철분 보충제 동시 복용", "reason": "철분과 아연이 동일 흡수 경로 경쟁 → 비율 2:1 이상이면 아연 흡수 급감", "evidence": "Sandström, J Trace Elem Med Biol, 2001"},
        {"item": "하루 40mg 이상 장기 과잉 복용", "reason": "구리 결핍 유발 → 빈혈·신경 손상 가능, 상한 섭취량 준수 필수", "evidence": "Nations et al., Neurology, 2008"},
    ],
    "gaba": [
        {"item": "알코올 병용", "reason": "GABA 수용체 과자극 → 내성 발생 가능, 알코올 섭취 시 GABA 보충 효과도 감소", "evidence": "Mehta & Bhatt, Pharmacol Rev, 1999"},
        {"item": "수면제·항불안제 (벤조디아제핀) 병용", "reason": "진정 효과 과도하게 중첩될 수 있음 → 병용 전 반드시 의사 상담", "evidence": "Gottesmann, Neurosci Biobehav Rev, 2002"},
    ],
    "headache_tree": [
        {"item": "지속적 과음", "reason": "헛개나무가 간 보호 효과를 부분적으로 제공하지만, 알코올 손상이 지속되면 효과 한계 — 음주량 자체를 줄이는 것이 핵심", "evidence": "Song et al., Food Chem Toxicol, 2011"},
        {"item": "아세트아미노펜 + 음주 병용", "reason": "타이레놀+알코올은 간독성 극대화 → 헛개나무로 상쇄 불가, 병용 자체를 피해야 함", "evidence": "Watkins et al., JAMA, 2006"},
    ],
    "folic_acid": [
        {"item": "메토트렉세이트 (류마티스·항암 약물)", "reason": "엽산 길항제 약물 — 복용 중이면 엽산 보충 여부·용량을 반드시 의사와 결정", "evidence": "Morgan et al., Arthritis Rheum, 1994"},
        {"item": "하루 1mg 이상 단독 고용량 복용", "reason": "비타민B12 결핍을 마스킹 → 신경 손상 진행 중 발견 지연 위험", "evidence": "Morris et al., J Nutr, 2007"},
    ],
    "vitamin_e": [
        {"item": "항응고제 (와파린, 아스피린 고용량)", "reason": "비타민E 400IU 이상 시 혈소판 응집 억제 효과 중첩 → 출혈 위험 증가", "evidence": "Booth et al., Nutr Rev, 1999"},
        {"item": "고용량 오메가-3 동시 복용", "reason": "항혈전 효과 중첩 가능 — 각 권장량 내 복용 시 문제없음", "evidence": "Harris et al., Am J Clin Nutr, 2007"},
    ],
    "red_ginseng": [
        {"item": "혈압강하제 (ACE억제제, 칼슘채널차단제)", "reason": "홍삼의 혈관 확장 효과가 중첩 → 저혈압 위험. 복용 중이면 반드시 의사 상담", "evidence": "Janetzky & Morreale, Am J Health Syst Pharm, 1997"},
        {"item": "카페인 과다 (커피 4잔 이상)", "reason": "홍삼+카페인 동시 자극 → 심박수 증가·불안감 악화 가능", "evidence": "Kim et al., Food Chem Toxicol, 2012"},
    ],
    "calcium": [
        {"item": "철분제 동시 복용", "reason": "칼슘이 비헴철 흡수를 최대 60% 억제 → 반드시 2시간 간격 복용", "evidence": "Hallberg et al., Eur J Clin Nutr, 1991"},
        {"item": "시금치·수산 함유 식품 (과다)", "reason": "옥살산이 칼슘과 결합 → 칼슘 흡수 방해 및 신장결석 위험 증가", "evidence": "Holmes et al., J Am Soc Nephrol, 2001"},
    ],
    "lutein": [
        {"item": "베타카로틴 고용량 보충제 (흡연자)", "reason": "흡연자에서 폐암 위험 증가 연관 — 루테인 단독 제품 선택 권장", "evidence": "ATBC Study Group, NEJM, 1994"},
    ],
    "chromium": [
        {"item": "알코올 과다", "reason": "크롬 배출 증가 → 혈당 조절 효과 감소", "evidence": "Anderson et al., Diabetes, 1997"},
        {"item": "고용량 비타민C 동시 복용", "reason": "크롬 흡수 경쟁 가능", "evidence": "Chromium supplementation data, 2015"},
    ],
    "banaba_leaf": [
        {"item": "당뇨약 병용", "reason": "저혈당 위험 증가 — 모니터링 필수", "evidence": "Fukushima et al., J Ethnopharmacol, 2006"},
    ],
    "saw_palmetto": [
        {"item": "항응고제 병용", "reason": "출혈 위험 증가", "evidence": "Gerber et al., J Urol, 2001"},
        {"item": "호르몬 치료제", "reason": "효과 간섭 가능", "evidence": "Saw palmetto review, 2000"},
    ],
    "gamma_linolenic": [
        {"item": "항응고제·NSAIDs 병용", "reason": "출혈 경향 증가", "evidence": "Zurier & Rossetti, Am J Clin Nutr, 2012"},
    ],
    "msm": [
        {"item": "항응고제 병용", "reason": "혈액 희석 효과 중첩 가능", "evidence": "MSM safety data, 2008"},
    ],
    "garcinia": [
        {"item": "스타틴 계열 약물", "reason": "간 부담 증가 가능", "evidence": "Garcinia safety review, 2011"},
        {"item": "당뇨약 병용", "reason": "저혈당 위험", "evidence": "Onakpoya et al., J Obes, 2011"},
    ],
    "vitamin_k2": [
        {"item": "와파린 절대 금기", "reason": "항응고 효과 상쇄 — 치명적 위험", "evidence": "FDA warning, Warfarin interaction, 2015"},
        {"item": "항응고제 병용", "reason": "항응고 효과 감소", "evidence": "Vitamin K2 interactions, 2018"},
    ],
    "selenium": [
        {"item": "고용량 비타민C 동시", "reason": "셀레늄 형태 변환 저해 가능", "evidence": "Selenium interaction data, 2012"},
    ],
    "red_clover": [
        {"item": "호르몬 치료제", "reason": "에스트로겐 효과 중첩", "evidence": "Tice et al., JAMA, 2003"},
        {"item": "타목시펜 (유방암 약)", "reason": "효과 상쇄", "evidence": "Red clover isoflavones data, 2010"},
    ],
    "coenzyme_pqq": [
        {"item": "특별한 금기 없음", "reason": "단 고용량 장기 복용 자료 부족 — 권장량 준수", "evidence": "PQQ safety review, 2016"},
    ],
    "phosphatidylserine": [
        {"item": "항응고제 병용", "reason": "출혈 위험 소폭 증가 가능", "evidence": "Phosphatidylserine interactions, 2014"},
    ],
}


# ── 질환별 추천 로직 ──────────────────────────────────────────────────────────
# 각 질환에 따라 특정 영양제 점수를 높이거나, 금기 성분을 차단합니다.
CONDITIONS = {
    "당뇨_혈당": {
        "label": "🩸 당뇨 / 혈당 문제",
        "boost": {"magnesium": 12, "omega3": 8, "vitamin_d": 8, "probiotics": 6},
        "blocked": [],
        "category_boost": {},
        "note": "혈당강하제 복용 중이면 영양제 추가 전 반드시 의사와 상담하세요. 일부 성분이 혈당을 추가로 낮출 수 있습니다.",
    },
    "고혈압": {
        "label": "❤️ 고혈압",
        "boost": {"magnesium": 12, "coq10": 10, "omega3": 8},
        "blocked": [],
        "category_boost": {},
        "note": "마그네슘·오메가-3·CoQ10은 혈압 개선에 임상 근거가 있습니다. 단, 혈압약과 상호작용 가능하니 의사 상담을 권장합니다.",
    },
    "고지혈증": {
        "label": "🫀 고지혈증 (콜레스테롤 높음)",
        "boost": {"omega3": 14, "coq10": 12, "probiotics": 6},
        "blocked": [],
        "category_boost": {},
        "note": "스타틴(콜레스테롤약) 복용 중이면 CoQ10이 체내에서 고갈될 수 있어요. 보충을 적극 권장합니다.",
    },
    "갑상선_질환": {
        "label": "🦋 갑상선 질환 (갑상선 기능 저하·항진)",
        "boost": {"vitamin_d": 10, "zinc": 8, "omega3": 6},
        "blocked": ["lemon_balm"],
        "category_boost": {"피로": 2},
        "note": "레몬밤은 갑상선 기능을 억제할 수 있어 추천에서 제외했습니다. 갑상선 약과 다른 영양제 복용 시 의사 상담 필수.",
    },
    "관절염_류마티스": {
        "label": "🦴 관절염 / 류마티스",
        "boost": {"omega3": 12, "collagen": 12, "vitamin_d": 8, "magnesium": 6},
        "blocked": [],
        "category_boost": {"근육관절": 4, "피로": 1},
        "note": "오메가-3는 관절 염증 감소에 임상 근거가 있습니다. 류마티스 치료제 복용 중이면 의사 상담 후 복용하세요.",
    },
    "골다공증": {
        "label": "🦷 골다공증 / 뼈 건강",
        "boost": {"vitamin_d": 14, "magnesium": 10, "collagen": 8},
        "blocked": [],
        "category_boost": {"근육관절": 2},
        "note": "비타민D는 칼슘 흡수에 필수적입니다. 칼슘 보충제와 함께 복용하면 더 효과적이에요.",
    },
    "빈혈": {
        "label": "💉 빈혈 (철분 결핍성)",
        "boost": {"iron": 18, "vitamin_c": 10, "vitamin_b": 8},
        "blocked": [],
        "category_boost": {"피로": 4, "면역력": 1},
        "note": "비타민C와 철분을 함께 복용하면 철분 흡수율이 2~3배 높아집니다. 공복보다 식후 복용을 권장합니다.",
    },
    "위장_질환": {
        "label": "🫄 위장 질환 (위염, 과민성 대장 등)",
        "boost": {"probiotics": 14, "zinc": 8, "vitamin_b": 4},
        "blocked": [],
        "category_boost": {"장건강": 4},
        "note": "철분·CoQ10은 공복 복용 시 위장 자극 가능. 반드시 식후에 복용하세요. 프로바이오틱스는 빈속에 복용이 더 효과적입니다.",
    },
    "피부_질환": {
        "label": "🌸 피부 질환 (아토피, 건선 등)",
        "boost": {"omega3": 12, "probiotics": 10, "vitamin_d": 8, "zinc": 8},
        "blocked": [],
        "category_boost": {"피부": 4},
        "note": "장-피부 연결(Gut-Skin Axis): 장 건강 개선이 피부 염증 완화에 직결됩니다. 오메가-3의 항염 효과도 임상에서 확인됐어요.",
    },
    "우울증_불안": {
        "label": "🧠 우울증 / 불안장애",
        "boost": {"omega3": 12, "vitamin_d": 10, "magnesium": 10},
        "blocked": ["lemon_balm"],
        "category_boost": {"스트레스": 3, "수면": 2},
        "note": "항우울제(SSRI 등) 복용 중이면 레몬밤은 상호작용 위험으로 추천에서 제외했습니다. 오메가-3(EPA)의 항우울 효과는 다수의 임상시험에서 확인됐습니다.",
    },
    "비만_대사증후군": {
        "label": "⚖️ 비만 / 대사증후군",
        "boost": {"garcinia": 14, "chromium": 12, "banaba_leaf": 10, "probiotics": 8, "omega3": 8},
        "blocked": [],
        "category_boost": {"체중관리": 3, "혈당대사": 2},
        "note": "체중 관리와 혈당 안정화는 함께 진행되어야 합니다. 식단 개선과 운동을 병행하면 영양제 효과가 더 뚜렷합니다.",
    },
    "전립선비대": {
        "label": "🌴 전립선비대증 (BPH)",
        "boost": {"saw_palmetto": 16, "zinc": 10, "selenium": 8},
        "blocked": ["red_clover"],
        "category_boost": {"갱년기": 1},
        "note": "쏘팔메토는 배뇨 증상 개선에 임상 근거가 있습니다. PSA 검사를 받으실 예정이라면 검사 전에 의사에게 알리세요.",
    },
    "갱년기증후군": {
        "label": "🌺 갱년기증후군",
        "boost": {"red_clover": 18, "gamma_linolenic": 14, "calcium": 12, "vitamin_d": 10, "magnesium": 10},
        "blocked": [],
        "category_boost": {"갱년기": 4, "근육관절": 2},
        "note": "호르몬 치료를 고려 중이라면 반드시 의사와 상담하세요. 식물성 에스트로겐과 칼슘·비타민D 보충이 갱년기 증상 완화에 도움됩니다.",
    },
}


# ── 신체 지표 계산 (Mifflin-St Jeor 공식) ──────────────────────────────────────
ACTIVITY_FACTORS = {
    "거의_안함": 1.2,
    "주1-2회": 1.375,
    "주3-4회": 1.55,
    "거의_매일": 1.725,
}

def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    height_m = height_cm / 100
    return round(weight_kg / (height_m ** 2), 1)

def get_bmi_category(bmi: float) -> tuple:
    """Returns (label, color, advice)"""
    if bmi < 18.5:
        return "저체중", "#74b9ff", "영양 보충과 체중 증가가 필요해요"
    elif bmi < 23.0:
        return "정상", "#00b894", "건강한 체중 범위예요"
    elif bmi < 25.0:
        return "과체중", "#fdcb6e", "한국 기준 과체중이에요 (WHO 기준 정상)"
    else:
        return "비만", "#d63031", "체중 관리와 대사 건강 개선이 필요해요"

def calculate_bmr(gender: str, weight_kg: float, height_cm: float, age: int) -> float:
    """Mifflin-St Jeor 기초대사량 공식"""
    if gender == "남성":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

def calculate_tdee(bmr: float, activity_level: str) -> float:
    """Total Daily Energy Expenditure"""
    factor = ACTIVITY_FACTORS.get(activity_level, 1.4)
    return round(bmr * factor)

def calculate_protein_target(weight_kg: float, goals: list) -> tuple:
    """
    목표별 단백질 권장량 (g/일)
    근육증가: 1.6~2.0g/kg, 체중감량: 1.4~1.8g/kg, 일반: 1.0~1.4g/kg
    Returns (min_g, max_g)
    """
    if "근육증가" in goals:
        return round(weight_kg * 1.6), round(weight_kg * 2.0)
    elif "체중감량" in goals:
        return round(weight_kg * 1.4), round(weight_kg * 1.8)
    else:
        return round(weight_kg * 1.0), round(weight_kg * 1.4)


# ── 페르소나 (설계 문서 기반 10종) ───────────────────────────────────────────
PERSONAS = [
    {
        "id": "pregnant",
        "name": "예비 맘 / 수유 중",
        "tagline": "둘을 위해 먹는 지금, 영양이 두 배로 중요한 시기예요",
        "max_recommendations": 3,
        "category_boosts": {},
        "emoji": "🤱",
        "description": "이 시기는 나와 아기 모두를 위한 특별한 영양 관리가 필요해요. 전문의와 꼭 상담하세요.",
        "color": "#e17055",
        "avoidances": [
            {"item": "비타민 A 과다 복용 (하루 10,000 IU 이상)", "reason": "태아 기형 유발 가능 — 임신 중 레티놀 형태 보충제는 엄격히 제한", "evidence": "WHO Vitamin A Supplementation Guidelines"},
            {"item": "카페인 200mg 초과 (아메리카노 약 2잔 이상)", "reason": "유산 및 저체중아 출산 위험 증가 — 200mg 이하 유지 권장", "evidence": "ACOG Committee Opinion No.462, 2010"},
            {"item": "날생선·덜 익힌 육류 (초밥, 생고기 등)", "reason": "리스테리아균·살모넬라균 감염 시 태아에 치명적 영향 가능", "evidence": "CDC Food Safety for Pregnant Women, 2023"},
            {"item": "감초 성분 함유 한방 보충제", "reason": "글리시리진 과다 섭취 시 조산 위험 연관 보고", "evidence": "Strandberg et al., Am J Epidemiol, 2002"},
        ],
    },
    {
        "id": "dine_out_drinker",
        "name": "즉흥 외식형",
        "tagline": "간이 오늘도 야근 중인데 퇴근 시간이 없어요",
        "max_recommendations": 4,
        "category_boosts": {"간건강": 4},
        "emoji": "🍻",
        "description": "사람 만나고 먹고 마시는 걸 즐기는 분이시군요. 간과 장이 특히 관리가 필요해요.",
        "color": "#fdcb6e",
        "avoidances": [
            {"item": "아세트아미노펜(타이레놀) + 음주 병용", "reason": "간독성 시너지 — 음주 후 타이레놀 복용은 간 손상 위험 최대 10배 증가", "evidence": "Watkins et al., JAMA, 2006"},
            {"item": "고과당 음료 (액상과당 함유 탄산음료, 과일주스)", "reason": "과당은 간에서만 대사 → 지방간(NAFLD) 직결, 알코올 없이도 지방간 유발", "evidence": "Lim et al., J Hepatol, 2010"},
            {"item": "가공육·고지방 안주 반복 섭취 (삼겹살, 소시지 등)", "reason": "간 지방 축적 + 만성 저등급 염증 유발, 음주와 시너지로 간 손상 가속", "evidence": "Promrat et al., Hepatology, 2010"},
        ],
    },
    {
        "id": "burnout",
        "name": "번아웃 직장인",
        "tagline": "배터리가 늘 5% 이하인 분, 충전이 아니라 패턴 교체가 필요해요",
        "max_recommendations": 5,
        "category_boosts": {"피로": 3, "스트레스": 2},
        "emoji": "😮‍💨",
        "description": "열심히 달려왔더니 몸이 먼저 지쳤네요. 에너지 탱크가 바닥 신호를 보내고 있어요.",
        "color": "#d63031",
        "avoidances": [
            {"item": "카페인 과다 (하루 400mg 이상 / 커피 4잔 이상)", "reason": "일시적 각성 후 더 깊은 피로 유발, 코르티솔 과분비로 부신 피로 악화", "evidence": "Lovallo et al., Psychosom Med, 2005"},
            {"item": "단순당·정제 탄수화물 (과자, 흰빵, 탄산음료)", "reason": "혈당 스파이크 → 인슐린 급상승 → 급격한 에너지 저하 (혈당 롤러코스터)", "evidence": "Jenkins et al., Am J Clin Nutr, 2002"},
            {"item": "알코올 (피로 해소 목적의 저녁 음주)", "reason": "미토콘드리아 ATP 생성 저해 + REM 수면 억제 → 다음 날 더 심한 피로", "evidence": "Thakkar et al., Alcohol, 2015"},
        ],
    },
    {
        "id": "poor_sleeper",
        "name": "수면 부족형",
        "tagline": "눈은 감는데 뇌가 퇴근을 못 하고 있어요",
        "max_recommendations": 3,
        "category_boosts": {"수면": 4},
        "emoji": "😴",
        "description": "잠자리에 누워도 뒤척이는 밤이 많죠. 제대로 된 수면 하나가 삶의 질을 통째로 바꿔요.",
        "color": "#6c5ce7",
        "avoidances": [
            {"item": "카페인 오후 2시 이후 섭취", "reason": "카페인 반감기 5~7시간 — 오후 2시 커피가 자정까지 수면 방해, 수면 효율 20% 저하", "evidence": "Drake et al., J Clin Sleep Med, 2013"},
            {"item": "알코올 (수면 유도 목적)", "reason": "초반 졸음 유발하지만 REM 수면 강력 억제 → 수면 구조 파괴, 새벽 각성 증가", "evidence": "Ebrahim et al., Alcohol Clin Exp Res, 2013"},
            {"item": "취침 전 스마트폰·모니터 블루라이트", "reason": "멜라토닌 분비 최대 50% 억제 — 생체시계를 1~3시간 후퇴시킴", "evidence": "Chang et al., PNAS, 2015"},
            {"item": "취침 3시간 내 격렬한 유산소 운동", "reason": "체온 상승·교감신경 자극 → 수면 잠복기 연장, 심부 체온 하강 필요", "evidence": "Stutz et al., Sports Med, 2019"},
        ],
    },
    {
        "id": "fitness_lover",
        "name": "근력 마니아",
        "tagline": "운동은 열심히 하는데, 회복이 빠지면 절반의 효과예요",
        "max_recommendations": 4,
        "category_boosts": {"근육관절": 4},
        "emoji": "💪",
        "description": "운동은 열심히 하는데, 회복과 영양 보충이 따라줘야 실력이 더 올라요.",
        "color": "#00b894",
        "avoidances": [
            {"item": "운동 직전 고용량 항산화제 (비타민C·E 1g 이상)", "reason": "운동 적응 신호(활성산소)를 차단 → 근력·지구력 향상 효과 오히려 감소", "evidence": "Ristow et al., PNAS, 2009"},
            {"item": "이부프로펜·NSAIDs 상시 복용", "reason": "근단백질 합성 mTOR 경로 억제 → 운동 후 근육 회복 및 성장 방해", "evidence": "Trappe et al., Acta Physiol Scand, 2001"},
            {"item": "운동 후 알코올 섭취 (회식)", "reason": "근단백질 합성 최대 37% 감소, 테스토스테론 일시 저하 — 효과 48시간 지속", "evidence": "Parr et al., PLOS ONE, 2014"},
        ],
    },
    {
        "id": "dieter",
        "name": "다이어터",
        "tagline": "의지력 문제가 아니라 영양 전략이 필요한 거예요",
        "max_recommendations": 3,
        "category_boosts": {"장건강": 2, "피로": 1},
        "emoji": "⚖️",
        "description": "체중 관리를 위해 노력 중이시군요. 균형 잡힌 영양 보충이 다이어트 성공의 열쇠예요.",
        "color": "#0984e3",
        "avoidances": [
            {"item": "인공감미료 (아스파탐, 수크랄로스, 사카린)", "reason": "장내 미생물 불균형 유발 → 혈당 조절 악화, 오히려 체중 증가 촉진 가능", "evidence": "Suez et al., Nature, 2022"},
            {"item": "무지방·저칼로리 가공식품", "reason": "지방 빠진 자리에 당·전분 첨가 → 포만감 저하, 혈당 더 불안정", "evidence": "Ludwig et al., JAMA, 2018"},
            {"item": "탄수화물 극단적 제한 (하루 50g 미만)", "reason": "코르티솔 상승 → 근육 분해 가속 + 갑상선 기능 저하 가능 → 기초대사량 감소", "evidence": "Serog et al., Int J Obes, 1982"},
        ],
    },
    {
        "id": "low_willpower",
        "name": "불규칙 생활형",
        "tagline": "패턴이 나쁜 거지, 의지력 탓이 아니에요. 시스템을 바꿔봐요",
        "max_recommendations": 3,
        "category_boosts": {"장건강": 3, "피로": 2},
        "emoji": "🛋️",
        "description": "의지력 문제가 아니에요. 불규칙한 패턴 자체가 영양 불균형을 만들고 있어요. 시스템을 바꿔봐요.",
        "color": "#b2bec3",
        "avoidances": [
            {"item": "식사 거르기 + 무계획 간헐적 단식", "reason": "공복 호르몬 그렐린 급상승 → 과식·폭식 유발, 기초대사율 저하 악순환", "evidence": "Chapelot et al., J Nutr, 2011"},
            {"item": "초가공식품 위주 식사 (과자, 편의점 음식 반복)", "reason": "도파민 보상 회로 과자극 → 일반 음식에 대한 식욕 조절 점점 어려워짐", "evidence": "Schulte et al., PLOS ONE, 2015"},
            {"item": "정제 탄수화물 위주 식사", "reason": "혈당 불안정 → 더 강한 식탐 유발 반복 사이클, 피로·집중력 저하 악화", "evidence": "Lennerz et al., Am J Clin Nutr, 2013"},
        ],
    },
    {
        "id": "immunity_worrier",
        "name": "면역력 걱정형",
        "tagline": "조금만 무리해도 먼저 아픈 분, 면역 시스템이 SOS를 보내고 있어요",
        "max_recommendations": 4,
        "category_boosts": {"면역력": 4},
        "emoji": "🛡️",
        "description": "조금만 피곤하면 금방 아프는 것 같죠? 지금이 면역 시스템을 탄탄히 할 시간이에요.",
        "color": "#a29bfe",
        "avoidances": [
            {"item": "정제당 과다 섭취 (설탕, 시럽류)", "reason": "혈당 상승 후 2시간 동안 백혈구(호중구) 탐식 능력 최대 40% 저하", "evidence": "Sanchez et al., Am J Clin Nutr, 1973"},
            {"item": "수면 6시간 미만 지속", "reason": "NK세포(자연살해세포) 활성 저하, 감기 감수성 4배 증가 — 영양제로 대체 불가", "evidence": "Prather et al., Sleep, 2015"},
            {"item": "알코올 과다 섭취", "reason": "T세포·B세포 기능 저하 + 장 점막 면역 약화 → 바이러스 방어력 감소", "evidence": "Sarkar et al., Alcohol Res, 2015"},
            {"item": "초가공식품 위주 식사", "reason": "장내 미생물 다양성 감소 → 전신 면역력 약화 (장-면역 축 교란)", "evidence": "Zinöcker & Lindseth, Front Nutr, 2018"},
        ],
    },
    {
        "id": "skin_influencer",
        "name": "피부 관리형",
        "tagline": "SNS에 올리는 그 피부, 안에서부터 채워야 진짜예요",
        "max_recommendations": 3,
        "category_boosts": {"피부": 4},
        "emoji": "📱",
        "description": "보여지는 것도 중요하지만, 진짜 건강이 피부와 몸매로 드러나요. 안에서부터 채워드릴게요.",
        "color": "#fd79a8",
        "avoidances": [
            {"item": "고당분 식품 (케이크, 탄산음료, 정제 탄수화물)", "reason": "최종당화산물(AGEs) 형성 → 콜라겐 교차결합 손상 → 피부 탄력 저하·노화 가속", "evidence": "Danby, Clin Dermatol, 2010"},
            {"item": "트랜스지방 (일부 마가린, 패스트푸드 튀김류)", "reason": "피부 장벽 지질층 손상 + 전신 염증 촉진 → 피부 트러블·건조 악화", "evidence": "Calder, Am J Clin Nutr, 2006"},
            {"item": "알코올 (특히 과음)", "reason": "피부 탈수 + 비타민B군 결핍 + 모세혈관 확장 → 칙칙하고 붉어지는 피부", "evidence": "NHANES Data, J Am Acad Dermatol, 2019"},
            {"item": "유제품·유청단백질 과다 (여드름성 피부)", "reason": "IGF-1 자극 → 피지선 과활성 → 여드름성 피부에 악영향 (체질별 차이 있음)", "evidence": "Adebamowo et al., JAAD, 2018"},
        ],
    },
    {
        "id": "gut_health_sensitive",
        "name": "예민한 장 타입",
        "tagline": "장이 예민하면 몸 전체가 흔들려요. 장부터 잡아드릴게요",
        "max_recommendations": 4,
        "category_boosts": {"장건강": 3, "면역력": 2},
        "emoji": "🫙",
        "description": "소화기관이 예민하거나 장 건강이 주요 관심사인 분이에요. 장 건강이 면역력의 70%를 좌우합니다.",
        "color": "#00b894",
        "avoidances": [
            {"item": "고용량 철분 보충제 단독 복용", "reason": "장 점막 자극 → 변비·소화 불편 악화, 비타민C와 함께 소량씩 복용 권장", "evidence": "Tolkien et al., PLOS ONE, 2015"},
            {"item": "과도한 항생제 복용 (처방 외)", "reason": "장내 유익균 대량 사멸 → 장 투과성 증가(Leaky Gut) 위험", "evidence": "Palleja et al., Nat Microbiol, 2018"},
            {"item": "고지방·저섬유 식단 지속", "reason": "장내 미생물 다양성 감소 → 짧은사슬지방산 생성 저하 → 장 염증 악화", "evidence": "Sonnenburg et al., Nature, 2016"},
        ],
    },
    {
        "id": "senior_wellness",
        "name": "시니어 건강형",
        "tagline": "지금 채우는 영양이 10년 후 활동성을 결정해요",
        "max_recommendations": 5,
        "category_boosts": {"근육관절": 2, "피로": 2, "면역력": 2},
        "emoji": "🌳",
        "description": "50대 이후의 몸은 더 세심한 관리가 필요해요. 지금 챙기는 게 10년 후 건강을 결정해요.",
        "color": "#00cec9",
        "avoidances": [
            {"item": "고용량 레티놀(비타민A) 보충제", "reason": "50대 이상에서 골밀도 감소·골절 위험 증가 — 베타카로틴 형태는 비교적 안전", "evidence": "Melhus et al., Ann Intern Med, 1998"},
            {"item": "그레이프프루트 (음료·주스 포함)", "reason": "CYP450 효소 억제 → 50대 이상이 복용하는 혈압약·콜레스테롤약 등 수십 종 약물 농도 2~5배 변화", "evidence": "Bailey et al., CMAJ, 2013"},
            {"item": "과도한 나트륨 섭취 (염분 하루 2g 초과)", "reason": "혈압 상승 + 칼슘 소변 배출 증가 → 골밀도 저하 가속 (골다공증 위험)", "evidence": "Devine et al., Am J Clin Nutr, 1995"},
            {"item": "음주 (근육 유지 관점)", "reason": "근감소증(사코페니아) 가속 + 낙상 위험 증가 + 인지 기능 저하와 연관", "evidence": "Molina et al., Alcohol Clin Exp Res, 2014"},
        ],
    },
    {
        "id": "general_wellness",
        "name": "전반적 건강 관리형",
        "tagline": "지금 당장 큰 문제는 없지만, 예방이 최고의 치료예요",
        "max_recommendations": 2,
        "category_boosts": {},
        "emoji": "🌱",
        "description": "크게 아픈 곳은 없지만, 건강을 미리미리 챙기는 현명한 분이시네요.",
        "color": "#636e72",
        "avoidances": [
            {"item": "초가공식품 위주 식사 (가공육, 인스턴트, 패스트푸드)", "reason": "만성 저등급 염증 유발 → 장기적으로 심혈관질환·당뇨·암 위험 증가", "evidence": "Monteiro et al., Public Health Nutr, 2018"},
            {"item": "하루 수면 7시간 미만 지속", "reason": "심혈관질환·당뇨·비만·면역 저하 위험 모두 증가 — 영양제로 대체 불가능", "evidence": "Walker, Why We Sleep / Nat Rev Neurosci, 다수"},
            {"item": "장시간 앉아있기 (하루 8시간 이상)", "reason": "운동 여부와 무관한 독립적 대사 이상 위험인자 — 매시간 5분 움직임 권장", "evidence": "Biswas et al., Ann Intern Med, 2015"},
        ],
    },
    {
        "id": "menopause_woman",
        "name": "갱년기 여성",
        "tagline": "호르몬이 변하는 시기, 몸이 보내는 신호에 맞춰 채워드릴게요",
        "max_recommendations": 4,
        "category_boosts": {"갱년기": 4, "근육관절": 2},
        "emoji": "🌸",
        "description": "호르몬 변화로 인한 불편함을 겪고 계신가요? 이 시기는 특별한 영양 전략이 필요합니다.",
        "color": "#fd79a8",
        "avoidances": [
            {"item": "고용량 비타민 A (레티놀 형태, 하루 10,000 IU 이상)", "reason": "골밀도 감소 가속화 — 갱년기에 골다공증 위험이 높으므로 주의", "evidence": "Penniston & Tanumihardjo, Nutr Rev, 2006"},
            {"item": "카페인 과다 (하루 400mg 이상 / 커피 4잔)", "reason": "안면홍조 빈도 증가, 수면 방해, 칼슘 배출 촉진", "evidence": "Sagari et al., Menopause Rev, 2015"},
            {"item": "매운 음식·알코올 (특히 열감 민감할 때)", "reason": "안면홍조 증상 유발·악화 가능", "evidence": "Menopause symptom management data, 2018"},
        ],
    },
    {
        "id": "blood_sugar_manager",
        "name": "혈당 관리형",
        "tagline": "혈당 스파이크를 잡으면 에너지와 체중이 동시에 안정돼요",
        "max_recommendations": 4,
        "category_boosts": {"혈당대사": 4, "체중관리": 2},
        "emoji": "🩸",
        "description": "혈당 불안정으로 에너지 기복이 크신가요? 혈당을 안정화하면 피로도 줄어듭니다.",
        "color": "#d63031",
        "avoidances": [
            {"item": "정제 탄수화물 (흰쌀밥, 식빵, 파스타)", "reason": "혈당 스파이크 직결 → 인슐린 급상승 → 급격한 저혈당 → 피로·식탐", "evidence": "Jenkins et al., Am J Clin Nutr, 2002"},
            {"item": "고과당 음료·과자 (탄산음료, 과자, 초콜릿)", "reason": "단순당 섭취 → 혈당 롤러코스터 → 대사 스트레스", "evidence": "Lim et al., J Hepatol, 2010"},
            {"item": "장시간 공복", "reason": "저혈당 → 코르티솔 과분비 → 근력 분해·체지방 축적·피로", "evidence": "Chapelot et al., J Nutr, 2011"},
        ],
    },
    {
        "id": "middle_aged_man",
        "name": "중년 남성 건강형",
        "tagline": "지금이 남성 건강의 전환점, 전립선부터 심혈관까지 챙길 타이밍이에요",
        "max_recommendations": 4,
        "category_boosts": {"심혈관": 3, "갱년기": 2},
        "emoji": "💼",
        "description": "40대 이후로는 심혈관과 전립선 건강이 중요해집니다. 적극적인 영양 관리의 시작점이에요.",
        "color": "#0984e3",
        "avoidances": [
            {"item": "과음 (주 3회 이상 음주)", "reason": "간 손상 + 테스토스테론 저하 + 전립선 염증 증가", "evidence": "Sarkar et al., Alcohol Res, 2015"},
            {"item": "고지방·고염분 식단 (특히 가공육·패스트푸드)", "reason": "혈압 상승·혈관 경화·전립선 염증 촉진", "evidence": "De Stefani et al., Nutr Cancer, 2000"},
            {"item": "과도한 스트레스 + 불충분한 수면", "reason": "코르티솔 과분비 → 테스토스테론 저하 → 성기능 저하·피로·비만 악화", "evidence": "Lovallo et al., Psychosom Med, 2005"},
        ],
    },
]


# ── 점수 매핑 공유 상수 (compute_scores / compute_score_breakdown 동기화) ───────
_GOAL_SCORE_MAP = {
    "피로회복": {"피로": 3}, "수면개선": {"수면": 3},
    "면역력강화": {"면역력": 3}, "체중감량": {"피로": 1, "장건강": 1},
    "간건강": {"간건강": 3}, "소화장건강": {"장건강": 3},
    "근육증가": {"근육관절": 3}, "피부개선": {"피부": 3},
    "혈당관리": {"혈당대사": 3}, "체지방감소": {"체중관리": 3, "혈당대사": 1},
    "눈건강": {"눈건강": 3}, "심혈관건강": {"심혈관": 3}, "갱년기관리": {"갱년기": 3},
    "인지력향상": {"인지기능": 3},
}
_SLEEP_SCORE_MAP = {
    "잠들기_어려움": {"수면": 3, "스트레스": 1},
    "중간에_자꾸_깸": {"수면": 2, "피로": 1},
    "자도_피곤함": {"피로": 3, "수면": 1},
    "괜찮음": {},
}
_STRESS_SCORE_MAP = {
    "거의_없음": {}, "가끔": {"스트레스": 1},
    "자주": {"스트레스": 3, "피로": 1},
    "항상_폭발_직전": {"스트레스": 5, "피로": 2, "수면": 1},
}
_DRINK_SCORE_MAP = {
    "거의_안마심": {},
    "주1-2회": {"간건강": 3},
    "주3회이상": {"간건강": 5, "피로": 1},
}
_CAFFEINE_SCORE_MAP = {
    "거의안마심": {}, "하루1-2잔": {},
    "하루3-4잔": {"수면": 1, "스트레스": 1},
    "하루5잔이상": {"수면": 2, "스트레스": 2, "피로": 1},
}


# ── 핵심 함수 ─────────────────────────────────────────────────────────────────

def compute_scores(answers):
    scores = {
        "피로": 0, "수면": 0, "스트레스": 0, "간건강": 0,
        "면역력": 0, "장건강": 0, "근육관절": 0, "피부": 0,
        "눈건강": 0, "혈당대사": 0, "심혈관": 0, "갱년기": 0, "체중관리": 0, "인지기능": 0,
    }

    # 1. 신체 증상 기반 (핵심)
    for symptom_id in answers.get("증상", []):
        for cat, val in SYMPTOM_SCORE_MAP.get(symptom_id, {}).items():
            scores[cat] += val

    # 2. 건강 목표
    for goal in answers.get("목표", []):
        for cat, val in _GOAL_SCORE_MAP.get(goal, {}).items():
            scores[cat] += val

    # 3. 수면 패턴
    for cat, val in _SLEEP_SCORE_MAP.get(answers.get("수면", ""), {}).items():
        scores[cat] += val

    # 4. 스트레스
    for cat, val in _STRESS_SCORE_MAP.get(answers.get("스트레스", ""), {}).items():
        scores[cat] += val

    # 5. 운동 (빈도 + 유형)
    exercise_map = {
        "거의_안함": {"피로": 1},
        "주1-2회": {},
        "주3-4회": {"근육관절": 2},
        "거의_매일": {"근육관절": 4},
    }
    for cat, val in exercise_map.get(answers.get("운동"), {}).items():
        scores[cat] += val

    exercise_type_map = {
        "근력": {"근육관절": 2},
        "혼합": {"근육관절": 1},
        "유산소": {"피로": -1},  # 유산소 운동 = 피로 관리에 도움
        "가벼운": {},
    }
    for cat, val in exercise_type_map.get(answers.get("운동유형", ""), {}).items():
        scores[cat] = max(0, scores[cat] + val)

    # 6. 식습관
    diet_map = {
        "집밥_위주": {},
        "배달_외식_많음": {"장건강": 2, "면역력": 1, "간건강": 1},
        "채식_위주": {"피로": 2},
        "불규칙함": {"장건강": 2, "피로": 1},
    }
    for cat, val in diet_map.get(answers.get("식습관", ""), {}).items():
        scores[cat] += val

    # 7. 식사 규칙성
    if answers.get("식사규칙성") == "불규칙":
        scores["장건강"] += 1
        scores["피로"] += 1

    # 8. 음주
    for cat, val in _DRINK_SCORE_MAP.get(answers.get("음주", ""), {}).items():
        scores[cat] += val

    # 음주량 보정
    qty_boost_map = {
        "가벼운": {"간건강": 1},
        "보통": {"간건강": 2},
        "과음": {"간건강": 4, "피로": 1},
    }
    for cat, val in qty_boost_map.get(answers.get("음주량", ""), {}).items():
        scores[cat] += val

    # 카페인
    for cat, val in _CAFFEINE_SCORE_MAP.get(answers.get("카페인", ""), {}).items():
        scores[cat] += val

    # 식사 횟수
    meal_map = {
        "1끼": {"피로": 2, "장건강": 2},
        "2끼": {"피로": 1, "장건강": 1},
        "3끼": {},
        "4끼 이상": {"장건강": 1},
    }
    for cat, val in meal_map.get(answers.get("식사횟수", ""), {}).items():
        scores[cat] += val

    # 흡연
    if "흡연" in answers.get("특이사항", []):
        scores["피부"] += 2
        scores["면역력"] += 1
        scores["피로"] += 1

    # 일조량
    sunlight_map = {
        "충분": {},
        "부족": {"면역력": 1},
        "매우_부족": {"면역력": 2, "피로": 1},
    }
    for cat, val in sunlight_map.get(answers.get("일조량", ""), {}).items():
        scores[cat] += val

    # 여성 월경 상태
    menstruation = answers.get("월경상태", "")
    if menstruation == "과다_불규칙":
        scores["피로"] += 3
    elif menstruation == "폐경":
        scores["근육관절"] += 2
        scores["갱년기"] += 3
    elif menstruation == "임신계획":
        scores["면역력"] += 1

    # 9. 나이 보정 (numeric)
    age = answers.get("나이", 30)
    if age >= 40:
        scores["피로"] += 1
        scores["근육관절"] += 1
        scores["면역력"] += 1
        scores["심혈관"] += 1
        scores["인지기능"] += 1
    if age >= 50:
        scores["근육관절"] += 1
        scores["피부"] += 1
        scores["갱년기"] += 1

    # 10. BMI 기반 보정
    weight = answers.get("체중")
    height = answers.get("신장")
    if weight and height and weight > 0 and height > 0:
        bmi = calculate_bmi(weight, height)
        if bmi < 18.5:
            scores["피로"] += 3
            scores["면역력"] += 2
        elif 23 <= bmi < 25:
            scores["장건강"] += 1
        elif bmi >= 25:
            scores["장건강"] += 3
            scores["면역력"] += 1
            scores["혈당대사"] += 2
            scores["체중관리"] += 2
            scores["심혈관"] += 1

    # 11. 질환 기반 카테고리 보정
    for cond_id in answers.get("질환", []):
        for cat, val in CONDITIONS.get(cond_id, {}).get("category_boost", {}).items():
            scores[cat] += val

    # 12. 처방약 복용 (영양소 고갈 반영)
    medications = answers.get("복용약물", [])
    if "PPI" in medications:
        scores["피로"] += 1      # B12 흡수 저하
        scores["면역력"] += 1    # 마그네슘 저하
    if "피임약" in medications:
        scores["피로"] += 1      # B6/B9 저하
        scores["피부"] += 1
    if "NSAIDs" in medications:
        scores["장건강"] += 2    # 위장관 자극
    if "스타틴" in medications:
        scores["피로"] += 2      # CoQ10 저하
    if "이뇨제" in medications:
        scores["근육관절"] += 1  # 칼륨/마그네슘 저하
        scores["피로"] += 1
    if "메트포르민" in medications:
        scores["피로"] += 2      # B12 결핍 → 만성 피로, 신경 이상
        scores["면역력"] += 1    # B12 결핍 → 면역 저하

    # 13. 수분 섭취
    water_map = {
        "충분": {},
        "보통": {},
        "부족": {"피로": 1, "피부": 1, "장건강": 1},
    }
    for cat, val in water_map.get(answers.get("수분섭취", ""), {}).items():
        scores[cat] += val

    # 14. 체중 변화 추이
    weight_change_map = {
        "안정": {},
        "증가": {"피로": 1, "장건강": 1},
        "감소": {"피로": 1},
        "의도치않은감소": {"피로": 3, "면역력": 2},
    }
    for cat, val in weight_change_map.get(answers.get("체중변화", ""), {}).items():
        scores[cat] += val

    # 15. 연쇄 보정 (카테고리 간 상호작용)
    if scores["스트레스"] >= 4:
        scores["수면"] += 1
        scores["피로"] += 1
    if scores["피로"] >= 5:
        scores["면역력"] += 1
    if scores["장건강"] >= 4:
        scores["면역력"] += 1
    # New cross-category interactions
    if scores["혈당대사"] >= 4:
        scores["심혈관"] += 1
    if scores["갱년기"] >= 4:
        scores["근육관절"] += 1

    return scores


def compute_score_breakdown(answers):
    """각 카테고리 점수를 기여 항목별로 분해해서 반환 {cat: [(설명, 점수), ...]}"""
    breakdown = {cat: [] for cat in ["피로", "수면", "스트레스", "간건강", "면역력", "장건강", "근육관절", "피부", "눈건강", "혈당대사", "심혈관", "갱년기", "체중관리", "인지기능"]}

    # 1. 증상
    for symptom_id in answers.get("증상", []):
        for cat, val in SYMPTOM_SCORE_MAP.get(symptom_id, {}).items():
            if cat in breakdown:
                text = SYMPTOM_TEXT_MAP.get(symptom_id, symptom_id)
                # Truncate long symptom text
                text = text[:20] + "…" if len(text) > 20 else text
                breakdown[cat].append((f"증상: {text}", val))

    # 2. 건강 목표
    for goal in answers.get("목표", []):
        for cat, val in _GOAL_SCORE_MAP.get(goal, {}).items():
            breakdown[cat].append((f"목표: {goal}", val))

    # 3. 수면 패턴
    for cat, val in _SLEEP_SCORE_MAP.get(answers.get("수면", ""), {}).items():
        if cat in breakdown:
            breakdown[cat].append(("수면 패턴", val))

    # 4. 스트레스
    for cat, val in _STRESS_SCORE_MAP.get(answers.get("스트레스", ""), {}).items():
        if cat in breakdown:
            breakdown[cat].append(("스트레스 수준", val))

    # 5. 음주
    for cat, val in _DRINK_SCORE_MAP.get(answers.get("음주", ""), {}).items():
        if cat in breakdown:
            breakdown[cat].append(("음주 빈도", val))

    # 6. 카페인
    for cat, val in _CAFFEINE_SCORE_MAP.get(answers.get("카페인", ""), {}).items():
        if cat in breakdown:
            breakdown[cat].append(("카페인 섭취", val))

    return breakdown


def get_persona(answers, scores):
    bmi = None
    weight = answers.get("체중")
    height = answers.get("신장")
    if weight and height and weight > 0 and height > 0:
        bmi = calculate_bmi(weight, height)

    def find(pid):
        return next(p for p in PERSONAS if p["id"] == pid)

    # 1. 임산부/수유부 — 절대 우선
    if "임산부_수유부" in answers.get("특이사항", []):
        return find("pregnant")

    is_senior = answers.get("나이", 30) >= 50

    # 2. 전체 점수 합이 낮으면 전반적 건강 관리형
    total_score = sum(scores.values())
    if total_score < 6:
        return find("general_wellness")

    # 4. 점수 순위 기반 매칭
    top_cats = sorted(scores.items(), key=lambda x: -x[1])
    top_cat = top_cats[0][0]
    second_cat = top_cats[1][0] if len(top_cats) > 1 else ""

    exercise = answers.get("운동", "주1-2회")
    alcohol = answers.get("음주", "거의_안마심")
    diet = answers.get("식습관", "집밥_위주")
    goals = answers.get("목표", [])

    # 간건강 1위이거나 음주가 잦으면서 간건강 지표가 높음
    if top_cat == "간건강" or (alcohol == "주3회이상" and scores.get("간건강", 0) >= 3):
        return find("dine_out_drinker")

    # 갱년기 여성
    gender = answers.get("성별", "")
    if top_cat == "갱년기" and gender == "여성":
        return find("menopause_woman")

    # 혈당관리 필요
    if top_cat == "혈당대사":
        return find("blood_sugar_manager")

    # 중년 남성 심혈관 관리
    age = answers.get("나이", 30)
    if top_cat == "심혈관" and gender == "남성" and age >= 40:
        return find("middle_aged_man")

    # 눈건강 1위
    if top_cat == "눈건활":
        return find("general_wellness")

    # 수면 1위
    if top_cat == "수면":
        return find("poor_sleeper")

    # 스트레스 1위
    if top_cat == "스트레스":
        return find("burnout")

    # 피로 1위이면서 스트레스도 높음
    if top_cat == "피로" and scores.get("스트레스", 0) >= 3:
        return find("burnout")

    # 근육관절 1위
    if top_cat == "근육관절":
        if exercise in ("주3-4회", "거의_매일"):
            return find("fitness_lover")
        elif "체중감량" in goals or (bmi is not None and bmi >= 25):
            return find("dieter")
        else:
            return find("burnout")

    # 면역력 1위
    if top_cat == "면역력":
        return find("immunity_worrier")

    # 피부 1위
    if top_cat == "피부":
        return find("skin_influencer")

    # 장건강 1위
    if top_cat == "장건강":
        if scores.get("장건강", 0) >= 5:
            return find("gut_health_sensitive")
        if diet == "불규칙함" and exercise == "거의_안함":
            return find("low_willpower")
        return find("immunity_worrier")

    # 피로 1위 (스트레스 낮음)
    if top_cat == "피로":
        if "체중감량" in goals or (bmi is not None and bmi >= 25):
            return find("dieter")
        return find("burnout")

    # 목표 기반 후순위 매칭
    if "체중감량" in goals or (bmi is not None and bmi >= 25):
        return find("dieter")
    if "피부개선" in goals:
        return find("skin_influencer")

    # 50세 이상이고 위에서 매칭 안 됐을 경우 시니어로 분류
    if is_senior:
        return find("senior_wellness")

    return find("general_wellness")


# 영양제 추천 최소 점수 기준치 (혈액 검사 미제출 기준)
# 혈액 검사 없이 증상 기반만으로: 증상 2~3개 + 목표 1개 수준에서 임계치 도달
# 혈액 검사 제출 시: 1.5배 보정 없이 직접 수치 반영 (더 정확, 더 높은 점수)
# 식약처 일일 상한 섭취량 (UL) — 보충제 유래 기준
NUTRIENT_UL = {
    "vitamin_d_iu":  4000,   # IU (= 100μg)
    "vitamin_c_mg":  2000,   # mg
    "folate_ug":     1000,   # μg (엽산)
    "vitamin_b6_mg": 100,    # mg
    "niacin_mg":     35,     # mg (B3, 니코틴산 형태)
    "calcium_mg":    2500,   # mg
    "iron_mg":       45,     # mg
    "zinc_mg":       35,     # mg
    "magnesium_mg":  400,    # mg (보충제 유래, 350→400 여유 마진)
    "vitamin_e_mg":  1000,   # mg (식약처 상한)
}

# 단위 매핑 — 키 이름 파싱 대신 명시적 딕셔너리 사용
NUTRIENT_UNIT = {
    "vitamin_d_iu":  "IU",
    "vitamin_c_mg":  "mg",
    "folate_ug":     "μg",
    "vitamin_b6_mg": "mg",
    "niacin_mg":     "mg",
    "calcium_mg":    "mg",
    "iron_mg":       "mg",
    "zinc_mg":       "mg",
    "magnesium_mg":  "mg",
    "vitamin_e_mg":  "mg",
}

# 각 영양제의 대표 1일 함량 (성인 권장 복용량 기준, 보수적 추정)
SUPPLEMENT_NUTRIENT_CONTENT = {
    "vitamin_b":  {"folate_ug": 400, "vitamin_b6_mg": 10, "niacin_mg": 18},
    "folic_acid": {"folate_ug": 800},
    "vitamin_c":  {"vitamin_c_mg": 500},
    "vitamin_d":  {"vitamin_d_iu": 2000},
    "calcium":    {"calcium_mg": 600, "vitamin_d_iu": 400},
    "magnesium":  {"magnesium_mg": 350},
    "iron":       {"iron_mg": 18},
    "zinc":       {"zinc_mg": 10},
    "vitamin_e":  {"vitamin_e_mg": 268},   # 400IU ≈ 268mg d-alpha-tocopherol
}

# 3개월 복용 기준 임상시험 보고 개선율 (카테고리 점수 × 이 비율만큼 감소)
# 근거: 명시된 RCT/체계적 리뷰 기반, 보수적 하한 추정치 사용
SUPPLEMENT_CLINICAL_EFFECT = {
    # B군 비타민 — Stough et al. (2011) JNHA: 피로 33% / Kennedy et al. (2010): 스트레스 28%
    "vitamin_b":     {"피로": 0.33, "스트레스": 0.28},
    # 마그네슘 — Abbasi et al. (2012) J Res Med Sci: 수면 29% / Boyle et al. (2017): 스트레스 20%
    "magnesium":     {"수면": 0.29, "스트레스": 0.20, "근육관절": 0.15},
    # 비타민D — Zhu et al. (2016) Nutrients: 피로 28% / Aranow (2011) J Investig Med: 면역 30%
    "vitamin_d":     {"피로": 0.28, "면역력": 0.30},
    # 오메가-3 — Kiecolt-Glaser et al. (2012) Brain Behav Immun: 스트레스 22% / Thomsen et al. (2020): 피부 22%
    "omega3":        {"스트레스": 0.22, "피부": 0.22, "장건강": 0.15},
    # 유산균 — Ford et al. (2014) Gut: 장건강 40% / Hao et al. (2015) Cochrane: 면역 20%
    "probiotics":    {"장건강": 0.40, "면역력": 0.20},
    # 밀크씨슬 — Gillessen & Schmidt (2020) Med Sci: 간 수치 정상화 32%
    "milk_thistle":  {"간건강": 0.32},
    # 비타민C — Carr & Maggini (2017) Nutrients: 면역 20% / Pullar et al. (2017): 피부 20%
    "vitamin_c":     {"면역력": 0.20, "피부": 0.20},
    # 레몬밤 — Cases et al. (2011): 수면 33% / Kennedy et al. (2004): 스트레스 35%
    "lemon_balm":    {"수면": 0.33, "스트레스": 0.35},
    # 콜라겐 — Proksch et al. (2014) Skin Pharmacol Physiol: 피부 35% / Shaw et al. (2017): 근육관절 28%
    "collagen":      {"피부": 0.35, "근육관절": 0.28},
    # CoQ10 — Mizuno et al. (2008) Nutrition: 피로 30%
    "coq10":         {"피로": 0.30},
    # 철분 — Vaucher et al. (2012) CMAJ: 피로 45% (결핍 여성 기준)
    "iron":          {"피로": 0.45},
    # 아연 — Singh & Das (2011) Cochrane: 면역 22% / Gupta et al. (2014): 피부 22%
    "zinc":          {"면역력": 0.22, "피부": 0.22},
    # GABA — Abdou et al. (2006) Biofactors: 스트레스 30% / Yamatsu et al. (2016): 수면 28%
    "gaba":          {"수면": 0.28, "스트레스": 0.30},
    # 고함량 파트헤니움 — Diener et al. (1988) Lancet: 편두통 24% 감소
    "headache_tree": {"스트레스": 0.24},
    # 엽산 — Gilbody et al. (2007): 기분·피로 20%
    "folic_acid":    {"피로": 0.20},
    # 비타민E — Rizvi et al. (2014) Nat Sci Biol Med: 피부 22% / Meydani et al. (1997) JAMA: 면역 25%
    "vitamin_e":     {"피부": 0.22, "면역력": 0.25},
    # 홍삼 — Kim et al. (2013) J Ginseng Res: 피로 38% / Sung et al. (2005): 면역 32%
    "red_ginseng":   {"피로": 0.38, "면역력": 0.32},
    # 칼슘 — 근육·관절 지지 15%
    "calcium":       {"근육관절": 0.15},
    # 루테인 — 추적 카테고리(눈 건강) 없어 미등록
}

RECOMMENDATION_MIN_SCORE = 12


def get_recommendations(answers, scores, blood_boosts: dict = None, max_recs: int = 5, extra_supp_boosts: dict = None, current_ids: set = None):
    special = answers.get("특이사항", [])
    user_diseases = answers.get("질환", [])
    gender = answers.get("성별", "")
    drink = answers.get("음주", "")
    user_symptoms = set(answers.get("증상", []))

    # BMI 계산
    bmi = None
    weight = answers.get("체중")
    height = answers.get("신장")
    if weight and height and weight > 0 and height > 0:
        bmi = calculate_bmi(weight, height)

    # 질환별 차단 목록
    disease_blocked = set()
    for cond_id in user_diseases:
        disease_blocked.update(CONDITIONS.get(cond_id, {}).get("blocked", []))

    scored = []
    for s in SUPPLEMENTS:
        # 안전 필터 1: 특이사항 (임산부 등)
        if any(c in special for c in s.get("blocked_conditions", [])):
            continue
        # 안전 필터 2: 질환 기반 차단
        if s["id"] in disease_blocked:
            continue
        # 현재 복용 중인 영양제는 추천에서 제외
        if current_ids and s["id"] in current_ids:
            continue
        # 특정 조건 전용 성분
        required = s.get("required_conditions", [])
        if required and not any(c in special for c in required):
            continue

        # 카테고리 점수 (affinity 기반)
        total = sum(scores.get(cat, 0) * weight_val for cat, weight_val in s["affinity"].items())

        # 성별 보정 (폐경 여성은 iron gender_boost 미적용)
        menstruation = answers.get("월경상태", "")
        if s["id"] == "iron" and menstruation == "폐경":
            pass  # 폐경 여성 철분 과잉 추천 차단
        elif gender in s.get("gender_boost", {}):
            total += s["gender_boost"][gender]

        # 음주 보정
        if s.get("drink_boost") and drink in ["주1-2회", "주3회이상"]:
            total += s["drink_boost"]

        # 증상 매칭 보너스
        matched_symptoms = user_symptoms & set(s.get("symptom_indicators", []))
        total += len(matched_symptoms) * 8

        # 질환별 영양제 보너스
        for cond_id in user_diseases:
            boost = CONDITIONS.get(cond_id, {}).get("boost", {})
            total += boost.get(s["id"], 0)

        # BMI 기반 보너스
        if bmi is not None:
            bmi_boosts = {}
            if bmi < 18.5:
                bmi_boosts = {"iron": 8, "vitamin_b": 6, "vitamin_d": 4, "vitamin_c": 4}
            elif bmi >= 25:
                bmi_boosts = {"probiotics": 8, "omega3": 6, "vitamin_d": 4}
            total += bmi_boosts.get(s["id"], 0)

        # 혈액 검사 기반 보너스
        if blood_boosts:
            total += blood_boosts.get(s["id"], 0)

        # 추가 외부 보너스 (가족력·음식빈도·약물 상호작용 등)
        if extra_supp_boosts:
            total += extra_supp_boosts.get(s["id"], 0)

        # 처방약 기반 보너스
        medications = answers.get("복용약물", [])
        if "PPI" in medications and s["id"] == "vitamin_b":
            total += 6
        if "피임약" in medications and s["id"] == "folic_acid":
            total += 5
        if "스타틴" in medications and s["id"] == "coq10":
            total += 8
        if "NSAIDs" in medications and s["id"] == "probiotics":
            total += 4
        if "이뇨제" in medications and s["id"] == "magnesium":
            total += 5
        if "메트포르민" in medications and s["id"] == "vitamin_b":
            total += 8

        # 수분 부족 시 boost
        if answers.get("수분섭취") == "부족":
            if s["id"] == "probiotics":
                total += 3
            elif s["id"] == "collagen":
                total += 2

        # 50대 이상 남성 iron penalty
        if s["id"] == "iron" and gender == "남성" and answers.get("나이", 30) >= 50:
            total -= 5

        # 흡연자 비타민C 우선 추천
        if s["id"] == "vitamin_c" and "흡연" in answers.get("특이사항", []):
            total += 5

        # 월경 과다 여성 철분 강화
        if s["id"] == "iron" and answers.get("월경상태") == "과다_불규칙":
            total += 5

        # 일조량 부족 시 비타민D 우선 추천
        sunlight = answers.get("일조량", "")
        if s["id"] == "vitamin_d":
            if sunlight == "부족":
                total += 5
            elif sunlight == "매우_부족":
                total += 10

        # 현재 복용 중인 영양제의 시너지 성분 가산
        if current_ids:
            for syn in s.get("synergy", []):
                if syn["id"] in current_ids:
                    total += 4

        scored.append((total, s, matched_symptoms))

    scored.sort(key=lambda x: x[0], reverse=True)

    # 최소 점수 기준치 미만은 제외 (필요성이 충분하지 않음)
    scored = [(total, s, ms) for total, s, ms in scored if total >= RECOMMENDATION_MIN_SCORE]

    # 후보군 내 시너지 파트너 보너스 (추천 후보 중 시너지 쌍이 있으면 양쪽에 가산)
    if len(scored) > 1:
        SYNERGY_BONUS = 5
        pool_ids = {s["id"] for _, s, _ in scored}
        scored = [
            (t + sum(SYNERGY_BONUS for syn in s.get("synergy", []) if syn["id"] in pool_ids), s, ms)
            for t, s, ms in scored
        ]
        scored.sort(key=lambda x: x[0], reverse=True)

    # 페르소나별 최대 추천 수 적용 — (supp, matched_symptoms, total_score) 반환
    return [(s, list(ms), t) for t, s, ms in scored[:max_recs]]


def get_excluded_candidates(answers, scores, recommendations, blood_boosts=None, extra_supp_boosts=None, top_n=3):
    """
    추천에 포함되지 않은 상위 후보와 제외 이유를 반환.
    반환: [(supp, reason_str), ...]
    """
    special = answers.get("특이사항", [])
    user_diseases = answers.get("질환", [])
    gender = answers.get("성별", "")
    drink = answers.get("음주", "")
    user_symptoms = set(answers.get("증상", []))
    current_ids = set(answers.get("현재복용영양제", []))
    recommended_ids = {s["id"] for s, *_ in recommendations}

    bmi = None
    weight = answers.get("체중")
    height = answers.get("신장")
    if weight and height and weight > 0 and height > 0:
        bmi = calculate_bmi(weight, height)

    disease_blocked = set()
    for cond_id in user_diseases:
        disease_blocked.update(CONDITIONS.get(cond_id, {}).get("blocked", []))

    excluded = []
    for s in SUPPLEMENTS:
        if s["id"] in recommended_ids:
            continue

        # 제외 이유 판별
        if any(c in special for c in s.get("blocked_conditions", [])):
            reason = f"특이사항 ({', '.join(c for c in s.get('blocked_conditions', []) if c in special)})으로 복용 주의"
        elif s["id"] in disease_blocked:
            cond_labels = [CONDITIONS[c]["label"] for c in user_diseases if s["id"] in CONDITIONS.get(c, {}).get("blocked", [])]
            reason = f"기저 질환 ({', '.join(cond_labels)})으로 주의가 필요해요"
        elif current_ids and s["id"] in current_ids:
            reason = "이미 복용 중이에요"
        elif s.get("required_conditions") and not any(c in special for c in s["required_conditions"]):
            continue  # 특정 조건 전용 성분은 제외 목록에도 안 보임
        else:
            # 점수 계산
            total = sum(scores.get(cat, 0) * w for cat, w in s["affinity"].items())
            reason = f"현재 필요도가 낮습니다 (점수: {int(total)}점)"

        excluded.append((s, reason))
        if len(excluded) >= top_n:
            break

    return excluded


def apply_toxicity_guardrail(recommendations, current_ids=None, max_recs=None):
    """
    추천 조합에서 영양소 합산이 식약처 UL 초과 시,
    가장 낮은 점수의 기여 영양제를 제외하고 reserve에서 backfill합니다.
    current_ids: 현재 복용 중인 영양제 ID 목록 (baseline 합산에 포함)
    max_recs: 최종 반환할 최대 수 (None이면 전체 유지)
    반환: (filtered_list, warning_messages)
    """
    from collections import defaultdict

    if max_recs is None:
        max_recs = len(recommendations)

    active = list(recommendations[:max_recs])
    reserve = list(recommendations[max_recs:])
    warnings = []

    _nutrient_label = {
        "folate_ug": "엽산", "vitamin_d_iu": "비타민D",
        "vitamin_c_mg": "비타민C", "vitamin_b6_mg": "비타민B6",
        "niacin_mg": "나이아신", "calcium_mg": "칼슘",
        "iron_mg": "철분", "zinc_mg": "아연", "magnesium_mg": "마그네슘",
        "vitamin_e_mg": "비타민E",
    }

    # 현재 복용 중인 영양제를 baseline 합산에 포함
    baseline = defaultdict(float)
    if current_ids:
        for cid in current_ids:
            for nutrient, amount in SUPPLEMENT_NUTRIENT_CONTENT.get(cid, {}).items():
                baseline[nutrient] += amount

    def _totals(recs):
        t = defaultdict(float, baseline)
        for supp, _, _ in recs:
            for nutrient, amount in SUPPLEMENT_NUTRIENT_CONTENT.get(supp["id"], {}).items():
                t[nutrient] += amount
        return t

    while True:
        totals = _totals(active)
        exceeded = {n: v for n, v in totals.items() if v > NUTRIENT_UL.get(n, float("inf"))}
        if not exceeded:
            break
        # 가장 심각하게 초과된 영양소부터 처리
        nutrient = max(exceeded, key=lambda n: exceeded[n] / NUTRIENT_UL[n])
        # 해당 영양소를 포함하는 영양제 중 점수 가장 낮은 것 제거
        candidates = [
            (i, score, supp)
            for i, (supp, _, score) in enumerate(active)
            if nutrient in SUPPLEMENT_NUTRIENT_CONTENT.get(supp["id"], {})
        ]
        if not candidates:
            break
        idx = min(candidates, key=lambda x: x[1])[0]
        removed_supp = active.pop(idx)[0]
        label = _nutrient_label.get(nutrient, nutrient)
        unit = NUTRIENT_UNIT.get(nutrient, "")
        warnings.append(
            f"{removed_supp.get('emoji', '')} **{removed_supp['name']}** — "
            f"다른 영양제와 {label} 성분이 중복되어 제외했습니다 "
            f"(합산 {int(totals[nutrient])}{unit} > 식약처 상한 {int(NUTRIENT_UL[nutrient])}{unit})."
        )
        # 빈 자리 채우기: reserve에서 UL 위반 없는 것 추가
        for j, candidate in enumerate(reserve):
            test_totals = _totals(active + [candidate])
            if not any(v > NUTRIENT_UL.get(n, float("inf")) for n, v in test_totals.items()):
                active.append(reserve.pop(j))
                break

    return active, warnings


# ── 혈액 검사 기반 보정 ───────────────────────────────────────────────────────
BLOOD_TEST_FIELDS = [
    {
        "id": "vitamin_d_level",
        "label": "비타민 D (25-OH 비타민D)",
        "unit": "ng/mL",
        "normal_range": "30–100",
        "ranges": [
            {"max": 20, "label": "심각한 결핍 (< 20)", "color": "#d63031", "boost": {"vitamin_d": 25}},
            {"max": 30, "label": "부족 (20~30)", "color": "#fdcb6e", "boost": {"vitamin_d": 15}},
            {"max": 100, "label": "정상 (30~100)", "color": "#00b894", "boost": {}},
        ],
    },
    {
        "id": "ferritin",
        "label": "페리틴 (철분 저장)",
        "unit": "ng/mL",
        "normal_range": "남 30–400 / 여 13–150",
        "ranges": [
            {"max": 15, "label": "결핍 (< 15)", "color": "#d63031", "boost": {"iron": 20, "vitamin_c": 8}},
            {"max": 30, "label": "부족 (15~30)", "color": "#fdcb6e", "boost": {"iron": 12}},
            {"max": 400, "label": "정상", "color": "#00b894", "boost": {}},
        ],
    },
    {
        "id": "triglycerides",
        "label": "중성지방 (TG)",
        "unit": "mg/dL",
        "normal_range": "< 150",
        "ranges": [
            {"max": 150, "label": "정상 (< 150)", "color": "#00b894", "boost": {}},
            {"max": 200, "label": "경계 (150~200)", "color": "#fdcb6e", "boost": {"omega3": 12}},
            {"max": 9999, "label": "높음 (> 200)", "color": "#d63031", "boost": {"omega3": 20, "coq10": 8}},
        ],
    },
    {
        "id": "ldl",
        "label": "LDL 콜레스테롤",
        "unit": "mg/dL",
        "normal_range": "< 130",
        "ranges": [
            {"max": 130, "label": "정상 (< 130)", "color": "#00b894", "boost": {}},
            {"max": 160, "label": "경계 (130~160)", "color": "#fdcb6e", "boost": {"omega3": 10, "probiotics": 6}},
            {"max": 9999, "label": "높음 (> 160)", "color": "#d63031", "boost": {"omega3": 18, "probiotics": 10, "coq10": 8}},
        ],
    },
    {
        "id": "fasting_glucose",
        "label": "공복 혈당",
        "unit": "mg/dL",
        "normal_range": "70–100",
        "ranges": [
            {"max": 100, "label": "정상 (< 100)", "color": "#00b894", "boost": {}},
            {"max": 126, "label": "전당뇨 (100~126)", "color": "#fdcb6e", "boost": {"magnesium": 10, "probiotics": 8, "vitamin_d": 6}},
            {"max": 9999, "label": "당뇨 범위 (> 126)", "color": "#d63031", "boost": {"magnesium": 15, "probiotics": 10, "vitamin_d": 8}},
        ],
    },
]


# ── 현재 복용 중인 영양제 옵션 ──────────────────────────────────────────────────
CURRENT_SUPPLEMENT_OPTIONS = [
    {"label": "종합비타민 (멀티비타민)", "ids": ["vitamin_b", "vitamin_c", "vitamin_d", "zinc", "iron"]},
    {"label": "오메가-3 (생선기름)", "ids": ["omega3"]},
    {"label": "마그네슘", "ids": ["magnesium"]},
    {"label": "비타민 D", "ids": ["vitamin_d"]},
    {"label": "비타민 C", "ids": ["vitamin_c"]},
    {"label": "비타민 B 복합체", "ids": ["vitamin_b"]},
    {"label": "철분제", "ids": ["iron"]},
    {"label": "아연 (징크)", "ids": ["zinc"]},
    {"label": "유산균 (프로바이오틱스)", "ids": ["probiotics"]},
    {"label": "콜라겐", "ids": ["collagen"]},
    {"label": "코엔자임 Q10 (CoQ10)", "ids": ["coq10"]},
    {"label": "밀크씨슬", "ids": ["milk_thistle"]},
    {"label": "비타민 E", "ids": ["vitamin_e"]},
    {"label": "홍삼", "ids": ["red_ginseng"]},
    {"label": "칼슘", "ids": ["calcium"]},
    {"label": "루테인", "ids": ["lutein"]},
]

# 지용성 비타민 — 과잉 복용 위험 대상
FAT_SOLUBLE_IDS = {"vitamin_d", "vitamin_a"}


# ── 영양제별 월간 비용 및 하루 복용량 ─────────────────────────────────────────
SUPPLEMENT_MONTHLY_DATA = {
    "vitamin_b":     {"cost_min": 8000,  "cost_max": 20000, "pills_per_day": 1, "unit": "정"},
    "magnesium":     {"cost_min": 10000, "cost_max": 25000, "pills_per_day": 1, "unit": "정"},
    "omega3":        {"cost_min": 15000, "cost_max": 35000, "pills_per_day": 2, "unit": "캡슐"},
    "vitamin_d":     {"cost_min": 5000,  "cost_max": 15000, "pills_per_day": 1, "unit": "정"},
    "probiotics":    {"cost_min": 15000, "cost_max": 40000, "pills_per_day": 1, "unit": "포"},
    "milk_thistle":  {"cost_min": 10000, "cost_max": 25000, "pills_per_day": 1, "unit": "정"},
    "vitamin_c":     {"cost_min": 5000,  "cost_max": 15000, "pills_per_day": 1, "unit": "정"},
    "lemon_balm":    {"cost_min": 12000, "cost_max": 30000, "pills_per_day": 1, "unit": "정"},
    "collagen":      {"cost_min": 15000, "cost_max": 40000, "pills_per_day": 1, "unit": "포"},
    "coq10":         {"cost_min": 20000, "cost_max": 50000, "pills_per_day": 1, "unit": "캡슐"},
    "iron":          {"cost_min": 8000,  "cost_max": 20000, "pills_per_day": 1, "unit": "정"},
    "zinc":          {"cost_min": 5000,  "cost_max": 15000, "pills_per_day": 1, "unit": "정"},
    "gaba":          {"cost_min": 12000, "cost_max": 30000, "pills_per_day": 1, "unit": "정"},
    "headache_tree": {"cost_min": 8000,  "cost_max": 20000, "pills_per_day": 1, "unit": "정"},
    "folic_acid":    {"cost_min": 5000,  "cost_max": 15000, "pills_per_day": 1, "unit": "정"},
    "vitamin_e":     {"cost_min": 8000, "cost_max": 25000, "pills_per_day": 1, "unit": "캡슐"},
    "red_ginseng": {"cost_min": 15000, "cost_max": 50000, "pills_per_day": 2, "unit": "정"},
    "calcium":     {"cost_min": 8000,  "cost_max": 25000, "pills_per_day": 2, "unit": "정"},
    "lutein":      {"cost_min": 10000, "cost_max": 30000, "pills_per_day": 1, "unit": "캡슐"},
}


def calculate_monthly_summary(recommendations: list) -> dict:
    """추천 영양제 목록의 월간 예상 비용 및 하루 알약 수 계산"""
    cost_min = 0
    cost_max = 0
    pills_per_day = 0
    items = []
    for supp, *_ in recommendations:
        d = SUPPLEMENT_MONTHLY_DATA.get(supp["id"], {})
        cost_min += d.get("cost_min", 0)
        cost_max += d.get("cost_max", 0)
        pills_per_day += d.get("pills_per_day", 1)
        items.append({"name": supp["name"], "pills": d.get("pills_per_day", 1), "unit": d.get("unit", "정")})
    return {"cost_min": cost_min, "cost_max": cost_max, "pills_per_day": pills_per_day, "items": items}


# ── 가족력 데이터 ────────────────────────────────────────────────────────────────
FAMILY_HISTORY_DATA = {
    "당뇨": {
        "label": "🩸 당뇨",
        "category_boost": {"장건강": 2, "피로": 1},
        "supp_boost": {"magnesium": 8, "probiotics": 6, "omega3": 4, "vitamin_d": 4},
        "note": "당뇨 가족력 → 인슐린 저항성 관련 영양소(마그네슘·오메가3·비타민D) 가중치 반영",
    },
    "고혈압": {
        "label": "❤️ 고혈압",
        "category_boost": {"피로": 1},
        "supp_boost": {"magnesium": 8, "coq10": 8, "omega3": 6},
        "note": "고혈압 가족력 → 혈관 건강 영양소(마그네슘·CoQ10·오메가3) 가중치 반영",
    },
    "고지혈증": {
        "label": "🫀 고지혈증 (콜레스테롤)",
        "category_boost": {},
        "supp_boost": {"omega3": 10, "coq10": 8, "probiotics": 4},
        "note": "고지혈증 가족력 → 오메가3·CoQ10 가중치 반영",
    },
    "심장질환": {
        "label": "🫀 심장질환",
        "category_boost": {},
        "supp_boost": {"omega3": 10, "coq10": 8, "magnesium": 6, "vitamin_d": 4},
        "note": "심혈관 가족력 → 오메가3·CoQ10 집중 가중치 반영",
    },
    "골다공증": {
        "label": "🦴 골다공증",
        "category_boost": {"근육관절": 2},
        "supp_boost": {"vitamin_d": 10, "magnesium": 8, "collagen": 6},
        "note": "골다공증 가족력 → 뼈 건강 3종(비타민D·마그네슘·콜라겐) 가중치 반영",
    },
    "탈모": {
        "label": "💇 탈모",
        "category_boost": {"피부": 2},
        "supp_boost": {"zinc": 8, "iron": 6, "vitamin_b": 6, "collagen": 4},
        "note": "탈모 가족력 → 아연·철분·비타민B 가중치 반영",
    },
    "우울증_정신질환": {
        "label": "🧠 우울증 / 불안",
        "category_boost": {"스트레스": 2, "수면": 1},
        "supp_boost": {"omega3": 8, "vitamin_d": 6, "magnesium": 6},
        "note": "정신건강 가족력 → 신경계 영양소(오메가3·비타민D·마그네슘) 가중치 반영",
    },
    "암": {
        "label": "🎗️ 암",
        "category_boost": {"면역력": 3},
        "supp_boost": {"vitamin_d": 8, "vitamin_c": 6, "omega3": 6, "probiotics": 4},
        "note": "암 가족력 → 면역 방어 영양소 가중치 반영 (예방 목적)",
    },
}


def apply_family_history_boosts(family_history: list) -> tuple:
    """가족력 → (카테고리 점수 추가, 영양제 추가 점수) 반환"""
    cat_boosts = {}
    supp_boosts = {}
    notes = []
    for fh in family_history:
        data = FAMILY_HISTORY_DATA.get(fh, {})
        for cat, val in data.get("category_boost", {}).items():
            cat_boosts[cat] = cat_boosts.get(cat, 0) + val
        for sid, val in data.get("supp_boost", {}).items():
            supp_boosts[sid] = supp_boosts.get(sid, 0) + val
        if data.get("note"):
            notes.append(data["note"])
    return cat_boosts, supp_boosts, notes


# ── 음식 섭취 빈도 → 영양 결핍 추론 ─────────────────────────────────────────────
# 각 음식 섭취 빈도 답변이 특정 영양소 카테고리 점수와 영양제 추천에 어떻게 영향을 주는지 정의
FOOD_DETAIL_BOOSTS = {
    # 채소 섭취 빈도
    "채소_거의안먹음": {
        "cat": {"면역력": 3, "피부": 2, "장건강": 2},
        "supp": {"vitamin_c": 8, "probiotics": 6},
        "food_advice": "녹황색 채소(브로콜리·시금치·당근)를 매일 1컵(150g) 이상 드세요. 비타민C·엽산·식이섬유의 주요 공급원입니다.",
    },
    "채소_주1-2회": {
        "cat": {"면역력": 1, "장건강": 1},
        "supp": {"vitamin_c": 4},
        "food_advice": "채소 섭취를 주 5회 이상으로 늘려보세요. 다양한 색깔의 채소를 골고루 드시는 게 좋습니다.",
    },
    # 생선 섭취 빈도
    "생선_거의안먹음": {
        "cat": {"피부": 2, "면역력": 1, "피로": 1},
        "supp": {"omega3": 10},
        "food_advice": "등푸른 생선(고등어·삼치·연어)을 주 2회 이상 드세요. 오메가3 EPA·DHA의 최고 천연 공급원입니다.",
    },
    "생선_주1회미만": {
        "cat": {"피부": 1},
        "supp": {"omega3": 5},
        "food_advice": "생선 섭취를 주 1~2회로 늘리거나 오메가3 보충제를 고려해 보세요.",
    },
    # 붉은 육류 섭취 빈도
    "육류_거의안먹음": {
        "cat": {"피로": 2, "면역력": 1},
        "supp": {"iron": 8, "vitamin_b": 6, "zinc": 4},
        "food_advice": "철분·아연·비타민B12가 부족해질 수 있어요. 콩류·두부·달걀로 대체하거나 헴철 보충제를 고려하세요.",
    },
    # 가공식품·패스트푸드 섭취 빈도
    "가공식품_주4회이상": {
        "cat": {"장건강": 3, "피부": 2, "간건강": 2},
        "supp": {"probiotics": 8, "vitamin_b": 4, "milk_thistle": 4},
        "food_advice": "가공식품을 주 2회 이하로 줄이세요. 나트륨·트랜스지방 과다로 장내 미생물 불균형과 간 부담이 생길 수 있습니다.",
    },
    "가공식품_주2-3회": {
        "cat": {"장건강": 1},
        "supp": {"probiotics": 4},
        "food_advice": "가공식품보다 신선식품 위주로 바꿔가시면 장 건강이 크게 개선됩니다.",
    },
    # 당류·단 음식 섭취 빈도
    "당류_매일": {
        "cat": {"피부": 2, "장건강": 2, "피로": 1},
        "supp": {"probiotics": 6, "vitamin_b": 4},
        "food_advice": "정제당을 하루 25g(세계보건기구 권고) 이하로 줄이세요. 과잉 섭취 시 AGEs 형성으로 피부 노화·장 건강 악화가 가속됩니다.",
    },
    "당류_주3-4회": {
        "cat": {"피부": 1},
        "supp": {},
        "food_advice": "단 음식은 과일·고구마 등 천연 당으로 대체해 보세요.",
    },
}


def apply_food_detail_boosts(food_detail: dict) -> tuple:
    """음식 섭취 빈도 → (카테고리 추가 점수, 영양제 추가 점수, 식품 조언 목록) 반환"""
    cat_boosts = {}
    supp_boosts = {}
    food_advices = []
    for answer_key in food_detail.values():
        data = FOOD_DETAIL_BOOSTS.get(answer_key, {})
        for cat, val in data.get("cat", {}).items():
            cat_boosts[cat] = cat_boosts.get(cat, 0) + val
        for sid, val in data.get("supp", {}).items():
            supp_boosts[sid] = supp_boosts.get(sid, 0) + val
        if data.get("food_advice"):
            food_advices.append(data["food_advice"])
    return cat_boosts, supp_boosts, food_advices


# ── 질환별 동적 꼬리 질문 ──────────────────────────────────────────────────────
# 특정 질환 선택 시 추가로 물어볼 약물 관련 질문과 부스트 로직
DRUG_INTERACTION_QUESTIONS = {
    "고지혈증": {
        "question": "스타틴 계열 콜레스테롤약(리피토·크레스토 등)을 복용 중이신가요?",
        "key": "statin_use",
        "if_yes_boost": {"coq10": 20},
        "if_yes_note": "스타틴이 체내 CoQ10을 고갈시킵니다 → CoQ10 최우선 추천에 반영",
    },
    "당뇨_혈당": {
        "question": "메트포르민(당뇨약)을 복용 중이신가요?",
        "key": "metformin_use",
        "if_yes_boost": {"vitamin_b": 18},
        "if_yes_note": "메트포르민이 비타민B12 흡수를 차단합니다 → 비타민B 복합체 최우선 추천에 반영",
    },
    "골다공증": {
        "question": "비스포스포네이트 계열 골다공증 약(포사맥스·악토넬 등)을 복용 중이신가요?",
        "key": "bisphosphonate_use",
        "if_yes_boost": {"vitamin_d": 12, "magnesium": 8},
        "if_yes_note": "골다공증 약과 함께 비타민D·마그네슘 보충이 더욱 중요합니다 → 가중치 반영",
    },
}


def apply_drug_interaction_boosts(answers: dict) -> tuple:
    """동적 꼬리 질문 응답 → 영양제 추가 점수 및 노트 반환"""
    supp_boosts = {}
    notes = []
    drug_answers = answers.get("drug_interactions", {})
    user_diseases = answers.get("질환", [])
    for cond_id, diq in DRUG_INTERACTION_QUESTIONS.items():
        if cond_id in user_diseases and drug_answers.get(diq["key"]) is True:
            for sid, val in diq["if_yes_boost"].items():
                supp_boosts[sid] = supp_boosts.get(sid, 0) + val
            notes.append(diq["if_yes_note"])
    return supp_boosts, notes


def apply_blood_test_boosts(blood_values: dict) -> dict:
    """혈액 검사 결과를 영양제 ID별 추가 점수로 변환"""
    boosts = {}
    findings = []  # (field_label, value, label, color)

    for field in BLOOD_TEST_FIELDS:
        raw = blood_values.get(field["id"])
        if raw is None:
            continue
        try:
            val = float(raw)
        except (ValueError, TypeError):
            continue

        for r in field["ranges"]:
            if val <= r["max"]:
                for supp_id, pts in r["boost"].items():
                    boosts[supp_id] = boosts.get(supp_id, 0) + pts
                if r["boost"]:  # 정상 범위 아닐 때만 기록
                    findings.append({
                        "label": field["label"],
                        "value": f"{val:.0f} {field['unit']}",
                        "status": r["label"],
                        "color": r["color"],
                    })
                break

    return boosts, findings
