"""
Job_Crawler FastAPI 백엔드
실행: uvicorn api.main:app --reload --port 8000
"""
import asyncio
import json
import logging
import pathlib
import sys
import os

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

# db_service 임포트 전에 .last_db 읽어서 env var 설정
_last_db_file = pathlib.Path(__file__).parent.parent / ".last_db"
if _last_db_file.exists():
    _saved_db = _last_db_file.read_text().strip()
    if _saved_db:
        os.environ.setdefault("JOB_CRAWLER_DB_NAME", _saved_db)

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

_DIST = pathlib.Path(__file__).parent.parent / "frontend" / "dist"

from services.db_service import (
    init_db, save_jobs,
    load_latest_jobs, load_all_jobs, get_job_by_url,
    load_not_interested_jobs, load_saved_jobs, load_favorite_jobs,
    load_not_interested_urls, load_saved_urls, load_favorite_urls,
    mark_not_interested, mark_saved, mark_favorite, unmark,
    reassign_to_saved, reassign_to_not_interested, reassign_to_favorite,
    count_all_jobs, load_search_history, list_db_files,
    migrate_swipe_decisions, update_description,
    get_current_db, switch_db,
)
from services.analysis_service import analyze_job
from services.detail_crawler import extract_job_posting
from services.filter_service import FilterService
from crawlers import SaraminCrawler, JobKoreaCrawler
from models.job import JobPosting

logger = logging.getLogger(__name__)

