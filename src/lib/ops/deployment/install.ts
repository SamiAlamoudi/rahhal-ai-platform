/**
 * Sprint 68 — Optional install hook (metrics banner only; no business wiring).
 */

import { getLogger } from '../logging/structuredLogger'
import { RAHHAL_V1_RELEASE_VERSION, SPRINT68_DEPLOYMENT_VERSION } from './release'

export function installDeploymentAutomation(): { dispose: () => void } {
  const logger = getLogger()
  logger.info('ops', 'deployment', 'sprint68_installed', {
    version: RAHHAL_V1_RELEASE_VERSION,
    module: SPRINT68_DEPLOYMENT_VERSION,
  })
  return {
    dispose: () => {
      logger.info('ops', 'deployment', 'sprint68_disposed', {
        version: RAHHAL_V1_RELEASE_VERSION,
      })
    },
  }
}
