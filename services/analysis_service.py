import logging
import os
from dotenv import load_dotenv
from models.job import JobPosting

load_dotenv()

logger = logging.getLogger(__name__)

# Bedrock cross-region inference profile ID for Claude Haiku 4.5
_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
_MAX_DESC = 2000


def analyze_job(job: JobPosting) -> str:
    """AWS Bedrock Claude Haiku로 공고를 분석해 마크다운 문자열 반환. 실패 시 오류 메시지."""
    try:
        import boto3
    except ImportError:
        return "⚠️ `boto3` 패키지가 설치되지 않았습니다. `pip install boto3`을 실행하세요."

    desc = (job.description or "")[:_MAX_DESC]
    stacks = ", ".join(job.tech_stack) if job.tech_stack else "없음"
    cats = ", ".join(job.categories) if job.categories else "없음"

    prompt = f"""다음 채용 공고를 지원자 관점에서 분석해주세요.

제목: {job.title}
회사: {job.company}
위치: {job.location or '-'}
경력: {job.experience or '-'}
학력: {job.education or '-'}
고용형태: {job.job_type or '-'}
기술스택: {stacks}
직종: {cats}
급여: {job.salary or '미정'}
마감일: {job.deadline or '미정'}
공고 내용:
{desc}

아래 항목으로 간결하게 분석해주세요 (한국어):

## 한줄 요약
이 포지션이 어떤 사람을 찾는지 한 문장으로.

## 핵심 요구사항
- 필수 스킬/경력을 bullet로

## 주목할 점
- 이 공고의 장점, 특이사항을 bullet로

## 체크해볼 것
- 지원 전 확인하면 좋을 사항을 bullet로"""

    try:
        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
        client = boto3.client("bedrock-runtime", region_name=region)
        response = client.converse(
            modelId=_MODEL,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 1024},
        )
        return response["output"]["message"]["content"][0]["text"]
    except Exception as e:
        logger.error(f"공고 분석 실패 ({job.url}): {e}")
        return (
            f"⚠️ 분석 실패: {e}\n\n"
            "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION이 .env에 설정되어 있는지 확인하세요."
        )
