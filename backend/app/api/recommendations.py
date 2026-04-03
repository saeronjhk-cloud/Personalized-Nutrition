"""
추천 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException
from ..schemas.input import SurveyInput
from ..services.recommender import run_recommendation

router = APIRouter(prefix="/api/v1", tags=["recommendations"])


@router.post("/recommend")
async def recommend(survey: SurveyInput):
    """
    설문 응답을 받아 맞춤 영양제 추천을 반환.

    - 입력: 설문 전체 응답 (SurveyInput)
    - 출력: 페르소나, 점수, 추천 영양제, 영양 정보, 월간 비용
    """
    try:
        # Pydantic 모델 → dict 변환 (기존 엔진이 dict를 받음)
        answers = survey.model_dump(exclude_none=True)
        result = run_recommendation(answers)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {"status": "ok", "version": "1.0.0"}


@router.get("/meta/symptoms")
async def get_symptoms():
    """설문에 사용되는 증상 목록 반환 (프론트엔드 렌더링용)"""
    from tools.tool_recommender import SYMPTOM_GROUPS
    return {"symptom_groups": SYMPTOM_GROUPS}


@router.get("/meta/goals")
async def get_goals():
    """건강 목표 목록 반환"""
    goals = [
        {"id": "피로회복", "emoji": "💪", "label": "피로회복"},
        {"id": "수면개선", "emoji": "😴", "label": "수면개선"},
        {"id": "면역력강화", "emoji": "🛡️", "label": "면역력강화"},
        {"id": "체중감량", "emoji": "⚖️", "label": "체중감량"},
        {"id": "간건강", "emoji": "🍺", "label": "간건강"},
        {"id": "소화장건강", "emoji": "🦠", "label": "소화장건강"},
        {"id": "근육증가", "emoji": "🏋️", "label": "근육증가"},
        {"id": "피부개선", "emoji": "✨", "label": "피부개선"},
        {"id": "혈당관리", "emoji": "🩸", "label": "혈당관리"},
        {"id": "체지방감소", "emoji": "⚖️", "label": "체지방감소"},
        {"id": "눈건강", "emoji": "👁️", "label": "눈건강"},
        {"id": "심혈관건강", "emoji": "❤️", "label": "심혈관건강"},
        {"id": "갱년기관리", "emoji": "🌸", "label": "갱년기관리"},
        {"id": "인지력향상", "emoji": "🧠", "label": "인지력향상"},
    ]
    return {"goals": goals}


@router.get("/meta/conditions")
async def get_conditions():
    """질환/기저질환 목록 반환"""
    from tools.tool_recommender import CONDITIONS
    return {"conditions": list(CONDITIONS.keys())}


@router.get("/meta/supplements")
async def get_supplements():
    """전체 보충제 기본 정보 반환"""
    from tools.tool_recommender import SUPPLEMENTS
    summary = []
    for sid, data in SUPPLEMENTS.items():
        summary.append({
            "id": sid,
            "name": data.get("name", sid),
            "mfds_type": data.get("mfds_type"),
            "mfds_function": data.get("mfds_function"),
        })
    return {"supplements": summary}
