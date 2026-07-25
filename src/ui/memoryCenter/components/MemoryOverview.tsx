import type { CSSProperties } from 'react'
import type {
  MemoryCenterLocale,
  MemoryGraphNode,
  MemoryStatCard,
} from '../types'

export interface MemoryOverviewProps {
  overview: string
  stats: MemoryStatCard[]
  confidenceAverage: number
  memoryGraph: MemoryGraphNode[]
  locale: MemoryCenterLocale
}

export function MemoryOverview({
  overview,
  stats,
  confidenceAverage,
  memoryGraph,
  locale,
}: MemoryOverviewProps) {
  return (
    <>
      <section className="rahhal-mc-panel" data-testid="mc-overview">
        <h2>{locale === 'en' ? 'Overview' : 'نظرة عامة'}</h2>
        <p>{overview}</p>
      </section>

      <div className="rahhal-mc-grid" data-testid="mc-stats">
        {stats.map((stat) => (
          <article key={stat.id} className="rahhal-mc-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <div className="rahhal-mc-layout">
        <section className="rahhal-mc-panel" data-testid="mc-confidence">
          <h2>
            {locale === 'en' ? 'Confidence scores' : 'درجات الثقة'}
          </h2>
          <p>
            {locale === 'en'
              ? `Average confidence ${confidenceAverage}%`
              : `متوسط الثقة ${confidenceAverage}%`}
          </p>
          <div
            className="rahhal-mc-meter"
            data-testid="mc-confidence-meter"
            aria-valuenow={confidenceAverage}
          >
            <i style={{ width: `${confidenceAverage}%` } as CSSProperties} />
          </div>
        </section>

        <section className="rahhal-mc-panel" data-testid="mc-memory-graph">
          <h2>{locale === 'en' ? 'Memory graph' : 'رسم الذاكرة'}</h2>
          <div className="rahhal-mc-graph">
            {memoryGraph.map((node) => (
              <div key={node.id}>
                <i style={{ height: `${Math.max(12, node.weight)}%` }} />
                <span>{node.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
