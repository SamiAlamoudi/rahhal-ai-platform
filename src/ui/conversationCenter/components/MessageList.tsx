import { useEffect, useRef, useState } from 'react'
import type {
  ConversationCenterLocale,
  ConversationCenterMessage,
  ConversationMessageActionId,
} from '../types'
import { MessageBubble } from './MessageBubble'

export interface MessageListProps {
  messages: ConversationCenterMessage[]
  locale?: ConversationCenterLocale
  showJumpToLatest?: boolean
  onJumpToLatest?: () => void
  onMessageAction?: (action: ConversationMessageActionId, messageId: string) => void
}

/** Large conversation area with smooth scroll + jump-to-latest. */
export function MessageList({
  messages,
  locale = 'ar',
  showJumpToLatest = false,
  onJumpToLatest,
  onMessageAction,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  return (
    <div className="rahhal-cc-thread" data-testid="cc-message-list">
      <div
        className="rahhal-cc-thread__messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => {
          const expanded = expandedIds[message.id] ?? message.expanded
          return (
            <div key={message.id} className="rahhal-cc-thread__item rahhal-cc-anim-appear">
              <MessageBubble
                message={{ ...message, expanded }}
                locale={locale}
                onAction={onMessageAction}
                onToggleExpand={() =>
                  setExpandedIds((prev) => ({
                    ...prev,
                    [message.id]: !(prev[message.id] ?? message.expanded),
                  }))
                }
              />
            </div>
          )
        })}
        <div ref={endRef} data-testid="cc-thread-end" />
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="rahhal-cc-thread__jump"
          data-testid="cc-jump-latest"
          onClick={onJumpToLatest}
        >
          {locale === 'en' ? 'Jump to latest' : 'الأحدث'}
        </button>
      ) : null}
    </div>
  )
}
