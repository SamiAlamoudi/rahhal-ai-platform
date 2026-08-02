/**
 * Signature Brand gallery panel — identity assets only.
 */

import { useState } from 'react'
import { DsChip, DsText } from '../components/primitives'
import { RahhalAiPersonalityRow } from './AiPersonality'
import { RahhalIllustrationRow } from './Illustrations'
import { RahhalOrb, RAHHAL_ORB_STATES, type RahhalOrbState } from './RahhalOrb'
import { TravelDnaGrid } from './TravelDna'

export function BrandGalleryPanel() {
  const [orbState, setOrbState] = useState<RahhalOrbState>('listening')

  return (
    <div className="rh-atmosphere" style={{ display: 'grid', gap: 28, padding: '8px 4px 32px' }}>
      <header style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
        <p className="rh-section-label">Signature identity</p>
        <DsText as="h2" variant="display">
          رحّال Brand DNA
        </DsText>
        <DsText variant="callout" tone="secondary">
          Modern Arabic elegance · luxury travel · calm AI · ocean exploration. One family of marks —
          instantly recognizable as Rahhal.
        </DsText>
      </header>

      <hr className="rh-separator" />

      <section style={{ display: 'grid', gap: 16 }}>
        <p className="rh-section-label">Rahhal Orb</p>
        <DsText variant="heading">The AI logo — seven states</DsText>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {RAHHAL_ORB_STATES.map((s) => (
            <DsChip key={s} active={orbState === s} onClick={() => setOrbState(s)}>
              {s}
            </DsChip>
          ))}
        </div>
        <div
          className="rh-surface-signature"
          style={{
            display: 'grid',
            placeItems: 'center',
            padding: '48px 24px 56px',
            minHeight: 220,
            background: 'var(--rh-gradient-dusk)',
          }}
        >
          <RahhalOrb state={orbState} size={120} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
          {RAHHAL_ORB_STATES.map((s) => (
            <div key={s} style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
              <RahhalOrb state={s} size={64} interactive={false} />
              <DsText variant="micro" tone="tertiary">
                {s}
              </DsText>
            </div>
          ))}
        </div>
      </section>

      <hr className="rh-separator" />

      <section style={{ display: 'grid', gap: 14 }}>
        <p className="rh-section-label">AI personality</p>
        <DsText variant="heading">Cognitive states with visual identity</DsText>
        <RahhalAiPersonalityRow />
      </section>

      <hr className="rh-separator" />

      <section style={{ display: 'grid', gap: 14 }}>
        <p className="rh-section-label">Travel DNA</p>
        <DsText variant="heading">Connected journey categories</DsText>
        <TravelDnaGrid />
      </section>

      <hr className="rh-separator" />

      <section style={{ display: 'grid', gap: 14 }}>
        <p className="rh-section-label">Illustration language</p>
        <DsText variant="heading">Horizon geometry — never cartoon</DsText>
        <RahhalIllustrationRow />
      </section>

      <hr className="rh-separator" />

      <section style={{ display: 'grid', gap: 14 }}>
        <p className="rh-section-label">Signature surfaces</p>
        <DsText variant="heading">Glass · cards · timeline · map</DsText>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="rh-card-price-insight">
            <DsText variant="micro" tone="tertiary">
              Price insight
            </DsText>
            <DsText variant="heading">٢٬٤٥٠ ر.س</DsText>
            <DsText variant="micro" style={{ color: 'var(--ds-secondary)' }}>
              أقل بـ ١٢٪ من متوسط ٧ أيام
            </DsText>
          </div>
          <div className="rh-card-recommend" style={{ padding: 16 }}>
            <DsText variant="micro" tone="tertiary">
              Recommendation
            </DsText>
            <DsText variant="callout">باقة إسطنبول الهادئة — ٤ ليالٍ</DsText>
          </div>
        </div>
        <div className="rh-float-layer" style={{ padding: 16 }}>
          <div className="rh-timeline-signature">
            <div className="rh-timeline-signature__stop">
              <DsText variant="callout">مغادرة الرياض</DsText>
            </div>
            <div className="rh-timeline-signature__stop">
              <DsText variant="callout">وصول إسطنبول</DsText>
            </div>
            <div className="rh-timeline-signature__stop">
              <DsText variant="callout">تسجيل الفندق</DsText>
            </div>
          </div>
        </div>
        <div
          className="rh-surface-signature rh-map-overlay"
          style={{ height: 120, borderRadius: 16, position: 'relative' }}
          aria-hidden
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="rh-loading-mist" style={{ height: 48 }} aria-label="Loading mist" />
          <div className="rh-celebrate">
            <RahhalOrb state="success" size={56} />
            <DsText variant="callout">تم تأكيد رحلتك</DsText>
          </div>
        </div>
      </section>

      <hr className="rh-separator" />

      <section
        className="rh-glass-signature"
        style={{ padding: 20, display: 'grid', gap: 10, borderRadius: 'var(--ds-radius-xl)' }}
      >
        <p className="rh-section-label">Glass · Gradient · Depth</p>
        <DsText variant="callout" tone="secondary">
          Signature glass uses pearl translucency + 24px blur. Cards use inset highlight + ocean-tinted
          float shadow. Separators are horizon fades — never hard rules.
        </DsText>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="rh-surface-signature rh-pattern-dune" style={{ height: 88, borderRadius: 16 }} />
          <div
            className="rh-pattern-compass"
            style={{
              height: 88,
              borderRadius: 16,
              backgroundColor: 'transparent',
              backgroundImage: 'var(--rh-pattern-compass), var(--rh-gradient-horizon)',
              boxShadow: 'var(--rh-shadow-float)',
            }}
          />
        </div>
      </section>
    </div>
  )
}
