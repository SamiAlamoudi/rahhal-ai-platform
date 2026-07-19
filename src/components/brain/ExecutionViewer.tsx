import type { TravelExecutionTurnResult } from '../../lib/brain/execution'

export interface ExecutionViewerProps {
  execution: TravelExecutionTurnResult | null
  className?: string
}

/**
 * Sprint 23 — Execution debug viewer (queue, running, completed, failed, progress, deps).
 */
export function ExecutionViewer({
  execution,
  className = '',
}: ExecutionViewerProps) {
  if (!execution) {
    return (
      <section
        data-testid="brain-execution-viewer"
        className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
      >
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Execution
        </h3>
        <p className="text-slate-400">No execution yet</p>
      </section>
    )
  }

  const { plan, progress, summary, state } = execution
  const queue = plan.tasks.filter(
    (t) => t.status === 'pending' || t.status === 'queued',
  )
  const running = plan.tasks.filter((t) => t.status === 'running')
  const completed = plan.tasks.filter((t) => t.status === 'completed')
  const failed = plan.tasks.filter(
    (t) => t.status === 'failed' || t.status === 'timed_out',
  )

  return (
    <section
      data-testid="brain-execution-viewer"
      className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
    >
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Execution
      </h3>
      <p className="mb-2 font-medium text-slate-800" data-testid="execution-state">
        {summary.headline} · {state}
      </p>
      <div className="mb-2" data-testid="execution-progress">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>
            {progress.completed}/{progress.total} done
          </span>
          <span>{Math.round(progress.ratio * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.round(progress.ratio * 100)}%` }}
          />
        </div>
      </div>

      <TaskList title="Queue" tasks={queue} testId="execution-queue" />
      <TaskList title="Running" tasks={running} testId="execution-running" />
      <TaskList title="Completed" tasks={completed} testId="execution-completed" />
      <TaskList title="Failed" tasks={failed} testId="execution-failed" />

      <div className="mt-2 border-t border-slate-100 pt-2" data-testid="execution-dependencies">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Dependencies</p>
        <ul className="space-y-0.5">
          {plan.tasks.map((t) => (
            <li key={t.id} className="truncate font-mono text-[10px] text-slate-600">
              {t.metadata.label}
              {t.dependencies.length
                ? ` ← ${t.dependencies.map((d) => shortId(d)).join(', ')}`
                : ' (root)'}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2 border-t border-slate-100 pt-2" data-testid="execution-summary">
        <p className="text-[10px] text-slate-500">
          ok: {summary.successfulTypes.join(', ') || '—'} · fail:{' '}
          {summary.failedTypes.join(', ') || '—'} · partial:{' '}
          {summary.partialSuccess ? 'yes' : 'no'} · {summary.durationMs}ms
        </p>
      </div>
    </section>
  )
}

function shortId(id: string): string {
  return id.slice(0, 10)
}

function TaskList({
  title,
  tasks,
  testId,
}: {
  title: string
  tasks: Array<{ id: string; status: string; metadata: { label: string } }>
  testId: string
}) {
  return (
    <div className="mb-1.5" data-testid={testId}>
      <p className="text-[10px] font-semibold uppercase text-slate-400">
        {title} ({tasks.length})
      </p>
      {tasks.length === 0 ? (
        <p className="text-[10px] text-slate-400">—</p>
      ) : (
        <ul className="space-y-0.5">
          {tasks.map((t) => (
            <li key={t.id} className="truncate text-[11px] text-slate-700">
              {t.metadata.label}{' '}
              <span className="font-mono text-[10px] text-slate-400">{t.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
