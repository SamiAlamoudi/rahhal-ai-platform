/**
 * Premium UI shells — Splash → AI Conversation (placeholders only).
 */

import {
  IconBell,
  IconCar,
  IconCompass,
  IconHeart,
  IconHome,
  IconHotel,
  IconPackage,
  IconPlane,
  IconSpark,
  IconUser,
} from '../icons/OutlinedIcons'
import {
  DsAvatar,
  DsBottomNav,
  DsButton,
  DsChip,
  DsInput,
  DsProgress,
  DsSurface,
  DsText,
} from '../components/primitives'
import {
  DsAiBubble,
  DsFlightCard,
  DsHotelCard,
  DsPackageCard,
  DsQuickAction,
  DsRecommendationCard,
  DsSearchField,
  DsSuggestionCard,
  DsUserBubble,
  DsVoiceButton,
} from '../components/travel'
import {
  DsAiThinkingRail,
  DsMapExperience,
  DsPriceInsight,
  DsStreamingLine,
  DsTravelIllustration,
  DsTypingIndicator,
  DsVoiceOrb,
} from '../components/premium'
import { ScreenFrame } from './ScreenFrame'

export function SplashScreen() {
  return (
    <ScreenFrame pad={false}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: 32,
          background:
            'radial-gradient(90% 70% at 50% 28%, rgba(42,157,143,0.28), transparent 55%), radial-gradient(70% 50% at 80% 80%, rgba(74,144,188,0.2), transparent), var(--ds-ocean-900)',
          color: 'var(--ds-ink-inverse)',
        }}
      >
        <div style={{ textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center' }}>
          <DsText
            as="h1"
            variant="hero"
            tone="inverse"
            style={{
              fontFamily: 'var(--ds-font-display)',
              animation: 'ds-splash-mark var(--ds-duration-4) var(--ds-ease-emphasized) both',
            }}
          >
            رحّال
          </DsText>
          <DsText
            variant="callout"
            className="ds-animate-enter ds-animate-enter-delay-2"
            style={{ color: 'rgba(255,252,248,0.78)' }}
          >
            Your calm AI travel companion
          </DsText>
        </div>
      </div>
    </ScreenFrame>
  )
}

export function OnboardingScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))', display: 'grid', gap: 10 }}>
          <DsButton fullWidth size="lg">
            Begin with Rahhal
          </DsButton>
          <DsButton fullWidth variant="ghost">
            I already have an account
          </DsButton>
        </div>
      }
    >
      <div style={{ paddingTop: 28, display: 'grid', gap: 18 }}>
        <DsProgress value={34} label="Onboarding progress" />
        <DsText as="h1" variant="display">
          Travel that listens first
        </DsText>
        <DsText variant="body" tone="secondary">
          Speak naturally. Rahhal plans with care — flights, stays, and quiet moments — without the noise of a
          booking marketplace.
        </DsText>
        <div
          aria-hidden
          style={{
            marginTop: 24,
            height: 220,
            borderRadius: 'var(--ds-radius-xl)',
            background:
              'linear-gradient(160deg, rgba(15,76,117,0.16), rgba(42,157,143,0.22)), var(--ds-surface)',
            border: 'var(--ds-border-width) solid var(--ds-border)',
            boxShadow: 'var(--ds-shadow-md)',
          }}
        />
      </div>
    </ScreenFrame>
  )
}

export function AuthenticationScreen() {
  return (
    <ScreenFrame
      footer={
        <div style={{ padding: '16px 20px calc(20px + var(--ds-safe-bottom))' }}>
          <DsButton fullWidth size="lg">
            Continue
          </DsButton>
        </div>
      }
    >
      <div style={{ paddingTop: 20, display: 'grid', gap: 20 }}>
        <DsText as="h1" variant="display">
          Welcome back
        </DsText>
        <DsText variant="callout" tone="secondary">
          Sign in to continue your journey with Rahhal.
        </DsText>
        <DsInput label="Email" placeholder="you@email.com" name="email" autoComplete="email" />
        <DsInput
          label="Password"
          placeholder="••••••••"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <DsButton variant="ghost" size="sm" style={{ justifySelf: 'start' }}>
          Forgot password?
        </DsButton>
      </div>
    </ScreenFrame>
  )
}

