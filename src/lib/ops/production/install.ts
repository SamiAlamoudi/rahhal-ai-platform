/**
 * Sprint 65 — install production hardening bridges (non-breaking).
 */

import { getLogger } from '../logging/structuredLogger'
import { installProviderLogBridge } from './providerBridge'

export interface ProductionHardeningInstallResult {
  ok: boolean
  dispose: () => void
}

/** Install provider log bridge + log hardening banner. Safe to call multiple times. */
export function installProductionHardening(): ProductionHardeningInstallResult {
  const disposeBridge = installProviderLogBridge()
  getLogger().info('ops', 'production_hardening', 'sprint65_installed', {
    bridges: ['providerLog'],
  })
  return {
    ok: true,
    dispose: () => {
      disposeBridge()
    },
  }
}
