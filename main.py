import os
import subprocess
import sys

_ROOT = os.path.dirname(os.path.abspath(__file__))
_LAST_DB_FILE = os.path.join(_ROOT, ".last_db")
DEFAULT_DB = "jobs_before.db"


def _load_last_db() -> str:
    try:
        with open(_LAST_DB_FILE, encoding="utf-8") as f:
            name = f.read().strip()
            return name if name else DEFAULT_DB
    except FileNotFoundError:
        return DEFAULT_DB


def _save_last_db(name: str):
    with open(_LAST_DB_FILE, "w", encoding="utf-8") as f:
        f.write(name)


def ask_db_name() -> str:
    last = _load_last_db()
    last_without_ext = os.path.splitext(last)[0]
    print("\n" + "=" * 30)
    print("      사용할 DB 파일명을 입력하세요")
    print("=" * 30)
    print(f"  ✅ 엔터 → 이전 파일 사용 ({last_without_ext})")
    name = input("  📥 새 이름 입력 > ").strip()
    if not name:
        return last
    if not name.endswith(".db"):
        name += ".db"
    return name


def main():
    db_name = ask_db_name()
    _save_last_db(db_name)
    print(f"\n사용 DB: {db_name}\n")

    env = os.environ.copy()
    env["JOB_CRAWLER_DB_NAME"] = db_name

    subprocess.run(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--reload", "--port", "8000"],
        env=env,
        cwd=_ROOT,
    )


if __name__ == "__main__":
    main()
