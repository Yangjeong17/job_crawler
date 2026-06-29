import sqlite3
import json
import os
import logging
from datetime import datetime
from typing import List, Set

from models.job import JobPosting

logger = logging.getLogger(__name__)

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LAST_DB_FILE = os.path.join(_ROOT, ".last_db")

_db_name = os.environ.get("JOB_CRAWLER_DB_NAME", "jobs_before.db")
DB_PATH = os.path.join(_ROOT, _db_name)


def get_current_db() -> str:
    return _db_name


def switch_db(name: str) -> str:
    """런타임에 활성 DB를 전환하고 .last_db에 저장"""
    global _db_name, DB_PATH
    if not name.endswith(".db"):
        name += ".db"
    _db_name = name
    DB_PATH = os.path.join(_ROOT, _db_name)
    os.environ["JOB_CRAWLER_DB_NAME"] = name
    with open(_LAST_DB_FILE, "w", encoding="utf-8") as f:
        f.write(name)
    init_db()
    return DB_PATH


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS job_postings (
                url               TEXT PRIMARY KEY,
                title             TEXT,
                company           TEXT,
                source            TEXT,
                location          TEXT,
                experience        TEXT,
                education         TEXT,
                salary            TEXT,
                tech_stack        TEXT,
                job_type          TEXT,
                deadline          TEXT,
                posted_date       TEXT,
                description       TEXT,
                crawled_at        TEXT,
                search_keyword    TEXT,
                is_not_interested INTEGER DEFAULT 0,
                is_saved          INTEGER DEFAULT 0,
                saved_at          TEXT,
                is_favorite       INTEGER DEFAULT 0,
                favorited_at      TEXT,
                job_id            TEXT,
                content_hash      TEXT,
                updated_at        TEXT,
                is_modified       INTEGER DEFAULT 0,
                categories        TEXT
            )
        """)
        # 기존 테이블에 컬럼 없으면 추가 (순차 마이그레이션)
        existing = {r[1] for r in conn.execute("PRAGMA table_info(job_postings)").fetchall()}
        for col, typedef in [
            ("is_not_interested", "INTEGER DEFAULT 0"),
            ("is_saved",          "INTEGER DEFAULT 0"),
            ("saved_at",          "TEXT"),
            ("is_favorite",       "INTEGER DEFAULT 0"),
            ("favorited_at",      "TEXT"),
            ("job_id",            "TEXT"),
            ("content_hash",      "TEXT"),
            ("updated_at",        "TEXT"),
            ("is_modified",       "INTEGER DEFAULT 0"),
            ("categories",        "TEXT"),
        ]:
            if col not in existing:
                conn.execute(f"ALTER TABLE job_postings ADD COLUMN {col} {typedef}")
        conn.commit()
    logger.info(f"DB 초기화 완료: {DB_PATH}")


def save_jobs(jobs: List[JobPosting], keyword: str = ""):
    """크롤링 결과 저장.

    - job_id가 있는 경우: (source, job_id)로 기존 공고 조회
        - content_hash 동일 → 스킵 (변경 없음)
        - content_hash 변경 → 업데이트 + is_modified=1, updated_at 갱신
        - 없으면 신규 INSERT
    - job_id가 없는 경우: url 기준 INSERT OR IGNORE (기존 동작 유지)
    """
    if not jobs:
        return
    saved = updated = skipped = 0
    now = datetime.now().isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        for job in jobs:
            if job.job_id:
                row = conn.execute(
                    "SELECT content_hash FROM job_postings WHERE source=? AND job_id=?",
                    (job.source, job.job_id)
                ).fetchone()

                if row is not None:
                    existing_hash = row[0] or ""
                    if existing_hash != job.content_hash:
                        # 내용 변경 감지 → 업데이트
                        conn.execute("""
                            UPDATE job_postings SET
                                title=?, company=?, location=?, experience=?, education=?,
                                salary=?, tech_stack=?, job_type=?, deadline=?, posted_date=?,
                                description=?, content_hash=?, updated_at=?, is_modified=1,
                                crawled_at=?, search_keyword=?, categories=?
                            WHERE source=? AND job_id=?
                        """, (
                            job.title, job.company, job.location, job.experience,
                            job.education, job.salary,
                            json.dumps(job.tech_stack, ensure_ascii=False),
                            job.job_type, job.deadline, job.posted_date,
                            job.description, job.content_hash, now,
                            job.crawled_at.isoformat(), keyword,
                            json.dumps(job.categories, ensure_ascii=False),
                            job.source, job.job_id,
                        ))
                        updated += 1
                    else:
                        skipped += 1
                    continue

            # 신규 공고 (또는 job_id 없는 공고)
            cur = conn.execute("""
                INSERT OR IGNORE INTO job_postings
                (url, title, company, source, location, experience, education,
                 salary, tech_stack, job_type, deadline, posted_date,
                 description, crawled_at, search_keyword, job_id, content_hash,
                 categories)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job.url, job.title, job.company, job.source,
                job.location, job.experience, job.education, job.salary,
                json.dumps(job.tech_stack, ensure_ascii=False),
                job.job_type, job.deadline, job.posted_date,
                job.description, job.crawled_at.isoformat(), keyword,
                job.job_id, job.content_hash,
                json.dumps(job.categories, ensure_ascii=False),
            ))
            if cur.rowcount > 0:
                saved += 1
            else:
                skipped += 1

        conn.commit()

    logger.info(
        f"DB 저장: 신규 {saved}건, 내용변경 {updated}건, 스킵 {skipped}건 "
        f"(keyword='{keyword}')"
    )


