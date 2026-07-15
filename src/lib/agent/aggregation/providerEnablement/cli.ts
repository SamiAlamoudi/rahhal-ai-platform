/**
 * Phase AJ / AK — providers:check CLI runner.
 * Config/readiness validation only by default (no network).
 * Optional Amadeus-only sandbox probe with explicit opt-in.
 */

import { resolveProviderEnablementFlags } from './flags'
import {
  PRIMARY_SANDBOX_CAPABILITY,
  PRIMARY_SANDBOX_PROVIDER_ID,
} from './exclusivity'
import {
  isProductionProbeConfirmed,
  isSandboxProbeEnvEnabled,
  runSandboxProbes,
} from './probe'
import { checkAllProviderReadiness } from './readiness'
import { selectAllCapabilities } from './selection'
import { getDefaultPaymentProviderType } from '../../../payment'

export interface ProvidersCheckOptions {
  env?: Record<string, string | undefined>
  argv?: string[]
}

export interface ProvidersCheckResult {
  exitCode: number
  report: string
  probed: boolean
}

function hasArg(argv: string[], name: string): boolean {
  return argv.includes(name)
}

export async function runProvidersCheck(
  options: ProvidersCheckOptions = {},
): Promise<ProvidersCheckResult> {
  const env = options.env ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const argv = options.argv ?? (globalThis as { process?: { argv?: string[] } }).process?.argv ?? []
  const probeRequested =
    hasArg(argv, '--sandbox-probe') || isSandboxProbeEnvEnabled(env)
  const confirmProduction =
    hasArg(argv, '--confirm-production-probe') || isProductionProbeConfirmed(env)

  const flags = resolveProviderEnablementFlags(env)
  const readiness = checkAllProviderReadiness({ env, flags })
  const selections = selectAllCapabilities({ env, flags })

  const lines: string[] = []
  lines.push('Rahhal provider readiness check (Phase AK)')
  lines.push(`paymentProvider=${getDefaultPaymentProviderType()}`)
  lines.push(`masterLive=${flags.masterLive}`)
  lines.push(`mockFallback=${flags.mockFallbackEnabled}`)
  lines.push(`strictLive=${flags.strictLive}`)
  lines.push(`allowedLiveCapability=${flags.allowedLiveCapability ?? 'none'}`)
  lines.push(
    `exclusivitySuppressed=${(flags.exclusivitySuppressed ?? []).join(',') || 'none'}`,
  )
  lines.push(`primarySandboxProvider=${PRIMARY_SANDBOX_PROVIDER_ID}`)
  lines.push(`primarySandboxCapability=${PRIMARY_SANDBOX_CAPABILITY}`)
  lines.push(`probeRequested=${probeRequested}`)
  lines.push('')
  lines.push('Selections:')
  for (const s of selections) {
    lines.push(
      `  - ${s.capability}: ${s.selectedProviderId} (${s.outcome}${s.fallbackUsed ? ', fallback' : ''})`,
    )
  }
  lines.push('')
  lines.push('Readiness:')
  for (const r of readiness) {
    lines.push(
      `  - ${r.provider}/${r.capability}: configured=${r.configured} enabled=${r.enabled} healthy=${r.healthy} env=${r.environment} reason=${r.reason}`,
    )
  }

  let probed = false
  if (probeRequested) {
    // Phase AK: only Amadeus is eligible for optional sandbox network probing.
    const probe = await runSandboxProbes([PRIMARY_SANDBOX_PROVIDER_ID], {
      env,
      probeEnabled: true,
      confirmProduction,
      amadeusOnly: true,
    })
    probed = probe.attempted
    lines.push('')
    if (probe.refusedReason) {
      lines.push(`Probe refused: ${probe.refusedReason}`)
    } else if (!probe.attempted) {
      lines.push('Probe not attempted.')
    } else {
      lines.push('Sandbox probe results (Amadeus-only, no credentials printed):')
      for (const row of probe.results) {
        lines.push(
          `  - ${row.provider}: probeOk=${row.probeOk ?? false} reason=${row.probeReason ?? row.reason}`,
        )
      }
    }
  } else {
    lines.push('')
    lines.push('No network calls performed (config/readiness only).')
    lines.push('Pass --sandbox-probe or PROVIDER_SANDBOX_PROBE=true for optional Amadeus sandbox probe.')
  }

  const forbidden = readiness.some((r) =>
    r.secrets.some((s) => s.forbiddenClientExposure),
  )
  const report = lines.join('\n')
  return {
    // Forbidden client secrets fail hard. Exclusivity conflicts are reported but non-fatal.
    exitCode: forbidden ? 2 : 0,
    report,
    probed,
  }
}
