import logging
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
    deadline: str = ""
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
        """마감일이 지났는지 확인"""
        if not self.deadline:
            return False

        now = datetime.now()

        # "상시채용", "채용시 마감" 등은 만료되지 않음
        skip_keywords = ["상시", "채용시", "수시", "마감시", "상시채용"]
        for kw in skip_keywords:
            if kw in self.deadline:
                return False

        # 날짜 파싱 시도
        date_formats = [
            "%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d",
            "%m/%d", "%m.%d",
        ]

        deadline_str = self.deadline.replace("~", "").replace("까지", "").strip()

        for fmt in date_formats:
            try:
                deadline_date = datetime.strptime(deadline_str, fmt)
                # 연도가 없는 경우 올해로 설정
                if deadline_date.year == 1900:
                    deadline_date = deadline_date.replace(year=now.year)
                    if deadline_date < now:
                        deadline_date = deadline_date.replace(year=now.year + 1)
                return deadline_date < now
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