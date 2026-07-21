/**
 * Sprint 69 — optional install banner for operations monitoring.
 */

import { getLogger } from '../logging/structuredLogger'
import { SPRINT69_OPERATIONS_VERSION } from './readiness'

export function installBetaOperationsMonitoring(): { dispose: () => void } {
  const logger = getLogger()
  logger.info('ops', 'operations', 'sprint69_installed', {
    version: SPRINT69_OPERATIONS_VERSION,
  })
  return {
    dispose: () => {
      logger.info('ops', 'operations', 'sprint69_disposed', {
        version: SPRINT69_OPERATIONS_VERSION,
      })
    },
  }
}
