import type {
  ConversationCenterLocale,
  ConversationCenterMessage,
  ConversationMessageActionId,
} from '../types'
import { isConversationCardKind } from '../types'
import { TravelCard } from './cards/TravelCards'

export interface MessageBubbleProps {
  message: ConversationCenterMessage
  locale?: ConversationCenterLocale
  onAction?: (action: ConversationMessageActionId, messageId: string) => void
  onToggleExpand?: () => void
}

const KIND_LABEL: Partial<
  Record<ConversationCenterMessage['kind'], { ar: string; en: string }>
> = {
  thinking: { ar: 'يفكّر…', en: 'Thinking…' },
  loading: { ar: 'جارٍ التحميل…', en: 'Loading…' },
  clarification: { ar: 'توضيح', en: 'Clarification' },
  recommendation: { ar: 'توصية', en: 'Recommendation' },
  warning: { ar: 'تنبيه', en: 'Warning' },
  success: { ar: 'نجاح', en: 'Success' },
  error: { ar: 'خطأ', en: 'Error' },
  system: { ar: 'نظام', en: 'System' },
}

const ACTION_LABEL: Record<ConversationMessageActionId, { ar: string; en: string }> = {
  copy: { ar: 'نسخ', en: 'Copy' },
  like: { ar: 'إعجاب', en: 'Like' },
  dislike: { ar: 'غير مفيد', en: 'Dislike' },
  regenerate: { ar: 'إعادة', en: 'Regenerate' },
  expand: { ar: 'توسيع', en: 'Expand' },
  collapse: { ar: 'طيّ', en: 'Collapse' },
  references: { ar: 'مراجع', en: 'References' },
}

/**
 * Single message bubble — traveler / assistant / system / cards / status.
 * Streaming is a visual placeholder only (no AI stream).
 */
export function MessageBubble({
  message,
  locale = 'ar',
  onAction,
  onToggleExpand,
}: MessageBubbleProps) {
  const isCard = isConversationCardKind(message.kind)
  const kindMeta = KIND_LABEL[message.kind]
  const kindLabel = kindMeta ? (locale === 'en' ? kindMeta.en : kindMeta.ar) : null
  const visualRole =
    message.kind === 'traveler' || message.role === 'user' ? 'traveler' : message.role

  return (
    <div
      className={`rahhal-cc-bubble rahhal-cc-bubble--${visualRole} rahhal-cc-bubble--kind-${message.kind}`}
      data-testid="cc-message"
      data-message-id={message.id}
      data-message-kind={message.kind}
      data-role={message.role}
      data-streaming={message.streamingPlaceholder ? 'true' : 'false'}
      data-unread={message.unread ? 'true' : 'false'}
    >
      {kindLabel ? (
        <span className="rahhal-cc-bubble__kind" data-testid="cc-message-kind">
          {kindLabel}
        </span>
      ) : null}

      {isCard ? (
        <TravelCard
          kind={message.kind}
          title={message.cardTitle ?? message.body.slice(0, 80)}
          expanded={message.expanded}
          locale={locale}
          onToggleExpand={onToggleExpand}
        />
      ) : (
        <div className="rahhal-cc-bubble__content">
          {message.streamingPlaceholder ? (
            <span className="rahhal-cc-bubble__streaming" data-testid="cc-streaming-placeholder">
              {message.body || '…'}
            </span>
          ) : (
            <p className="rahhal-cc-bubble__text">{message.body}</p>
          )}
        </div>
      )}

      <footer className="rahhal-cc-bubble__meta">
        <time className="rahhal-cc-bubble__time" dateTime={message.createdAt}>
          {formatTime(message.createdAt, locale)}
        </time>
        {message.confidence != null ? (
          <span className="rahhal-cc-bubble__confidence" data-testid="cc-confidence">
            {locale === 'en' ? 'Confidence' : 'ثقة'} {Math.round(message.confidence * 100)}%
          </span>
        ) : null}
        {message.actions.some((a) => a.id === 'references' && a.placeholder) ? (
          <span className="rahhal-cc-bubble__refs" data-testid="cc-refs-placeholder">
            {locale === 'en' ? 'References' : 'مراجع'}
          </span>
        ) : null}
      </footer>

      {message.role === 'assistant' || message.role === 'user' ? (
        <div className="rahhal-cc-bubble__actions" data-testid="cc-message-actions">
          {message.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="rahhal-cc-bubble__action"
              data-action={action.id}
              data-placeholder={action.placeholder ? 'true' : 'false'}
              onClick={() => onAction?.(action.id, message.id)}
            >
              {locale === 'en' ? ACTION_LABEL[action.id].en : ACTION_LABEL[action.id].ar}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function formatTime(iso: string, locale: ConversationCenterLocale): string {
  try {
    return new Date(iso).toLocaleTimeString(locale === 'en' ? 'en' : 'ar', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
