"""
기존 DB의 deadline·posted_date 컬럼을 YYYY-MM-DD 형식으로 일괄 정규화.
deadline_date 컬럼도 비어 있으면 채운다.

사용법:
    python scripts/migrate_date_format.py [db파일명]
    예) python scripts/migrate_date_format.py jobs_before.db
    인수 생략 시 현재 활성 DB에 적용.
"""
import sqlite3
import sys
import os
import pathlib
from datetime import datetime

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from utils.deadline_parser import normalize_date, normalize_deadline
from services.db_service import _DB_DIR


def migrate(db_path: str):
    print(f"대상 DB: {db_path}")
    with sqlite3.connect(db_path) as conn:
        # deadline_date 컬럼 없으면 추가
        existing = {r[1] for r in conn.execute("PRAGMA table_info(job_postings)").fetchall()}
        if "deadline_date" not in existing:
            conn.execute("ALTER TABLE job_postings ADD COLUMN deadline_date TEXT")
            print("  deadline_date 컬럼 추가됨")

        rows = conn.execute(
            "SELECT url, deadline, posted_date, deadline_date, crawled_at FROM job_postings"
        ).fetchall()

        updated = 0
        for url, deadline, posted_date, deadline_date, crawled_at in rows:
            try:
                ref = datetime.fromisoformat(crawled_at) if crawled_at else None
            except ValueError:
                ref = None
            new_deadline      = normalize_date(deadline or "", ref)
            new_posted_date   = normalize_date(posted_date or "", ref)
            new_deadline_date = deadline_date or normalize_deadline(deadline or "", ref)

            if (new_deadline != (deadline or "")
                    or new_posted_date != (posted_date or "")
                    or new_deadline_date != (deadline_date or "")):
                conn.execute(
                    """UPDATE job_postings
                       SET deadline=?, posted_date=?, deadline_date=?
                       WHERE url=?""",
                    (new_deadline, new_posted_date, new_deadline_date, url),
                )
                updated += 1

        conn.commit()
    print(f"완료: {updated}/{len(rows)}건 갱신")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        name = sys.argv[1]
        if not name.endswith(".db"):
            name += ".db"
        db_path = os.path.join(_DB_DIR, name)
    else:
        # 활성 DB 사용
        from services.db_service import DB_PATH
        db_path = DB_PATH

    if not os.path.exists(db_path):
        print(f"파일 없음: {db_path}")
        sys.exit(1)

    migrate(db_path)
