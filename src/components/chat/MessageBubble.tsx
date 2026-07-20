import { useState } from 'react'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { copyTextToClipboard } from '../../lib/chat/chatHelpers'
import { tripPlanFromMeta } from '../../lib/agent/memory'
import type { TripPlan } from '../../lib/agent/types'
import { isConversationExperienceEnabled } from '../../lib/chat/conversationExperienceUi'
import MarkdownContent from './MarkdownContent'
import ItineraryActions from './ItineraryActions'
import ConversationExperiencePanel from './experience/ConversationExperiencePanel'
import TypingIndicator from './experience/TypingIndicator'
import type {
  ConversationBookingAction,
  ConversationBookingState,
  ConversationTimelineEvent,
} from '../../lib/chat/conversationExperienceUi'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  busy?: boolean
  locale?: 'ar' | 'en'
  bookingState?: ConversationBookingState | null
  timelineEvents?: ConversationTimelineEvent[]
  onRetry?: (messageId: string) => void
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
  const imageUrl = message.imageUrl
    || message.attachments.find((a) => a.kind === 'image')?.url
    || null
  const itinerary = tripPlanFromMeta(message.providerMeta)
  const experienceOn = isConversationExperienceEnabled()

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
        <div className="mb-1 text-[10px] font-medium opacity-70">
          {isUser ? 'أنت' : 'وكيل سفر رحّال'}
          {message.modality === 'audio' ? ' · صوت / نصّ الكلام' : ''}
          {imageUrl ? ' · صورة' : ''}
          {isStreaming ? ' · يكتب' : ''}
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

        {message.audioUrl && (
          <audio controls preload="none" className="mb-2 w-full" src={message.audioUrl}>
            <track kind="captions" />
          </audio>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : experienceOn ? (
          <>
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
          <MarkdownContent content={message.content || (isStreaming ? '…' : '')} />
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
