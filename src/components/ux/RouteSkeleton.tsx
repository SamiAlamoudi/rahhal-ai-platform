/**
 * UX-01 — branded RTL route fallback (replaces plain text spinner).
 */

export default function RouteSkeleton({
  label = 'جاري التحميل…',
}: {
  label?: string
}) {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white"
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="route-skeleton"
    >
      <div className="border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-primary-100" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <p className="mt-6 text-center text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}
