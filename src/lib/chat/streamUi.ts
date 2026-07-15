import type { ChatMessage } from './chatTypes'

function defaultSchedule(cb: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb)
  return setTimeout(cb, 16) as unknown as number
}

function defaultCancel(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
  else clearTimeout(id)
}

/**
 * Coalesce rapid streaming deltas onto animation frames to smooth UI updates
 * without changing the underlying stream payload.
 */
export function createDeltaCoalescer(
  onFlush: (message: ChatMessage) => void,
  schedule: (cb: () => void) => number = defaultSchedule,
  cancel: (id: number) => void = defaultCancel,
) {
  let pending: ChatMessage | null = null
  let handle: number | null = null

  const flush = () => {
    handle = null
    if (!pending) return
    const next = pending
    pending = null
    onFlush(next)
  }

  return {
    push(message: ChatMessage) {
      pending = message
      if (handle == null) handle = schedule(flush)
    },
    flushNow() {
      if (handle != null) {
        cancel(handle)
        handle = null
      }
      flush()
    },
    dispose() {
      if (handle != null) cancel(handle)
      handle = null
      pending = null
    },
  }
}
