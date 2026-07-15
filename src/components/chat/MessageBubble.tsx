import { useState } from 'react'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { copyTextToClipboard } from '../../lib/chat/chatHelpers'
import MarkdownContent from './MarkdownContent'

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  onRetry?: (messageId: string) => void
}

export default function MessageBubble({ message, isStreaming = false, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const showActions = message.role === 'assistant' && message.status !== 'streaming' && !isStreaming
  const imageUrl = message.imageUrl
    || message.attachments.find((a) => a.kind === 'image')?.url
    || null

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
        className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[80%] ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'border border-slate-100 bg-white text-slate-800'
        }`}
      >
        <div className="mb-1 text-[10px] font-medium opacity-70">
          {isUser ? 'أنت' : 'رحّال'}
          {message.modality === 'audio' ? ' · صوت / نصّ الكلام' : ''}
          {imageUrl ? ' · صورة' : ''}
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
        ) : (
          <MarkdownContent content={message.content || (isStreaming ? '…' : '')} />
        )}

        {(message.status === 'error' || message.status === 'cancelled') && (
          <p className={`mt-2 text-xs ${isUser ? 'text-primary-100' : 'text-rose-600'}`}>
            {message.status === 'cancelled' ? 'تم إيقاف التوليد' : (message.error || 'فشل التوليد')}
          </p>
        )}

        {showActions && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
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