export function HomeScreen() {
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

        {/* Living companion hero — voice is the centerpiece */}
        <section
          className="ds-animate-enter ds-animate-enter-delay-1"
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
            minHeight: 340,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08), transparent 35%)',
            }}
          />
          <DsText
            variant="micro"
            style={{ color: 'rgba(255,252,248,0.7)', letterSpacing: '0.14em', zIndex: 1 }}
          >
            LIVE COMPANION
          </DsText>
          <DsText as="h2" variant="display" tone="inverse" style={{ zIndex: 1, maxWidth: 280 }}>
            Where shall we go?
          </DsText>
          <DsText
            variant="callout"
            style={{ color: 'rgba(255,252,248,0.78)', maxWidth: 260, zIndex: 1 }}
          >
            Speak. Rahhal listens — then plans with quiet confidence.
          </DsText>
          <div style={{ zIndex: 1, marginTop: 4, marginBottom: 18 }}>
            <DsVoiceOrb listening size={108} />
          </div>
          <DsText variant="micro" style={{ color: 'rgba(255,252,248,0.58)', zIndex: 1 }}>
            Hold to talk · Tap to open chat
          </DsText>
        </section>

        <section className="ds-animate-enter ds-animate-enter-delay-2" style={{ display: 'grid', gap: 14 }}>
          <DsSearchField placeholder="Or whisper a destination in text…" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <DsQuickAction icon={<IconPlane />} label="Flights" />
            <DsQuickAction icon={<IconHotel />} label="Hotels" />
            <DsQuickAction icon={<IconPackage />} label="Packages" />
            <DsQuickAction icon={<IconCar />} label="Cars" />
            <DsQuickAction icon={<IconCompass />} label="Discover" />
          </div>
        </section>

        <section className="ds-animate-enter ds-animate-enter-delay-3" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <DsText as="h2" variant="heading">
              Soft inspiration
            </DsText>
            <DsText variant="micro" tone="primary">
              For you
            </DsText>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 10 }}>
            <DsSurface
              className="ds-float-card"
              padding={16}
              style={{
                minHeight: 140,
                background:
                  'linear-gradient(160deg, rgba(15,76,117,0.9), rgba(42,157,143,0.55)), #6f9db8',
                color: 'var(--ds-ink-inverse)',
                border: 'none',
              }}
            >
              <DsText variant="micro" tone="inverse" style={{ opacity: 0.75 }}>
                Morocco
              </DsText>
              <DsText variant="heading" tone="inverse" style={{ marginTop: 8 }}>
                Courtyard light & slow mornings
              </DsText>
            </DsSurface>
            <DsSurface className="ds-float-card" padding={16} elevated>
              <DsTravelIllustration kind="journey" size={72} />
              <DsText variant="caption" tone="secondary" style={{ marginTop: 8 }}>
                Quiet coasts this month
              </DsText>
            </DsSurface>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 12 }}>
          <DsText as="h2" variant="heading">
            Recent journeys
          </DsText>
          <DsPackageCard title="Jeddah weekend" nights="2 nights" price="SAR 2,100" />
        </section>
      </div>
    </ScreenFrame>
  )
}

