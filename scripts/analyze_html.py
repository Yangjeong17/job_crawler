"""HTML 구조 분석 스크립트"""
from bs4 import BeautifulSoup
import pathlib

KEYWORDS = ["자격요건", "우대사항", "주요업무", "담당업무", "모집부문"]

for site in ["jobkorea", "saramin"]:
    path = pathlib.Path(f"scripts/debug_content_frame_{site}.html")
    if not path.exists():
        print(f"\n=== {site}: 파일 없음 ===")
        continue

    html = path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    print(f"\n{'='*60}")
    print(f"[{site}]  HTML 길이: {len(html):,}")

    # 상위 태그 빈도
    tags = {}
    for tag in soup.find_all(True):
        tags[tag.name] = tags.get(tag.name, 0) + 1
    top = sorted(tags.items(), key=lambda x: -x[1])[:8]
    print("주요 태그:", top)

    # 키워드 포함 요소 탐색
    print("\n--- 키워드 위치 ---")
    for kw in KEYWORDS:
        hits = soup.find_all(string=lambda t, k=kw: t and k in t)
        if hits:
            for hit in hits[:2]:
                p = hit.parent
                cls = " ".join(p.get("class", []))
                print(f"  [{kw}] <{p.name} class='{cls}'> '{hit[:40].strip()}'")

    # 텍스트가 긴 div/section 후보
    print("\n--- 텍스트 많은 컨테이너 Top5 ---")
    candidates = []
    for tag in soup.find_all(["div", "section", "article"]):
        text = tag.get_text(strip=True)
        if len(text) > 200:
            cls = " ".join(tag.get("class", []))
            id_ = tag.get("id", "")
            candidates.append((len(text), tag.name, id_, cls[:50], text[:60]))
    candidates.sort(reverse=True)
    for length, name, id_, cls, preview in candidates[:5]:
        print(f"  {length:,}자  <{name} id='{id_}' class='{cls}'>  '{preview}'")
