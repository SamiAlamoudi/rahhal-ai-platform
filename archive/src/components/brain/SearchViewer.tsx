import type { SearchAggregationTurnResult } from '../../lib/brain/search'

export interface SearchViewerProps {
  search: SearchAggregationTurnResult | null
  className?: string
}

/**
 * Sprint 24 — Search aggregation debug viewer
 * (provider calls, aggregation, ranking, scoring, recommendation, timeline).
 */
export function SearchViewer({ search, className = '' }: SearchViewerProps) {
  if (!search) {
    return (
      <section
        data-testid="brain-search-viewer"
        className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
      >
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Search Aggregation
        </h3>
        <p className="text-slate-400">No aggregation yet</p>
      </section>
    )
  }

  const { recommendation, collection, timeline, providerCallCount, rankedCount } =
    search
  const top = recommendation.top

  return (
    <section
      data-testid="brain-search-viewer"
      className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
    >
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Search Aggregation
      </h3>

      <div className="mb-2 space-y-1" data-testid="search-provider-calls">
        <p className="text-[10px] font-semibold uppercase text-slate-400">Provider calls</p>
        <p className="font-medium text-slate-800">
          {providerCallCount} result(s) · {collection.all.length} option(s) ·{' '}
          {rankedCount} ranked
        </p>
        <p className="truncate font-mono text-[10px] text-slate-500">
          plan {collection.executionPlanId.slice(0, 14)} · trip{' '}
          {collection.tripPlanId.slice(0, 14)}
        </p>
      </div>

      <div className="mb-2 border-t border-slate-100 pt-2" data-testid="search-aggregation">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Aggregation</p>
        <ul className="space-y-0.5 font-mono text-[10px] text-slate-600">
          <li>flights: {collection.flights.length}</li>
          <li>hotels: {collection.hotels.length}</li>
          <li>transport: {collection.transport.length}</li>
          <li>activities: {collection.activities.length}</li>
          <li>packages: {collection.packages.length}</li>
        </ul>
      </div>

      <div className="mb-2 border-t border-slate-100 pt-2" data-testid="search-ranking">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Ranking</p>
        <p className="text-slate-700">
          {rankedCount} candidate(s)
          {top ? ` · top score ${top.score.toFixed(2)}` : ''}
        </p>
      </div>

      <div className="mb-2 border-t border-slate-100 pt-2" data-testid="search-scoring">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Scoring</p>
        {top ? (
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-slate-600">
            {Object.entries(top.factors).map(([k, v]) => (
              <li key={k}>
                {k}: {Number(v).toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">—</p>
        )}
      </div>

      <div className="mb-2 border-t border-slate-100 pt-2" data-testid="search-recommendation">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
          Recommendation
        </p>
        {top ? (
          <>
            <p className="font-medium text-slate-800" data-testid="search-top">
              Top: {top.title} · conf {recommendation.confidenceScore.toFixed(2)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              alt: {recommendation.alternatives.length} · rejected:{' '}
              {recommendation.rejected.length}
            </p>
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
              {recommendation.reasoning.slice(0, 4).map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-slate-400">No recommendation</p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-2" data-testid="search-timeline">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">
          Execution timeline
        </p>
        <ol className="space-y-0.5">
          {timeline.map((entry) => (
            <li key={entry.id} className="truncate font-mono text-[10px] text-slate-600">
              <span className="text-slate-400">{entry.stage}</span> — {entry.detail}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