export function AiConversationScreen() {
  return (
    <ScreenFrame
      pad={false}
      footer={
        <div
          className="ds-glass"
          style={{
            padding: '12px 16px calc(16px + var(--ds-safe-bottom))',
            borderTop: 'var(--ds-border-width) solid var(--ds-border)',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8, overflow: 'auto' }}>
            <DsChip active>Flexible dates</DsChip>
            <DsChip>Under SAR 5k</DsChip>
            <DsChip>Quiet hotels</DsChip>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <DsSearchField placeholder="Tell Rahhal what you need…" />
            </div>
            <DsVoiceButton size={56} />
            <button
              type="button"
              aria-label="Play last reply"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'var(--ds-border-width) solid var(--ds-border)',
                background: 'var(--ds-surface)',
                color: 'var(--ds-primary)',
                cursor: 'pointer',
              }}
            >
              <IconSpark />
            </button>
          </div>
        </div>
      }
    >
      <div
        style={{
          padding: '12px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <DsText as="h1" variant="heading">
            Consultant
          </DsText>
          <DsText variant="micro" tone="tertiary">
            Premium travel conversation
          </DsText>
        </div>
        <DsAvatar initials="AI" size={36} alt="Rahhal AI" />
      </div>
      <div className="ds-scroll-fade" style={{ padding: '12px 20px 24px', display: 'grid', gap: 16 }}>
        <DsAiThinkingRail />
        <DsAiBubble meta="Rahhal · just now">
          I can shape a Morocco week that feels unhurried — flights, a calm riad, and a soft landing day.
        </DsAiBubble>
        <DsUserBubble>Morocco next month, two adults, quiet stay.</DsUserBubble>
        <DsAiBubble rich meta="Composed for you">
          <DsSurface elevated padding={14} className="ds-float-card">
            <DsStreamingLine text="Here is a composed start — refine anytime." />
          </DsSurface>
          <DsFlightCard />
          <DsHotelCard />
          <DsMapExperience />
          <DsPriceInsight />
          <DsRecommendationCard />
          <DsPackageCard title="Courtyard week" nights="5 nights" price="SAR 5,400" />
        </DsAiBubble>
        <DsTypingIndicator />
        <div style={{ display: 'grid', gap: 8 }}>
          <DsSuggestionCard label="Show me softer evening arrivals" />
          <DsSuggestionCard label="Compare two riads near the medina" />
          <DsSuggestionCard label="Add a quiet transfer from the airport" />
        </div>
      </div>
    </ScreenFrame>
  )
}

export function VoiceConversationScreen() {
  return (
    <ScreenFrame pad={false}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          gap: 22,
          padding: '48px 24px',
          background:
            'radial-gradient(80% 60% at 50% 40%, rgba(42,157,143,0.14), transparent), var(--ds-brand-wash)',
        }}
      >
        <DsText variant="caption" tone="primary" style={{ letterSpacing: '0.12em' }}>
          LISTENING
        </DsText>
        <DsText as="h1" variant="display" style={{ maxWidth: 300 }}>
          “A calm week in Morocco…”
        </DsText>
        <DsVoiceOrb listening size={128} />
        <DsText variant="callout" tone="secondary" style={{ maxWidth: 280 }}>
          Soft breath. Natural waves. Interrupt anytime — Rahhal never rushes you.
        </DsText>
        <DsButton variant="ghost">Switch to text</DsButton>
      </div>
    </ScreenFrame>
  )
}

export function SearchResultsScreen() {
  return (
    <ScreenFrame>
      <DsText as="h1" variant="title">
        Results
      </DsText>
      <DsText variant="caption" tone="secondary">
        Riyadh → Dubai · flexible week
      </DsText>
      <div style={{ display: 'flex', gap: 8, overflow: 'auto' }}>
        <DsChip active>Best match</DsChip>
        <DsChip>Price</DsChip>
        <DsChip>Duration</DsChip>
      </div>
      <DsRecommendationCard title="Best balance" body="Morning arrival, midfare, easy connection to hotel." />
      <DsFlightCard />
      <DsFlightCard from="RUH" to="DXB" time="14:10 → 16:35" price="SAR 1,150" meta="Nonstop · 2h 25m" />
      <DsHotelCard />
    </ScreenFrame>
  )
}

export function AiRecommendationsScreen() {
  return (
    <ScreenFrame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconSpark style={{ color: 'var(--ds-secondary)' }} />
        <DsText as="h1" variant="title">
          For you
        </DsText>
      </div>
      <DsText variant="callout" tone="secondary">
        Quiet recommendations shaped from your last conversation — never a marketplace wall.
      </DsText>
      <DsRecommendationCard title="Arrive Thursday" body="Lower hotel rates and softer airport rhythm." />
      <DsPackageCard />
      <DsHotelCard name="Riad Light Courtyard" area="Medina · 4.9" />
      <DsFlightCard price="SAR 1,340" meta="Preferred window · nonstop" />
    </ScreenFrame>
  )
}