def mark_not_interested(url: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_not_interested=1 WHERE url=?", (url,)
        )
        conn.commit()


def mark_saved(url: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_saved=1, saved_at=? WHERE url=?",
            (datetime.now().isoformat(), url),
        )
        conn.commit()


def mark_favorite(url: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_favorite=1, favorited_at=? WHERE url=?",
            (datetime.now().isoformat(), url),
        )
        conn.commit()


def unmark(url: str):
    """관심없음, 저장, 즐겨찾기 모두 취소 (실행취소용)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_not_interested=0, is_saved=0, saved_at=NULL, is_favorite=0, favorited_at=NULL WHERE url=?",
            (url,)
        )
        conn.commit()


def reassign_to_saved(url: str):
    """관심없음 → 저장으로 상태 전환."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_not_interested=0, is_saved=1, saved_at=?, is_favorite=0, favorited_at=NULL WHERE url=?",
            (datetime.now().isoformat(), url),
        )
        conn.commit()


def reassign_to_not_interested(url: str):
    """저장/즐겨찾기 → 관심없음으로 상태 전환."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_not_interested=1, is_saved=0, saved_at=NULL, is_favorite=0, favorited_at=NULL WHERE url=?",
            (url,),
        )
        conn.commit()


def reassign_to_favorite(url: str):
    """관심없음/저장 → 즐겨찾기로 상태 전환."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET is_not_interested=0, is_saved=0, saved_at=NULL, is_favorite=1, favorited_at=? WHERE url=?",
            (datetime.now().isoformat(), url),
        )
        conn.commit()


def load_not_interested_urls() -> Set[str]:
    try:
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT url FROM job_postings WHERE is_not_interested=1"
            ).fetchall()
        return {r[0] for r in rows}
    except Exception as e:
        logger.error(f"load_not_interested_urls 실패: {e}")
        return set()


def load_saved_urls() -> Set[str]:
    try:
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT url FROM job_postings WHERE is_saved=1"
            ).fetchall()
        return {r[0] for r in rows}
    except Exception as e:
        logger.error(f"load_saved_urls 실패: {e}")
        return set()


def load_favorite_urls() -> Set[str]:
    try:
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute(
                "SELECT url FROM job_postings WHERE is_favorite=1"
            ).fetchall()
        return {r[0] for r in rows}
    except Exception as e:
        logger.error(f"load_favorite_urls 실패: {e}")
        return set()


