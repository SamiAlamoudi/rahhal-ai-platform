/**
 * Sprint 120 — Production Conversation screen.
 * Wired to Streaming + Editable Conversation + Pipeline artifacts.
 */

import {
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import {
  ConversationScreen,
  ConversationInput,
  UserBubble,
  AssistantBubble,
  ThinkingBubble,
  StreamingBubble,
  SuggestionBubble,
  TypingIndicator,
  VoiceButton,
} from '../chat'
import {
  FlightCard,
  HotelCard,
  PackageCard,
  RecommendationCard,
  WarningCard,
  ConfidenceCard,
  ComparisonCard,
  ItineraryCard,
} from '../cards'
import {
  Timeline,
  TimelineDay,
  TimelineItem,
  TimelineEvent,
} from '../timeline'
import {
  ProgressIndicator,
  StreamingPlaceholder,
  RetryState,
  EmptyState,
} from '../loading'
import { UiStack, UiText, UiButton } from '../common'
import {
  runProductionConversationTurn,
  runProductionEditTurn,
  buildEditSnapshotFromPipeline,
  mapEditComparison,
  type ProductionTurnViewModel,
} from '../../lib/uiIntegration'
import type { EditSnapshot } from '../../lib/agent/editing'
import type { StreamingEvent } from '../../lib/agent/streaming'
import { useAuth } from '../../lib/auth'
import { spacing } from '../tokens'

interface ChatLine {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

export interface ProductionConversationScreenProps {
  conversationId?: string | null
  initialPrompt?: string | null
  /** Prefetched offers from a prior search (production pools). */
  flights?: Array<Record<string, unknown>> | null
  hotels?: Array<Record<string, unknown>> | null
}

export const ProductionConversationScreen = memo(
  function ProductionConversationScreen({
    conversationId,
    initialPrompt,
    flights,
    hotels,
  }: ProductionConversationScreenProps) {
    const { user } = useAuth()
    const [draft, setDraft] = useState(initialPrompt ?? '')
    const [lines, setLines] = useState<ChatLine[]>([])
    const [turn, setTurn] = useState<ProductionTurnViewModel | null>(null)
    const [liveEvents, setLiveEvents] = useState<StreamingEvent[]>([])
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editDraft, setEditDraft] = useState('')
    const [snapshot, setSnapshot] = useState<EditSnapshot | null>(null)
    const [editComparison, setEditComparison] = useState<ReturnType<
      typeof mapEditComparison
    > | null>(null)
    const [isPending, startTransition] = useTransition()
    const deferredTurn = useDeferredValue(turn)

    const progressPercent = turn?.progress.progressPercent ?? 0

    const runTurn = useCallback(
      async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed || running) return
        setRunning(true)
        setError(null)
        setLiveEvents([])
        setEditComparison(null)
        const userLine: ChatLine = {
          id: `u_${Date.now()}`,
          role: 'user',
          text: trimmed,
        }
        setLines((prev) => [...prev, userLine])
        setDraft('')

        try {
          const result = await runProductionConversationTurn({
            conversationId: conversationId ?? `prod_${Date.now()}`,
            userId: user?.id ?? null,
            text: trimmed,
            flights,
            hotels,
            onEvent: (event) => {
              setLiveEvents((prev) => [...prev, event])
            },
          })
          startTransition(() => {
            setTurn(result)
            if (result.streaming.pipeline) {
              setSnapshot(buildEditSnapshotFromPipeline(result.streaming.pipeline))
            }
            const assistantText =
              result.narrative
              || result.executiveSummary
              || result.headline
              || result.transcript.filter((t) => t.startsWith('✓')).slice(-3).join('\n')
              || 'تم تجهيز التوصية.'
            setLines((prev) => [
              ...prev,
              {
                id: `a_${Date.now()}`,
                role: 'assistant',
                text: assistantText,
              },
            ])
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Conversation turn failed')
        } finally {
          setRunning(false)
        }
      },
      [conversationId, flights, hotels, running, user?.id],
    )

    const onSubmit = useCallback(
      (event?: FormEvent) => {
        event?.preventDefault()
        void runTurn(draft)
      },
      [draft, runTurn],
    )

    const onRetry = useCallback(() => {
      const lastUser = [...lines].reverse().find((l) => l.role === 'user')
      if (lastUser) void runTurn(lastUser.text)
    }, [lines, runTurn])

    const onRegenerate = onRetry

    const onEdit = useCallback(async () => {
      if (!snapshot || !editDraft.trim() || running) return
      setRunning(true)
      setError(null)
      try {
        const result = await runProductionEditTurn({
          editText: editDraft.trim(),
          snapshot,
          conversationId: conversationId ?? null,
          userId: user?.id ?? null,
        })
        startTransition(() => {
          setEditComparison(result.comparison)
          if (result.edit.pipeline) {
            setSnapshot(buildEditSnapshotFromPipeline(result.edit.pipeline))
            setTurn((prev) =>
              prev
                ? {
                    ...prev,
                    flights: result.flights,
                    hotels: result.hotels,
                    packages: result.packages,
                    recommendations: result.recommendations,
                    warnings: result.warnings,
                    confidence: result.confidence,
                    itineraryDays: result.itineraryDays,
                    streaming: {
                      ...prev.streaming,
                      pipeline: result.edit.pipeline,
                      confidence: result.edit.pipeline?.confidence ?? prev.streaming.confidence,
                    },
                  }
                : prev,
            )
          }
          setLines((prev) => [
            ...prev,
            {
              id: `edit_${Date.now()}`,
              role: 'user',
              text: editDraft.trim(),
            },
            {
              id: `edit_a_${Date.now()}`,
              role: 'assistant',
              text: `تم تطبيق التعديل: ${result.comparison.whatChanged.join(' · ')}`,
            },
          ])
          setEditDraft('')
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Edit failed')
      } finally {
        setRunning(false)
      }
    }, [snapshot, editDraft, running, conversationId, user?.id])

    const messages = useMemo(() => {
      const nodes = lines.map((line) =>
        line.role === 'user' ? (
          <UserBubble key={line.id}>{line.text}</UserBubble>
        ) : (
          <AssistantBubble key={line.id}>{line.text}</AssistantBubble>
        ),
      )
      if (running) {
        nodes.push(
          <ThinkingBubble key="thinking">
            <TypingIndicator label="Thinking" />
            <ProgressIndicator
              value={progressPercent}
              label={turn?.progress.currentStage ?? 'pipeline'}
            />
            <StreamingPlaceholder lines={3} />
          </ThinkingBubble>,
        )
        for (const ev of liveEvents.slice(-4)) {
          nodes.push(
            <StreamingBubble key={ev.id}>
              {ev.message} ({ev.progressPercent}%)
            </StreamingBubble>,
          )
        }
      }
      if (deferredTurn?.recommendations[0]) {
        nodes.push(
          <SuggestionBubble key="suggest">
            {deferredTurn.recommendations[0].title}
          </SuggestionBubble>,
        )
      }
      return nodes
    }, [lines, running, progressPercent, turn?.progress.currentStage, liveEvents, deferredTurn])

    const cards = deferredTurn ? (
      <UiStack gap="md" aria-label="Production recommendations">
        {deferredTurn.confidence ? (
          <ConfidenceCard
            title={deferredTurn.confidence.title}
            confidenceLabel={deferredTurn.confidence.confidenceLabel}
          />
        ) : null}
        {deferredTurn.flights.map((f) => (
          <FlightCard
            key={f.id}
            title={f.title}
            airline={f.airline}
            route={f.route}
            priceLabel={f.priceLabel}
          />
        ))}
        {deferredTurn.hotels.map((h) => (
          <HotelCard
            key={h.id}
            title={h.title}
            city={h.city}
            starsLabel={h.starsLabel}
            priceLabel={h.priceLabel}
          />
        ))}
        {deferredTurn.packages.map((p) => (
          <PackageCard
            key={p.id}
            title={p.title}
            totalLabel={p.totalLabel}
            nightsLabel={p.nightsLabel}
          />
        ))}
        {deferredTurn.recommendations.map((r) => (
          <RecommendationCard key={r.id} title={r.title} reason={r.reason} />
        ))}
        {deferredTurn.warnings.map((w) => (
          <WarningCard key={w.id} title={w.title} severity={w.severity} />
        ))}
        {deferredTurn.itineraryDays.map((day) => (
          <ItineraryCard key={day.date} title={day.dayLabel} dayLabel={day.date} />
        ))}
      </UiStack>
    ) : (
      <EmptyState title="أرسل رسالة لبدء التخطيط" />
    )

    const timeline = deferredTurn?.itineraryDays.length ? (
      <Timeline>
        {deferredTurn.itineraryDays.map((day) => (
          <TimelineDay key={day.date} dayLabel={day.dayLabel}>
            {day.events.map((ev) => (
              <TimelineItem key={ev.id} title={ev.title}>
                <TimelineEvent timeLabel={ev.timeLabel} status={ev.status} />
              </TimelineItem>
            ))}
          </TimelineDay>
        ))}
      </Timeline>
    ) : null

    return (
      <main aria-label="Production conversation" style={{ padding: spacing.lg }}>
        <ConversationScreen
          header={
            <UiStack gap="sm">
              <UiText as="h1" size="xl" weight="bold">
                رحّال — محادثة الإنتاج
              </UiText>
              {isPending ? <UiText size="xs">Updating…</UiText> : null}
            </UiStack>
          }
          messages={
            <UiStack gap="lg">
              {messages}
              {error ? (
                <RetryState
                  title="تعذر إكمال الطلب"
                  description={error}
                  onRetry={onRetry}
                />
              ) : null}
              {cards}
              {timeline}
              {editComparison ? (
                <ComparisonCard
                  title="Before / After"
                  leftLabel={`Budget ${editComparison.beforeBudget ?? '—'}`}
                  rightLabel={`Budget ${editComparison.afterBudget ?? '—'}`}
                >
                  <UiText size="sm">
                    Affected: {editComparison.affectedStages.join(', ')}
                  </UiText>
                  <UiText size="sm">
                    Skipped: {editComparison.stagesToSkip.join(', ')}
                  </UiText>
                  <UiText size="sm">
                    Δ confidence: {editComparison.confidenceDelta}
                  </UiText>
                </ComparisonCard>
              ) : null}
            </UiStack>
          }
          input={
            <UiStack gap="sm">
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <ConversationInput
                    value={draft}
                    disabled={running}
                    placeholder="صف رحلتك…"
                    onChange={setDraft}
                    onSubmit={() => void runTurn(draft)}
                  />
                </div>
                <VoiceButton disabled />
                {/* Recovery Phase 2.2 — attachment chrome hidden unless Brain requests one. */}
              </div>
              <UiStack direction="horizontal" gap="sm">
                <UiButton disabled={running || !lines.length} onClick={onRegenerate}>
                  إعادة التوليد
                </UiButton>
                <UiButton disabled={running || !snapshot} onClick={() => void onEdit()}>
                  تطبيق تعديل
                </UiButton>
              </UiStack>
              <ConversationInput
                value={editDraft}
                disabled={running || !snapshot}
                placeholder="عدّل الطلب (مثل: Change the hotel / Business class)"
                onChange={setEditDraft}
                onSubmit={() => void onEdit()}
              />
            </UiStack>
          }
          footer={
            deferredTurn?.progress.warnings.length ? (
              <UiText size="xs">
                Warnings: {deferredTurn.progress.warnings.join(' · ')}
              </UiText>
            ) : null
          }
        />
        {/* silence unused form helper */}
        <form hidden onSubmit={onSubmit} />
      </main>
    )
  },
)

export default ProductionConversationScreen
