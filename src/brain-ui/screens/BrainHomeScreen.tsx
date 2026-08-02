import {
  IconBell,
  IconCar,
  IconCompass,
  IconHeart,
  IconHome,
  IconHotel,
  IconPackage,
  IconPlane,
  IconUser,
} from '../../design-system/icons/OutlinedIcons'
import { RahhalOrb } from '../../design-system/brand/RahhalOrb'
import {
  DsBottomNav,
  DsSurface,
  DsText,
} from '../../design-system/components/primitives'
import {
  DsPackageCard,
  DsQuickAction,
  DsRecommendationCard,
} from '../../design-system/components/travel'
import { ScreenFrame } from '../../design-system/screens/ScreenFrame'
import { useTravelBrain } from '../useTravelBrain'
import { BrainComposer } from '../components/BrainComposer'
import { useState } from 'react'

export function BrainHomeScreen({
  onOpenChat,
  onOpenVoice,
}: {
  onOpenChat?: () => void
  onOpenVoice?: () => void
}) {
  const { state, sendMessage, startVoice } = useTravelBrain()
  const [query, setQuery] = useState('')
  const personal = state.recommendations?.packages[0]

  return (
    <ScreenFrame
      pad={false}
      footer={
        <DsBottomNav
          activeId="home"
          items={[
            { id: 'home', label: 'Home', icon: <IconHome /> },
            { id: 'trips', label: 'Trips', icon: <IconPackage /> },
            { id: 'saved', label: 'Saved', icon: <IconHeart /> },
            { id: 'profile', label: 'You', icon: <IconUser /> },
          ]}
        />
      }
    >
      <div style={{ padding: '10px 20px 28px', display: 'grid', gap: 22 }}>
        <header
          className="ds-animate-enter"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <DsText variant="caption" tone="tertiary">
              Good evening
            </DsText>
            <DsText as="h1" variant="display" style={{ letterSpacing: '-0.03em' }}>
              رحّال
            </DsText>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="ds-glass"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'var(--ds-border-width) solid var(--ds-border)',
              color: 'var(--ds-ink-secondary)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconBell />
          </button>
        </header>

        <section
          className="ds-animate-enter ds-animate-enter-delay-1 rh-atmosphere"
          style={{
            position: 'relative',
            padding: '28px 22px 26px',
            borderRadius: 'var(--ds-radius-2xl)',
            overflow: 'hidden',
            background:
              'radial-gradient(120% 90% at 50% 0%, rgba(42,157,143,0.35), transparent 50%), linear-gradient(165deg, var(--ds-ocean-600), var(--ds-ocean-900))',
            color: 'var(--ds-ink-inverse)',
            display: 'grid',
            gap: 16,
            justifyItems: 'center',
            textAlign: 'center',
            boxShadow: 'var(--ds-shadow-float)',
            minHeight: 320,
          }}
        >
          <DsText
            variant="micro"
            style={{ color: 'rgba(255,252,248,0.7)', letterSpacing: '0.14em', zIndex: 1 }}
          >
            LIVE COMPANION · BRAIN
          </DsText>
          <DsText as="h2" variant="display" tone="inverse" style={{ zIndex: 1, maxWidth: 280 }}>
            Where shall we go?
          </DsText>
          <div style={{ zIndex: 1 }}>
            <RahhalOrb
              interactive
              size={108}
              state={state.voiceListening ? 'listening' : 'idle'}
              label="Start voice planning"
              onClick={() => {
                onOpenVoice?.()
                void startVoice()
              }}
            />
          </div>
          <DsText variant="micro" style={{ color: 'rgba(255,252,248,0.58)', zIndex: 1 }}>
            Hold to talk · Tap chat to continue planning
          </DsText>
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          <BrainComposer
            value={query}
            placeholder="Or whisper a destination in text…"
            onChange={setQuery}
            onSubmit={() => {
              const text = query
              setQuery('')
              onOpenChat?.()
              void sendMessage(text)
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <div
              role="presentation"
              onClick={() => {
                onOpenChat?.()
                void sendMessage('Book a flight from Riyadh to Dubai')
              }}
            >
              <DsQuickAction icon={<IconPlane />} label="Flights" />
            </div>
            <div
              role="presentation"
              onClick={() => {
                onOpenChat?.()
                void sendMessage('Book a hotel in Istanbul')
              }}
            >
              <DsQuickAction icon={<IconHotel />} label="Hotels" />
            </div>
            <div
              role="presentation"
              onClick={() => {
                onOpenChat?.()
                void sendMessage('Recommend a package to Istanbul')
              }}
            >
              <DsQuickAction icon={<IconPackage />} label="Packages" />
            </div>
            <div role="presentation" onClick={() => onOpenChat?.()}>
              <DsQuickAction icon={<IconCar />} label="Cars" />
            </div>
            <div role="presentation" onClick={() => onOpenChat?.()}>
              <DsQuickAction icon={<IconCompass />} label="Chat" />
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <DsText as="h2" variant="heading">
            Suggested journeys
          </DsText>
          {state.suggestedJourneys.map((j) => (
            <DsSurface
              key={j.id}
              elevated
              padding={16}
              className="ds-float-card"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                onOpenChat?.()
                void sendMessage(j.prompt)
              }}
            >
              <DsText variant="heading">{j.title}</DsText>
              <DsText variant="caption" tone="secondary">
                {j.subtitle}
              </DsText>
            </DsSurface>
          ))}
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <DsText as="h2" variant="heading">
            Recent conversations
          </DsText>
          {state.recentConversations.length === 0 ? (
            <DsText variant="caption" tone="tertiary">
              Your TravelBrain sessions will appear here.
            </DsText>
          ) : (
            state.recentConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenChat?.()}
                style={{
                  textAlign: 'start',
                  padding: 14,
                  borderRadius: 'var(--ds-radius-lg)',
                  border: 'var(--ds-border-width) solid var(--ds-border)',
                  background: 'var(--ds-surface)',
                  cursor: 'pointer',
                }}
              >
                <DsText variant="heading">{c.title}</DsText>
                <DsText variant="caption" tone="secondary">
                  {c.preview}
                </DsText>
              </button>
            ))
          )}
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <DsText as="h2" variant="heading">
              Continue planning
            </DsText>
            <button
              type="button"
              onClick={() => onOpenChat?.()}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--ds-primary)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Open chat
            </button>
          </div>
          {personal ? (
            <DsPackageCard
              title={personal.item.title}
              nights={`${personal.item.nights} nights`}
              price={`${personal.item.currency} ${personal.item.totalPrice.toLocaleString()}`}
            />
          ) : (
            <DsRecommendationCard
              title="Personal recommendations"
              body="Start a conversation — Rahhal will compose options from the mock brain."
            />
          )}
        </section>
      </div>
    </ScreenFrame>
  )
}
