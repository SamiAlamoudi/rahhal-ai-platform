import type { CommandPaletteLocale, PaletteEmptyState } from '../types'

const COPY: Record<
  PaletteEmptyState,
  { ar: { title: string; body: string }; en: { title: string; body: string } }
> = {
  no_results: {
    ar: { title: 'لا نتائج', body: 'جرّب كلمات أخرى أو غيّر التصفية.' },
    en: { title: 'No results', body: 'Try different keywords or change filters.' },
  },
  recent_searches: {
    ar: { title: 'عمليات بحث أخيرة', body: 'ستظهر عمليات البحث الأخيرة هنا.' },
    en: { title: 'Recent searches', body: 'Your recent searches will appear here.' },
  },
  suggested_commands: {
    ar: {
      title: 'أوامر مقترحة',
      body: 'ابدأ بالكتابة أو اختر أمراً للتنقل لاحقاً.',
    },
    en: {
      title: 'Suggested commands',
      body: 'Start typing or pick a command to navigate later.',
    },
  },
}

export function PaletteEmpty({
  kind,
  locale = 'ar',
  recentQueries = [],
}: {
  kind: PaletteEmptyState
  locale?: CommandPaletteLocale
  recentQueries?: string[]
}) {
  const copy = locale === 'en' ? COPY[kind].en : COPY[kind].ar
  return (
    <div
      className="rahhal-cp-empty"
      data-testid="cp-empty"
      data-empty-kind={kind}
      role="status"
    >
      <h3>{copy.title}</h3>
      <p>{copy.body}</p>
      {kind === 'recent_searches' && recentQueries.length > 0 ? (
        <ul data-testid="cp-recent-searches">
          {recentQueries.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
