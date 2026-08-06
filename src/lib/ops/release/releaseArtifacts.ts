/**
 * Sprint 70 — Release artifact strings for GA documentation pack.
 */

import { generateGAReleaseNotes } from './releaseNotes'
import { formatVersionManifest, buildVersionManifest } from './versionManifest'
import { buildGAChecklist } from './releaseChecklist'
import type { VersionManifest } from './types'
import { RAHHAL_GA_VERSION } from './types'

export interface GAReleaseArtifacts {
  releaseNotes: string
  changelogV1: string
  versionDoc: string
  gaChecklist: string
  systemStatus: string
  apiStatus: string
  knownLimitations: string
  roadmapPostV1: string
  versionManifestMarkdown: string
}

export function generateGAReleaseArtifacts(input?: {
  manifest?: VersionManifest
  systemOverall?: string
}): GAReleaseArtifacts {
  const manifest = input?.manifest ?? buildVersionManifest()
  const checklist = buildGAChecklist()
  const overall = input?.systemOverall ?? 'healthy'

  const releaseNotes = generateGAReleaseNotes(manifest)

  const changelogV1 = [
    `# CHANGELOG — Bilamo V1`,
    '',
    `## [${RAHHAL_GA_VERSION}] — GA`,
    '',
    '### Added',
    '- GA release manager (`src/lib/ops/release` Sprint 70 modules)',
    '- Version manifest 1.0.0',
    '- Operational stack through Sprint 69',
    '',
    '### Safe defaults',
    '- Mock payments; live providers gated',
    '',
  ].join('\n')

  const versionDoc = [
    `# VERSION ${RAHHAL_GA_VERSION}`,
    '',
    formatVersionManifest(manifest),
    '',
    'This document certifies Bilamo General Availability.',
    '',
  ].join('\n')

  const gaChecklist = [
    `# GA Checklist`,
    '',
    ...checklist.map((c) => `- [${c.done ? 'x' : ' '}] ${c.label} (${c.group})`),
    '',
  ].join('\n')

  const systemStatus = [
    `# SYSTEM STATUS`,
    '',
    `Overall: **${overall}**`,
    `Bilamo: ${RAHHAL_GA_VERSION} GA`,
    `Package: ${manifest.packageVersion}`,
    '',
    'Subsystems: Conversation, Search, Ranking, Booking, Trips, Documents,',
    'Payments (mock), Providers, Notifications, Observability, Deployment.',
    '',
  ].join('\n')

  const apiStatus = [
    `# API STATUS`,
    '',
    '| Surface | Status | Notes |',
    '| --- | --- | --- |',
    '| Supabase Auth | Ready | Anon key client-side only |',
    '| Ops health probes | Ready | liveness / readiness / health |',
    '| Provider adapters | Ready | Mock default; live gated |',
    '| Payments | Frozen mock | Live capture blocked until freeze lift |',
    '| Notifications | Ready | Mock channel providers + retry |',
    '',
  ].join('\n')

  const knownLimitations = [
    `# KNOWN LIMITATIONS — Bilamo ${RAHHAL_GA_VERSION}`,
    '',
    '- Live payments frozen (`VITE_PAYMENT_PROVIDER=mock`).',
    '- Live travel providers default OFF; require Edge secrets + ops approval.',
    '- In-memory idempotency / DLQ / trip store — not multi-instance durable.',
    '- Enterprise Document Center OFF by default when present.',
    '- No OpenTelemetry export — in-process metrics + structured logs.',
    '- Alert sinks mock/composite until production webhook configured.',
    '- Hosting rollback is manual; library arms the trigger.',
    '',
  ].join('\n')

  const roadmapPostV1 = [
    `# ROADMAP — Post V1`,
    '',
    '1. Lift payment production freeze after business verification.',
    '2. Durable multi-instance stores (idempotency, trips, DLQ).',
    '3. OpenTelemetry / external APM export.',
    '4. Production alert webhooks (PagerDuty / Slack).',
    '5. Expanded live provider coverage with per-market SLOs.',
    '6. Enterprise Document Center default-on after soak.',
    '',
  ].join('\n')

  return {
    releaseNotes,
    changelogV1,
    versionDoc,
    gaChecklist,
    systemStatus,
    apiStatus,
    knownLimitations,
    roadmapPostV1,
    versionManifestMarkdown: formatVersionManifest(manifest),
  }
}