app = FastAPI(title="Job_Crawler API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # CRA
        "http://localhost:5173",   # Vite
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 단일 사용자 앱이므로 서버 메모리에 유지
_action_history: list[tuple[str, str]] = []  # [(url, action)]

_SHORTCUTS_PATH = pathlib.Path(__file__).parent.parent / "shortcuts.json"
_DEFAULT_SHORTCUTS = {
    "not_interested": "ArrowLeft",
    "save":           "ArrowRight",
    "favorite":       "0",
    "undo":           "ArrowUp",
    "open_url":       "ArrowDown",
}


@app.on_event("startup")
async def startup():
    init_db()


# ── 공통 변환 ─────────────────────────────────────────────────────────────

def _job_dict(job: JobPosting) -> dict:
    return {
        "url":         job.url,
        "title":       job.title,
        "company":     job.company,
        "source":      job.source,
        "location":    job.location,
        "experience":  job.experience,
        "education":   job.education,
        "salary":      job.salary,
        "tech_stack":  job.tech_stack,
        "job_type":    job.job_type,
        "deadline":      job.deadline,
        "deadline_date": job.deadline_date,
        "posted_date": job.posted_date,
        "description": job.description,
        "crawled_at":  job.crawled_at.isoformat(),
        "job_id":      job.job_id,
        "is_modified": job.is_modified,
        "categories":  job.categories,
    }


def _load_shortcuts() -> dict:
    try:
        with open(_SHORTCUTS_PATH, encoding="utf-8") as f:
            return {**_DEFAULT_SHORTCUTS, **json.load(f)}
    except (FileNotFoundError, json.JSONDecodeError):
        return _DEFAULT_SHORTCUTS.copy()


# ── Pydantic 스키마 ───────────────────────────────────────────────────────

class SwipeRequest(BaseModel):
    url: str
    action: str  # "not_interested" | "save" | "favorite"

class ReassignRequest(BaseModel):
    url: str
    from_status: str  # "ni" | "saved" | "favorite"
    to_status: str    # "ni" | "saved" | "favorite"

class AnalyzeRequest(BaseModel):
    url: str

class ShortcutsBody(BaseModel):
    not_interested: str
    save: str
    favorite: str
    undo: str
    open_url: str

class MigrateRequest(BaseModel):
    db_name: str

class DbSwitchRequest(BaseModel):
    db_name: str


# ── 통계 ─────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    return {"total": count_all_jobs()}


# ── 공고 목록 ─────────────────────────────────────────────────────────────

@app.get("/api/jobs/search")
def get_search_jobs():
    """최근 크롤링 세션 결과 + 스와이프 상태 URL 집합"""
    jobs = load_latest_jobs()
    return {
        "jobs":                 [_job_dict(j) for j in jobs],
        "not_interested_urls":  list(load_not_interested_urls()),
        "saved_urls":           list(load_saved_urls()),
        "favorite_urls":        list(load_favorite_urls()),
    }

@app.get("/api/jobs/all")
def get_all_jobs():
    return {"jobs": [_job_dict(j) for j in load_all_jobs()]}

@app.get("/api/jobs/not-interested")
def get_not_interested():
    return {"jobs": [_job_dict(j) for j in load_not_interested_jobs()]}

@app.get("/api/jobs/saved")
def get_saved():
    return {"jobs": [_job_dict(j) for j in load_saved_jobs()]}

@app.get("/api/jobs/favorites")
def get_favorites():
    return {"jobs": [_job_dict(j) for j in load_favorite_jobs()]}


# ── 스와이프 액션 ─────────────────────────────────────────────────────────

@app.post("/api/jobs/swipe")
def swipe(req: SwipeRequest):
    """스크리닝 뷰 스와이프: not_interested / save / favorite"""
    if req.action == "not_interested":
        mark_not_interested(req.url)
    elif req.action == "save":
        mark_saved(req.url)
    elif req.action == "favorite":
        mark_favorite(req.url)
    else:
        raise HTTPException(400, f"지원하지 않는 action: {req.action!r}")

    _action_history.append((req.url, req.action))
    return {"ok": True}

@app.post("/api/jobs/undo")
def undo():
    """마지막 스와이프 취소"""
    if not _action_history:
        raise HTTPException(400, "취소할 작업이 없습니다")
    url, action = _action_history.pop()
    unmark(url)
    return {"ok": True, "url": url, "action": action}

@app.post("/api/jobs/reassign")
def reassign(req: ReassignRequest):
    """목록 간 재분류 (ni↔saved↔favorite)"""
    _VALID = {"ni", "saved", "favorite"}
    if req.from_status not in _VALID:
        raise HTTPException(400, f"지원하지 않는 from_status: {req.from_status!r}")
    _HANDLERS = {
        "ni":       reassign_to_not_interested,
        "saved":    reassign_to_saved,
        "favorite": reassign_to_favorite,
    }
    handler = _HANDLERS.get(req.to_status)
    if not handler:
        raise HTTPException(400, f"지원하지 않는 to_status: {req.to_status!r}")
    handler(req.url)
    return {"ok": True}


# ── AI 분석 ───────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    job = get_job_by_url(req.url)
    if not job:
        raise HTTPException(404, "공고를 찾을 수 없습니다")

    # sync_playwright와 Claude API 모두 블로킹 → 스레드풀에서 실행
    if not job.description:
        logger.info(f"description 없음 → 상세 페이지 크롤링: {job.url}")
        detail = await asyncio.to_thread(extract_job_posting, job.url)
        if detail["markdown"]:
            job.description = detail["markdown"]
            update_description(job.url, detail["markdown"])
            logger.info(f"description 저장 완료 ({detail['content_length']}자)")

    result = await asyncio.to_thread(analyze_job, job)
    return {"result": result}


# ── 단축키 설정 ───────────────────────────────────────────────────────────

@app.get("/api/shortcuts")
def get_shortcuts():
    return _load_shortcuts()

@app.put("/api/shortcuts")
def save_shortcuts(body: ShortcutsBody):
    with open(_SHORTCUTS_PATH, "w", encoding="utf-8") as f:
        json.dump(body.model_dump(), f, ensure_ascii=False, indent=2)
    return {"ok": True}


# ── 검색기록 / DB 관리 ────────────────────────────────────────────────────

@app.get("/api/db-current")
def db_current():
    return {"db_name": get_current_db()}

@app.post("/api/db-switch")
def db_switch(req: DbSwitchRequest):
    if not req.db_name:
        raise HTTPException(400, "db_name이 필요합니다")
    path = switch_db(req.db_name)
    return {"ok": True, "db_name": get_current_db(), "path": path}

@app.get("/api/search-history")
def get_search_history():
    rows = load_search_history()
    return {
        "history": [
            {"keyword": kw, "count": cnt, "last_crawled": last}
            for kw, cnt, last in rows
        ]
    }

@app.get("/api/db-files")
def get_db_files():
    return {"files": list_db_files()}

@app.post("/api/migrate")
def migrate(req: MigrateRequest):
    result = migrate_swipe_decisions(req.db_name)
    if isinstance(result, dict) and result.get("error"):
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(code, result["error"])
    return result


# ── 크롤링 (WebSocket) ────────────────────────────────────────────────────

@app.websocket("/api/crawl")
async def crawl_ws(ws: WebSocket):
    """
    React에서 연결 후 JSON 전송:
      { "keyword": "...", "saramin": true, "jobkorea": true }

    서버 → 클라이언트 메시지 타입:
      { "type": "progress", "step": N, "total": N, "message": "..." }
      { "type": "done",     "total": N, "filtered": N, "jobs": [...] }
      { "type": "error",    "message": "..." }
    """
    await ws.accept()
    try:
        data = await ws.receive_json()
        keyword      = data.get("keyword", "")
        use_saramin  = data.get("saramin", True)
        use_jobkorea = data.get("jobkorea", True)

        crawlers = []
        if use_saramin:
            crawlers.append(("사람인", SaraminCrawler()))
        if use_jobkorea:
            crawlers.append(("잡코리아", JobKoreaCrawler()))

        if not crawlers:
            await ws.send_json({"type": "error", "message": "사이트를 하나 이상 선택하세요"})
            return

        all_jobs = []
        loop = asyncio.get_event_loop()

        for i, (name, crawler) in enumerate(crawlers):
            await ws.send_json({
                "type": "progress",
                "step": i,
                "total": len(crawlers),
                "message": f"{name} 크롤링 중...",
            })

            # Selenium은 블로킹 → 스레드풀에서 실행
            jobs = await loop.run_in_executor(
                None, lambda c=crawler, kw=keyword: c.run(keyword=kw)
            )
            all_jobs.extend(jobs)

            await ws.send_json({
                "type": "progress",
                "step": i + 1,
                "total": len(crawlers),
                "message": f"{name}: {len(jobs)}개 수집",
            })

        filtered = FilterService.filter_jobs(all_jobs, keyword=keyword)
        save_jobs(all_jobs, keyword)

        await ws.send_json({
            "type": "done",
            "total": len(all_jobs),
            "filtered": len(filtered),
            "jobs": [_job_dict(j) for j in filtered],
        })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"crawl_ws 오류: {e}", exc_info=True)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ── 프론트엔드 정적 파일 서빙 ──────────────────────────────────────────────

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

@app.get("/{full_path:path}")
async def spa(full_path: str):
    if _DIST.exists():
        return FileResponse(str(_DIST / "index.html"))
    return {"message": "프론트엔드 빌드 필요: cd frontend && npm run build"}
