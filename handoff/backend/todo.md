# Backend TODO

## 미완료 / 후속 검토 항목

### T-01: saramin salary 상세 페이지 추출 [보류]
목록 페이지에서 급여 추출 불가 확인. 상세 페이지 크롤링 추가 시 salary 복원 가능.
단, 공고 수 × 상세 페이지 요청 → 크롤링 시간 대폭 증가. 별도 세션에서 설계 필요.

### T-02: jobkorea education 항상 빈값 [미해결]
분류 로직(`대졸`, `고졸`, `석사`, `박사`, `학력` 키워드)은 존재하지만, 현재 바이오 검색 결과에서
GrayChip에 학력 chip이 아예 없음. 다른 키워드 검색 시 학력이 노출되는지 확인 필요.
→ 코드 문제인지 사이트 UI 변경인지 추가 검증 필요.

### T-03: saramin cond_parts 인덱스 기반 파싱 취약성
`cond_parts[0]~[3]`을 location/experience/education/job_type에 고정 매핑.
span 개수나 순서가 바뀌면 필드 오염 발생. 키워드 기반 분류로 전환 검토 가능.

### T-04: 크롤링 결과 재검증 (다음 크롤링 후)
이번 수정 사항이 실제 DB에 반영됐는지 `20260630.db` 이후 DB로 이상 데이터 비율 비교.
특히 jobkorea experience, categories, job_type, deadline 개선 여부 확인.
