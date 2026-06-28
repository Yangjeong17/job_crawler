# JobHub

사람인·잡코리아 채용공고를 자동 수집하고, 카드 스와이프로 스크리닝하는 개인용 취업 공고 관리 앱.

## 주요 기능

- **크롤링**: 사람인·잡코리아 키워드 검색 → 공고 자동 수집 (Selenium)
- **스와이프 스크리닝**: 관심없음 / 저장 / 즐겨찾기 카드 분류
- **AI 분석**: 공고 상세 페이지 크롤링 후 Claude API로 적합도 분석
- **스케줄러**: 저장된 공고를 마감일 기준 리스트 + 캘린더로 확인
- **DB 전환**: 여러 DB 파일을 전환하며 사용, 이전 DB 스와이프 결정 마이그레이션

## 기술 스택

| 영역 | 내용 |
|------|------|
| 백엔드 | Python 3.11+, FastAPI, SQLite |
| 크롤링 | Selenium, Playwright (상세 페이지) |
| AI | Claude API (Anthropic) |
| 프론트엔드 | React 19, TypeScript, Vite |
| 스타일 | Tailwind CSS v4 |
| 상태관리 | TanStack Query v5, Zustand v5 |

## 프로젝트 구조

```
JobHub/
├── api/
│   └── main.py               # FastAPI 앱 (REST API + WebSocket)
├── crawlers/
│   ├── saramin_crawler.py
│   └── jobkorea_crawler.py
├── services/
│   ├── db_service.py         # SQLite CRUD
│   ├── filter_service.py     # 필터링·중복 제거
│   ├── analysis_service.py   # Claude AI 분석
│   └── detail_crawler.py     # 공고 상세 크롤링 (Playwright)
├── frontend/                 # React 프론트엔드
│   └── src/
│       ├── pages/            # ScreeningPage, AllJobsPage, JobListPage, SchedulerPage
│       ├── components/       # Sidebar, TabBar, TopBar, ListCard, AnalysisModal
│       ├── api/client.ts     # API 클라이언트
│       └── store/            # Zustand 전역 상태
├── utils/
│   ├── url_utils.py          # URL 정규화, job_id 추출
│   └── hash_utils.py         # 공고 변경 감지
└── jobs_before.db            # SQLite DB (기본)
```

## 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/Yangjeong17/JobHub.git
cd JobHub
```

### 2. 백엔드 의존성 설치

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium    # 상세 크롤링용
```

### 3. 프론트엔드 의존성 설치

```bash
cd frontend
npm install
```

### 4. 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
ANTHROPIC_API_KEY=your_api_key   # AI 분석 기능에 필요 (없으면 분석 버튼만 비활성)
JOBHUB_DB_NAME=jobs_before.db    # 기본 DB 파일명 (생략 가능)
```

### 5. 실행

백엔드와 프론트엔드를 **동시에** 실행해야 합니다.

```bash
# 백엔드 (포트 8000)
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000

# 프론트엔드 (포트 5173) — 별도 터미널
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

> Vite 개발 서버가 `/api/*` 요청을 `http://localhost:8000`으로 자동 프록시합니다.

## 사용 방법

### 공고 수집

1. 사이드바에서 키워드 입력 (예: `백엔드 Python`)
2. 수집할 사이트 선택 (사람인 / 잡코리아)
3. **검색** 버튼 클릭 → 크롤링 진행 상황이 로그로 표시됨
4. 완료 후 스크리닝 화면에 새 공고 자동 반영

### 스와이프 스크리닝

| 버튼 | 의미 |
|------|------|
| 👎 관심없음 | 다음 공고로 넘김 |
| 🔖 저장 | 나중에 다시 볼 공고 |
| ❤️ 즐겨찾기 | 지원 예정 공고 |
| ↩️ 실행취소 | 직전 결정 취소 |

단축키는 우측 상단 키보드 아이콘에서 확인 및 변경할 수 있습니다.

### AI 분석

스크리닝 카드 우측 상단 ✨ 아이콘 클릭 → 공고 상세 페이지를 크롤링한 뒤 Claude가 적합도를 분석합니다. `ANTHROPIC_API_KEY`가 필요합니다.

### 스케줄러

저장된 공고를 마감일 기준으로 정렬한 리스트 뷰와 캘린더 뷰로 확인합니다. 상단 검색박스로 공고명·회사명 필터링 가능.

### DB 관리

- **DB 전환**: 사이드바 상단에서 다른 `.db` 파일로 전환
- **스와이프 마이그레이션**: 이전 DB의 관심없음/저장/즐겨찾기 결정을 현재 DB로 가져오기 (job_id 기반 매칭)

## 주의사항

개인 학습 및 포트폴리오 목적으로 제작되었습니다. 수집한 데이터의 저작권은 각 채용 플랫폼에 있으며, 과도한 요청은 서비스 차단의 원인이 될 수 있습니다.
