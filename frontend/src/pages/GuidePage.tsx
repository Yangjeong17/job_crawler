import {
  Database, Search, Globe, Calendar, History, FolderOpen,
  ThumbsDown, Bookmark, Heart, Undo2, ExternalLink, Sparkles,
  Keyboard, ArrowLeft, ArrowRight, ArrowUp, List, LayoutGrid,
} from 'lucide-react'

/* ── 작은 UI 조각들 ─────────────────────────────── */

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: active ? 'var(--brand-primary)' : 'var(--secondary)',
      color: active ? '#fff' : 'var(--muted-foreground)',
      border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border)'}`,
    }}>
      {children}
    </span>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 26, height: 24, padding: '0 6px', borderRadius: 5, fontSize: 11,
      fontFamily: 'monospace', fontWeight: 600,
      background: 'var(--secondary)', color: 'var(--foreground)',
      border: '1px solid var(--border)',
      boxShadow: '0 2px 0 var(--border)',
    }}>
      {children}
    </kbd>
  )
}

function MockTab({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{
      padding: '6px 16px', borderRadius: '6px 6px 0 0', fontSize: 12,
      fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      background: active ? 'var(--brand-primary)' : 'transparent',
      color: active ? '#fff' : 'var(--muted-foreground)',
    }}>
      {label}
    </div>
  )
}

function MockSidebarRow({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 6, fontSize: 12,
      background: 'var(--secondary)', border: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--brand-primary)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{label}</span>
      {sub && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted-foreground)' }}>{sub}</span>}
    </div>
  )
}

function MockSwipeBtn({ icon, color, label }: { icon: React.ReactNode; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{label}</span>
    </div>
  )
}

/* ── 섹션 래퍼 ─────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function FeatureRow({ preview, title, desc }: { preview: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center',
      padding: '14px 16px', borderRadius: 10,
      background: 'var(--card)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{desc}</span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end',
        padding: '8px 10px', borderRadius: 8,
        background: 'var(--secondary)', border: '1px solid var(--border)',
      }}>
        {preview}
      </div>
    </div>
  )
}

/* ── 메인 컴포넌트 ──────────────────────────────── */

