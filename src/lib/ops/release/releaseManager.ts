/**
 * Sprint 70 — GA Release Manager (orchestrates verification + artifacts).
 */

import { getLogger } from '../logging/structuredLogger'
import { buildGAReadinessReport } from './gaReadiness'
import { generateGAReleaseArtifacts } from './releaseArtifacts'
import { runGAVerification } from './releaseValidator'
import { buildVersionManifest } from './versionManifest'
import { RAHHAL_GA_VERSION, SPRINT70_GA_VERSION, type GAReadinessReport } from './types'

export interface GAReleaseManagerResult {
  report: GAReadinessReport
  gaReady: boolean
  version: string
}

export function runGAReleaseManager(input?: {
  skipHeavy?: boolean
  packageVersion?: string
  commit?: string
}): GAReleaseManagerResult {
  const logger = getLogger()
  logger.info('ops', 'release', 'ga_release_manager_start', {
    version: RAHHAL_GA_VERSION,
    sprint: SPRINT70_GA_VERSION,
  })

  const report = buildGAReadinessReport(input)

  logger.info('ops', 'release', 'ga_release_manager_complete', {
    gaReady: report.gaReady,
    overall: report.scores.overall,
    recommendation: report.recommendation,
  })

  return {
    report,
    gaReady: report.gaReady,
    version: RAHHAL_GA_VERSION,
  }
}

export function installGAReleaseManager(): { dispose: () => void } {
  const logger = getLogger()
  logger.info('ops', 'release', 'sprint70_installed', {
    version: RAHHAL_GA_VERSION,
  })
  return {
    dispose: () => {
      logger.info('ops', 'release', 'sprint70_disposed', {
        version: RAHHAL_GA_VERSION,
      })
    },
  }
}

export {
  buildGAReadinessReport,
  generateGAReleaseArtifacts,
  runGAVerification,
  buildVersionManifest,
}
