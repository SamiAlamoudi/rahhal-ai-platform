/**
 * Phase AL — CLI runner for Amadeus sandbox validation.
 * Default (mode OFF): report-only, no network.
 * Opt-in: AMADEUS_SANDBOX_VALIDATION=true or --amadeus-sandbox-validate
 */

import {
  runAmadeusSandboxValidation,
  type AmadeusSandboxValidationOptions,
  type AmadeusSandboxValidationReport,
} from './amadeusSandboxValidation'
import { resolveProviderEnablementFlags } from './flags'
import { getDefaultPaymentProviderType } from '../../../payment'

export interface AmadeusSandboxValidationCliResult {
  exitCode: number
  report: string
  result: AmadeusSandboxValidationReport
}

export async function runAmadeusSandboxValidationCli(
  options: AmadeusSandboxValidationOptions = {},
): Promise<AmadeusSandboxValidationCliResult> {
  const env = options.env
    ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const result = await runAmadeusSandboxValidation({ ...options, env })
  const flags = resolveProviderEnablementFlags(env)

  const safety = [
    '',
    '--- safety ---',
    `paymentProvider=${getDefaultPaymentProviderType()}`,
    `masterLive=${flags.masterLive}`,
    `flightsLive=${flags.capabilities.flights.live}`,
    `hotelsLive=${flags.capabilities.hotels.live}`,
    `mockFallback=${flags.mockFallbackEnabled}`,
    'productionCredentials=not_enabled_by_this_command',
    'realCustomerTraffic=false',
  ].join('\n')

  const report = `${result.summary}${safety}`
  return {
    exitCode: result.exitCode,
    report,
    result,
  }
}
