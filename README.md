# StockInsight AI (📊 개인화 AI 주식 리포트 자동화 시스템)

흩어져 있는 글로벌 거시 경제 지표, 개별 종목의 펀더멘털, 실시간 뉴스를 통합하고 LLM을 통해 분석하여 투자 인사이트를 제공하는 대시보드입니다.

## 🚀 기술 스택

### Backend

- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL (SQLAlchemy Async)
- **Task Queue:** Celery + Redis
- **AI:** Google Gemini API
- **Data:** yfinance, pykrx

### Frontend

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **State Management:** SWR

## 🛠️ 시작하기

### 백엔드 설정

1. `backend` 디렉토리로 이동
2. `poetry install`
3. `backend/.env` 확인 (`DATABASE_URL`, `GEMINI_API_KEY`, `KRX_ID`, `KRX_PW` 등)
   - **국내 주식(pykrx):** 2026년부터 [KRX Data Marketplace](https://data.krx.co.kr) **회원 로그인 필수** (조회는 무료). 가입 후 `.env`에 `KRX_ID` / `KRX_PW` 설정.
4. PostgreSQL DB 생성 (최초 1회, **관리자 PowerShell**):
  ```powershell
   cd backend

   .\scripts\setup-postgres.ps1 -ResetPassword
  ```
   이미 `postgres` 비밀번호를 알고 있다면: `.\scripts\setup-postgres.ps1 -Password 'YOUR_PASSWORD'`
5. 스키마 마이그레이션 (Alembic):
  ```powershell
   cd backend
   poetry run alembic upgrade head
  ```
   모델 변경 후: `poetry run alembic revision --autogenerate -m "설명"` → `poetry run alembic upgrade head`
6. `poetry run uvicorn src.backend.main:app --reload`
   - 터미널에 **API 요청**(`stockinsight.api`)과 **수집·리포트 태스크**(`stockinsight.task`) 로그가 출력됩니다.
   - 상세 진행 로그: `.env`에 `LOG_LEVEL=DEBUG` (기본 `INFO`)

### 프론트엔드 설정

1. `frontend` 디렉토리로 이동
2. `npm install`
3. `npm run dev`

## 📂 프로젝트 구조

- `backend/`: FastAPI 서버 및 데이터 파이프라인
- `frontend/`: Next.js 웹 대시보드
- `docs/`: 기획서 및 명세서

## ✨ 핵심 기능 (v1.0)

- 프로젝트 초기화 및 기본 아키텍처 구축
- 주식 데이터 수집기 (국내/해외) 구현
- Gemini API 연동 및 AI 분석 엔진 기초 구축
- Next.js 기반 대시보드 UI 레이아웃 구현
- Celery를 이용한 정기 데이터 수집 자동화 (진행 중)
- 디스코드 모닝 알림 연동 (진행 중)

