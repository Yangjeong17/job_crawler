"""detail_crawler 동작 검증 스크립트"""
import sys
import pathlib
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from services.detail_crawler import extract_job_posting

TEST_URLS = {
    "saramin":  "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54248171",
    "jobkorea": "https://www.jobkorea.co.kr/Recruit/GI_Read/49281310",
}

sites = sys.argv[1:] if sys.argv[1:] else list(TEST_URLS.keys())

for site in sites:
    url = TEST_URLS.get(site)
    if not url:
        print(f"알 수 없는 사이트: {site}")
        continue

    print(f"\n{'='*60}")
    print(f"[{site}] {url}")
    print("="*60)

    result = extract_job_posting(url, debug_dir="scripts")

    md = result["markdown"]
    lines = md.splitlines()
    print(f"\n글자 수     : {len(md):,}")
    print(f"줄 수       : {len(lines)}")
    print(f"자격요건 포함: {'예' if '자격요건' in md else '아니오'}")
    print(f"우대사항 포함: {'예' if '우대사항' in md else '아니오'}")
    print(f"\n--- Markdown 미리보기 (첫 40줄) ---")
    print("\n".join(lines[:40]))