def load_latest_jobs() -> List[JobPosting]:
    """가장 최근 크롤링 세션(1시간 이내) 결과 로드."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute(
                "SELECT MAX(crawled_at) FROM job_postings"
            ).fetchone()
            if not row or not row[0]:
                return []
            latest = row[0]
            rows = conn.execute("""
                SELECT url, title, company, source, location, experience,
                       education, salary, tech_stack, job_type, deadline,
                       posted_date, description, crawled_at,
                       job_id, content_hash, is_modified, updated_at, categories
                FROM job_postings
                WHERE crawled_at >= datetime(?, '-1 hour')
                ORDER BY rowid ASC
            """, (latest,)).fetchall()
        jobs = [_row_to_job(r) for r in rows]
        logger.info(f"DB 로드 완료: {len(jobs)}건")
        return jobs
    except Exception as e:
        logger.error(f"load_latest_jobs 실패: {e}")
        return []


def get_job_by_url(url: str):
    """URL로 단일 공고 조회."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute("""
                SELECT url, title, company, source, location, experience,
                       education, salary, tech_stack, job_type, deadline,
                       posted_date, description, crawled_at,
                       job_id, content_hash, is_modified, updated_at, categories
                FROM job_postings WHERE url=?
            """, (url,)).fetchone()
        return _row_to_job(row) if row else None
    except Exception as e:
        logger.error(f"get_job_by_url 실패: {e}")
        return None


def load_all_jobs() -> List[JobPosting]:
    """DB 전체 공고 로드 (crawled_at 역순)."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute("""
                SELECT url, title, company, source, location, experience,
                       education, salary, tech_stack, job_type, deadline,
                       posted_date, description, crawled_at,
                       job_id, content_hash, is_modified, updated_at, categories
                FROM job_postings
                ORDER BY crawled_at DESC
            """).fetchall()
        return [_row_to_job(r) for r in rows]
    except Exception as e:
        logger.error(f"load_all_jobs 실패: {e}")
        return []


def load_not_interested_jobs() -> List[JobPosting]:
    return _load_by_flag("is_not_interested")


def load_saved_jobs() -> List[JobPosting]:
    return _load_by_flag("is_saved")


def load_favorite_jobs() -> List[JobPosting]:
    return _load_by_flag("is_favorite")


_VALID_FLAG_COLS = frozenset({"is_not_interested", "is_saved", "is_favorite"})


def _load_by_flag(col: str) -> List[JobPosting]:
    if col not in _VALID_FLAG_COLS:
        raise ValueError(f"허용되지 않은 컬럼: {col!r}")
    try:
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute(f"""
                SELECT url, title, company, source, location, experience,
                       education, salary, tech_stack, job_type, deadline,
                       posted_date, description, crawled_at,
                       job_id, content_hash, is_modified, updated_at, categories
                FROM job_postings
                WHERE {col}=1
                ORDER BY rowid DESC
            """).fetchall()
        return [_row_to_job(r) for r in rows]
    except Exception as e:
        logger.error(f"_load_by_flag({col}) 실패: {e}")
        return []


def count_all_jobs() -> int:
    """DB에 저장된 전체 공고 수."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            return conn.execute("SELECT COUNT(*) FROM job_postings").fetchone()[0]
    except Exception as e:
        logger.error(f"count_all_jobs 실패: {e}")
        return 0


def load_search_history():
    """검색 키워드 히스토리 반환: [(keyword, count, last_crawled), ...]"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            return conn.execute("""
                SELECT search_keyword, COUNT(*) as cnt, MAX(crawled_at) as last_crawled
                FROM job_postings
                WHERE search_keyword IS NOT NULL AND search_keyword != ''
                GROUP BY search_keyword
                ORDER BY last_crawled DESC
            """).fetchall()
    except Exception as e:
        logger.error(f"load_search_history 실패: {e}")
        return []


def list_db_files() -> list:
    """같은 디렉토리 내 .db 파일 목록 반환 (현재 DB 제외)."""
    db_dir = os.path.dirname(DB_PATH)
    return sorted(
        f for f in os.listdir(db_dir)
        if f.endswith(".db") and f != _db_name
    )


def update_description(url: str, description: str):
    """상세 페이지에서 가져온 description을 DB에 저장."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE job_postings SET description=? WHERE url=?",
            (description, url),
        )
        conn.commit()


