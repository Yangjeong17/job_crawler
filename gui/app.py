import logging
import streamlit as st
from datetime import datetime
from typing import List

from config import Config
from models.job import JobPosting
from crawlers import SaraminCrawler, JobKoreaCrawler, WantedCrawler
from services.filter_service import FilterService
from services.mail_service import MailService
from scheduler.daily_scheduler import DailyScheduler
from utils.helpers import get_source_display_name, get_source_color

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


def _init_state():
    defaults = {
        "all_jobs": [],
        "filtered_jobs": [],
        "rendered_count": PAGE_SIZE,
        "scheduler": None,
        "auto_send": False,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


def _run_crawlers(keyword: str, sites: dict, params: dict) -> List[JobPosting]:
    crawlers = []
    if sites.get("saramin"):
        crawlers.append(("사람인", SaraminCrawler()))
    if sites.get("jobkorea"):
        crawlers.append(("잡코리아", JobKoreaCrawler()))
    if sites.get("wanted"):
        crawlers.append(("원티드", WantedCrawler()))

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


def _render_card(job: JobPosting):
    color = get_source_color(job.source)
    source_name = get_source_display_name(job.source)
    deadline = f"마감: {job.deadline}" if job.deadline else ""
    title = job.title if len(job.title) <= 60 else job.title[:57] + "..."

    meta = "  |  ".join(filter(None, [
        f"📍 {job.location}" if job.location else "",
        f"💼 {job.experience}" if job.experience else "",
        f"🎓 {job.education}" if job.education else "",
        f"💰 {job.salary}" if job.salary else "",
    ]))

    stacks_html = ""
    if job.tech_stack:
        tags = "".join(
            f'<span style="background:#E3F2FD;color:{color};padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">{t}</span>'
            for t in job.tech_stack[:8]
        )
        stacks_html = f'<div style="margin-top:6px;">{tags}</div>'

    btn = f'<a href="{job.url}" target="_blank" style="background:{color};color:#fff;padding:6px 16px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:bold;">공고 보기 →</a>'
    title_link = f'<a href="{job.url}" target="_blank" style="color:#212121;text-decoration:none;">{title}</a>'

    html = (
        f'<div style="border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin:6px 0;background:#fff;">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;">'
        f'<span style="background:{color};color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:bold;">{source_name}</span>'
        f'<span style="color:#999;font-size:12px;">{deadline}</span>'
        f'</div>'
        f'<h4 style="margin:8px 0 4px;">{title_link}</h4>'
        f'<p style="margin:4px 0;color:#555;font-size:14px;">🏢 {job.company}</p>'
        f'<p style="margin:4px 0;color:#777;font-size:13px;">{meta}</p>'
        f'{stacks_html}'
        f'<div style="margin-top:10px;">{btn}</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


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

        keyword = st.text_input("키워드", placeholder="예: 백엔드 Python")

        st.subheader("사이트")
        saramin = st.checkbox("사람인", value=True)
        jobkorea = st.checkbox("잡코리아", value=True)
        wanted = st.checkbox("원티드", value=True)

        st.subheader("필터")
        category = st.selectbox("직종", Config.JOB_CATEGORIES)
        experience = st.selectbox("경력", Config.EXPERIENCE_LEVELS)
        education = st.selectbox("학력", Config.EDUCATION_LEVELS)
        location = st.selectbox("지역", Config.LOCATIONS)

        st.subheader("기술스택")
        tech_stacks = st.multiselect(
            "기술스택 선택",
            [t for t in Config.TECH_STACKS if t != "전체"],
            label_visibility="collapsed",
        )

        do_search = st.button("🔍 검색", use_container_width=True, type="primary")

        st.divider()

        sort_label = st.selectbox("정렬", ["최신순", "회사명순", "사이트순"])

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

        auto_send = st.toggle(
            f"매일 자동 발송 ({Config.DAILY_SEND_TIME})",
            value=st.session_state.auto_send,
        )
        if auto_send != st.session_state.auto_send:
            st.session_state.auto_send = auto_send
            if auto_send:
                sched_params = dict(
                    keyword=keyword,
                    category=category,
                    experience=experience,
                    education=education,
                    location=location,
                    tech_stacks=tech_stacks,
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
            sites = {"saramin": saramin, "jobkorea": jobkorea, "wanted": wanted}
            params = dict(
                category=category,
                experience=experience,
                education=education,
                location=location,
                tech_stacks=tech_stacks,
            )
            all_jobs = _run_crawlers(keyword, sites, params)
            st.session_state.all_jobs = all_jobs
            st.session_state.filtered_jobs = FilterService.filter_jobs(
                all_jobs, keyword=keyword, **params
            )
            st.session_state.rendered_count = PAGE_SIZE

            # TODO: save_to_db(all_jobs)

    # ── 정렬 적용 ─────────────────────────────────────────────
    sort_map = {"최신순": "latest", "회사명순": "company", "사이트순": "source"}
    jobs_to_show = FilterService.sort_jobs(
        st.session_state.filtered_jobs, sort_map[sort_label]
    )

    # ── 결과 헤더 ─────────────────────────────────────────────
    total = len(st.session_state.all_jobs)
    filtered_count = len(jobs_to_show)

    col1, col2 = st.columns([4, 1])
    with col1:
        if total > 0:
            st.markdown(f"**결과: {filtered_count}건** (전체 {total}건 수집)")
        else:
            st.markdown("검색 결과가 여기에 표시됩니다.")
    with col2:
        st.caption(datetime.now().strftime("%Y-%m-%d %H:%M"))

    # ── 카드 렌더링 ───────────────────────────────────────────
    if jobs_to_show:
        for job in jobs_to_show[:st.session_state.rendered_count]:
            _render_card(job)

        remaining = filtered_count - st.session_state.rendered_count
        if remaining > 0:
            if st.button(f"더 보기 ({remaining}건 남음)", use_container_width=True):
                st.session_state.rendered_count += PAGE_SIZE
                st.rerun()
    elif total > 0:
        st.info("필터 조건에 맞는 공고가 없습니다.")


if __name__ == "__main__":
    main()
