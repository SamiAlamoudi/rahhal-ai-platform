/**
 * Phase AJ — providers:check CLI runner (config/readiness only by default).
 */

import { resolveProviderEnablementFlags } from './flags'
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
  lines.push('Rahhal provider readiness check (Phase AJ)')
  lines.push(`paymentProvider=${getDefaultPaymentProviderType()}`)
  lines.push(`masterLive=${flags.masterLive}`)
  lines.push(`mockFallback=${flags.mockFallbackEnabled}`)
  lines.push(`strictLive=${flags.strictLive}`)
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
    const probeIds = readiness
      .filter(
        (r) =>
          !String(r.provider).endsWith('_mock') &&
          r.provider !== 'transport_mock' &&
          r.provider !== 'activities_mock',
      )
      .map((r) => r.provider)

    const probe = await runSandboxProbes(probeIds, {
      env,
      probeEnabled: true,
      confirmProduction,
      // Default probe does NOT network — requires injected probeFn for real calls.
      probeFn: async () => ({
        ok: false,
        reason: 'network_probe_not_wired_in_default_cli',
      }),
    })
    probed = probe.attempted
    lines.push('')
    if (probe.refusedReason) {
      lines.push(`Probe refused: ${probe.refusedReason}`)
    } else if (!probe.attempted) {
      lines.push('Probe not attempted.')
    } else {
      lines.push('Sandbox probe results (no credentials printed):')
      for (const row of probe.results) {
        lines.push(
          `  - ${row.provider}: probeOk=${row.probeOk ?? false} reason=${row.probeReason ?? row.reason}`,
        )
      }
    }
  } else {
    lines.push('')
    lines.push('No network calls performed (config/readiness only).')
    lines.push('Pass --sandbox-probe or PROVIDER_SANDBOX_PROBE=true for optional probe mode.')
  }

  // Exit non-zero only on forbidden client secret exposure in readiness.
  const forbidden = readiness.some((r) =>
    r.secrets.some((s) => s.forbiddenClientExposure),
  )
  const report = lines.join('\n')
  return {
    exitCode: forbidden ? 2 : 0,
    report,
    probed,
  }
}
