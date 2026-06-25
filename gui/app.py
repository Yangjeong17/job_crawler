import json
import os
import re
import logging
import streamlit as st
import streamlit.components.v1 as components
from datetime import datetime
from typing import List
from dotenv import set_key, load_dotenv

from config import Config
from models.job import JobPosting
from crawlers import SaraminCrawler, JobKoreaCrawler
from services.filter_service import FilterService
from services.mail_service import MailService
from scheduler.daily_scheduler import DailyScheduler
from utils.helpers import get_source_display_name, get_source_color
from services.db_service import (
    init_db, save_jobs, load_latest_jobs, load_all_jobs,
    mark_not_interested, mark_saved, mark_favorite, unmark,
    reassign_to_saved, reassign_to_favorite, reassign_to_not_interested,
    load_not_interested_urls, load_saved_urls, load_favorite_urls,
    load_not_interested_jobs, load_saved_jobs, load_favorite_jobs,
    migrate_swipe_decisions, load_search_history, list_db_files,
    count_all_jobs,
)
from services import analysis_service

_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
_EMAIL_DEFAULTS = {"your_email@gmail.com", "your_app_password", "receiver@gmail.com", ""}

_SHORTCUTS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "shortcuts.json")
DEFAULT_SHORTCUTS = {
    "not_interested": "ArrowLeft",
    "save":           "ArrowRight",
    "favorite":       "0",
    "undo":           "ArrowUp",
    "open_url":       "ArrowDown",
}
_KEY_DISPLAY = {
    "ArrowLeft": "←", "ArrowRight": "→",
    "ArrowUp": "↑",  "ArrowDown": "↓",
    " ": "Space",
}

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
        "not_interested_urls": None,  # set, loaded lazily
        "saved_urls":          None,  # set, loaded lazily
        "favorite_urls":       None,  # set, loaded lazily
        "action_history":      [],    # list of (url, action)
        "view_mode":           "스크리닝",
        "ni_jobs_cache":       None,  # 뷰 전환 시 lazy 로드, 액션 시 무효화
        "saved_jobs_cache":    None,
        "fav_jobs_cache":      None,
        "all_db_jobs_cache":   None,
        "analysis_cache":      {},    # url → AI 분석 텍스트
        "_pending_mail_send":  False, # 이메일 설정 저장 후 발송 트리거
        "shortcuts":           None,  # 단축키 설정 (lazy 로드)
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

    # 단축키 lazy 로드
    if st.session_state.shortcuts is None:
        st.session_state.shortcuts = _load_shortcuts()

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


def _load_shortcuts() -> dict:
    try:
        with open(_SHORTCUTS_PATH, encoding="utf-8") as f:
            return {**DEFAULT_SHORTCUTS, **json.load(f)}
    except (FileNotFoundError, json.JSONDecodeError):
        return DEFAULT_SHORTCUTS.copy()


def _save_shortcuts_file(sc: dict):
    with open(_SHORTCUTS_PATH, "w", encoding="utf-8") as f:
        json.dump(sc, f, ensure_ascii=False, indent=2)


def _key_display(key: str) -> str:
    return _KEY_DISPLAY.get(key, key)


@st.dialog("⌨️ 단축키 커스텀")
def _shortcut_dialog():
    sc = st.session_state.shortcuts.copy()
    st.caption("화살표: ArrowLeft / ArrowRight / ArrowUp / ArrowDown  |  숫자·영문자는 그대로 입력  |  특수: Enter, Space")
    sc["not_interested"] = st.text_input("👎 관심없음", value=sc["not_interested"])
    sc["save"]           = st.text_input("⭐ 저장",     value=sc["save"])
    sc["favorite"]       = st.text_input("❤️ 즐겨찾기", value=sc["favorite"])
    sc["undo"]           = st.text_input("↩ 실행취소",  value=sc["undo"])
    sc["open_url"]       = st.text_input("🔗 공고보기", value=sc["open_url"])

    col1, col2 = st.columns(2)
    with col1:
        if st.button("저장", type="primary", use_container_width=True):
            st.session_state.shortcuts = sc
            _save_shortcuts_file(sc)
            st.rerun()
    with col2:
        if st.button("기본값 초기화", use_container_width=True):
            st.session_state.shortcuts = DEFAULT_SHORTCUTS.copy()
            _save_shortcuts_file(DEFAULT_SHORTCUTS.copy())
            st.rerun()


