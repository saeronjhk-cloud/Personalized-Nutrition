"""
추천 서비스 레이어 테스트 (순수 Python, FastAPI 없이)
- 실제 배포 시 pytest로 실행
- 지금은 직접 실행해서 추천 엔진 → API 출력 파이프라인 검증
"""
import sys
import os
import json

# 프로젝트 루트
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

from backend.app.services.recommender import run_recommendation


def test_basic_recommendation():
    """기본 추천 테스트 — 30대 남성 직장인"""
    answers = {
        "성별": "male",
        "나이": 32,
        "신장": 175,
        "체중": 72,
        "체중변화": "변화없음",
        "증상": ["chronic_fatigue", "afternoon_slump", "cant_fall_asleep"],
        "목표": ["피로회복", "수면개선"],
        "수면": "잠들기_어려움",
        "스트레스": "자주",
        "운동": "주1-2회",
        "운동유형": "유산소",
        "일조량": "부족",
        "식사패턴": "불규칙",
        "음주": "주2-3회",
        "흡연": "비흡연",
        "현재복용영양제": [],
        "기저질환": [],
        "가족력": [],
    }

    result = run_recommendation(answers)

    # 기본 구조 검증
    assert "persona" in result, "페르소나 누락"
    assert "scores" in result, "점수 누락"
    assert "recommendations" in result, "추천 결과 누락"
    assert "nutrition_info" in result, "영양 정보 누락"
    assert "monthly_summary" in result, "월간 비용 누락"

    # 추천 결과가 1개 이상
    assert len(result["recommendations"]) >= 1, "추천 결과 0개"

    # 페르소나 필드 확인
    persona = result["persona"]
    assert "name" in persona, "페르소나 name 누락"
    assert "emoji" in persona, "페르소나 emoji 누락"

    # BMI 검증
    bmi = result["nutrition_info"]["bmi"]
    assert 15 < bmi["value"] < 40, f"BMI 이상: {bmi['value']}"

    # 추천에 쿠팡 URL 포함 확인
    for rec in result["recommendations"]:
        assert "coupang_url" in rec, f"쿠팡 URL 누락: {rec.get('id')}"
        assert "name" in rec, f"이름 누락: {rec.get('id')}"

    print(f"✅ 기본 테스트 통과")
    print(f"   페르소나: {persona['emoji']} {persona['name']}")
    print(f"   추천 {len(result['recommendations'])}개: {[r['name'] for r in result['recommendations']]}")
    print(f"   BMI: {bmi['value']} ({bmi['label']})")
    return result


def test_menopause_woman():
    """갱년기 여성 테스트"""
    answers = {
        "성별": "female",
        "나이": 52,
        "신장": 160,
        "체중": 58,
        "체중변화": "증가",
        "월경상태": "폐경",
        "증상": ["hot_flashes", "mood_swings", "cant_fall_asleep", "dry_skin"],
        "목표": ["갱년기관리", "수면개선", "피부개선"],
        "수면": "중간에_자꾸_깸",
        "스트레스": "자주",
        "운동": "주1-2회",
        "일조량": "부족",
        "현재복용영양제": [],
        "기저질환": [],
        "가족력": ["골다공증"],
    }

    result = run_recommendation(answers)

    persona = result["persona"]
    recs = result["recommendations"]
    rec_names = [r["name"] for r in recs]

    print(f"\n✅ 갱년기 여성 테스트 통과")
    print(f"   페르소나: {persona['emoji']} {persona['name']}")
    print(f"   추천: {rec_names}")
    print(f"   경고: {result.get('warnings', [])}")
    return result


def test_blood_sugar_manager():
    """혈당 관리 중년 남성 테스트"""
    answers = {
        "성별": "male",
        "나이": 48,
        "신장": 172,
        "체중": 85,
        "체중변화": "증가",
        "증상": ["sugar_cravings", "post_meal_drowsy", "chronic_fatigue"],
        "목표": ["혈당관리", "체지방감소", "피로회복"],
        "스트레스": "가끔",
        "운동": "거의_안함",
        "일조량": "부족",
        "현재복용영양제": [],
        "기저질환": ["당뇨"],
        "가족력": ["당뇨"],
    }

    result = run_recommendation(answers)

    persona = result["persona"]
    recs = result["recommendations"]

    print(f"\n✅ 혈당 관리 테스트 통과")
    print(f"   페르소나: {persona['emoji']} {persona['name']}")
    print(f"   추천: {[r['name'] for r in recs]}")
    print(f"   BMI: {result['nutrition_info']['bmi']['value']} ({result['nutrition_info']['bmi']['label']})")
    return result


def test_output_format():
    """API 출력 형식이 프론트엔드에서 바로 사용 가능한지 검증"""
    result = test_basic_recommendation()

    # score_breakdown 형식 확인
    for item in result["score_breakdown"]:
        assert "category" in item, "breakdown category 누락"
        assert "score" in item, "breakdown score 누락"

    # monthly_summary 형식 확인
    monthly = result["monthly_summary"]
    assert "cost_min" in monthly, "월간 비용 cost_min 누락"
    assert "cost_max" in monthly, "월간 비용 cost_max 누락"

    # JSON 직렬화 가능 여부
    json_str = json.dumps(result, ensure_ascii=False, indent=2)
    assert len(json_str) > 100, "JSON 출력 너무 짧음"

    print(f"\n✅ 출력 형식 테스트 통과 (JSON {len(json_str)} bytes)")


if __name__ == "__main__":
    print("=" * 60)
    print("🧪 백엔드 추천 서비스 테스트")
    print("=" * 60)

    test_basic_recommendation()
    test_menopause_woman()
    test_blood_sugar_manager()
    test_output_format()

    print("\n" + "=" * 60)
    print("🎉 전체 테스트 통과!")
    print("=" * 60)
