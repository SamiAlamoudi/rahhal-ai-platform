/**
 * Sprint 120 — Production Home screen bound to real Memory / Trips / Chat data.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeExperience } from '../layout'
import { UiStack, UiText, UiButton } from '../common'
import { EmptyState, ErrorState, RetryState, Skeleton } from '../loading'
import { RecommendationCard } from '../cards'
import {
  loadProductionHomeData,
  type ProductionHomeData,
} from '../../lib/uiIntegration'
import { useAuth } from '../../lib/auth'
import { spacing } from '../tokens'

function ListBlock({
  items,
  empty,
  onSelect,
}: {
  items: Array<{ id: string; title: string; meta?: string }>
  empty: string
  onSelect: (id: string) => void
}) {
  if (!items.length) {
    return <EmptyState title={empty} />
  }
  return (
    <UiStack gap="sm" role="list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          onClick={() => onSelect(item.id)}
          style={{
            textAlign: 'start',
            padding: spacing.md,
            borderRadius: 10,
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          <UiText as="span" weight="semibold" size="sm">
            {item.title}
          </UiText>
          {item.meta ? (
            <UiText as="span" size="xs">
              {' '}
              — {item.meta}
            </UiText>
          ) : null}
        </button>
      ))}
    </UiStack>
  )
}

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

  if (authLoading || loading || !data) {
    return (
      <main aria-busy="true" aria-label="Loading home" style={{ padding: spacing['2xl'] }}>
        <UiStack gap="md">
          <Skeleton height={28} width="40%" />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </UiStack>
      </main>
    )
  }

  if (data.error && !data.recentConversations.length && !data.recentTrips.length) {
    return (
      <main style={{ padding: spacing['2xl'] }}>
        <RetryState
          title="تعذر تحميل الصفحة الرئيسية"
          description={data.error}
          onRetry={() => void refresh()}
        />
      </main>
    )
  }

  return (
    <main aria-label="Rahhal home" style={{ padding: spacing.lg }}>
      {data.error ? (
        <ErrorState title="تحذير" description={data.error} />
      ) : null}
      <HomeExperience
        greeting={
          <UiStack gap="sm">
            <UiText as="h1" size="2xl" weight="bold">
              رحّال
            </UiText>
            <UiText as="p" size="lg" weight="semibold">
              {data.greeting}
            </UiText>
            {data.memoryInsights[0] ? (
              <UiText size="sm">{data.memoryInsights[0]}</UiText>
            ) : null}
          </UiStack>
        }
        recentTrips={
          <ListBlock
            empty="لا توجد رحلات حديثة"
            items={data.recentTrips.map((t) => ({
              id: t.id,
              title: t.title,
              meta: t.totalLabel,
            }))}
            onSelect={(id) => navigate(`/my-trips/${id}`)}
          />
        }
        suggestedDestinations={
          data.suggestedDestinations.length ? (
            <UiStack direction="horizontal" gap="sm">
              {data.suggestedDestinations.map((d) => (
                <UiButton
                  key={d}
                  onClick={() =>
                    navigate('/chat', { state: { initialPrompt: `Plan a trip to ${d}` } })
                  }
                  aria-label={`Suggest ${d}`}
                >
                  {d}
                </UiButton>
              ))}
            </UiStack>
          ) : (
            <EmptyState title="لا توجد وجهات مقترحة بعد" />
          )
        }
        continueConversation={
          data.continueConversation ? (
            <UiButton
              onClick={() =>
                navigate(`/chat?c=${encodeURIComponent(data.continueConversation!.id)}`)
              }
            >
              متابعة: {data.continueConversation.title}
            </UiButton>
          ) : (
            <UiButton onClick={() => navigate('/chat')}>ابدأ محادثة جديدة</UiButton>
          )
        }
        upcomingTrips={
          <ListBlock
            empty="لا توجد رحلات قادمة"
            items={data.upcomingTrips.map((t) => ({
              id: t.id,
              title: t.title,
              meta: t.status,
            }))}
            onSelect={(id) => navigate(`/my-trips/${id}`)}
          />
        }
        quickActions={
          <UiStack gap="md">
            <UiStack direction="horizontal" gap="sm">
              <UiButton onClick={() => navigate('/chat')}>محادثة</UiButton>
              <UiButton onClick={() => navigate('/search')}>بحث</UiButton>
              <UiButton onClick={() => navigate('/my-trips')}>رحلاتي</UiButton>
            </UiStack>
            {data.personalizedRecommendations.length ? (
              <UiStack gap="sm">
                {data.personalizedRecommendations.map((r) => (
                  <RecommendationCard key={r} title={r} reason="من الذاكرة" />
                ))}
              </UiStack>
            ) : null}
            {data.recentConversations.length ? (
              <ListBlock
                empty=""
                items={data.recentConversations.map((c) => ({
                  id: c.id,
                  title: c.title,
                  meta: c.updatedAt,
                }))}
                onSelect={(id) => navigate(`/chat?c=${encodeURIComponent(id)}`)}
              />
            ) : null}
          </UiStack>
        }
      />
    </main>
  )
})

export default ProductionHomeScreen