def _has_email_config() -> bool:
    return (
        Config.EMAIL_SENDER not in _EMAIL_DEFAULTS
        and Config.EMAIL_PASSWORD not in _EMAIL_DEFAULTS
        and Config.EMAIL_RECEIVER not in _EMAIL_DEFAULTS
    )


def _save_email_config(sender: str, password: str, receiver: str):
    set_key(_ENV_PATH, "EMAIL_SENDER", sender)
    set_key(_ENV_PATH, "EMAIL_PASSWORD", password)
    set_key(_ENV_PATH, "EMAIL_RECEIVER", receiver)
    load_dotenv(_ENV_PATH, override=True)
    Config.EMAIL_SENDER = sender
    Config.EMAIL_PASSWORD = password
    Config.EMAIL_RECEIVER = receiver


@st.dialog("📧 이메일 설정")
def _email_setup_dialog():
    st.markdown("한 번만 입력하면 `.env`에 저장되어 이후 자동으로 사용됩니다.")
    sender   = st.text_input("발신 Gmail 주소", placeholder="yourmail@gmail.com")
    password = st.text_input(
        "Gmail 앱 비밀번호 (16자리)", type="password",
        help="Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호에서 발급"
    )
    receiver = st.text_input("수신 이메일 주소", placeholder="receiver@gmail.com")
    st.caption("💡 앱 비밀번호: [myaccount.google.com](https://myaccount.google.com) → 보안 → 2단계 인증 → 앱 비밀번호")

    if st.button("저장 후 발송", type="primary", use_container_width=True):
        if not all([sender, password, receiver]):
            st.error("모든 항목을 입력하세요.")
        else:
            _save_email_config(sender, password, receiver)
            st.session_state._pending_mail_send = True
            st.rerun()


def _action_not_interested(job: JobPosting):
    mark_not_interested(job.url)
    st.session_state.not_interested_urls.add(job.url)
    st.session_state.action_history.append((job.url, "not_interested"))
    st.session_state.ni_jobs_cache = None
    st.toast("👎 관심없음 처리", icon="👎")
    st.rerun()


def _action_save(job: JobPosting):
    mark_saved(job.url)
    st.session_state.saved_urls.add(job.url)
    st.session_state.action_history.append((job.url, "saved"))
    st.session_state.saved_jobs_cache = None
    st.toast("⭐ 저장 완료", icon="⭐")
    st.rerun()


def _action_favorite(job: JobPosting):
    mark_favorite(job.url)
    st.session_state.favorite_urls.add(job.url)
    st.session_state.action_history.append((job.url, "favorite"))
    st.session_state.fav_jobs_cache = None
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
        st.session_state.ni_jobs_cache = None
    elif action == "saved":
        st.session_state.saved_urls.discard(url)
        st.session_state.saved_jobs_cache = None
    elif action == "favorite":
        st.session_state.favorite_urls.discard(url)
        st.session_state.fav_jobs_cache = None
    st.toast(f"↩ {labels.get(action, action)} 취소", icon="↩️")
    st.rerun()


def _action_ni_to_saved(job: JobPosting):
    reassign_to_saved(job.url)
    st.session_state.not_interested_urls.discard(job.url)
    st.session_state.saved_urls.add(job.url)
    st.session_state.ni_jobs_cache = None
    st.session_state.saved_jobs_cache = None
    st.toast("⭐ 저장으로 변경 완료", icon="⭐")
    st.rerun()


def _action_ni_to_favorite(job: JobPosting):
    reassign_to_favorite(job.url)
    st.session_state.not_interested_urls.discard(job.url)
    st.session_state.favorite_urls.add(job.url)
    st.session_state.ni_jobs_cache = None
    st.session_state.fav_jobs_cache = None
    st.toast("❤️ 즐겨찾기로 변경 완료", icon="❤️")
    st.rerun()


