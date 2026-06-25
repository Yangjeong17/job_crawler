# JobHub

사람인, 잡코리아 채용공고를 자동 수집하고 스와이프 방식으로 스크리닝하는 개인용 채용 탐색 도구입니다.

## 주요 기능

**수집 및 저장**
- 사람인, 잡코리아 채용공고 Selenium 기반 크롤링
- SQLite DB 기반 영속 저장 — 재실행 시 재크롤링 불필요
- URL 정규화 (추적 파라미터 제거) + 사이트별 고유 job_id 추출로 안정적 중복 판정
- 공고 내용 변경 감지 (제목·마감일·등록일 등 SHA256 해시 비교)
- 회사명 + 제목 기준 교차사이트 중복 제거

**스크리닝 UI (Streamlit)**
- 카드 스와이프 방식: 관심없음 👎 / 저장 ⭐ / 즐겨찾기 ❤️
- 진행률 표시 및 남은 공고 수 실시간 갱신
- 등록일, 마감일, 직종 태그, 급여, 헤드헌터 뱃지 표시
- 저장/즐겨찾기 목록 탭 별도 제공

**편의 기능**
- 앱 시작 시 DB 선택 (마지막 사용 DB 자동 기억)
- 검색 기록 조회 및 복사
- 이전 DB 스와이프 결정 마이그레이션 (job_id 기반 매칭)
- 저장/즐겨찾기 공고 이메일 발송
- 일일 자동 발송 스케줄러

## 기술 스택

| 영역 | 기술 |
|---|---|
| Language | Python 3.11+ |
| Crawling | Selenium, webdriver-manager |
| GUI | Streamlit |
| DB | SQLite (sqlite3) |
| Email | smtplib |
| Scheduling | schedule |
| Test | pytest |

## 프로젝트 구조

```
JobHub/
├── main.py                   # 진입점: DB 선택 → Streamlit 실행
├── config.py                 # 크롤링·필터·이메일 설정
├── requirements.txt
├── pyproject.toml
├── crawlers/
│   ├── base_crawler.py       # Selenium 공통 기반
│   ├── saramin_crawler.py    # 사람인 크롤러
│   ├── jobkorea_crawler.py   # 잡코리아 크롤러
│   └── wanted_crawler.py     # 원티드 크롤러 (준비 중)
├── gui/
│   └── app.py                # Streamlit 앱
├── models/
│   └── job.py                # JobPosting 데이터 모델
├── services/
│   ├── db_service.py         # SQLite CRUD, 마이그레이션
│   ├── filter_service.py     # 필터링, 중복 제거
│   └── mail_service.py       # 이메일 발송
├── scheduler/
│   └── daily_scheduler.py    # 일일 자동 발송
├── utils/
│   ├── url_utils.py          # URL 정규화, job_id 추출
│   ├── hash_utils.py         # content_hash 생성, 변경 감지
│   └── helpers.py            # 표시명·색상 유틸리티
└── tests/
    └── test_url_utils.py     # URL 정규화·변경 감지 단위 테스트
```

## 설치

### 1. 저장소 클론

```bash
git clone https://github.com/Yangjeong17/JobHub.git
cd JobHub
```

### 2. 가상환경 생성 및 의존성 설치

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다.

```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
EMAIL_SENDER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_RECEIVER=receiver@gmail.com
```

Gmail은 일반 비밀번호가 아닌 [앱 비밀번호](https://myaccount.google.com/apppasswords)가 필요합니다.

## 실행

```bash
python main.py
```

실행하면 사용할 DB 이름을 입력하는 프롬프트가 나타납니다. 엔터를 누르면 마지막으로 사용한 DB를 이어서 사용합니다. 이후 Streamlit 앱이 자동으로 열립니다.

```
==============================
      사용할 DB 파일명을 입력하세요
==============================
  ✅ 엔터 → 이전 파일 사용 (jobs_database)
  📥 새 이름 입력 > 
```

## 사용 방법

### 공고 수집

1. 사이드바에서 키워드 입력 (예: `백엔드`, `Python`, `신입`)
2. 수집할 사이트 선택 (사람인 / 잡코리아)
3. **검색** 버튼 클릭 → 크롤링 시작
4. 완료 후 카드 목록에서 공고 스크리닝

### 스와이프 스크리닝

| 버튼 | 의미 |
|---|---|
| 👎 관심없음 | 다음 공고로 넘김. 목록에서 제외 |
| ⭐ 저장 | 관심 공고 저장. 저장 탭에서 확인 가능 |
| ❤️ 즐겨찾기 | 지원 예정 공고. 이메일 발송 대상 |
| ↩️ 실행취소 | 직전 결정 취소 |

모든 결정은 즉시 DB에 저장됩니다.

### DB 이전 (스와이프 마이그레이션)

새 DB로 재크롤링한 뒤 이전 DB의 스와이프 결정을 가져올 수 있습니다.

1. 사이드바 **"📂 이전 DB 스와이프 가져오기"** 섹션 열기
2. 이전 DB 파일 선택
3. **가져오기** 클릭

job_id 기반으로 매칭하므로 URL 형식이 달라도 동일 공고를 인식합니다.

## 데이터 모델

`JobPosting` 주요 필드:

| 필드 | 설명 |
|---|---|
| `job_id` | 사이트별 고유 ID (사람인: `rec_idx`, 잡코리아: GI_Read 번호) |
| `content_hash` | 주요 필드 SHA256 해시 — 변경 감지에 사용 |
| `is_modified` | 재크롤링 시 내용 변경 여부 |
| `categories` | 직종 태그 리스트 (크롤러에서 분리 추출) |
| `posted_date` | 등록일 또는 수정일 (사람인 수정 감지에 활용) |

## URL 정규화 규칙

동일 공고가 세션마다 다른 URL로 수집되는 문제를 방지합니다.

| 사이트 | 규칙 | Canonical URL |
|---|---|---|
| 사람인 | `rec_idx`만 유지, 나머지 파라미터 제거 | `.../relay/view?rec_idx={id}` |
| 잡코리아 | 쿼리 파라미터 전체 제거 | `.../Recruit/GI_Read/{id}` |

새 사이트 추가 시 `utils/url_utils.py`의 `_STRATEGIES` 딕셔너리에 정규화·ID 추출 함수만 등록하면 됩니다.

## 테스트

```bash
pytest tests/ -v
```

## 설정

`config.py`에서 주요 동작을 제어합니다.

```python
MAX_PAGES = 5          # 사이트별 최대 크롤링 페이지 수
CHROME_HEADLESS = True # 헤드리스 모드 (False로 변경 시 브라우저 표시)
DAILY_SEND_TIME = "09:00"
```

## 주의사항

이 프로젝트는 개인 학습 및 포트폴리오 목적으로 제작되었습니다. 수집한 데이터의 저작권은 각 채용 플랫폼에 있으며, 과도한 요청은 서비스 차단의 원인이 될 수 있습니다.
