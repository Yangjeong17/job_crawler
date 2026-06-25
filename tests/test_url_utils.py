"""
URL 정규화, job_id 추출, 변경 감지 단위 테스트
"""
import pytest
from utils.url_utils import normalize_job_url, extract_job_id, detect_site
from utils.hash_utils import generate_content_hash, detect_job_change
from models.job import JobPosting


# ── helpers ──────────────────────────────────────────────────────────────────

def _job(**kwargs) -> JobPosting:
    defaults = dict(
        title="백엔드 개발자",
        company="테스트회사",
        url="https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54142230",
        source="saramin",
        deadline="07/31",
        location="서울",
        experience="3년",
        posted_date="25/06/20",
    )
    defaults.update(kwargs)
    return JobPosting(**defaults)


# ── detect_site ───────────────────────────────────────────────────────────────

def test_detect_site_saramin():
    assert detect_site("https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1") == "saramin"

def test_detect_site_jobkorea():
    assert detect_site("https://www.jobkorea.co.kr/Recruit/GI_Read/49424960") == "jobkorea"

def test_detect_site_unknown():
    assert detect_site("https://www.unknown-site.com/job/123") is None


# ── 사람인: URL 정규화 ────────────────────────────────────────────────────────

SARAMIN_BASE = "https://www.saramin.co.kr/zf_user/jobs/relay/view"
SARAMIN_CANONICAL = f"{SARAMIN_BASE}?rec_idx=54142230"

def test_saramin_normalize_strips_tracking_params():
    url = (
        f"{SARAMIN_BASE}?view_type=search&rec_idx=54142230"
        "&location=ts&searchword=백엔드&search_uuid=abc123"
    )
    assert normalize_job_url(url) == SARAMIN_CANONICAL

def test_saramin_same_job_different_search_uuid():
    url1 = f"{SARAMIN_BASE}?rec_idx=54142230&search_uuid=aaa"
    url2 = f"{SARAMIN_BASE}?rec_idx=54142230&search_uuid=zzz"
    assert normalize_job_url(url1) == normalize_job_url(url2) == SARAMIN_CANONICAL

def test_saramin_extract_job_id():
    url = f"{SARAMIN_BASE}?view_type=search&rec_idx=54142230&searchword=백엔드"
    assert extract_job_id(url) == "54142230"

def test_saramin_different_rec_idx_is_different_job():
    url1 = f"{SARAMIN_BASE}?rec_idx=11111"
    url2 = f"{SARAMIN_BASE}?rec_idx=22222"
    assert extract_job_id(url1) != extract_job_id(url2)


# ── 잡코리아: URL 정규화 ──────────────────────────────────────────────────────

JK_BASE = "https://www.jobkorea.co.kr/Recruit/GI_Read/49424960"
JK_CANONICAL = JK_BASE

def test_jobkorea_normalize_strips_all_query_params():
    url = f"{JK_BASE}?Oem_Code=C1&logpath=1&stext=백엔드&listno=43&sc=630"
    assert normalize_job_url(url) == JK_CANONICAL

def test_jobkorea_same_job_different_listno():
    url1 = f"{JK_BASE}?listno=1"
    url2 = f"{JK_BASE}?listno=99"
    assert normalize_job_url(url1) == normalize_job_url(url2) == JK_CANONICAL

def test_jobkorea_extract_job_id():
    url = f"{JK_BASE}?Oem_Code=C1&logpath=1"
    assert extract_job_id(url) == "49424960"

def test_jobkorea_different_id_is_different_job():
    url1 = "https://www.jobkorea.co.kr/Recruit/GI_Read/11111111"
    url2 = "https://www.jobkorea.co.kr/Recruit/GI_Read/22222222"
    assert extract_job_id(url1) != extract_job_id(url2)


# ── 미지원 사이트 ─────────────────────────────────────────────────────────────

def test_unsupported_site_returns_original_url():
    url = "https://www.wanted.co.kr/wd/12345"
    assert normalize_job_url(url) == url

def test_unsupported_site_job_id_returns_none():
    assert extract_job_id("https://www.unknown.com/job/999") is None


# ── content_hash: 변경 없음 ───────────────────────────────────────────────────

def test_no_change_same_hash():
    job = _job()
    assert not detect_job_change(generate_content_hash(job), job)

def test_no_change_whitespace_insensitive():
    job1 = _job(title=" 백엔드 개발자 ")
    job2 = _job(title="백엔드 개발자")
    assert not detect_job_change(generate_content_hash(job1), job2)


# ── content_hash: 변경 감지 ──────────────────────────────────────────────────

def test_deadline_change_detected():
    job1 = _job(deadline="07/31")
    job2 = _job(deadline="08/31")
    assert detect_job_change(generate_content_hash(job1), job2)

def test_title_change_detected():
    job1 = _job(title="백엔드 개발자")
    job2 = _job(title="시니어 백엔드 개발자")
    assert detect_job_change(generate_content_hash(job1), job2)

def test_posted_date_change_detected():
    """사람인 수정일 변경 감지: 등록일 → 수정일로 날짜가 바뀌면 감지."""
    job1 = _job(posted_date="25/06/20")
    job2 = _job(posted_date="25/06/25")
    assert detect_job_change(generate_content_hash(job1), job2)

def test_description_change_not_in_hash():
    """description은 목록 페이지 미수집 → 해시 대상 아님 (설계상 의도)."""
    job1 = _job(description="원래 설명")
    job2 = _job(description="바뀐 설명")
    assert not detect_job_change(generate_content_hash(job1), job2)
