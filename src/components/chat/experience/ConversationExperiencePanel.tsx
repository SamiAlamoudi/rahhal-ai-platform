import { memo, useMemo } from 'react'
import type { ChatMessage } from '../../../lib/chat/chatTypes'
import {
  buildMemoryChips,
  buildTravelCards,
  extractConversationUiMeta,
  suggestedActionsFromStructured,
  type ConversationBookingAction,
  type ConversationBookingState,
  type ConversationTimelineEvent,
} from '../../../lib/chat/conversationExperienceUi'
import MarkdownContent from '../MarkdownContent'
import BookingActionsBar from './BookingActionsBar'
import MemoryChips from './MemoryChips'
import SmartActionsBar from './SmartActionsBar'
import TripTimelinePanel from './TripTimelinePanel'
import { FlightTravelCard } from './cards/FlightTravelCard'
import { HotelTravelCard } from './cards/HotelTravelCard'
import {
  ActivityTravelCard,
  CarTravelCard,
  InsuranceTravelCard,
  VisaTravelCard,
} from './cards/OtherTravelCards'
import AttachmentPreview from './AttachmentPreview'

interface Props {
  message: ChatMessage
  isStreaming?: boolean
  busy?: boolean
  locale?: 'ar' | 'en'
  bookingState?: ConversationBookingState | null
  timelineEvents?: ConversationTimelineEvent[]
  onSmartAction?: (commandHint: string) => void
  onBookingAction?: (action: ConversationBookingAction) => void
  onOpenTimelineEvent?: (event: ConversationTimelineEvent) => void
}

function ConversationExperiencePanelImpl({
  message,
  isStreaming = false,
  busy = false,
  locale = 'ar',
  bookingState = null,
  timelineEvents = [],
  onSmartAction,
  onBookingAction,
  onOpenTimelineEvent,
}: Props) {
  const meta = useMemo(() => extractConversationUiMeta(message.providerMeta), [message.providerMeta])
  const cards = useMemo(
    () => (meta.structured && !isStreaming ? buildTravelCards(meta.structured, { locale }) : []),
    [meta.structured, isStreaming, locale],
  )
  const actions = useMemo(
    () => suggestedActionsFromStructured(meta.structured),
    [meta.structured],
  )
  const memoryChips = useMemo(
    () => buildMemoryChips(meta.memory, locale),
    [meta.memory, locale],
  )

  if (!meta.conversationUi && !meta.structured) {
    return <MarkdownContent content={message.content || (isStreaming ? '…' : '')} />
  }

  return (
    <div className="space-y-3">
      <MarkdownContent content={message.content || (isStreaming ? '…' : '')} />

      {message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <AttachmentPreview key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {memoryChips.length > 0 && <MemoryChips chips={memoryChips} />}

      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Travel recommendation cards">
          {cards.map((card) => {
            if (card.kind === 'flight') {
              return (
                <FlightTravelCard
                  key={card.id}
                  card={card}
                  busy={busy}
                  onBook={() => onBookingAction?.('reserve')}
                />
              )
            }
            if (card.kind === 'hotel') {
              return (
                <HotelTravelCard
                  key={card.id}
                  card={card}
                  busy={busy}
                  onBook={() => onBookingAction?.('reserve')}
                />
              )
            }
            if (card.kind === 'car') {
              return <CarTravelCard key={card.id} card={card} busy={busy} onBook={() => onBookingAction?.('reserve')} />
            }
            if (card.kind === 'activity') {
              return <ActivityTravelCard key={card.id} card={card} busy={busy} onReserve={() => onBookingAction?.('reserve')} />
            }
            if (card.kind === 'visa') {
              return <VisaTravelCard key={card.id} card={card} onAction={() => onSmartAction?.('Review visa requirements')} />
            }
            return <InsuranceTravelCard key={card.id} card={card} onPurchase={() => onSmartAction?.('Add travel insurance')} />
          })}
        </div>
      )}

      {!isStreaming && onSmartAction && (
        <SmartActionsBar actions={actions} onAction={onSmartAction} disabled={busy} />
      )}

      {!isStreaming && onBookingAction && meta.structured && (
        <BookingActionsBar onAction={onBookingAction} busy={busy} />
      )}

      {bookingState?.message && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300" role="status">
          {bookingState.message}
        </p>
      )}

      {timelineEvents.length > 0 && (
        <TripTimelinePanel events={timelineEvents} onOpen={onOpenTimelineEvent} />
      )}
    </div>
  )
}

export default memo(ConversationExperiencePanelImpl)
