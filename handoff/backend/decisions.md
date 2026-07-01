# Backend Decisions

## 2026-07-01

### D-01: DOM 확인 없이 selector 추측 금지
selector 변경은 반드시 Chrome 확장을 통한 실제 DOM 확인 후에만 진행.
추측 기반 수정은 이전 세션에서 education 분석 오류 사례처럼 잘못된 진단으로 이어질 수 있음.

### D-02: saramin salary 추출 포기 (목록 페이지 한계)
사람인 검색 결과 목록 페이지에는 급여 정보가 DOM에 없음 (협의/내규 텍스트 포함 전무).
상세 페이지 크롤링은 범위 확대로 별도 판단 필요. 현재는 `salary = ""` 유지.

### D-03: categories 길이 제한 제거
잡코리아 GrayChip은 "생명과학, 바이오, 연구개발" 처럼 여러 직종을 하나의 chip에 쉼표로 묶음.
`len(t) < 25` 조건이 이런 정상 데이터를 걸러냄 → 조건 제거. 길이 제한은 보조 안전장치로도 부적합.

### D-04: jobkorea experience fallback에 이중 방어
XPath ancestor 조건(원인 제거)을 1차 방어로, `len(experience) > 20` 조건을 2차 안전장치로 유지.
XPath 조건만으로 이론상 FN=0이지만, DOM 구조 변경에 대비한 보험.
