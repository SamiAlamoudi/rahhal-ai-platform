/**
 * Sprint 80 P1-5 — isolate mic level updates from ChatPage React state.
 * Voice meters subscribe here so level ticks do not re-render the message list.
 */

let level = 0
const listeners = new Set<() => void>()

export function setVoiceMeterLevel(next: number): void {
  const clamped = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0
  if (clamped === level) return
  level = clamped
  listeners.forEach((listener) => listener())
}

export function getVoiceMeterLevel(): number {
  return level
}

export function subscribeVoiceMeter(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test / dispose helper — resets meter without notifying (avoids flicker). */
export function resetVoiceMeterLevel(): void {
  level = 0
}