export function GuidePage() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', minHeight: 0 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: 'var(--brand-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>J</span>
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.2 }}>
              JobHub에 오신 것을 환영합니다
            </h1>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
              새 DB가 생성되었습니다. 아래에서 주요 기능을 확인하세요.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* ── 사이드바 기능 ── */}
          <Section title="① 사이드바 기능">
            <FeatureRow
              title="DB 전환"
              desc="여러 개의 DB를 관리합니다. '기존 선택'에서 파일을 고르거나 '새로 만들기'로 빈 DB를 생성하고 즉시 전환합니다."
              preview={
                <>
                  <MockSidebarRow icon={<Database size={12} />} label="DB 전환" sub="▾" />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Chip active>기존 선택</Chip>
                    <Chip>새로 만들기</Chip>
                  </div>
                </>
              }
            />
            <FeatureRow
              title="키워드 검색"
              desc="키워드를 입력하고 '검색'을 누르면 사람인·잡코리아에서 공고를 크롤링합니다. Enter 키로도 실행됩니다."
              preview={
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 10px', height: 34, borderRadius: 6, width: '100%',
                  background: 'var(--background)', border: '1px solid var(--brand-primary)',
                }}>
                  <Search size={13} style={{ color: 'var(--muted-foreground)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>예: 백엔드 Python</span>
                </div>
              }
            />
            <FeatureRow
              title="사이트 선택"
              desc="사람인과 잡코리아 중 크롤링할 사이트를 선택합니다. 두 곳 모두 체크하면 동시에 수집합니다."
              preview={
                <div style={{ display: 'flex', gap: 12 }}>
                  {['사람인', '잡코리아'].map((s) => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--foreground)' }}>
                      <input type="checkbox" defaultChecked readOnly style={{ accentColor: 'var(--brand-primary)' }} />
                      {s}
                    </label>
                  ))}
                </div>
              }
            />
            <FeatureRow
              title="스케줄러"
              desc="저장된 공고의 마감일을 캘린더로 확인합니다. 리스트 뷰에서는 마감일순 정렬도 가능합니다."
              preview={<MockSidebarRow icon={<Calendar size={12} />} label="스케줄러" />}
            />
            <FeatureRow
              title="검색 기록"
              desc="이전에 검색했던 키워드 목록과 검색 횟수를 확인합니다."
              preview={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <MockSidebarRow icon={<History size={12} />} label="검색 기록" sub="▾" />
                  {['백엔드 Python · 3회', '프론트엔드 React · 1회'].map((t) => (
                    <div key={t} style={{ fontSize: 10, color: 'var(--muted-foreground)', padding: '2px 10px' }}>{t}</div>
                  ))}
                </div>
              }
            />
            <FeatureRow
              title="이전 DB 스와이프 가져오기"
              desc="다른 DB에서 스와이프(관심없음·저장·즐겨찾기)한 결정을 현재 DB로 마이그레이션합니다. job_id 기준으로 매칭됩니다."
              preview={<MockSidebarRow icon={<FolderOpen size={12} />} label="이전 DB 스와이프 가져오기" />}
            />
          </Section>

          {/* ── 탭 기능 ── */}
          <Section title="② 탭 기능">
            <div style={{
              display: 'flex', gap: 2, padding: '8px 12px',
              background: 'var(--secondary)', borderRadius: 8, border: '1px solid var(--border)',
              flexWrap: 'wrap',
            }}>
              {['스크리닝', '전체 공고', '관심없음', '저장', '즐겨찾기'].map((t, i) => (
                <MockTab key={t} label={t} active={i === 0} />
              ))}
            </div>

            {[
              {
                icon: <LayoutGrid size={13} />,
                label: '스크리닝',
                color: 'var(--brand-primary)',
                desc: '크롤링된 새 공고를 틴더 스타일로 스와이프합니다. 왼쪽→관심없음, 오른쪽→저장, 위→즐겨찾기.',
                extra: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <MockSwipeBtn icon={<ThumbsDown size={14} />} color="var(--color-error)" label="관심없음" />
                    <MockSwipeBtn icon={<Bookmark size={14} />} color="var(--color-success)" label="저장" />
                    <MockSwipeBtn icon={<Heart size={14} />} color="var(--brand-primary)" label="즐겨찾기" />
                    <MockSwipeBtn icon={<Undo2 size={14} />} color="var(--secondary)" label="실행취소" />
                    <MockSwipeBtn icon={<ExternalLink size={14} />} color="var(--secondary)" label="공고보기" />
                  </div>
                ),
              },
              { icon: <List size={13} />, label: '전체 공고', color: 'var(--muted-foreground)', desc: 'DB에 저장된 모든 공고를 리스트로 봅니다. 공고명·회사명으로 검색하거나 소스 필터를 쓸 수 있습니다.', extra: null },
              { icon: <ThumbsDown size={13} />, label: '관심없음', color: 'var(--color-error)', desc: '스크리닝에서 왼쪽으로 스와이프한 공고 목록입니다. 재분류(저장·즐겨찾기) 버튼으로 상태를 바꿀 수 있습니다.', extra: null },
              { icon: <Bookmark size={13} />, label: '저장', color: 'var(--color-success)', desc: '오른쪽으로 스와이프해 저장한 공고 목록입니다. 마감일순·최근 저장순·상시채용 기준으로 정렬할 수 있습니다.', extra: null },
              { icon: <Heart size={13} />, label: '즐겨찾기', color: 'var(--brand-primary)', desc: '위로 스와이프(슈퍼라이크)한 공고 목록입니다. AI 전체분석 기능으로 한 번에 분석할 수 있습니다.', extra: null },
            ].map(({ icon, label, color, desc, extra }) => (
              <div key={label} style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--card)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{label}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.7 }}>{desc}</p>
                {extra}
              </div>
            ))}
          </Section>

          {/* ── 단축키 커스텀 ── */}
          <Section title="③ 단축키 커스텀">
            <div style={{
              padding: '16px 18px', borderRadius: 10,
              background: 'var(--card)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, fontSize: 12,
                  background: 'var(--secondary)', border: '1px solid var(--border)',
                  color: 'var(--muted-foreground)',
                }}>
                  <Keyboard size={13} />
                  단축키
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  탭바 오른쪽의 버튼을 눌러 단축키를 커스텀합니다.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { action: '관심없음', key: <ArrowLeft size={12} />, keyLabel: '←', color: 'var(--color-error)' },
                  { action: '저장',     key: <ArrowRight size={12} />, keyLabel: '→', color: 'var(--color-success)' },
                  { action: '즐겨찾기', key: <ArrowUp size={12} />,   keyLabel: '↑', color: 'var(--brand-primary)' },
                  { action: '실행취소', keyLabel: 'Z',  color: 'var(--muted-foreground)' },
                  { action: '공고보기', keyLabel: 'O',  color: 'var(--muted-foreground)' },
                ].map(({ action, keyLabel, color }) => (
                  <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Key>{keyLabel}</Key>
                    <span style={{ fontSize: 11, fontWeight: 500, color }}>{action}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 4 }}>
                      — 스크리닝 화면에서 키보드로 스와이프
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 11,
                background: 'var(--secondary)', color: 'var(--muted-foreground)',
                lineHeight: 1.6,
              }}>
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4, color: 'var(--color-info-foreground)' }} />
                각 공고 카드의 <strong style={{ color: 'var(--color-info-foreground)' }}>AI 분석</strong> 버튼으로 GPT 기반 요약·적합도 분석을 받을 수 있습니다.
              </div>
            </div>
          </Section>

          {/* 시작 안내 */}
          <div style={{
            textAlign: 'center', padding: '24px',
            borderRadius: 12, border: '1px dashed var(--border)',
            color: 'var(--muted-foreground)', fontSize: 12, lineHeight: 1.8,
          }}>
            <Search size={20} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--brand-primary)' }} />
            <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>시작하기</strong>
            왼쪽 사이드바에서 키워드를 입력하고 <strong>검색</strong>을 누르면<br />
            공고가 크롤링되어 스크리닝 탭에 카드로 쌓입니다.
          </div>

        </div>
      </div>
    </div>
  )
}
