"""
API 출력 스키마 — 추천 결과 형식
"""
from pydantic import BaseModel, Field
from typing import Optional


class SupplementRecommendation(BaseModel):
    """개별 영양제 추천"""
    id: str
    name: str
    score: float
    rank: int
    mfds_type: Optional[str] = None
    mfds_function: Optional[str] = None
    evidence: Optional[dict] = None
    dosage_guide: Optional[dict] = None
    cautions: Optional[list[str]] = None
    drug_interactions: Optional[list[str]] = None
    symptom_indicators: Optional[list[str]] = None
    coupang_url: Optional[str] = None
    food_avoid: Optional[list[str]] = None


class PersonaInfo(BaseModel):
    """페르소나 정보"""
    id: str
    name: str
    emoji: str
    description: str
    tip: str


class ScoreBreakdown(BaseModel):
    """카테고리별 점수 분석"""
    category: str
    score: float
    max_score: float = 10.0


class BMIInfo(BaseModel):
    """BMI 정보"""
    value: float
    label: str
    color: str
    advice: str


class NutritionInfo(BaseModel):
    """기초대사량/에너지 정보"""
    bmi: BMIInfo
    bmr: float = Field(description="기초대사량 kcal")
    tdee: float = Field(description="일일 에너지 소비량 kcal")
    protein_min: float = Field(description="단백질 최소 g")
    protein_max: float = Field(description="단백질 최대 g")


class MonthlyCost(BaseModel):
    """월간 비용 요약"""
    total_min: int
    total_max: int
    items: list[dict]


class RecommendationResponse(BaseModel):
    """최종 추천 응답"""
    persona: PersonaInfo
    scores: dict[str, float]
    score_breakdown: list[ScoreBreakdown]
    recommendations: list[SupplementRecommendation]
    excluded: list[SupplementRecommendation] = Field(default_factory=list)
    nutrition_info: NutritionInfo
    monthly_summary: MonthlyCost
    warnings: list[str] = Field(default_factory=list)
