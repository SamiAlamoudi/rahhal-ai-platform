/**
 * Sprint 27 — structured logging for AITripOrchestrator.
 */

import type { OrchestratorLogEntry, OrchestratorLogLevel, OrchestratorStage } from './types'

export type OrchestratorLogger = {
  entries: () => OrchestratorLogEntry[]
  log: (
    level: OrchestratorLogLevel,
    stage: OrchestratorStage | 'orchestrator',
    message: string,
    data?: Record<string, unknown>,
  ) => void
  clear: () => void
}

export function createOrchestratorLogger(
  onLog?: (entry: OrchestratorLogEntry) => void,
): OrchestratorLogger {
  const buffer: OrchestratorLogEntry[] = []

  return {
    entries: () => [...buffer],
    clear: () => {
      buffer.length = 0
    },
    log(level, stage, message, data) {
      const entry: OrchestratorLogEntry = {
        at: new Date().toISOString(),
        level,
        stage,
        message,
        ...(data ? { data } : {}),
      }
      buffer.push(entry)
      onLog?.(entry)
    },
  }
}
