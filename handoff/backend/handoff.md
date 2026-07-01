# Backend Handoff

## 세션 이력

### 2026-07-01 — 크롤러 데이터 품질 수정 (문제 1~6)

**배경:** `20260630.db` 분석에서 source별 이상 데이터 발견. 6개 문제를 식별하고 전부 수정 완료.

**수정된 파일:**
- `utils/deadline_parser.py`
- `crawlers/jobkorea_crawler.py`
- `crawlers/saramin_crawler.py`

**각 문제 요약:**

| # | 증상 | 원인 | 수정 |
|---|------|------|------|
| 6 | `진행예정` deadline → 빈값 | `_ALWAYS_OPEN` regex 누락 | regex에 `진행예정` 추가 |
| 1 | jobkorea experience에 공고 제목 오염 | fallback XPath가 title 링크 내 span까지 포함 | `ancestor::a[href*='/Recruit/GI_Read/']` 조건으로 차단 + len>20 안전장치 |
| 2 | jobkorea job_type 100% 빈값 | 분류 elif 분기 자체가 없었음 | `elif any(e in t for e in ["정규직","계약직","인턴","프리랜서","파견"])` 추가 |
| 3 | jobkorea categories 39% 빈값 | `len(t) < 25` 조건이 정상 카테고리 차단 | 길이 조건 제거 (GrayChip은 쉼표로 여러 직종 묶음) |
| 5 | jobkorea deadline 10% 빈값 | 날짜/상시 패턴 미매칭 시 빈값으로 낙하 | else fallback → `normalize_deadline(text)` 위임 |
| 4 | saramin salary 100% 빈값 | `.job_salary` 클래스 DOM에 없음 | DOM 확인 결과 목록 페이지에 급여 미노출 → dead selector 제거, `salary = ""` |

**참고:** saramin salary는 상세 페이지에서만 제공. 목록 크롤링으로는 추출 불가 (구조적 한계).