def migrate_swipe_decisions(src_db_name: str) -> dict:
    """이전 DB에서 스와이프 결정(관심없음/저장/즐겨찾기)을 현재 DB로 마이그레이션.

    매칭 전략:
      1순위 — (source, job_id) 매칭: URL 정규화 여부와 무관하게 동작
      2순위 — url 매칭: job_id 추출 실패한 레코드 폴백

    반환값:
      {'ni': N, 'sv': N, 'fav': N, 'not_matched': N}
      {'error': 'not_found'} | {'error': 'empty'}
    """
    from utils.url_utils import extract_job_id

    src_path = os.path.join(os.path.dirname(DB_PATH), src_db_name)
    if not os.path.exists(src_path):
        return {'error': 'not_found'}

    with sqlite3.connect(src_path) as src:
        rows = src.execute("""
            SELECT url, source, is_not_interested, is_saved, saved_at,
                   is_favorite, favorited_at
            FROM job_postings
            WHERE is_not_interested=1 OR is_saved=1 OR is_favorite=1
        """).fetchall()

    if not rows:
        return {'error': 'empty'}

    counts = {'ni': 0, 'sv': 0, 'fav': 0, 'not_matched': 0}

    with sqlite3.connect(DB_PATH) as conn:
        for url, source, ni, sv, sv_at, fav, fav_at in rows:
            swipe_args = (ni, sv, sv_at, fav, fav_at)
            matched = False

            # 1순위: (source, job_id) 매칭
            job_id = extract_job_id(url)
            if job_id and source:
                cur = conn.execute("""
                    UPDATE job_postings
                    SET is_not_interested=?, is_saved=?, saved_at=?,
                        is_favorite=?, favorited_at=?
                    WHERE source=? AND job_id=?
                      AND is_not_interested=0 AND is_saved=0 AND is_favorite=0
                """, (*swipe_args, source, job_id))
                matched = cur.rowcount > 0

            # 2순위: url 직접 매칭 (job_id 추출 실패 또는 1순위 미매칭 시)
            if not matched:
                cur = conn.execute("""
                    UPDATE job_postings
                    SET is_not_interested=?, is_saved=?, saved_at=?,
                        is_favorite=?, favorited_at=?
                    WHERE url=?
                      AND is_not_interested=0 AND is_saved=0 AND is_favorite=0
                """, (*swipe_args, url))
                matched = cur.rowcount > 0

            if matched:
                if ni:  counts['ni']  += 1
                if sv:  counts['sv']  += 1
                if fav: counts['fav'] += 1
            else:
                counts['not_matched'] += 1

        conn.commit()

    logger.info(f"스와이프 마이그레이션: {src_db_name} → {_db_name}, {counts}")
    return counts


def _row_to_job(r) -> JobPosting:
    updated_at = None
    if len(r) > 17 and r[17]:
        try:
            updated_at = datetime.fromisoformat(r[17])
        except Exception:
            pass
    return JobPosting(
        url=r[0], title=r[1], company=r[2], source=r[3],
        location=r[4] or "", experience=r[5] or "",
        education=r[6] or "", salary=r[7] or "",
        tech_stack=json.loads(r[8]) if r[8] else [],
        job_type=r[9] or "", deadline=r[10] or "",
        posted_date=r[11] or "", description=r[12] or "",
        crawled_at=datetime.fromisoformat(r[13]),
        job_id=r[14] if len(r) > 14 and r[14] else "",
        content_hash=r[15] if len(r) > 15 and r[15] else "",
        is_modified=bool(r[16]) if len(r) > 16 and r[16] else False,
        updated_at=updated_at,
        categories=json.loads(r[18]) if len(r) > 18 and r[18] else [],
    )
