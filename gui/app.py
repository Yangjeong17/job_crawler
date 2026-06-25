import json
import re
import logging
import streamlit as st
import streamlit.components.v1 as components
from datetime import datetime
from typing import List

from config import Config
from models.job import JobPosting
from crawlers import SaraminCrawler, JobKoreaCrawler, WantedCrawler
from services.filter_service import FilterService
from services.mail_service import MailService
from scheduler.daily_scheduler import DailyScheduler
from utils.helpers import get_source_display_name, get_source_color
from services.db_service import (
    init_db, save_jobs, load_latest_jobs,
    mark_not_interested, mark_saved, mark_favorite, unmark,
    load_not_interested_urls, load_saved_urls, load_favorite_urls,
    load_not_interested_jobs, load_saved_jobs, load_favorite_jobs,
    migrate_swipe_decisions, load_search_history, list_db_files,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("crawler.log", encoding="utf-8"),
    ],
)
logging.getLogger("selenium").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

PAGE_SIZE = 20


@st.cache_resource
def _setup_db():
    init_db()


def _init_state():
    _setup_db()
    defaults = {
        "all_jobs":            [],
        "filtered_jobs":       [],
        "rendered_count":      PAGE_SIZE,
        "scheduler":           None,
        "auto_send":           False,
        "screen_index":        0,
        "not_interested_urls": None,  # set, loaded lazily
        "saved_urls":          None,  # set, loaded lazily
        "favorite_urls":       None,  # set, loaded lazily
        "action_history":      [],    # list of (url, action)
        "view_mode":           "스크리닝",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

    # URL 집합 lazy 로드 (세션 최초 1회)
    if st.session_state.not_interested_urls is None:
        st.session_state.not_interested_urls = load_not_interested_urls()
    if st.session_state.saved_urls is None:
        st.session_state.saved_urls = load_saved_urls()
    if st.session_state.favorite_urls is None:
        st.session_state.favorite_urls = load_favorite_urls()

    # 새로고침 후 빈 세션이면 DB에서 마지막 크롤링 결과 복원
    if not st.session_state.all_jobs:
        loaded = load_latest_jobs()
        if loaded:
            st.session_state.all_jobs = loaded
            st.session_state.filtered_jobs = FilterService.deduplicate(loaded)
            st.session_state.screen_index = _find_resume_index(
                loaded,
                st.session_state.not_interested_urls,
                st.session_state.saved_urls,
                st.session_state.favorite_urls,
            )


def _find_resume_index(jobs, ni_urls, sv_urls, fav_urls=None) -> int:
    """처음 '미확인' 카드 인덱스 반환."""
    fav_urls = fav_urls or set()
    for i, job in enumerate(jobs):
        if job.url not in ni_urls and job.url not in sv_urls and job.url not in fav_urls:
            return i
    return len(jobs)


def _action_not_interested(job: JobPosting):
    mark_not_interested(job.url)
    st.session_state.not_interested_urls.add(job.url)
    st.session_state.action_history.append((job.url, "not_interested"))
    st.session_state.screen_index += 1
    st.toast("👎 관심없음 처리", icon="👎")
    st.rerun()


def _action_save(job: JobPosting):
    mark_saved(job.url)
    st.session_state.saved_urls.add(job.url)
    st.session_state.action_history.append((job.url, "saved"))
    st.session_state.screen_index += 1
    st.toast("⭐ 저장 완료", icon="⭐")
    st.rerun()


def _action_favorite(job: JobPosting):
    mark_favorite(job.url)
    st.session_state.favorite_urls.add(job.url)
    st.session_state.action_history.append((job.url, "favorite"))
    st.session_state.screen_index += 1
    st.toast("❤️ 즐겨찾기 추가 — SUPER LIKE!", icon="❤️")
    st.rerun()


def _action_undo():
    if not st.session_state.action_history:
        st.toast("취소할 작업이 없습니다", icon="⚠️")
        return
    url, action = st.session_state.action_history.pop()
    unmark(url)
    labels = {"not_interested": "👎 관심없음", "saved": "⭐ 저장", "favorite": "❤️ 즐겨찾기"}
    if action == "not_interested":
        st.session_state.not_interested_urls.discard(url)
    elif action == "saved":
        st.session_state.saved_urls.discard(url)
    elif action == "favorite":
        st.session_state.favorite_urls.discard(url)
    st.session_state.screen_index = max(0, st.session_state.screen_index - 1)
    st.toast(f"↩ {labels.get(action, action)} 취소", icon="↩️")
    st.rerun()


def _inject_keyboard_shortcuts(job_url: str):
    """키보드 단축키 JS 주입. 매 rerun마다 기존 리스너를 교체한다."""
    components.html(f"""
<script>
(function() {{
    var doc = window.parent.document;
    if (window.parent._kjHandler) {{
        doc.removeEventListener('keydown', window.parent._kjHandler);
    }}
    var jobUrl = {json.dumps(job_url)};
    window.parent._kjHandler = function(e) {{
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key)) return;
        e.preventDefault();
        function clickBtn(text) {{
            var btns = doc.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {{
                if (btns[i].innerText.trim() === text) {{ btns[i].click(); return; }}
            }}
        }}
        if (e.key === 'ArrowLeft')  clickBtn('👎 관심없음');
        if (e.key === 'ArrowRight') clickBtn('⭐ 저장');
        if (e.key === 'ArrowUp')    clickBtn('↩ 실행취소');
        if (e.key === 'ArrowDown')  window.parent.open(jobUrl, '_blank');
        if (e.key === 'Enter')      clickBtn('❤️ 즐겨찾기');
    }};
    doc.addEventListener('keydown', window.parent._kjHandler);
}})();
</script>
""", height=0)


def _render_screening_card(job: JobPosting):
    color = get_source_color(job.source)
    source_name = get_source_display_name(job.source)
    deadline_label = f"마감: {job.deadline}" if job.deadline else ""
    posted_label   = f"등록: {job.posted_date}" if job.posted_date else ""
    title = job.title if len(job.title) <= 70 else job.title[:67] + "..."

    is_headhunter = "헤드헌팅" in (job.description or "")

    # 배지 행: 헤드헌터, 위치, 고용형태
    badge_html = ""
    if is_headhunter:
        badge_html += '<span style="background:#FF7043;color:#fff;padding:3px 12px;border-radius:12px;font-size:18px;margin-right:6px;">🔍 헤드헌터</span>'
    if job.location:
        badge_html += f'<span style="background:#E3F2FD;color:#1565C0;padding:3px 12px;border-radius:12px;font-size:18px;margin-right:6px;">📍 {job.location}</span>'
    if job.job_type:
        badge_html += f'<span style="background:#E8F5E9;color:#2E7D32;padding:3px 12px;border-radius:12px;font-size:18px;margin-right:6px;">📋 {job.job_type}</span>'
    badges_row = f'<div style="margin:8px 0;">{badge_html}</div>' if badge_html else ""

    # 텍스트: 경력, 학력
    plain_parts = filter(None, [
        f"경력: {job.experience}" if job.experience else "",
        f"학력: {job.education}"  if job.education  else "",
    ])
    plain_meta = "  |  ".join(plain_parts)
    plain_row = f'<p style="margin:4px 0;color:#777;font-size:18px;">{plain_meta}</p>' if plain_meta else ""

    # 직종 카테고리 태그 (description에서 파싱)
    categories_html = ""
    if job.description:
        _benefit_kws = ["지원", "보험", "제도", "수당", "식사", "할인", "연차", "반차", "복지", "상여", "인센티브", "헤드헌팅"]
        clean_desc = re.sub(r'(?:등록일|수정일)\s*\d+[./]\d+[./]\d+', '', job.description)
        raw_cats = [c.strip() for c in re.split(r'[,、]', clean_desc)]
        categories = [c for c in raw_cats if c and len(c) < 20 and not any(k in c for k in _benefit_kws)][:5]
        if categories:
            cat_tags = "".join(
                f'<span style="background:#F3E5F5;color:#7B1FA2;padding:2px 8px;border-radius:4px;font-size:17px;margin-right:4px;">{c}</span>'
                for c in categories
            )
            categories_html = f'<div style="margin-top:8px;">{cat_tags}</div>'

    # 기술스택 태그
    stacks_html = ""
    if job.tech_stack:
        tags = "".join(
            f'<span style="background:#E3F2FD;color:{color};padding:2px 8px;border-radius:4px;font-size:18px;margin-right:4px;">{t}</span>'
            for t in job.tech_stack[:8]
        )
        stacks_html = f'<div style="margin-top:8px;">{tags}</div>'

    date_row_right = " &nbsp; ".join(filter(None, [posted_label, deadline_label]))

    html = (
        f'<div style="border:2px solid {color};border-radius:12px;padding:20px 22px;background:#fff;min-height:160px;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;">'
        f'<span style="background:{color};color:#fff;padding:3px 12px;border-radius:6px;font-size:20px;font-weight:bold;">{source_name}</span>'
        f'<span style="color:#999;font-size:18px;">{date_row_right}</span>'
        f'</div>'
        f'<h3 style="margin:12px 0 6px;color:#212121;">{title}</h3>'
        f'<p style="margin:4px 0;color:#444;font-size:25px;font-weight:600;">🏢 {job.company}</p>'
        f'{badges_row}'
        f'{plain_row}'
        f'{categories_html}'
        f'{stacks_html}'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def _render_screening():
    _sort_map = {"최신순": "latest", "마감일순": "deadline", "회사명순": "company", "사이트순": "source"}
    _sort_key = _sort_map.get(st.session_state.get("sort_label", "최신순"), "latest")
    jobs = FilterService.sort_jobs(st.session_state.filtered_jobs, _sort_key)
    if not jobs:
        st.info("공고가 없습니다. 사이드바에서 검색하세요.")
        return

    ni_urls  = st.session_state.not_interested_urls
    sv_urls  = st.session_state.saved_urls
    fav_urls = st.session_state.favorite_urls

    # 스크리닝 대상: 미확인 공고만
    all_screening = [j for j in jobs if j.url not in ni_urls and j.url not in sv_urls and j.url not in fav_urls]
    reviewed_count = sum(1 for j in jobs if j.url in ni_urls or j.url in sv_urls or j.url in fav_urls)
    total          = len(jobs)

    # 진행률 + 액션 카운트 표시
    progress = reviewed_count / total if total else 0
    st.progress(progress, text=(
        f"진행: {reviewed_count} / {total}  |  "
        f"👎 {len(ni_urls)}  ⭐ {len(sv_urls)}  ❤️ {len(fav_urls)}  |  "
        f"남은 공고: {len(all_screening)}건"
    ))

    if not all_screening:
        st.success("모든 공고를 확인했습니다!")
        st.markdown(f"저장: **{len(sv_urls)}건**  |  즐겨찾기: **{len(fav_urls)}건**  |  관심없음: **{len(ni_urls)}건**")
        return

    # 사이트 필터
    source_filter = st.radio(
        "사이트 필터", ["전체", "사람인", "잡코리아"],
        horizontal=True, key="src_filter", label_visibility="collapsed",
    )
    src_map = {"사람인": "saramin", "잡코리아": "jobkorea"}
    screening_jobs = (
        [j for j in all_screening if j.source == src_map[source_filter]]
        if source_filter != "전체" else all_screening
    )

    if not screening_jobs:
        st.info(f"'{source_filter}' 공고가 없습니다. (다른 사이트 공고는 남아 있음)")
        return

    job = screening_jobs[0]

    # 카드 렌더링
    _render_screening_card(job)

    # 단축키 안내 (caption보다 큰 폰트)
    st.markdown(
        '<p style="font-size:25px;color:#555;margin:6px 0;">⌨️ &nbsp; ← 관심없음 &nbsp;|&nbsp; → 저장 &nbsp;|&nbsp; Enter 즐겨찾기 &nbsp;|&nbsp; ↑ 실행취소 &nbsp;|&nbsp; ↓ 공고보기</p>',
        unsafe_allow_html=True,
    )

    # 버튼 (키보드 단축키가 이 버튼을 클릭함)
    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        if st.button("👎 관심없음", use_container_width=True):
            _action_not_interested(job)
    with col2:
        if st.button("⭐ 저장", use_container_width=True, type="primary"):
            _action_save(job)
    with col3:
        if st.button("❤️ 즐겨찾기", use_container_width=True, type="primary"):
            _action_favorite(job)
    with col4:
        if st.button("↩ 실행취소", use_container_width=True):
            _action_undo()
    with col5:
        st.link_button("🔗 공고보기", job.url, use_container_width=True)

    # JS 키보드 리스너 주입
    _inject_keyboard_shortcuts(job.url)


def _render_job_list(jobs: List[JobPosting], empty_msg: str = "공고가 없습니다."):
    if not jobs:
        st.info(empty_msg)
        return
    st.caption(f"총 {len(jobs)}건")
    for job in jobs:
        _render_card(job)


def _render_card(job: JobPosting):
    color = get_source_color(job.source)
    source_name = get_source_display_name(job.source)
    deadline = f"마감: {job.deadline}" if job.deadline else ""
    title = job.title if len(job.title) <= 60 else job.title[:57] + "..."

    meta = "  |  ".join(filter(None, [
        f"📍 {job.location}"   if job.location   else "",
        f"💼 {job.experience}" if job.experience else "",
        f"🎓 {job.education}"  if job.education  else "",
        f"💰 {job.salary}"     if job.salary     else "",
    ]))

    stacks_html = ""
    if job.tech_stack:
        tags = "".join(
            f'<span style="background:#E3F2FD;color:{color};padding:2px 8px;border-radius:4px;font-size:20px;margin-right:4px;">{t}</span>'
            for t in job.tech_stack[:8]
        )
        stacks_html = f'<div style="margin-top:6px;">{tags}</div>'

    btn = f'<a href="{job.url}" target="_blank" style="background:{color};color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:20px;font-weight:bold;">공고 보기 →</a>'

    html = (
        f'<div style="border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin:6px 0;background:#fff;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;">'
        f'<span style="background:{color};color:#fff;padding:3px 10px;border-radius:4px;font-size:20px;font-weight:bold;">{source_name}</span>'
        f'<span style="color:#999;font-size:20px;">{deadline}</span>'
        f'</div>'
        f'<h4 style="margin:8px 0 4px;"><a href="{job.url}" target="_blank" style="color:#212121;text-decoration:none;">{title}</a></h4>'
        f'<p style="margin:4px 0;color:#555;font-size:23px;">🏢 {job.company}</p>'
        f'<p style="margin:4px 0;color:#777;font-size:20px;">{meta}</p>'
        f'{stacks_html}'
        f'<div style="margin-top:10px;">{btn}</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def _run_crawlers(keyword: str, sites: dict, params: dict) -> List[JobPosting]:
    crawlers = []
    if sites.get("saramin"):
        crawlers.append(("사람인", SaraminCrawler()))
    if sites.get("jobkorea"):
        crawlers.append(("잡코리아", JobKoreaCrawler()))
    # if sites.get("wanted"):  # 검색결과가 많지 않아 보류
    #     crawlers.append(("원티드", WantedCrawler()))

    if not crawlers:
        return []

    all_jobs: List[JobPosting] = []
    progress_ph = st.empty()
    status_ph = st.empty()

    for i, (name, crawler) in enumerate(crawlers):
        status_ph.info(f"{name} 크롤링 중...")
        progress_ph.progress(i / len(crawlers))
        try:
            jobs = crawler.run(keyword=keyword, **params)
            all_jobs.extend(jobs)
            status_ph.success(f"{name}: {len(jobs)}개 수집")
        except Exception as e:
            logger.error(f"[{name}] 크롤링 에러: {e}", exc_info=True)
            status_ph.error(f"{name} 크롤링 실패")
        progress_ph.progress((i + 1) / len(crawlers))

    progress_ph.empty()
    status_ph.empty()
    return all_jobs


def main():
    st.set_page_config(
        page_title="취조 - 취업 조지기",
        page_icon="💼",
        layout="wide",
    )
    _init_state()

    st.title("💼 취업 조지기 : 취조")

    # ── 사이드바 ──────────────────────────────────────────────
    with st.sidebar:
        st.header("검색 조건")
        keyword  = st.text_input("키워드", placeholder="예: 백엔드 Python")

        st.subheader("사이트")
        saramin  = st.checkbox("사람인",  value=True)
        jobkorea = st.checkbox("잡코리아", value=True)
        # wanted = st.checkbox("원티드", value=True)  # 검색결과가 많지 않아 보류
        wanted = False

        # 현재 사용안함
        # st.subheader("필터")
        # category   = st.selectbox("직종", Config.JOB_CATEGORIES)
        # experience = st.selectbox("경력", Config.EXPERIENCE_LEVELS)
        # education  = st.selectbox("학력", Config.EDUCATION_LEVELS)
        # location   = st.selectbox("지역", Config.LOCATIONS)

        # 현재 사용안함
        # st.subheader("기술스택")
        # tech_stacks = st.multiselect(
        #     "기술스택 선택",
        #     [t for t in Config.TECH_STACKS if t != "전체"],
        #     label_visibility="collapsed",
        # )

        do_search = st.button("🔍 검색", use_container_width=True, type="primary")

        st.divider()

        sort_label = st.selectbox(
            "정렬", ["최신순", "마감일순", "회사명순", "사이트순"], key="sort_label"
        )

        st.divider()

        if st.button("📧 메일 발송", use_container_width=True):
            if not st.session_state.filtered_jobs:
                st.warning("발송할 공고가 없습니다. 먼저 검색하세요.")
            else:
                with st.spinner("이메일 발송 중..."):
                    ok = MailService.send_jobs_email(st.session_state.filtered_jobs)
                if ok:
                    st.success(f"{len(st.session_state.filtered_jobs)}건 발송 완료")
                else:
                    st.error("이메일 발송 실패. .env를 확인하세요.")

        st.divider()
        with st.expander("🔍 검색 기록"):
            history = load_search_history()
            if not history:
                st.caption("검색 기록이 없습니다.")
            else:
                for kw, cnt, last_crawled in history:
                    kw_display = kw if kw else "(키워드 없음)"
                    date_str = last_crawled[:10] if last_crawled else "-"
                    st.caption(f"{cnt}건 · {date_str}")
                    st.code(kw_display, language=None)

        st.divider()
        with st.expander("📂 이전 DB 스와이프 가져오기"):
            db_files = list_db_files()
            if db_files:
                prev_db = st.selectbox(
                    "이전 DB 선택", db_files, key="prev_db_select",
                    label_visibility="collapsed"
                )
            else:
                prev_db = st.text_input(
                    "이전 DB 파일명", placeholder="jobs_before.db", key="prev_db_input"
                )
                if not prev_db:
                    st.caption("같은 폴더에 다른 .db 파일이 없습니다.")
            if st.button("가져오기", use_container_width=True):
                if not prev_db:
                    st.warning("파일명을 입력하세요.")
                else:
                    result = migrate_swipe_decisions(prev_db)
                    err = result.get('error') if isinstance(result, dict) else None
                    if err == 'not_found':
                        st.error(f"`{prev_db}` 파일을 찾을 수 없습니다.")
                    elif err == 'empty':
                        st.info("이전 DB에 스와이프 기록이 없습니다.")
                    else:
                        total = result['ni'] + result['sv'] + result['fav']
                        if total == 0:
                            st.info("현재 DB에 URL이 일치하는 공고가 없습니다.")
                        else:
                            st.success(
                                f"총 {total}건 완료 — "
                                f"👎 관심없음 {result['ni']}건 / "
                                f"⭐ 저장 {result['sv']}건 / "
                                f"❤️ 즐겨찾기 {result['fav']}건"
                            )
                            st.session_state.not_interested_urls = load_not_interested_urls()
                            st.session_state.saved_urls = load_saved_urls()
                            st.session_state.favorite_urls = load_favorite_urls()
                            st.rerun()

        auto_send = st.toggle(
            f"매일 자동 발송 ({Config.DAILY_SEND_TIME})",
            value=st.session_state.auto_send,
        )
        if auto_send != st.session_state.auto_send:
            st.session_state.auto_send = auto_send
            if auto_send:
                sched_params = dict(
                    keyword=keyword, category="전체", experience="전체",
                    education="전체", location="전체", tech_stacks=[],
                )
                sched = DailyScheduler(search_params=sched_params)
                sched.start()
                st.session_state.scheduler = sched
                st.success(f"자동 발송 ON (매일 {Config.DAILY_SEND_TIME})")
            else:
                if st.session_state.scheduler:
                    st.session_state.scheduler.stop()
                    st.session_state.scheduler = None
                st.info("자동 발송 OFF")

    # ── 검색 실행 ─────────────────────────────────────────────
    if do_search:
        if not (saramin or jobkorea or wanted):
            st.warning("사이트를 하나 이상 선택하세요.")
        else:
            sites  = {"saramin": saramin, "jobkorea": jobkorea, "wanted": wanted}
            params = dict(
                category="전체", experience="전체",
                education="전체", location="전체", tech_stacks=[],
            )
            all_jobs = _run_crawlers(keyword, sites, params)
            filtered = FilterService.filter_jobs(all_jobs, keyword=keyword, **params)

            st.session_state.all_jobs      = all_jobs
            st.session_state.filtered_jobs = filtered
            st.session_state.rendered_count = PAGE_SIZE
            # 새 검색 후 미확인 첫 번째 카드부터 재개
            st.session_state.screen_index  = _find_resume_index(
                filtered,
                st.session_state.not_interested_urls,
                st.session_state.saved_urls,
            )
            save_jobs(all_jobs, keyword)

    # ── 뷰 모드 탭 ────────────────────────────────────────────
    view_mode = st.radio(
        "보기 모드",
        ["스크리닝", "관심없음 목록", "저장한 공고", "즐겨찾기 목록"],
        horizontal=True,
        label_visibility="collapsed",
    )
    st.session_state.view_mode = view_mode
    st.divider()

    # ── 모드별 렌더링 ─────────────────────────────────────────
    if view_mode == "스크리닝":
        _render_screening()

    elif view_mode == "관심없음 목록":
        ni_jobs = load_not_interested_jobs()
        _render_job_list(ni_jobs, "관심없음으로 표시한 공고가 없습니다.")

    elif view_mode == "저장한 공고":
        saved_jobs = load_saved_jobs()
        _render_job_list(saved_jobs, "저장한 공고가 없습니다.")

    elif view_mode == "즐겨찾기 목록":
        fav_jobs = load_favorite_jobs()
        _render_job_list(fav_jobs, "즐겨찾기한 공고가 없습니다.")


if __name__ == "__main__":
    main()
