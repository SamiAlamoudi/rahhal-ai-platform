/**
 * Sprint 80 P2 — markdown + JSON report renderers.
 */

import type { LiveFlightValidationResult } from './types'

export function renderLiveFlightValidationMarkdown(
  result: LiveFlightValidationResult,
): string {
  const lines: string[] = []
  lines.push('# Sprint 80 P2 — Live Flight E2E Validation Report')
  lines.push('')
  lines.push(`**Version:** ${result.version}`)
  lines.push(`**Generated:** ${result.generatedAt}`)
  lines.push(`**Mode:** ${result.mode}`)
  lines.push(`**Scenario:** ${result.scenario.label} (\`${result.scenario.id}\`)`)
  lines.push('')
  lines.push('## Gate')
  lines.push('')
  lines.push(`| Field | Value |`)
  lines.push(`| --- | --- |`)
  lines.push(`| Allowed | ${result.gate.allowed} |`)
  lines.push(`| Deploy target | ${result.gate.deployTarget} |`)
  lines.push(`| Production blocked | ${result.gate.productionBlocked} |`)
  lines.push(`| Reason | ${result.gate.reason} |`)
  if (result.liveSkippedReason) {
    lines.push(`| Live skipped | ${result.liveSkippedReason} |`)
  }
  lines.push('')
  lines.push('## Authentication')
  lines.push('')
  lines.push(`- Token acquired: **${result.auth.tokenAcquired}**`)
  lines.push(`- Token refresh exercised: **${result.auth.tokenRefreshed}**`)
  lines.push(`- Detail: ${result.auth.detail}`)
  lines.push('')
  lines.push('## Field integrity')
  lines.push('')
  lines.push('| Check | Status |')
  lines.push('| --- | --- |')
  for (const [key, value] of Object.entries(result.fieldIntegrity)) {
    lines.push(`| ${key} | ${value} |`)
  }
  lines.push('')
  lines.push('## Pilot vs legacy')
  lines.push('')
  lines.push('| Side | ok | empty | offers | searchEngine | usedLive |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  lines.push(
    `| Pilot | ${result.pilot.ok} | ${result.pilot.empty} | ${result.pilot.offerCount} | ${result.pilot.searchEngine} | ${result.pilot.usedLive} |`,
  )
  lines.push(
    `| Legacy | ${result.legacy.ok} | ${result.legacy.empty} | ${result.legacy.offerCount} | ${result.legacy.searchEngine} | n/a |`,
  )
  lines.push('')
  lines.push('## Differences (every recorded delta)')
  lines.push('')
  if (result.differences.length === 0) {
    lines.push('_No differences recorded._')
  } else {
    lines.push('| Path | Pilot | Legacy | Severity | Note |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const diff of result.differences) {
      lines.push(
        `| \`${diff.path}\` | ${JSON.stringify(diff.pilot)} | ${JSON.stringify(diff.legacy)} | ${diff.severity} | ${diff.note} |`,
      )
    }
  }
  lines.push('')
  lines.push('## Latency')
  lines.push('')
  lines.push('| Metric | ms |')
  lines.push('| --- | --- |')
  lines.push(`| Provider response | ${result.latency.providerResponseMs} |`)
  lines.push(`| Normalization | ${result.latency.normalizationMs} |`)
  lines.push(`| Total pilot search | ${result.latency.totalSearchMs} |`)
  lines.push(`| Legacy search | ${result.latency.legacySearchMs} |`)
  lines.push('')
  lines.push('## Telemetry rates')
  lines.push('')
  lines.push('| Rate | Value |')
  lines.push('| --- | --- |')
  lines.push(`| Success rate | ${result.telemetry.successRate} |`)
  lines.push(`| Timeout rate | ${result.telemetry.timeoutRate} |`)
  lines.push(`| Auth failure rate | ${result.telemetry.authFailureRate} |`)
  lines.push(`| Empty response rate | ${result.telemetry.emptyResponseRate} |`)
  lines.push(`| Provider error rate | ${result.telemetry.providerErrorRate} |`)
  lines.push(`| Fallback rate | ${result.telemetry.fallbackRate} |`)
  lines.push(`| Searches | ${result.telemetry.searches} |`)
  lines.push('')
  lines.push('## Feature flags')
  lines.push('')
  lines.push('- `ai.live_flight_provider_pilot` — **OFF by default** (production hard-blocked)')
  lines.push('- `ai.conversational_provider_unify` — OFF by default')
  lines.push('- `ai.live_flight_search` — OFF by default')
  lines.push('')
  lines.push('## Untouched systems')
  lines.push('')
  lines.push('Voice · STT/TTS · Chat Engine · Memory · Booking · Payments')
  lines.push('')
  return lines.join('\n')
}

export function renderLiveFlightValidationJson(
  result: LiveFlightValidationResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
