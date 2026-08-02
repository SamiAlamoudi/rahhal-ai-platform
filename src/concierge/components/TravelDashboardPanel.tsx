import { DsText } from '../../design-system/components/primitives'
import type { TravelDashboardModel } from '../types'

const LABELS: Record<keyof TravelDashboardModel['readiness'], string> = {
  preparation: 'Preparation',
  budget: 'Budget health',
  packing: 'Packing',
  flight: 'Flight readiness',
  hotel: 'Hotel readiness',
  visa: 'Visa readiness',
  weather: 'Weather readiness',
}

export function TravelDashboardPanel({ model }: { model: TravelDashboardModel }) {
  return (
    <section
      className="rh-celebrate"
      style={{
        background: 'var(--rh-gradient-dusk)',
        color: '#fffcf8',
        display: 'grid',
        gap: 14,
        justifyItems: 'stretch',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <DsText variant="micro" style={{ color: 'rgba(255,252,248,0.7)', letterSpacing: '0.14em' }}>
          TRIP SCORE
        </DsText>
        <DsText as="p" variant="hero" tone="inverse" style={{ fontSize: 56, margin: '4px 0' }}>
          {model.tripScore}
        </DsText>
        <DsText variant="callout" style={{ color: 'rgba(255,252,248,0.85)' }}>
          {model.headline}
        </DsText>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => {
          const value = model.readiness[key]
          return (
            <div key={key} style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <DsText variant="caption" style={{ color: 'rgba(255,252,248,0.85)' }}>
                  {LABELS[key]}
                </DsText>
                <DsText variant="caption" style={{ color: 'rgba(255,252,248,0.85)' }}>
                  {value}%
                </DsText>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${value}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #2a9d8f, #c9a259)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
