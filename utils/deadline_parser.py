"""
deadline raw 텍스트 → 정규화된 날짜 문자열 변환.

반환값:
  - "YYYY-MM-DD"        : 구체적 날짜로 변환 성공
  - "상시채용"           : 상시/수시/채용시마감 계열
  - ""                  : 파싱 불가
"""

import re
from datetime import datetime, timedelta
from typing import Optional


_ALWAYS_OPEN = re.compile(r"상시|수시|채용시|채용 시|마감없|진행예정|rolling", re.I)

_RELATIVE = [
    (re.compile(r"오늘\s*마감|당일\s*마감"),   0),
    (re.compile(r"내일\s*마감"),               1),
    (re.compile(r"모레\s*마감"),               2),
]

# N시 마감 (날짜 없이 시간만): "21시마감", "17시 마감"
_TIME_ONLY = re.compile(r"^(\d{1,2})\s*시\s*마감$")

# D-숫자 / D+숫자
_D_DAY = re.compile(r"[Dd][-–]\s*(\d+)")

# MM/DD, MM.DD (연도 없음)
_MMDD = re.compile(r"^(\d{1,2})[./](\d{1,2})$")

# YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
_FULL_DATE = re.compile(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})")

# "N일 후 마감", "3일후"
_N_DAYS = re.compile(r"(\d+)\s*일\s*후")


def normalize_date(raw: str, ref: Optional[datetime] = None, allow_past: bool = False) -> str:
    """
    날짜 문자열만 YYYY-MM-DD로 정규화. 상시채용/빈값 등은 그대로 반환.
    주로 deadline·posted_date의 raw 저장값을 통일할 때 사용.

    allow_past=True: MM/DD가 올해 기준 과거여도 내년으로 보정하지 않음 (등록일 등에 사용).
    """
    if not raw:
        return ""
    if ref is None:
        ref = datetime.now()

    cleaned = re.sub(r"\([가-힣A-Za-z]+\)", "", raw)
    cleaned = re.sub(r"[~까지\s]", "", cleaned).strip()

    # YYYY-MM-DD 계열 → 이미 정규화됨
    m = _FULL_DATE.search(cleaned)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # MM/DD 계열
    m = _MMDD.match(cleaned)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        try:
            candidate = datetime(ref.year, mo, d)
            if not allow_past and candidate.date() < ref.date():
                candidate = candidate.replace(year=ref.year + 1)
            return candidate.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return raw  # 파싱 불가 시 원본 유지


def normalize_deadline(raw: str, ref: Optional[datetime] = None) -> str:
    """
    raw    : 크롤러가 긁어온 원본 텍스트 (e.g. "오늘마감", "07/15(화)", "2025.08.31")
    ref    : 크롤링 기준 시각 (None이면 datetime.now())
    returns: "YYYY-MM-DD" | "상시채용" | ""
    """
    if not raw:
        return ""

    if ref is None:
        ref = datetime.now()

    text = raw.strip()

    # 상시/수시 계열
    if _ALWAYS_OPEN.search(text):
        return "상시채용"

    # N시 마감 (당일 마감, 시간 포함)
    m = _TIME_ONLY.match(text)
    if m:
        hour = int(m.group(1))
        deadline_dt = ref.replace(hour=hour, minute=0, second=0, microsecond=0)
        # 이미 지난 시각이면 오늘 날짜 그대로 반환 (만료 판단은 is_expired에서)
        return deadline_dt.strftime("%Y-%m-%d")

    # 오늘/내일/모레
    for pattern, delta in _RELATIVE:
        if pattern.search(text):
            return (ref + timedelta(days=delta)).strftime("%Y-%m-%d")

    # D-N
    m = _D_DAY.search(text)
    if m:
        days = int(m.group(1))
        return (ref + timedelta(days=days)).strftime("%Y-%m-%d")

    # N일 후
    m = _N_DAYS.search(text)
    if m:
        days = int(m.group(1))
        return (ref + timedelta(days=days)).strftime("%Y-%m-%d")

    # 요일·기호 제거 후 날짜 파싱
    cleaned = re.sub(r"\([가-힣A-Za-z]+\)", "", text)
    cleaned = re.sub(r"[~까지\s]", "", cleaned).strip()

    # YYYY-MM-DD 계열
    m = _FULL_DATE.search(cleaned)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # MM/DD 계열 (연도 추정)
    m = _MMDD.match(cleaned)
    if m:
        mo, d = int(m.group(1)), int(m.group(2))
        try:
            candidate = datetime(ref.year, mo, d)
            # 이미 지났으면 내년으로
            if candidate.date() < ref.date():
                candidate = candidate.replace(year=ref.year + 1)
            return candidate.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return ""
