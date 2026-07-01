import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class JobPosting:
    """채용 공고 데이터 모델"""
    title: str
    company: str
    url: str
    source: str  # saramin, jobkorea, wanted

    location: str = ""
    experience: str = ""
    education: str = ""
    salary: str = ""
    tech_stack: List[str] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    job_type: str = ""  # 정규직, 계약직 등
    deadline: str = ""       # 원본 텍스트 (크롤러 raw)
    deadline_date: str = ""  # 정규화된 날짜 "YYYY-MM-DD" | "상시채용" | ""
    posted_date: str = ""
    description: str = ""

    crawled_at: datetime = field(default_factory=datetime.now)

    # 변경 감지용 필드
    job_id: str = ""
    content_hash: str = ""
    is_modified: bool = False
    updated_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.content_hash:
            from utils.hash_utils import generate_content_hash
            self.content_hash = generate_content_hash(self)

    def is_expired(self) -> bool:
        """마감일이 지났는지 확인. deadline_date(정규화값)를 우선 사용."""
        now = datetime.now()

        # 정규화된 날짜가 있으면 그걸로 판단
        date_str = self.deadline_date or self.deadline
        if not date_str:
            return False

        if date_str == "상시채용":
            return False

        # 상시/수시 계열 raw 텍스트 fallback
        skip_keywords = ["상시", "채용시", "수시", "마감시"]
        if any(kw in date_str for kw in skip_keywords):
            return False

        # YYYY-MM-DD 형식 (deadline_date의 표준 출력)
        try:
            return datetime.strptime(date_str, "%Y-%m-%d") < now
        except ValueError:
            pass

        # 레거시 raw 텍스트 fallback 파싱
        date_formats = ["%Y.%m.%d", "%Y/%m/%d", "%m/%d", "%m.%d"]
        cleaned = re.sub(r'\([가-힣]+\)', '', date_str).replace("~", "").replace("까지", "").strip()
        for fmt in date_formats:
            try:
                d = datetime.strptime(cleaned, fmt)
                if d.year == 1900:
                    d = d.replace(year=now.year)
                    if d < now:
                        d = d.replace(year=now.year + 1)
                return d < now
            except ValueError:
                continue

        return False

    def matches_filter(
        self,
        keyword: str = "",
        category: str = "전체",
        experience: str = "전체",
        education: str = "전체",
        tech_stacks: Optional[List[str]] = None,
        location: str = "전체"
    ) -> bool:
        """필터 조건에 맞는지 확인"""

        def log_fail(reason):
            logger.debug(
                "[%s] title='%s' exp='%s' loc='%s'",
                reason, self.title, self.experience, self.location,
            )

        if self.is_expired():
            log_fail("만료")
            return False

        # 키워드 필터: 사이트 URL 검색(서버 측)에서 이미 적용됨 — 내부 재필터 생략

        if tech_stacks:
            combined = " ".join(self.tech_stack).lower() + " " + f"{self.title} {self.description}".lower()
            if not any(ts.lower() in combined for ts in tech_stacks):
                log_fail("기술스택")
                return False

        _location_keywords = {
            "서울": ["서울"],
            "경기": ["경기", "수원", "성남", "고양", "용인", "부천",
                    "안산", "안양", "화성", "의정부", "파주", "시흥",
                    "하남", "광명", "평택", "과천", "의왕", "군포"],
        }
        if location and location != "전체":
            job_location = (self.location or "").strip()
            kws = _location_keywords.get(location, [location])
            if not any(kw in job_location for kw in kws):
                log_fail("지역")
                return False

        return True
    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "company": self.company,
            "url": self.url,
            "source": self.source,
            "location": self.location,
            "experience": self.experience,
            "education": self.education,
            "salary": self.salary,
            "tech_stack": self.tech_stack,
            "categories": self.categories,
            "job_type": self.job_type,
            "deadline": self.deadline,
            "deadline_date": self.deadline_date,
            "posted_date": self.posted_date,
            "description": self.description,
            "crawled_at": self.crawled_at.isoformat(),
            "job_id": self.job_id,
            "content_hash": self.content_hash,
            "is_modified": self.is_modified,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_html_card(self) -> str:
        """이메일용 HTML 카드"""
        source_colors = {
            "saramin": "#0D47A1",
            "jobkorea": "#00897B",
            "wanted": "#3F51B5"
        }
        source_names = {
            "saramin": "사람인",
            "jobkorea": "잡코리아",
            "wanted": "원티드"
        }
        color = source_colors.get(self.source, "#333")
        source_name = source_names.get(self.source, self.source)
        stacks = ", ".join(self.tech_stack[:5]) if self.tech_stack else "-"

        return f"""
        <div style="border:1px solid #ddd;border-radius:12px;padding:20px;
                    margin:10px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="background:{color};color:#fff;padding:4px 10px;
                            border-radius:6px;font-size:12px;">{source_name}</span>
                <span style="color:#999;font-size:12px;">마감: {self.deadline or '미정'}</span>
            </div>
            <h3 style="margin:12px 0 6px;color:#222;">{self.title}</h3>
            <p style="margin:4px 0;color:#555;font-size:14px;font-weight:bold;">
                🏢 {self.company}
            </p>
            <p style="margin:4px 0;color:#777;font-size:13px;">
                📍 {self.location or '-'} | 💼 {self.experience or '-'} |
                🎓 {self.education or '-'}
            </p>
            <p style="margin:4px 0;color:#777;font-size:13px;">
                🔧 {stacks}
            </p>
            <a href="{self.url}" style="display:inline-block;margin-top:10px;
                    background:{color};color:#fff;padding:8px 20px;border-radius:6px;
                    text-decoration:none;font-size:13px;">공고 보기 →</a>
        </div>
        """