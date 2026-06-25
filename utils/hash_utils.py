import hashlib
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.job import JobPosting


def generate_content_hash(job: "JobPosting") -> str:
    """
    공고 내용 변경 감지용 SHA256 해시 생성.

    해시 대상: title, company, deadline, location, experience, posted_date
    - posted_date 포함 이유: 사람인은 채용담당자가 공고를 수정하면
      목록에서 '등록일 → 수정일'로 날짜가 바뀌므로 변경을 감지할 수 있다.
    - description(상세 설명)은 목록 페이지에서 수집 불가 → 해시 대상 제외.
    """
    parts = [
        (job.title or "").strip(),
        (job.company or "").strip(),
        (job.deadline or "").strip(),
        (job.location or "").strip(),
        (job.experience or "").strip(),
        (job.posted_date or "").strip(),
    ]
    normalized = "|".join(parts).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def detect_job_change(existing_hash: str, new_job: "JobPosting") -> bool:
    """기존 해시와 새 공고 해시를 비교. 내용이 바뀌었으면 True."""
    return existing_hash != generate_content_hash(new_job)
