import re
import logging
from typing import Optional, Callable, Tuple
from urllib.parse import urlparse, parse_qs, urlunparse

logger = logging.getLogger(__name__)


# ── 사이트별 정규화 함수 ────────────────────────────────────────────────────

def _normalize_saramin(url: str) -> str:
    """rec_idx만 남기고 나머지 파라미터 제거."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    if "rec_idx" in params:
        return urlunparse(parsed._replace(
            query=f"rec_idx={params['rec_idx'][0]}",
            fragment=""
        ))
    return url


def _extract_saramin_id(url: str) -> Optional[str]:
    params = parse_qs(urlparse(url).query)
    return params["rec_idx"][0] if "rec_idx" in params else None


def _normalize_jobkorea(url: str) -> str:
    """쿼리 파라미터·프래그먼트 전체 제거."""
    parsed = urlparse(url)
    return urlunparse(parsed._replace(query="", fragment=""))


def _extract_jobkorea_id(url: str) -> Optional[str]:
    m = re.search(r"/Recruit/GI_Read/(\d+)", url)
    return m.group(1) if m else None


# ── 사이트 감지 ─────────────────────────────────────────────────────────────

_SiteStrategy = Tuple[Callable[[str], str], Callable[[str], Optional[str]]]

_STRATEGIES: dict[str, _SiteStrategy] = {
    "saramin":  (_normalize_saramin,  _extract_saramin_id),
    "jobkorea": (_normalize_jobkorea, _extract_jobkorea_id),
    # 추가 사이트: "wanted": (_normalize_wanted, _extract_wanted_id),
}

_HOST_MAP = {
    "saramin.co.kr":  "saramin",
    "jobkorea.co.kr": "jobkorea",
    "wanted.co.kr":   "wanted",
    "incruit.com":    "incruit",
}


def detect_site(url: str) -> Optional[str]:
    """URL 호스트로 사이트 이름 반환. 미지원 사이트는 None."""
    try:
        host = urlparse(url).netloc.lower()
        for key, name in _HOST_MAP.items():
            if key in host:
                return name
    except Exception:
        pass
    return None


# ── 공개 API ────────────────────────────────────────────────────────────────

def normalize_job_url(url: str) -> str:
    """Canonical URL 반환. 지원하지 않는 사이트는 원본 URL 그대로 반환."""
    if not url:
        return url
    site = detect_site(url)
    if site and site in _STRATEGIES:
        normalize_fn, _ = _STRATEGIES[site]
        try:
            return normalize_fn(url)
        except Exception as e:
            logger.warning(f"URL 정규화 실패 ({site}): {url} — {e}")
    return url


def extract_job_id(url: str) -> Optional[str]:
    """사이트별 고유 job_id 추출. 실패 시 None 반환 + warning 로그."""
    if not url:
        return None
    site = detect_site(url)
    if not site:
        return None
    if site not in _STRATEGIES:
        logger.warning(f"지원하지 않는 사이트 job_id 추출 시도: {url}")
        return None
    _, extract_fn = _STRATEGIES[site]
    try:
        job_id = extract_fn(url)
        if not job_id:
            logger.warning(f"job_id 추출 실패: {url}")
        return job_id
    except Exception as e:
        logger.warning(f"job_id 추출 예외 ({site}): {url} — {e}")
        return None
