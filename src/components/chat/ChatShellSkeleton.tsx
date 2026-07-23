/**
 * UX-01 — chat shell skeleton (sidebar + message placeholders).
 * Matches LegacyChatPage layout to avoid layout shift while list/detail load.
 */

export default function ChatShellSkeleton({
  label = 'جاري تحميل المحادثة…',
}: {
  label?: string
}) {
  return (
    <div
      className="flex min-h-0 flex-1 animate-pulse"
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="chat-shell-skeleton"
    >
      <aside className="hidden w-72 shrink-0 border-l border-slate-100 bg-white p-4 lg:block dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 h-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800"
              style={{ opacity: 1 - i * 0.08 }}
            />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6">
        <p className="sr-only">{label}</p>
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="mr-auto h-16 w-[72%] rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="ml-auto h-12 w-[55%] rounded-2xl bg-primary-100/80 dark:bg-primary-950" />
          <div className="mr-auto h-20 w-[80%] rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="ml-auto h-10 w-[40%] rounded-2xl bg-primary-100/80 dark:bg-primary-950" />
        </div>
      </div>
    </div>
  )
}
