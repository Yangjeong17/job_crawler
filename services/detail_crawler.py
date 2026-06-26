"""
채용공고 상세 페이지 본문 추출기

검증된 구조 (2026-06-25):
  잡코리아: GI_Read_Comt_Ifrm iframe → div#detail-content
  사람인:   view-detail iframe      → div.user_content (dl/dt/dd)

사용:
    from services.detail_crawler import extract_job_posting
    result = extract_job_posting("https://www.jobkorea.co.kr/Recruit/GI_Read/49281310")
"""

import logging
import pathlib
import re
from typing import Optional

from bs4 import BeautifulSoup
from markdownify import markdownify as md
from playwright.sync_api import sync_playwright, Page, Frame

logger = logging.getLogger(__name__)

_CHROME_PATH = "/usr/bin/google-chrome"

_CONTENT_KEYWORDS = ["자격요건", "우대사항", "모집부문", "모집분야", "담당업무", "주요업무", "근무조건"]

# 불필요한 요소 제거 대상
_STRIP_SELECTORS = [
    "script", "style", "svg", "noscript",
    "header", "footer", "nav",
    "[class*='banner']", "[class*='ad-']", "[class*='advertisement']",
    "[class*='apply-btn']", "[class*='btn-apply']",
]

# 사이트별 본문 컨테이너 셀렉터 (조사 결과 기반)
_CONTENT_SELECTORS = {
    "jobkorea": [
        "#detail-content",
        "article.dev-wrap-detailContents",
        "article.view-content",
        "div[class*='html-viewer-content-reset']",
    ],
    "saramin": [
        "div.user_content",
        "div.wrap_user_content",
    ],
}


def detect_source(url: str) -> Optional[str]:
    """URL에서 사이트명 감지."""
    if "saramin.co.kr" in url:
        return "saramin"
    if "jobkorea.co.kr" in url:
        return "jobkorea"
    return None


def _pick_content_frame(frames) -> Optional[Frame]:
    """키워드 우선순위로 본문 frame 선택."""
    best: Optional[Frame] = None
    best_priority = 999
    best_len = 0

    for frame in frames:
        try:
            frame_url = frame.url
            # 광고/추적 frame 제외
            if not frame_url or frame_url in ("about:blank", "") or "criteo" in frame_url:
                continue

            body = frame.query_selector("body")
            if not body:
                continue
            text = frame.inner_text("body")
            text_len = len(text)

            if "자격요건" in text:
                priority = 1
            elif "우대사항" in text:
                priority = 2
            elif "모집부문" in text or "모집분야" in text:
                priority = 3
            elif any(kw in text for kw in _CONTENT_KEYWORDS):
                priority = 4
            else:
                priority = 5

            if priority < best_priority or (priority == best_priority and text_len > best_len):
                best_priority = priority
                best_len = text_len
                best_frame = frame
                best = best_frame

        except Exception:
            continue

    return best


def _clean_and_convert(html: str, source: str) -> str:
    """HTML에서 본문 컨테이너 추출 후 Markdown 변환."""
    soup = BeautifulSoup(html, "html.parser")

    # 불필요한 요소 제거
    for sel in _STRIP_SELECTORS:
        for el in soup.select(sel):
            el.decompose()

    # 본문 컨테이너 선택
    container = None
    for sel in _CONTENT_SELECTORS.get(source, []):
        container = soup.select_one(sel)
        if container:
            logger.debug(f"본문 컨테이너: {sel}")
            break

    if not container:
        logger.warning(f"본문 컨테이너를 찾지 못해 body 전체 사용 (source={source})")
        container = soup.find("body") or soup

    # dl/dt/dd → h2/p 변환 (사람인 구조 보정)
    if source == "saramin":
        for dl in container.find_all("dl"):
            dt = dl.find("dt")
            dd = dl.find("dd")
            if dt:
                h2 = soup.new_tag("h2")
                h2.string = dt.get_text(strip=True)
                dl.replace_with(h2)
                if dd:
                    h2.insert_after(dd)

    result = md(str(container), heading_style="ATX", bullets="-")

    # 연속 빈 줄 정리
    result = re.sub(r"\n{3,}", "\n\n", result).strip()
    return result


def extract_job_posting(url: str, debug_dir: Optional[str] = None) -> dict:
    """
    채용공고 URL에서 본문을 Markdown으로 추출.

    반환:
        {
            "source": "jobkorea" | "saramin",
            "url": url,
            "markdown": "...",
            "raw_html": "...",
            "content_length": 12345,
        }
    실패 시 markdown은 빈 문자열.
    """
    source = detect_source(url)
    result = {"source": source, "url": url, "markdown": "", "raw_html": "", "content_length": 0}

    if not source:
        logger.error(f"지원하지 않는 사이트: {url}")
        return result

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                executable_path=_CHROME_PATH,
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="ko-KR",
            )
            page = context.new_page()

            logger.info(f"상세 페이지 로드: {url}")
            page.goto(url, timeout=20_000, wait_until="networkidle")

            content_frame = _pick_content_frame(page.frames)
            if not content_frame:
                logger.warning(f"본문 frame 탐지 실패: {url}")
                browser.close()
                return result

            logger.info(f"본문 frame: {content_frame.url}")
            raw_html = content_frame.content()
            browser.close()

        # 디버그 HTML 저장 (debug_dir 지정 시)
        if debug_dir:
            out = pathlib.Path(debug_dir) / f"debug_{source}.html"
            out.write_text(raw_html, encoding="utf-8")
            logger.debug(f"디버그 HTML 저장: {out}")

        markdown = _clean_and_convert(raw_html, source)

        # 검증 로그
        lines = markdown.splitlines()
        has_qual = "자격요건" in markdown
        has_pref = "우대사항" in markdown
        logger.info(
            f"추출 완료 — 글자 수: {len(markdown)}, 줄 수: {len(lines)}, "
            f"자격요건: {has_qual}, 우대사항: {has_pref}"
        )

        result.update({"markdown": markdown, "raw_html": raw_html, "content_length": len(markdown)})

    except Exception as e:
        logger.error(f"상세 크롤링 실패 ({url}): {e}", exc_info=True)

    return result
