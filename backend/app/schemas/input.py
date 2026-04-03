"""
API 입력 스키마 — 설문 응답을 받는 형식
Streamlit supplement_app.py의 answers dict를 Pydantic 모델로 정의
"""
from pydantic import BaseModel, Field
from typing import Optional


class SurveyInput(BaseModel):
    """설문 전체 응답"""

    # Q1: 기본 신체 정보
    성별: str = Field(..., description="male 또는 female")
    나이: int = Field(..., ge=10, le=100)
    신장: float = Field(..., ge=100, le=250, description="cm")
    체중: float = Field(..., ge=30, le=200, description="kg")
    체중변화: str = Field(default="변화없음", description="최근 체중 변화")

    # Q1 옵션: 월경
    월경상태: Optional[str] = Field(default=None)

    # Q2: 증상 체크
    증상: list[str] = Field(default_factory=list, description="선택한 증상 ID 목록")

    # Q3: 건강 목표
    목표: list[str] = Field(default_factory=list, description="선택한 건강 목표 목록")

    # Q4: 수면
    수면: Optional[str] = Field(default=None)

    # Q5: 스트레스
    스트레스: Optional[str] = Field(default=None)

    # Q6: 운동
    운동: Optional[str] = Field(default=None)
    운동유형: Optional[str] = Field(default=None)
    일조량: Optional[str] = Field(default=None)

    # Q7: 식습관
    식사패턴: Optional[str] = Field(default=None)
    식이제한: Optional[list[str]] = Field(default=None)

    # Q8: 알코올/흡연
    음주: Optional[str] = Field(default=None)
    흡연: Optional[str] = Field(default=None)

    # Q9: 현재 복용 영양제
    현재복용영양제: Optional[list[str]] = Field(default_factory=list)

    # Q10: 질환/약물
    기저질환: Optional[list[str]] = Field(default_factory=list)
    복용약물: Optional[str] = Field(default=None)

    # Q11: 가족력
    가족력: Optional[list[str]] = Field(default_factory=list)

    # 식단 세부
    음식상세: Optional[dict] = Field(default=None, alias="음식상세")

    # 혈액검사
    혈액검사: Optional[dict] = Field(default=None)

    class Config:
        populate_by_name = True
