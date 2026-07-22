/**
 * Sprint 120/121 — Production Home screen.
 * Sprint 121: premium presentation sections; data still from loadProductionHomeData.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UiButton } from '../common'
import { ErrorState, RetryState } from '../loading'
import {
  ConversationEntry,
  ContinueConversation,
  FeaturedExperiences,
  featuredItemsFromHistory,
  HeroSection,
  HomeSkeleton,
  QuickActions,
  RecommendedActions,
  RecentTripsCard,
  SmartSearchEntry,
  SuggestedDestinations,
  TravelInspiration,
  UpcomingTrips,
  homePageStyle,
  homeResponsiveGridStyle,
  homeShellStyle,
} from '../home'
import {
  loadProductionHomeData,
  type ProductionHomeData,
} from '../../lib/uiIntegration'
import { useAuth } from '../../lib/auth'

export const ProductionHomeScreen = memo(function ProductionHomeScreen() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<ProductionHomeData | null>(null)
  const [loading, setLoading] = useState(true)

  const displayName = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined
    return meta?.full_name || meta?.name || user?.email?.split('@')[0] || null
  }, [user])

  const refresh = useCallback(async () => {
    setLoading(true)
    const next = await loadProductionHomeData({
      userId: user?.id ?? null,
      displayName,
    })
    setData(next)
    setLoading(false)
  }, [user?.id, displayName])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const featured = useMemo(
    () => featuredItemsFromHistory(data?.travelHistory ?? null),
    [data?.travelHistory],
  )

  if (authLoading || loading || !data) {
    return <HomeSkeleton />
  }

  if (data.error && !data.recentConversations.length && !data.recentTrips.length) {
    return (
      <main
        dir="rtl"
        lang="ar"
        aria-label="خطأ في الصفحة الرئيسية"
        style={homePageStyle()}
      >
        <div style={homeShellStyle()}>
          <RetryState
            title="تعذر تحميل الصفحة الرئيسية"
            description={data.error}
            retryLabel="إعادة المحاولة"
            onRetry={() => void refresh()}
          />
        </div>
      </main>
    )
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      aria-label="الصفحة الرئيسية لرحّال"
      data-ui="premium-home"
      style={homePageStyle()}
    >
      <div style={homeShellStyle()}>
        {data.error ? (
          <ErrorState title="تحذير" description={data.error} />
        ) : null}

        <HeroSection
          greeting={data.greeting}
          insight={data.memoryInsights[0] ?? null}
          primaryAction={
            <UiButton
              onClick={() => navigate('/chat')}
              aria-label="ابدأ التخطيط"
              style={{
                background: '#ffffff',
                color: '#122e57',
              }}
            >
              ابدأ التخطيط
            </UiButton>
          }
          secondaryAction={
            <UiButton
              onClick={() => navigate('/search')}
              aria-label="فتح البحث"
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.45)',
              }}
            >
              بحث
            </UiButton>
          }
        />

        <div style={homeResponsiveGridStyle()}>
          <ConversationEntry
            index={1}
            onStart={() => navigate('/chat')}
          />
          <ContinueConversation
            index={2}
            conversation={data.continueConversation}
            onContinue={(id) => navigate(`/chat?c=${encodeURIComponent(id)}`)}
            onStartNew={() => navigate('/chat')}
          />
        </div>

        <div style={homeResponsiveGridStyle()}>
          <RecentTripsCard
            index={3}
            trips={data.recentTrips}
            onSelect={(id) => navigate(`/my-trips/${id}`)}
          />
          <UpcomingTrips
            index={4}
            trips={data.upcomingTrips}
            onSelect={(id) => navigate(`/my-trips/${id}`)}
          />
        </div>

        <SuggestedDestinations
          index={5}
          destinations={data.suggestedDestinations}
          onSelect={(destination) =>
            navigate('/chat', {
              state: { initialPrompt: `Plan a trip to ${destination}` },
            })
          }
        />

        <div style={homeResponsiveGridStyle()}>
          <TravelInspiration
            index={6}
            insights={data.memoryInsights}
            historyNotes={data.travelHistory?.notes ?? []}
          />
          <RecommendedActions
            index={7}
            recommendations={data.personalizedRecommendations}
            onSelect={(recommendation) =>
              navigate('/chat', { state: { initialPrompt: recommendation } })
            }
          />
        </div>

        <FeaturedExperiences index={8} items={featured} />

        <div style={homeResponsiveGridStyle()}>
          <SmartSearchEntry index={9} onSearch={() => navigate('/search')} />
          <QuickActions
            index={10}
            actions={[
              {
                id: 'chat',
                label: 'محادثة',
                primary: true,
                onClick: () => navigate('/chat'),
              },
              {
                id: 'search',
                label: 'بحث',
                onClick: () => navigate('/search'),
              },
              {
                id: 'trips',
                label: 'رحلاتي',
                onClick: () => navigate('/my-trips'),
              },
            ]}
            recentConversations={data.recentConversations}
            onOpenConversation={(id) => navigate(`/chat?c=${encodeURIComponent(id)}`)}
          />
        </div>
      </div>
    </main>
  )
})

export default ProductionHomeScreen
