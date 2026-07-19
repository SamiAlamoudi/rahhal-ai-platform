export function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="ai-home-skeleton" aria-busy="true">
      <div className="h-48 rounded-3xl bg-slate-200/70" />
      <div className="h-28 rounded-2xl bg-slate-200/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-slate-200/50" />
        <div className="h-24 rounded-2xl bg-slate-200/50" />
        <div className="hidden h-24 rounded-2xl bg-slate-200/50 sm:block" />
      </div>
      <div className="h-32 rounded-2xl bg-slate-200/40" />
    </div>
  )
}

export function HomeEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center"
      data-testid="ai-home-empty"
    >
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </div>
  )
}

export function HomeErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string
  body: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div
      className="rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-5 text-center"
      data-testid="ai-home-error"
      role="alert"
    >
      <p className="text-sm font-semibold text-rose-800">{title}</p>
      <p className="mt-1 text-xs text-rose-600">{body}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm"
        >
          {retryLabel ?? 'Retry'}
        </button>
      ) : null}
    </div>
  )
}
