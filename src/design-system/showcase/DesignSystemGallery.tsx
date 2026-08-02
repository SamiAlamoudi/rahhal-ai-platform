/**
 * Rahhal Design System Gallery — UI-only showcase (no business logic).
 */

import { useMemo, useState, type ReactElement } from 'react'
import type { DsLocaleDir, DsThemeMode } from '../tokens'
import {
  AiConversationScreen,
  AiRecommendationsScreen,
  AuthenticationScreen,
  BookingReviewScreen,
  DESIGN_SCREEN_CATALOG,
  type DesignScreenId,
  EmptyStateScreen,
  ErrorStateScreen,
  FlightDetailsScreen,
  HomeScreen,
  HotelDetailsScreen,
  LoadingStateScreen,
  MyTripsScreen,
  NotificationsScreen,
  OfflineStateScreen,
  OnboardingScreen,
  PackageDetailsScreen,
  PaymentScreen,
  ProfileScreen,
  SavedScreen,
  SearchResultsScreen,
  SettingsScreen,
  SplashScreen,
  SuccessStateScreen,
  TripTimelineScreen,
  VoiceConversationScreen,
} from '../screens'
import { DsButton, DsChip, DsPhoneShell, DsText } from '../components/primitives'

const SCREEN_MAP: Record<DesignScreenId, () => ReactElement> = {
  splash: SplashScreen,
  onboarding: OnboardingScreen,
  authentication: AuthenticationScreen,
  home: HomeScreen,
  aiConversation: AiConversationScreen,
  voiceConversation: VoiceConversationScreen,
  searchResults: SearchResultsScreen,
  flightDetails: FlightDetailsScreen,
  hotelDetails: HotelDetailsScreen,
  packageDetails: PackageDetailsScreen,
  bookingReview: BookingReviewScreen,
  payment: PaymentScreen,
  tripTimeline: TripTimelineScreen,
  myTrips: MyTripsScreen,
  saved: SavedScreen,
  notifications: NotificationsScreen,
  profile: ProfileScreen,
  settings: SettingsScreen,
  aiRecommendations: AiRecommendationsScreen,
  error: ErrorStateScreen,
  offline: OfflineStateScreen,
  empty: EmptyStateScreen,
  loading: LoadingStateScreen,
  success: SuccessStateScreen,
}

export function DesignSystemGallery() {
  const [theme, setTheme] = useState<DsThemeMode>('light')
  const [dir, setDir] = useState<DsLocaleDir>('rtl')
  const [screenId, setScreenId] = useState<DesignScreenId>('home')

  const Screen = useMemo(() => SCREEN_MAP[screenId], [screenId])
  const groups = useMemo(() => {
    const map = new Map<string, typeof DESIGN_SCREEN_CATALOG>()
    for (const item of DESIGN_SCREEN_CATALOG) {
      const list = map.get(item.group) ?? []
      list.push(item)
      map.set(item.group, list)
    }
    return [...map.entries()]
  }, [])

  return (
    <div
      data-rahhal-ds
      data-theme={theme}
      dir={dir}
      style={{
        minHeight: '100vh',
        background: 'var(--ds-bg)',
        color: 'var(--ds-ink)',
        padding: '24px clamp(16px, 3vw, 40px) 48px',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gap: 28,
          gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)',
        }}
      >
        <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div>
            <DsText as="h1" variant="display">
              رحّال · Premium V2
            </DsText>
            <DsText variant="callout" tone="secondary" style={{ marginTop: 8 }}>
              Apple-award caliber polish — living voice, consultant chat, floating depth. UI only. No business logic.
            </DsText>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <DsChip active={theme === 'light'} onClick={() => setTheme('light')}>
              Light
            </DsChip>
            <DsChip active={theme === 'dark'} onClick={() => setTheme('dark')}>
              Dark
            </DsChip>
            <DsChip active={dir === 'rtl'} onClick={() => setDir('rtl')}>
              RTL
            </DsChip>
            <DsChip active={dir === 'ltr'} onClick={() => setDir('ltr')}>
              LTR
            </DsChip>
          </div>

          {groups.map(([group, items]) => (
            <section key={group} style={{ display: 'grid', gap: 8 }}>
              <DsText variant="micro" tone="tertiary" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {group}
              </DsText>
              <div style={{ display: 'grid', gap: 6 }}>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setScreenId(item.id)}
                    style={{
                      textAlign: 'start',
                      padding: '10px 12px',
                      borderRadius: 'var(--ds-radius-md)',
                      border: 'var(--ds-border-width) solid var(--ds-border)',
                      background: screenId === item.id ? 'var(--ds-primary-soft)' : 'var(--ds-surface)',
                      color: screenId === item.id ? 'var(--ds-primary)' : 'var(--ds-ink)',
                      fontWeight: 600,
                      fontFamily: 'var(--ds-font-body)',
                      fontSize: 'var(--ds-text-caption)',
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          ))}

          <DsButton
            variant="ghost"
            onClick={() => {
              document.documentElement.dataset.dsPrint = '1'
            }}
          >
            {DESIGN_SCREEN_CATALOG.length} screens ready
          </DsButton>
        </aside>

        <main style={{ display: 'grid', justifyItems: 'center', gap: 16 }}>
          <DsText variant="caption" tone="tertiary">
            Preview · {DESIGN_SCREEN_CATALOG.find((s) => s.id === screenId)?.label}
          </DsText>
          <DsPhoneShell title="Rahhal">
            <Screen />
          </DsPhoneShell>
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          [data-rahhal-ds] > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
