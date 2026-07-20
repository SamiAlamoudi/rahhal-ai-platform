/**
 * Orchestrator handle registry — leaf module (no integration imports).
 */

// Opaque handle store — concrete type lives in aiTripOrchestrator.ts
const handles = new Map<string, object>()

export function getOrchestratorHandle(
  key: string,
): object | undefined {
  return handles.get(key)
}

export function setOrchestratorHandle(
  key: string,
  handle: object,
): void {
  handles.set(key, handle)
}

export function clearOrchestratorHandles(): void {
  handles.clear()
}
