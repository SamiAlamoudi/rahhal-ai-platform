import type { BrainResponsePlan } from '../../lib/brain'

export interface PlannerViewerProps {
  plan: BrainResponsePlan | null
  className?: string
}

export function PlannerViewer({ plan, className = '' }: PlannerViewerProps) {
  if (!plan) {
    return (
      <section
        data-testid="brain-planner-viewer"
        className={`rounded-xl border border-dashed border-slate-200 p-2.5 text-slate-400 ${className}`}
      >
        No plan yet
      </section>
    )
  }

  return (
    <section
      data-testid="brain-planner-viewer"
      className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
    >
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Planner
      </h3>
      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">action</dt>
          <dd className="font-medium text-slate-800">{plan.action}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">goal</dt>
          <dd className="truncate font-medium text-slate-800">{plan.assistantGoal}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">summary</dt>
          <dd className="truncate font-mono text-[10px] text-slate-600">{plan.summary}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">searches</dt>
          <dd className="font-medium text-slate-800">{plan.searchRequests.length}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">bookings</dt>
          <dd className="font-medium text-slate-800">{plan.bookingRequests.length}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">recs</dt>
          <dd className="font-medium text-slate-800">{plan.recommendations.length}</dd>
        </div>
      </dl>
      {plan.uiHints.suggestedReplies.length > 0 ? (
        <p className="mt-2 text-[10px] text-primary-700">
          hint: {plan.uiHints.suggestedReplies[0]}
        </p>
      ) : null}
    </section>
  )
}
