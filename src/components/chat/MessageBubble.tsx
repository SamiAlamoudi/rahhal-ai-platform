import { lazy, Suspense, useMemo, useState } from 'react'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { copyTextToClipboard } from '../../lib/chat/chatHelpers'
import { tripPlanFromMeta } from '../../lib/agent/memory'
import type { TripPlan } from '../../lib/agent/types'
import { isConversationExperienceEnabled } from '../../lib/chat/conversationExperienceUi'
import { isUiNewExperienceEnabled } from '../../lib/productUx'
import { AiThinkingRail, DynamicResultCards } from '../premium'
import { progressiveCardLimit } from '../../lib/premiumExperience'
import MarkdownContent from './MarkdownContent'
import ItineraryActions from './ItineraryActions'
import ConversationExperiencePanel from './experience/ConversationExperiencePanel'
import AlphaJourneyPanel from './AlphaJourneyPanel'
import TypingIndicator from './experience/TypingIndicator'

const NewExperienceResultsBridge = lazy(() =>
  import('../productUx/chat/NewExperienceResultsBridge').then((m) => ({
    default: m.NewExperienceResultsBridge,
  })),
)
import type {
  ConversationBookingAction,
  ConversationBookingState,
  ConversationTimelineEvent,
} from '../../lib/chat/conversationExperienceUi'
import { safeMediaUrl } from '../../lib/ops/security/safeMediaUrl'
import { shouldShowTravelerResultCards } from '../../lib/tripState'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  busy?: boolean
  locale?: 'ar' | 'en'
  bookingState?: ConversationBookingState | null
  timelineEvents?: ConversationTimelineEvent[]
  onRetry?: (messageId: string) => void
  onRegenerate?: (messageId: string) => void
  onEditUserMessage?: (messageId: string, content: string) => void
  onSaveItinerary?: (itinerary: TripPlan, messageId: string) => void
  onRegenerateItinerary?: (messageId: string) => void
  onRegenerateDay?: (messageId: string, day: number) => void
  onEditItinerary?: (patchText: string) => void
  onSmartAction?: (commandHint: string) => void
  onBookingAction?: (action: ConversationBookingAction) => void
  onOpenTimelineEvent?: (event: ConversationTimelineEvent) => void
}

