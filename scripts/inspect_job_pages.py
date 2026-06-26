"""
채용공고 상세 페이지 구조 조사 스크립트 (Step 1~3)

사용법:
    .venv/bin/python scripts/inspect_job_pages.py

출력:
    - 각 frame URL 및 텍스트 길이
    - 키워드 존재 여부
    - 본문 frame 자동 탐지
    - debug_content_frame_<site>.html 저장
"""

import sys
import pathlib

from playwright.sync_api import sync_playwright

CHROME_PATH = "/usr/bin/google-chrome"

KEYWORDS = ["자격요건", "우대사항", "모집부문", "모집분야", "담당업무", "주요업무", "근무조건"]

URLS = {
    "saramin":  "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54248171",
    "jobkorea": "https://www.jobkorea.co.kr/Recruit/GI_Read/49281310",
}

OUTPUT_DIR = pathlib.Path(__file__).parent.parent / "scripts"


def inspect_url(page, site: str, url: str):
    print(f"\n{'='*60}")
    print(f"[{site}] {url}")
    print(f"{'='*60}")

    page.goto(url, timeout=20_000, wait_until="networkidle")

    frames = page.frames
    print(f"\n총 frame 수: {len(frames)}")

    best_frame = None
    best_priority = 999
    best_len = 0

    for i, frame in enumerate(frames):
        try:
            frame_url = frame.url
            text = frame.inner_text("body") if frame.query_selector("body") else ""
            text_len = len(text)

            found = {kw: (kw in text) for kw in KEYWORDS}
            hit_keywords = [kw for kw, v in found.items() if v]

            print(f"\nFrame {i}:")
            print(f"  URL: {frame_url}")
            print(f"  텍스트 길이: {text_len:,} 자")
            for kw in KEYWORDS:
                mark = "✓" if found[kw] else "✗"
                print(f"  {mark} {kw}")

            # 우선순위 결정
            if found.get("자격요건"):
                priority = 1
            elif found.get("우대사항"):
                priority = 2
            elif found.get("모집부문") or found.get("모집분야"):
                priority = 3
            elif text_len > best_len and not hit_keywords:
                priority = 4
            else:
                priority = 5

            if priority < best_priority or (priority == best_priority and text_len > best_len):
                best_priority = priority
                best_len = text_len
                best_frame = frame

        except Exception as e:
            print(f"\nFrame {i}: 접근 실패 — {e}")

    print(f"\n{'─'*60}")
    if best_frame:
        print(f"Detected content frame:")
        print(f"  {best_frame.url}")
        print(f"  텍스트 길이: {best_len:,} 자")

        try:
            html = best_frame.content()
            out_path = OUTPUT_DIR / f"debug_content_frame_{site}.html"
            out_path.write_text(html, encoding="utf-8")
            print(f"  HTML 저장: {out_path}  (길이: {len(html):,})")
        except Exception as e:
            print(f"  HTML 저장 실패: {e}")
    else:
        print("본문 frame을 찾지 못했습니다.")


def main():
    sites = list(URLS.keys())
    if len(sys.argv) > 1:
        sites = [s for s in sys.argv[1:] if s in URLS]
        if not sites:
            print(f"사용법: python inspect_job_pages.py [saramin|jobkorea]")
            sys.exit(1)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage",
                  "--disable-blink-features=AutomationControlled"],
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

        for site in sites:
            inspect_url(page, site, URLS[site])

        browser.close()

    print(f"\n{'='*60}")
    print("조사 완료.")


if __name__ == "__main__":
    main()
