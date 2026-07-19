export function MyTripsLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      <p className="text-xs font-medium text-slate-400">Loading trips…</p>
    </div>
  )
}
