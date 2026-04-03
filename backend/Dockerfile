FROM python:3.11-slim

WORKDIR /app

# 프로젝트 전체 복사 (tools/ 패키지 포함)
COPY . /app/

# 백엔드 의존성 설치
RUN pip install --no-cache-dir -r backend/requirements.txt

# 프로젝트 루트를 PYTHONPATH에 추가
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
