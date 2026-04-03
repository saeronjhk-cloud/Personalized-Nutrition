"""
추천 엔진 서비스 레이어
- tool_recommender.py를 감싸서 API 친화적 결과를 반환
"""
import sys
import os

# 기존 tools 패키지를 import할 수 있도록 경로 추가
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from tools.tool_recommender import (
    compute_scores,
    compute_score_breakdown,
    get_persona,
    get_recommendations,
    get_excluded_candidates,
    apply_toxicity_guardrail,
    calculate_bmi,
    get_bmi_category,
    calculate_bmr,
    calculate_tdee,
    calculate_protein_target,
    calculate_monthly_summary,
    apply_family_history_boosts,
    apply_food_detail_boosts,
    apply_drug_interaction_boosts,
    apply_blood_test_boosts,
    SUPPLEMENTS,
    SUPPLEMENT_FOOD_AVOID,
)

from tools.tool_coupang_search import get_coupang_url


def build_coupang_url(keyword: str) -> str:
    """쿠팡 검색 URL 생성 래퍼"""
    result = get_coupang_url(keyword)
    return result.get("url", "")


def run_recommendation(answers: dict) -> dict:
    """
    설문 응답 dict를 받아 전체 추천 파이프라인을 실행하고 결과를 반환.

    이 함수는 supplement_app.py의 step_result()가 하던 일을 하나로 모은 것.
    """
    warnings = []

    # ── 1. 점수 계산 ──
    scores = compute_scores(answers)
    breakdown = compute_score_breakdown(answers)

    # ── 2. 가족력 부스트 ──
    blood_boosts = {}
    extra_supp_boosts = {}

    family_history = answers.get("가족력", [])
    if family_history:
        fam_cat_boosts, fam_supp_boosts, fam_notes = apply_family_history_boosts(family_history)
        for cat, val in fam_cat_boosts.items():
            scores[cat] = scores.get(cat, 0) + val
        extra_supp_boosts.update(fam_supp_boosts)
        warnings.extend(fam_notes)

    # ── 3. 식단 세부 부스트 ──
    food_detail = answers.get("음식상세")
    if food_detail:
        food_boosts, food_warnings = apply_food_detail_boosts(food_detail)
        extra_supp_boosts.update(food_boosts)
        warnings.extend(food_warnings)

    # ── 4. 약물 상호작용 부스트 ──
    drug_boosts, drug_warnings = apply_drug_interaction_boosts(answers)
    extra_supp_boosts.update(drug_boosts)
    warnings.extend(drug_warnings)

    # ── 5. 혈액검사 부스트 ──
    blood_values = answers.get("혈액검사")
    if blood_values:
        blood_boosts = apply_blood_test_boosts(blood_values)

    # ── 6. 페르소나 ──
    persona = get_persona(answers, scores)

    # ── 7. 추천 ──
    current_ids = set(answers.get("현재복용영양제", []))
    raw_recs = get_recommendations(
        answers, scores,
        blood_boosts=blood_boosts,
        max_recs=5,
        extra_supp_boosts=extra_supp_boosts,
        current_ids=current_ids,
    )

    # ── 8. 독성 가드레일 ──
    # raw_recs = [(supp_dict, matched_symptoms, total_score), ...]
    # apply_toxicity_guardrail 은 (filtered_list, warning_messages) 반환
    raw_recs, tox_warnings = apply_toxicity_guardrail(raw_recs, current_ids=current_ids, max_recs=5)
    warnings.extend(tox_warnings)

    # ── 9. 제외 후보 ──
    # get_excluded_candidates 는 원본 튜플 형식을 기대
    raw_excluded = get_excluded_candidates(
        answers, scores, raw_recs,
        blood_boosts=blood_boosts,
        extra_supp_boosts=extra_supp_boosts,
        top_n=3,
    )

    # ── 10. 영양 정보 ──
    height = answers.get("신장", 170)
    weight = answers.get("체중", 65)
    gender = answers.get("성별", "male")
    age = answers.get("나이", 30)
    activity = answers.get("운동", "거의_안함")

    bmi = calculate_bmi(weight, height)
    bmi_label, bmi_color, bmi_advice = get_bmi_category(bmi)
    bmr = calculate_bmr(gender, weight, height, age)
    tdee = calculate_tdee(bmr, activity)
    protein_min, protein_max = calculate_protein_target(weight, answers.get("목표", []))

    # ── 11. 튜플 → API dict 변환 ──
    # raw_recs: [(supp_dict, matched_symptoms, total_score), ...]
    recs = []
    for rank, (supp, matched_syms, total_score) in enumerate(raw_recs, 1):
        supp_id = supp.get("id", "")
        recs.append({
            "id": supp_id,
            "name": supp.get("name", supp_id),
            "score": total_score,
            "rank": rank,
            "mfds_type": supp.get("mfds_type"),
            "mfds_function": supp.get("mfds_function"),
            "evidence": supp.get("evidence"),
            "dosage_guide": supp.get("dosage_guide"),
            "cautions": supp.get("cautions", []),
            "drug_interactions": supp.get("drug_interactions", []),
            "symptom_indicators": supp.get("symptom_indicators", []),
            "coupang_url": build_coupang_url(supp.get("name", supp_id)),
            "food_avoid": SUPPLEMENT_FOOD_AVOID.get(supp_id, []),
        })

    # raw_excluded: [(supp_dict, reason_str), ...]
    excluded = []
    for supp, reason in raw_excluded:
        supp_id = supp.get("id", "")
        excluded.append({
            "id": supp_id,
            "name": supp.get("name", supp_id),
            "score": 0,
            "rank": 0,
            "reason": reason,
            "coupang_url": build_coupang_url(supp.get("name", supp_id)),
            "food_avoid": SUPPLEMENT_FOOD_AVOID.get(supp_id, []),
        })

    # ── 12. 월간 비용 (API dict 형식으로 전달) ──
    monthly = calculate_monthly_summary(raw_recs)

    # ── 결과 조립 ──
    return {
        "persona": persona,
        "scores": scores,
        "score_breakdown": [
            {"category": cat, "score": sc, "max_score": 10.0}
            for cat, sc in breakdown.items()
        ],
        "recommendations": recs,
        "excluded": excluded,
        "nutrition_info": {
            "bmi": {
                "value": round(bmi, 1),
                "label": bmi_label,
                "color": bmi_color,
                "advice": bmi_advice,
            },
            "bmr": round(bmr, 0),
            "tdee": round(tdee, 0),
            "protein_min": round(protein_min, 0),
            "protein_max": round(protein_max, 0),
        },
        "monthly_summary": monthly,
        "warnings": warnings,
    }
