/**
 * Sprint 83 — package builder observability events.
 */

export type PackageEventName =
  | 'package.created'
  | 'package.scored'
  | 'package.filtered'
  | 'package.ranked'
  | 'package.selected'

export interface PackageEvent {
  name: PackageEventName
  at: string
  payload: Record<string, unknown>
}

export type PackageEventListener = (event: PackageEvent) => void

const listeners = new Set<PackageEventListener>()

export function onPackageEvent(listener: PackageEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitPackageEvent(
  name: PackageEventName,
  payload: Record<string, unknown> = {},
  sink?: PackageEvent[],
): PackageEvent {
  const event: PackageEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  }
  sink?.push(event)
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // never break package path
    }
  }
  return event
}

export function resetPackageEventListeners(): void {
  listeners.clear()
}
