"""
맞춤형 건강기능식품 추천 API
- FastAPI 기반 백엔드
"""
import sys
import os

# 프로젝트 루트를 path에 추가 (tools 패키지 import를 위해)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.recommendations import router as rec_router

app = FastAPI(
    title="Personalized Nutrition API",
    description="맞춤형 건강기능식품 추천 API — 식약처 인정 기능성 기반",
    version="1.0.0",
)

# CORS 설정 — 웹/모바일 프론트엔드에서 호출 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # React 개발 서버
        "http://localhost:5173",      # Vite 개발 서버
        "http://localhost:8081",      # React Native (Expo)
        "https://*.vercel.app",       # Vercel 배포
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rec_router)


@app.get("/")
async def root():
    return {
        "name": "Personalized Nutrition API",
        "version": "1.0.0",
        "docs": "/docs",
    }
