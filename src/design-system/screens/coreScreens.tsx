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
  DsText,
} from '../components/primitives'
import {
  DsAiBubble,
  DsFlightCard,
  DsHotelCard,
  DsMapPlaceholder,
  DsPackageCard,
  DsQuickAction,
  DsRecommendationCard,
  DsSearchField,
  DsSuggestionCard,
  DsUserBubble,
  DsVoiceButton,
} from '../components/travel'
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
            'radial-gradient(80% 60% at 50% 30%, rgba(42,157,143,0.22), transparent), var(--ds-ocean-900)',
          color: 'var(--ds-ink-inverse)',
        }}
      >
        <div className="ds-animate-enter" style={{ textAlign: 'center', display: 'grid', gap: 12 }}>
          <DsText as="h1" variant="hero" tone="inverse" style={{ fontFamily: 'var(--ds-font-display)' }}>
            رحّال
          </DsText>
          <DsText variant="callout" style={{ color: 'rgba(255,252,248,0.78)' }}>
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <DsText variant="caption" tone="tertiary">
            Good evening
          </DsText>
          <DsText as="h1" variant="title">
            رحّال
          </DsText>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          style={{ border: 0, background: 'transparent', color: 'var(--ds-ink-secondary)', cursor: 'pointer' }}
        >
          <IconBell />
        </button>
      </header>

      <section
        className="ds-animate-enter"
        style={{
          marginTop: 8,
          padding: 22,
          borderRadius: 'var(--ds-radius-xl)',
          background: 'linear-gradient(165deg, var(--ds-ocean-700), var(--ds-ocean-900))',
          color: 'var(--ds-ink-inverse)',
          display: 'grid',
          gap: 18,
          justifyItems: 'center',
          textAlign: 'center',
          boxShadow: 'var(--ds-shadow-lg)',
        }}
      >
        <DsText variant="caption" style={{ color: 'rgba(255,252,248,0.72)', letterSpacing: '0.06em' }}>
          AI COMPANION
        </DsText>
        <DsText as="h2" variant="display" tone="inverse">
          Where shall we go?
        </DsText>
        <DsText variant="callout" style={{ color: 'rgba(255,252,248,0.78)', maxWidth: 280 }}>
          Speak freely. Rahhal listens, plans, and keeps every detail calm.
        </DsText>
        <DsVoiceButton listening />
        <DsText variant="micro" style={{ color: 'rgba(255,252,248,0.6)' }}>
          Hold to talk · Tap for chat
        </DsText>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <DsSearchField placeholder="Or type a destination…" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
          }}
        >
          <DsQuickAction icon={<IconPlane />} label="Flights" />
          <DsQuickAction icon={<IconHotel />} label="Hotels" />
          <DsQuickAction icon={<IconPackage />} label="Packages" />
          <DsQuickAction icon={<IconCar />} label="Cars" />
          <DsQuickAction icon={<IconCompass />} label="Discover" />
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <DsText as="h2" variant="heading">
          Recent trips
        </DsText>
        <DsPackageCard title="Jeddah weekend" nights="2 nights" price="SAR 2,100" />
      </section>
    </ScreenFrame>
  )
}

export function AiConversationScreen() {
  return (
    <ScreenFrame
      pad={false}
      footer={
        <div
          style={{
            padding: '12px 16px calc(16px + var(--ds-safe-bottom))',
            borderTop: 'var(--ds-border-width) solid var(--ds-border)',
            background: 'var(--ds-surface-glass)',
            backdropFilter: 'blur(16px)',
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
            <DsVoiceButton />
          </div>
        </div>
      }
    >
      <div style={{ padding: '12px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <DsText as="h1" variant="heading">
          Consultant
        </DsText>
        <DsAvatar initials="AI" size={36} alt="Rahhal AI" />
      </div>
      <div style={{ padding: '8px 20px 20px', display: 'grid', gap: 14 }}>
        <DsAiBubble meta="Rahhal · just now">
          I can shape a Morocco week that feels unhurried — flights, a calm riad, and a soft landing day.
        </DsAiBubble>
        <DsUserBubble>Morocco next month, two adults, quiet stay.</DsUserBubble>
        <DsAiBubble>
          Here is a composed start. We can refine dates after you glance at these options.
        </DsAiBubble>
        <DsFlightCard />
        <DsHotelCard />
        <DsMapPlaceholder />
        <DsRecommendationCard />
        <div style={{ display: 'grid', gap: 8 }}>
          <DsSuggestionCard label="Show me softer evening arrivals" />
          <DsSuggestionCard label="Compare two riads near the medina" />
        </div>
      </div>
    </ScreenFrame>
  )
}

export function VoiceConversationScreen() {
  return (
    <ScreenFrame>
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          gap: 20,
          padding: '40px 12px',
        }}
      >
        <DsText variant="caption" tone="tertiary">
          Listening
        </DsText>
        <DsText as="h1" variant="display">
          “A calm week in Morocco…”
        </DsText>
        <div style={{ position: 'relative', width: 160, height: 160, display: 'grid', placeItems: 'center' }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--ds-primary-soft)',
              animation: 'ds-soft-pulse 2s var(--ds-ease-standard) infinite',
            }}
          />
          <DsVoiceButton listening />
        </div>
        <DsText variant="callout" tone="secondary" style={{ maxWidth: 280 }}>
          Rahhal is composing a reply. You can interrupt anytime.
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
