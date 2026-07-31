import { memo, useMemo, useRef, useState, useEffect, type ReactNode, type UIEvent } from 'react'
import type { ChatMessage } from '../../../lib/chat/chatTypes'

interface Props {
  messages: ChatMessage[]
  renderMessage: (message: ChatMessage, index: number) => ReactNode
  estimateHeight?: number
  overscan?: number
  /**
   * Sprint 80 P1-5 — honest threshold: virtualize only when the list is large
   * enough that windowing saves work. Below this, render all rows (no fake
   * windowing overhead / scroll jump for short chats).
   */
  virtualizeAfter?: number
}

/** Default: keep short chats fully mounted; window only above this count. */
export const MESSAGE_LIST_VIRTUALIZE_AFTER = 40

/**
 * Lightweight virtualized list (no extra dependency).
 * Falls back to rendering all rows when the list is small.
 */
function VirtualizedMessageListImpl({
  messages,
  renderMessage,
  estimateHeight = 140,
  overscan = 4,
  virtualizeAfter = MESSAGE_LIST_VIRTUALIZE_AFTER,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(600)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => setViewport(el.clientHeight || 600)
    update()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [])

  const total = messages.length
  const useVirtual = total > virtualizeAfter

  const { start, end, offsetTop, totalHeight } = useMemo(() => {
    if (!useVirtual) {
      return { start: 0, end: total, offsetTop: 0, totalHeight: total * estimateHeight }
    }
    const startIndex = Math.max(0, Math.floor(scrollTop / estimateHeight) - overscan)
    const visible = Math.ceil(viewport / estimateHeight) + overscan * 2
    const endIndex = Math.min(total, startIndex + visible)
    return {
      start: startIndex,
      end: endIndex,
      offsetTop: startIndex * estimateHeight,
      totalHeight: total * estimateHeight,
    }
  }, [useVirtual, total, scrollTop, viewport, estimateHeight, overscan])

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }

  if (!useVirtual) {
    return (
      <div className="space-y-3" aria-live="polite">
        {messages.map((message, index) => (
          <div key={message.id}>{renderMessage(message, index)}</div>
        ))}
      </div>
    )
  }

  const slice = messages.slice(start, end)

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto"
      aria-live="polite"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetTop}px)` }} className="space-y-3">
          {slice.map((message, index) => (
            <div key={message.id}>{renderMessage(message, start + index)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default memo(VirtualizedMessageListImpl)