export default function MessageBubble({
  message,
  isStreaming = false,
  busy = false,
  locale = 'ar',
  bookingState = null,
  timelineEvents = [],
  onRetry,
  onRegenerate,
  onEditUserMessage,
  onSaveItinerary,
  onRegenerateItinerary,
  onRegenerateDay,
  onEditItinerary,
  onSmartAction,
  onBookingAction,
  onOpenTimelineEvent,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const showActions = message.role === 'assistant' && message.status !== 'streaming' && !isStreaming
  const imageUrl = safeMediaUrl(
    message.imageUrl
      || message.attachments.find((a) => a.kind === 'image')?.url
      || null,
  )
  const audioUrl = safeMediaUrl(message.audioUrl)
  const itinerary = tripPlanFromMeta(message.providerMeta)
  const experienceOn = isConversationExperienceEnabled()
  const newExperienceOn = isUiNewExperienceEnabled()
  const timestamp = formatMessageTime(message.createdAt)
  const seedForUi = useMemo(() => {
    const metaSeed =
      typeof message.providerMeta?.userSeed === 'string'
        ? message.providerMeta.userSeed
        : ''
    return metaSeed || message.content || ''
  }, [message.content, message.providerMeta])
  const streamingCardLimit = progressiveCardLimit(message.content.length)
  const cardsReady = shouldShowTravelerResultCards(message)
  const showResultCards =
    !isUser
    && cardsReady
    && (
      (isStreaming && streamingCardLimit > 0)
      || (!isStreaming && message.status === 'complete')
    )
  const cardLimit = isStreaming ? streamingCardLimit : 5

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message.content)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[96%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[88%] ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'border border-slate-100 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
        }`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-medium opacity-70">
          <span>
            {isUser ? 'أنت' : 'رحّال'}
            {message.modality === 'audio' ? ' · صوت' : ''}
            {imageUrl ? ' · صورة' : ''}
            {isStreaming ? ' · يكتب' : ''}
          </span>
          {timestamp && <time dateTime={message.createdAt}>{timestamp}</time>}
          {isStreaming && !isUser && (
            <span className="inline-block h-3 w-1.5 animate-pulse rounded-sm bg-current" aria-hidden="true" />
          )}
        </div>

        {imageUrl && (
          <div className="mb-2 overflow-hidden rounded-xl border border-white/20">
            <img
              src={imageUrl}
              alt="مرفق المحادثة"
              className="max-h-56 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {audioUrl && (
          <audio controls preload="none" className="mb-2 w-full" src={audioUrl}>
            <track kind="captions" />
          </audio>
        )}

        {isUser ? (
          <div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
            {onEditUserMessage && !busy && (
              <button
                type="button"
                onClick={() => onEditUserMessage(message.id, message.content)}
                className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-primary-50 hover:bg-white/20"
              >
                تعديل
              </button>
            )}
          </div>
        ) : experienceOn ? (
          <>
            {isStreaming ? (
              <div className="mb-3">
                <AiThinkingRail active seedText={seedForUi} locale={locale} />
              </div>
            ) : null}
            <ConversationExperiencePanel
              message={message}
              isStreaming={isStreaming}
              busy={busy}
              locale={locale}
              bookingState={bookingState}
              timelineEvents={timelineEvents}
              onSmartAction={onSmartAction}
              onBookingAction={onBookingAction}
              onOpenTimelineEvent={onOpenTimelineEvent}
            />
            {isStreaming && (
              <div className="mt-2">
                <TypingIndicator />
              </div>
            )}
          </>
        ) : (
          <>
            {isStreaming ? (
              <div className="space-y-3">
                {!message.content ? (
                  <AiThinkingRail active seedText={seedForUi} locale={locale} />
                ) : null}
                {message.content ? (
                  <MarkdownContent content={message.content} />
                ) : (
                  <TypingIndicator />
                )}
                {message.content ? (
                  <span
                    className="inline-block h-3 w-1.5 animate-pulse rounded-sm bg-primary-500 align-middle"
                    aria-hidden
                  />
                ) : null}
              </div>
            ) : (
              <MarkdownContent content={message.content || ''} />
            )}
            {showResultCards ? (
              <div className="mt-3">
                {newExperienceOn ? (
                  <Suspense fallback={null}>
                    <NewExperienceResultsBridge
                      message={message}
                      locale={locale}
                      isStreaming={isStreaming}
                      onEditItinerary={onEditItinerary}
                      onSmartAction={onSmartAction}
                    />
                  </Suspense>
                ) : (
                  <DynamicResultCards
                    seedText={seedForUi || message.content}
                    locale={locale}
                    limit={cardLimit}
                  />
                )}
              </div>
            ) : null}
            {!isStreaming && onSmartAction && (
              <AlphaJourneyPanel
                message={message}
                busy={busy}
                locale={locale}
                onCommand={onSmartAction}
              />
            )}
          </>
        )}

        {(message.status === 'error' || message.status === 'cancelled') && (
          <p className={`mt-2 text-xs ${isUser ? 'text-primary-100' : 'text-rose-600'}`}>
            {message.status === 'cancelled' ? 'تم إيقاف التوليد' : (message.error || 'فشل التوليد')}
          </p>
        )}

        {showActions && itinerary && onSaveItinerary && onRegenerateItinerary && onRegenerateDay && onEditItinerary && (
          <ItineraryActions
            itinerary={itinerary}
            busy={busy}
            onSave={() => onSaveItinerary(itinerary, message.id)}
            onRegenerate={() => onRegenerateItinerary(message.id)}
            onRegenerateDay={(day) => onRegenerateDay(message.id, day)}
            onEditSubmit={onEditItinerary}
          />
        )}

        {showActions && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إعادة التوليد
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMessageTime(iso: string): string | null {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}
