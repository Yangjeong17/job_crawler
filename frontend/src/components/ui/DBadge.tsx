import type { ReactNode } from 'react';


interface DBadgeProps {
  deadline_date?: string | null;
  deadline?: string | null; // fallback
  size?: 'default' | 'mini';
  onlyUrgent?: boolean;
  fallback?: ReactNode;
  showFallbackText?: boolean;
}

interface DeadlineMiniBadgeProps {
  deadline_date?: string | null;
  deadline?: string | null; // fallback
  onlyUrgent?: boolean;
  fallback?: ReactNode;
}

interface DeadlineBadgeMeta {
  days: number;
  bg: string;
  fg: string;
  label: string;
  isToday: boolean;
}


function isOpenUntilFilled(val: string): boolean {
  const skip = ['상시', '채용시', '수시', '마감시'];
  return skip.some((k) => val.includes(k));
}

function getDeadlineValue(
  deadline_date?: string | null,
  deadline?: string | null
): string {
  const values = [deadline_date, deadline];

  const found = values.find((v) => typeof v === 'string' && v.trim() !== '');
  return found?.trim() ?? '';
}

function isClosedDeadlineText(val: string): boolean {
  const normalized = val.replace(/\s/g, '');

  if (isOpenUntilFilled(normalized)) {
    return false;
  }

  const closed = [
    '공고마감',
    '접수마감',
    '채용마감',
    '마감됨',
    '마감완료',
    '접수종료',
    '종료',
  ];

  return closed.some((k) => normalized.includes(k));
}

function UnknownDefaultBadge() {
  return (
    <div
      className="flex items-center justify-center text-[12px] font-bold leading-tight text-center shrink-0"
      style={{
        width: 55,
        alignSelf: 'stretch',
        background: '#949494ff',
        color: 'var(--black)',
        borderRadius: '10px 0 0 10px',
        boxSizing: 'border-box',
        fontWeight: 700,
        lineHeight: 1.15,
        textAlign: 'center',
      }}
    >
      마감일
      <br />
      미확인
    </div>
  );
}

function UnknownMiniBadge() {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 6,
        fontWeight: 600,
        background: '#949494ff',
        color: 'var(--black)',
        border: '0.5px solid #949494ff',
        boxSizing: 'border-box',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      미확인
    </span>
  );
}

function parseDays(val: string): number | null {
  if (!val) return null;

  // deadline_date는 항상 YYYY-MM-DD이므로 바로 파싱
  const clean = val.replace(/[~까지\s]/g, '');
  const formats = [
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
    /(\d{1,2})[.\-/](\d{1,2})/,
  ];

  for (const fmt of formats) {
    const m = clean.match(fmt);
    if (m) {
      const year = m[3] ? parseInt(m[1]) : new Date().getFullYear();
      const month = m[3] ? parseInt(m[2]) : parseInt(m[1]);
      const day = m[3] ? parseInt(m[3]) : parseInt(m[2]);
      const target = new Date(year, month - 1, day);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return Math.ceil((target.getTime() - now.getTime()) / 86400000);
    }
  }

  return null;
}

function getDeadlineBadgeMeta(
  deadline_date?: string | null,
  deadline?: string | null
): DeadlineBadgeMeta | null {
  const val = getDeadlineValue(deadline_date, deadline);
  if (!val) return null;

  const days = parseDays(val);
  if (days === null) return null;

  const isToday = days === 0;

  let bg = 'var(--color-success)';
  let fg = 'var(--color-success-foreground)';
  let label = isToday ? 'D-day' : `D-${days}`;

  if (days < 0) {
    bg = '#2a2a2a';
    fg = '#888888';
    label = '마감';
  } else if (days <= 3) {
    bg = 'var(--color-error)';
    fg = 'var(--color-error-foreground)';
  } else if (days <= 7) {
    bg = 'var(--color-warning)';
    fg = 'var(--color-warning-foreground)';
  }

  return { days, bg, fg, label, isToday };
}





export function DBadge({ deadline_date, deadline }: DBadgeProps) {
  const val = getDeadlineValue(deadline_date, deadline);

  if (!val) {
    return <UnknownDefaultBadge />;
  }

  const meta = getDeadlineBadgeMeta(deadline_date, deadline);

  if (!meta) {
    if (isOpenUntilFilled(val)) {
      return (
        <div
          className="flex items-center justify-center text-[12px] font-bold leading-tight text-center shrink-0"
          style={{
            width: 55,
            alignSelf: 'stretch',
            background: 'var(--brand-primary-bg)',
            color: '#888888',
            borderRadius: '10px 0 0 10px',
          }}
        >
          채용시
          <br />
          마감
        </div>
      );
    }

    if (isClosedDeadlineText(val)) {
      return (
        <div
          className="flex items-center justify-center text-[14px] font-bold shrink-0"
          style={{
            width: 55,
            alignSelf: 'stretch',
            background: '#2a2a2a',
            color: '#888888',
            borderRadius: '10px 0 0 10px',
            boxSizing: 'border-box',
            fontWeight: 700,
          }}
        >
          공고
          <br />
          마감
        </div>
      );
    }

    return <UnknownDefaultBadge />;
  }

  return (
    <div
      className="flex items-center justify-center text-[14px] font-bold shrink-0"
      style={{
        width: 55,
        alignSelf: 'stretch',
        background: meta.bg,
        color: meta.fg,
        borderRadius: '10px 0 0 10px',
        border: meta.isToday
          ? '0.5px solid var(--color-warning-foreground)'
          : 'none',
        boxSizing: 'border-box',
        fontWeight: meta.isToday ? 800 : 700,
        lineHeight: 1.15,
        textAlign: 'center',
      }}
    >
      {meta.isToday ? (
        <>
          오늘
          <br />
          마감
        </>
      ) : meta.days < 0 ? (
        <>
          공고
          <br />
          마감
        </>
      ) : (
        meta.label
      )}
    </div>
  );
}

// 기존 import를 쓰는 파일이 남아 있어도 깨지지 않도록 호환용으로 유지
export function DeadlineMiniBadge({
  deadline_date,
  deadline,
  onlyUrgent = false,
  fallback = null,
}: DeadlineMiniBadgeProps) {
  const val = getDeadlineValue(deadline_date, deadline);

  if (!val) {
    return <UnknownMiniBadge />;
  }

  const meta = getDeadlineBadgeMeta(deadline_date, deadline);

  if (!meta) {
    if (isOpenUntilFilled(val)) {
      return (
        <span
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 6,
            fontWeight: 700,
            background: 'var(--brand-primary-bg)',
            color: 'var(--muted-foreground)',
            border: '1px solid var(--brand-primary-bg)',
            boxSizing: 'border-box',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          채용시
        </span>
      );
    }

    if (isClosedDeadlineText(val)) {
      return (
        <span
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 6,
            fontWeight: 700,
            background: 'transparent',
            color: '#888888',
            border: '0.5px solid #888888',
            boxSizing: 'border-box',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          마감
        </span>
      );
    }

    return <UnknownMiniBadge />;
  }

  if (onlyUrgent && (meta.days < 0 || meta.days > 7)) {
    return <>{fallback}</>;
  }

  const borderColor = meta.isToday ? 'var(--color-warning-foreground)' : meta.fg

  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 6,
        fontWeight: meta.isToday ? 800 : 700,
        background: meta.isToday ? 'var(--color-warning)' : 'transparent',
        color: meta.fg,
        border: `1px solid ${borderColor}`,
        boxSizing: 'border-box',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
    }
