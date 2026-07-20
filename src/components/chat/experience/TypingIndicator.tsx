import { memo } from 'react'

function TypingIndicatorImpl() {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      role="status"
      aria-live="polite"
      aria-label="Assistant is typing"
    >
      <span className="sr-only">Assistant is typing</span>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
    </div>
  )
}

export default memo(TypingIndicatorImpl)