def _action_saved_to_ni(job: JobPosting):
    reassign_to_not_interested(job.url)
    st.session_state.saved_urls.discard(job.url)
    st.session_state.not_interested_urls.add(job.url)
    st.session_state.saved_jobs_cache = None
    st.session_state.ni_jobs_cache = None
    st.toast("👎 관심없음으로 변경 완료", icon="👎")
    st.rerun()


def _action_saved_to_favorite(job: JobPosting):
    reassign_to_favorite(job.url)
    st.session_state.saved_urls.discard(job.url)
    st.session_state.favorite_urls.add(job.url)
    st.session_state.saved_jobs_cache = None
    st.session_state.fav_jobs_cache = None
    st.toast("❤️ 즐겨찾기로 변경 완료", icon="❤️")
    st.rerun()


def _inject_keyboard_shortcuts(job_url: str):
    """키보드 단축키 JS 주입. 매 rerun마다 기존 리스너를 교체한다."""
    sc = st.session_state.shortcuts
    components.html(f"""
<script>
(function() {{
    var doc = window.parent.document;
    if (window.parent._kjHandler) {{
        doc.removeEventListener('keydown', window.parent._kjHandler);
    }}
    var jobUrl = {json.dumps(job_url)};
    var SC = {json.dumps(sc)};
    window.parent._kjHandler = function(e) {{
        if (!Object.values(SC).includes(e.key)) return;
        e.preventDefault();
        function clickBtn(text) {{
            var btns = doc.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {{
                if (btns[i].innerText.trim() === text) {{ btns[i].click(); return; }}
            }}
        }}
        if (e.key === SC.not_interested) clickBtn('👎 관심없음');
        if (e.key === SC.save)           clickBtn('⭐ 저장');
        if (e.key === SC.undo)           clickBtn('↩ 실행취소');
        if (e.key === SC.open_url)       window.parent.open(jobUrl, '_blank');
        if (e.key === SC.favorite)       clickBtn('❤️ 즐겨찾기');
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

    # 직종 카테고리 태그 (크롤러에서 분리된 categories 필드 직접 사용)
    categories_html = ""
    if job.categories:
        cat_tags = "".join(
            f'<span style="background:#F3E5F5;color:#7B1FA2;padding:2px 8px;border-radius:4px;font-size:17px;margin-right:4px;">{c}</span>'
            for c in job.categories[:5]
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


_SORT_MAP = {"최신순": "latest", "마감일순": "deadline", "회사명순": "company", "사이트순": "source"}


def _render_screening():
    _sort_key = _SORT_MAP.get(st.session_state.get("sort_label", "최신순"), "latest")
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
    db_total = count_all_jobs()
    progress = reviewed_count / total if total else 0
    st.progress(progress, text=(
        f"진행: {reviewed_count} / {total}  |  "
        f"👎 {len(ni_urls)}  ⭐ {len(sv_urls)}  ❤️ {len(fav_urls)}  |  "
        f"남은 공고: {len(all_screening)}건"
    ))
    st.caption(f"검색된 결과: {total}건  |  누적 건수: {db_total}건")

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

    search_q = st.text_input(
        "재검색", key="search_screening",
        placeholder="공고명 또는 회사명으로 검색",
        label_visibility="collapsed",
    )
    if search_q:
        q = search_q.lower()
        screening_jobs = [j for j in screening_jobs if q in j.title.lower() or q in j.company.lower()]
        if not screening_jobs:
            st.info(f"'{search_q}'에 해당하는 공고가 없습니다.")
            return

    job = screening_jobs[0]

    # 카드 렌더링
    _render_screening_card(job)

    # 단축키 안내 (동적)
    sc = st.session_state.shortcuts
    hint = " &nbsp;|&nbsp; ".join([
        f"{_key_display(sc['not_interested'])} 관심없음",
        f"{_key_display(sc['save'])} 저장",
        f"{_key_display(sc['favorite'])} 즐겨찾기",
        f"{_key_display(sc['undo'])} 실행취소",
        f"{_key_display(sc['open_url'])} 공고보기",
    ])
    st.markdown(
        f'<p style="font-size:25px;color:#555;margin:6px 0;">⌨️ &nbsp; {hint}</p>',
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


def _render_analysis(job: JobPosting):
    cache = st.session_state.analysis_cache
    col_btn, _ = st.columns([1, 4])
    with col_btn:
        if st.button("🤖 AI 분석", key=f"analyze_{job.url}", use_container_width=True):
            with st.spinner("분석 중..."):
                result = analysis_service.analyze_job(job)
                cache[job.url] = result if result else "⚠️ 분석 결과를 가져오지 못했습니다."
    if job.url in cache:
        with st.expander("📋 AI 분석 결과", expanded=True):
            st.markdown(cache[job.url])


def _render_job_list(jobs: List[JobPosting], empty_msg: str = "공고가 없습니다.", mode: str = ""):
    if not jobs:
        st.info(empty_msg)
        return

    src_filter = st.radio(
        "사이트 필터", ["전체", "사람인", "잡코리아"],
        horizontal=True, key=f"src_filter_{mode}", label_visibility="collapsed",
    )
    src_map = {"사람인": "saramin", "잡코리아": "jobkorea"}
    if src_filter != "전체":
        jobs = [j for j in jobs if j.source == src_map[src_filter]]

    search_q = st.text_input(
        "재검색", key=f"search_q_{mode}",
        placeholder="공고명 또는 회사명으로 검색",
        label_visibility="collapsed",
    )
    if search_q:
        q = search_q.lower()
        jobs = [j for j in jobs if q in j.title.lower() or q in j.company.lower()]

    if not jobs:
        st.info("검색 결과가 없습니다.")
        return

    st.caption(f"총 {len(jobs)}건")
    for job in jobs:
        _render_card(job)
        if mode == "ni":
            col1, col2, _ = st.columns([1, 1, 3])
            with col1:
                if st.button("⭐ 저장으로 변경", key=f"ni_save_{job.url}", use_container_width=True):
                    _action_ni_to_saved(job)
            with col2:
                if st.button("❤️ 즐겨찾기로 변경", key=f"ni_fav_{job.url}", use_container_width=True):
                    _action_ni_to_favorite(job)
        elif mode == "saved":
            col1, col2, _ = st.columns([1, 1, 3])
            with col1:
                if st.button("👎 관심없음으로 변경", key=f"sv_ni_{job.url}", use_container_width=True):
                    _action_saved_to_ni(job)
            with col2:
                if st.button("❤️ 즐겨찾기로 변경", key=f"sv_fav_{job.url}", use_container_width=True):
                    _action_saved_to_favorite(job)
            _render_analysis(job)
        elif mode == "fav":
            _render_analysis(job)


def _render_scheduler():
    if st.session_state.fav_jobs_cache is None:
        st.session_state.fav_jobs_cache = load_favorite_jobs()

    fav_jobs = st.session_state.fav_jobs_cache
    if not fav_jobs:
        st.info("즐겨찾기한 공고가 없습니다. 즐겨찾기 탭에서 공고를 추가하세요.")
        return

    sorted_jobs = FilterService.sort_jobs(fav_jobs, "deadline")
    now = datetime.now()
    st.caption(f"❤️ 즐겨찾기 {len(sorted_jobs)}건  —  마감일 순")

    for job in sorted_jobs:
        s = (job.deadline or "").replace("~", "").replace("까지", "").strip()
        days_left = None
        for fmt in ["%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%m/%d", "%m.%d"]:
            try:
                d = datetime.strptime(s, fmt)
                if d.year == 1900:
                    d = d.replace(year=now.year)
                days_left = (d - now).days
                break
            except ValueError:
                continue

        if days_left is None:
            dl_label = job.deadline or "상시채용"
            dl_color = "#888"
        elif days_left < 0:
            dl_label = f"마감 ({job.deadline})"
            dl_color = "#bbb"
        elif days_left == 0:
            dl_label = f"D-day ({job.deadline})"
            dl_color = "#E53935"
        elif days_left <= 3:
            dl_label = f"D-{days_left} ({job.deadline})"
            dl_color = "#E53935"
        elif days_left <= 7:
            dl_label = f"D-{days_left} ({job.deadline})"
            dl_color = "#FB8C00"
        else:
            dl_label = f"D-{days_left} ({job.deadline})"
            dl_color = "#2E7D32"

        color = get_source_color(job.source)
        source_name = get_source_display_name(job.source)
        title = job.title if len(job.title) <= 60 else job.title[:57] + "..."

        html = (
            f'<div style="border:1px solid #ddd;border-radius:8px;padding:12px 16px;margin:6px 0;background:#fff;">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
            f'<span style="background:{color};color:#fff;padding:2px 8px;border-radius:4px;font-size:18px;font-weight:bold;">{source_name}</span>'
            f'<span style="color:{dl_color};font-size:22px;font-weight:bold;">{dl_label}</span>'
            f'</div>'
            f'<h4 style="margin:4px 0;"><a href="{job.url}" target="_blank" style="color:#212121;text-decoration:none;">{title}</a></h4>'
            f'<p style="margin:2px 0;color:#555;font-size:20px;">🏢 {job.company}</p>'
            f'</div>'
        )
        st.markdown(html, unsafe_allow_html=True)


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
        page_title="취업 크롤러",
        page_icon="💼",
        layout="wide",
    )
    _init_state()

    st.title("💼 취업 크롤러")

    # ── 사이드바 ──────────────────────────────────────────────
    with st.sidebar:
        if st.button("⌨️ 단축키 커스텀", use_container_width=True):
            _shortcut_dialog()
        st.divider()
        st.header("검색 조건")
        with st.form("search_form"):
            keyword  = st.text_input("키워드", placeholder="예: 백엔드 Python")

            st.subheader("사이트")
            saramin  = st.checkbox("사람인",  value=True)
            jobkorea = st.checkbox("잡코리아", value=True)

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

            do_search = st.form_submit_button("🔍 검색", use_container_width=True, type="primary")

        st.divider()

        sort_label = st.selectbox(
            "정렬", ["최신순", "마감일순", "회사명순", "사이트순"], key="sort_label"
        )

        st.divider()

        # ── 메일 발송 기능 비활성화 ──────────────────────────────
        # if st.button("📧 메일 발송", use_container_width=True):
        #     if not st.session_state.filtered_jobs:
        #         st.warning("발송할 공고가 없습니다. 먼저 검색하세요.")
        #     elif not _has_email_config():
        #         _email_setup_dialog()
        #     else:
        #         with st.spinner("이메일 발송 중..."):
        #             ok = MailService.send_jobs_email(st.session_state.filtered_jobs)
        #         if ok:
        #             st.success(f"{len(st.session_state.filtered_jobs)}건 발송 완료")
        #         else:
        #             st.error("이메일 발송 실패. 앱 비밀번호를 확인하세요.")

        # if st.session_state._pending_mail_send and _has_email_config():
        #     st.session_state._pending_mail_send = False
        #     with st.spinner("이메일 발송 중..."):
        #         ok = MailService.send_jobs_email(st.session_state.filtered_jobs)
        #     if ok:
        #         st.success(f"{len(st.session_state.filtered_jobs)}건 발송 완료")
        #     else:
        #         st.error("이메일 발송 실패. 앱 비밀번호를 확인하세요.")
        # ────────────────────────────────────────────────────────

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
                        not_matched = result.get('not_matched', 0)
                        if total == 0:
                            st.warning(
                                f"매칭된 공고가 없습니다. "
                                f"(미매칭 {not_matched}건 — 새 DB에 없는 공고이거나 이미 결정된 공고)"
                            )
                        else:
                            st.success(
                                f"총 {total}건 완료 — "
                                f"👎 관심없음 {result['ni']}건 / "
                                f"⭐ 저장 {result['sv']}건 / "
                                f"❤️ 즐겨찾기 {result['fav']}건"
                            )
                            if not_matched > 0:
                                st.caption(f"미매칭 {not_matched}건: 새 DB에 없는 공고 (만료 또는 미크롤링)")
                            st.session_state.not_interested_urls = load_not_interested_urls()
                            st.session_state.saved_urls = load_saved_urls()
                            st.session_state.favorite_urls = load_favorite_urls()
                            st.rerun()

        # auto_send = st.toggle(
        #     f"매일 자동 발송 ({Config.DAILY_SEND_TIME})",
        #     value=st.session_state.auto_send,
        # )
        # if auto_send != st.session_state.auto_send:
        #     st.session_state.auto_send = auto_send
        #     if auto_send:
        #         sched_params = dict(
        #             keyword=keyword, category="전체", experience="전체",
        #             education="전체", location="전체", tech_stacks=[],
        #         )
        #         sched = DailyScheduler(search_params=sched_params)
        #         sched.start()
        #         st.session_state.scheduler = sched
        #         st.success(f"자동 발송 ON (매일 {Config.DAILY_SEND_TIME})")
        #     else:
        #         if st.session_state.scheduler:
        #             st.session_state.scheduler.stop()
        #             st.session_state.scheduler = None
        #         st.info("자동 발송 OFF")

    # ── 검색 실행 ─────────────────────────────────────────────
    if do_search:
        if not (saramin or jobkorea):
            st.warning("사이트를 하나 이상 선택하세요.")
        else:
            sites  = {"saramin": saramin, "jobkorea": jobkorea}
            params = dict(
                category="전체", experience="전체",
                education="전체", location="전체", tech_stacks=[],
            )
            all_jobs = _run_crawlers(keyword, sites, params)
            filtered = FilterService.filter_jobs(all_jobs, keyword=keyword, **params)

            st.session_state.all_jobs      = all_jobs
            st.session_state.filtered_jobs = filtered
            st.session_state.rendered_count = PAGE_SIZE
            save_jobs(all_jobs, keyword)
            st.session_state.all_db_jobs_cache = None

    # tabs
    _sort_key = _SORT_MAP.get(st.session_state.get("sort_label", "최신순"), "latest")

    tab_screen, tab_all, tab_ni, tab_saved, tab_fav, tab_sched = st.tabs([
        "🔍 검색목록", "📋 전체", "👎 관심없음", "⭐ 저장", "❤️ 즐겨찾기", "📅 스케줄러"
    ])

    with tab_screen:
        _render_screening()

    with tab_all:
        if st.session_state.all_db_jobs_cache is None:
            st.session_state.all_db_jobs_cache = load_all_jobs()
        sorted_all = FilterService.sort_jobs(st.session_state.all_db_jobs_cache, _sort_key)
        _render_job_list(sorted_all, "DB에 저장된 공고가 없습니다.", mode="all")

    with tab_ni:
        if st.session_state.ni_jobs_cache is None:
            st.session_state.ni_jobs_cache = load_not_interested_jobs()
        sorted_ni = FilterService.sort_jobs(st.session_state.ni_jobs_cache, _sort_key)
        _render_job_list(sorted_ni, "관심없음으로 표시한 공고가 없습니다.", mode="ni")

    with tab_saved:
        if st.session_state.saved_jobs_cache is None:
            st.session_state.saved_jobs_cache = load_saved_jobs()
        sorted_saved = FilterService.sort_jobs(st.session_state.saved_jobs_cache, _sort_key)
        _render_job_list(sorted_saved, "저장한 공고가 없습니다.", mode="saved")

    with tab_fav:
        if st.session_state.fav_jobs_cache is None:
            st.session_state.fav_jobs_cache = load_favorite_jobs()
        sorted_fav = FilterService.sort_jobs(st.session_state.fav_jobs_cache, _sort_key)
        _render_job_list(sorted_fav, "즐겨찾기한 공고가 없습니다.", mode="fav")

    with tab_sched:
        _render_scheduler()


if __name__ == "__main__":
    main()
