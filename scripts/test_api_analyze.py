"""
FastAPI analyze 엔드포인트 통합 테스트
별도 터미널에서 uvicorn 실행 후 이 스크립트를 실행하거나,
uvicorn을 subprocess로 띄워 테스트합니다.
"""
import subprocess
import sys
import time
import pathlib
import os

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

# 서버 없이 비동기 직접 테스트
import asyncio

TEST_URL = "https://www.jobkorea.co.kr/Recruit/GI_Read/49429518"
os.environ.setdefault("JOBHUB_DB_NAME", "jobs_swipe.db")

os.chdir(pathlib.Path(__file__).parent.parent)


async def run_analyze(url: str):
    from services.detail_crawler import extract_job_posting
    from services.analysis_service import analyze_job
    from services.db_service import get_job_by_url, update_description

    job = get_job_by_url(url)
    if not job:
        print(f"[ERROR] DB에서 공고를 찾을 수 없음: {url}")
        return

    print(f"공고: {job.title} / {job.company}")
    print(f"기존 description 길이: {len(job.description)}")

    if not job.description:
        print("description 없음 → 상세 페이지 크롤링 시작...")
        detail = await asyncio.to_thread(extract_job_posting, url)
        print(f"크롤링 결과: {detail['content_length']}자")
        if detail["markdown"]:
            job.description = detail["markdown"]
            update_description(url, detail["markdown"])
            print("DB 저장 완료")

    print("\nClaude AI 분석 시작...")
    result = await asyncio.to_thread(analyze_job, job)
    print("\n=== AI 분석 결과 ===")
    print(result)


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else TEST_URL
    asyncio.run(run_analyze(url))
