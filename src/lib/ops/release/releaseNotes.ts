/**
 * Sprint 70 — GA release notes generator (library string; docs also written to repo).
 */

import { RAHHAL_GA_VERSION } from './types'
import { PLATFORM_PACKAGE_VERSION } from '../production/report'
import type { VersionManifest } from './types'

export function generateGAReleaseNotes(manifest: VersionManifest): string {
  return [
    `# Bilamo ${RAHHAL_GA_VERSION} — General Availability`,
    '',
    `**Release type:** ${manifest.releaseType}`,
    `**Package version:** ${manifest.packageVersion || PLATFORM_PACKAGE_VERSION}`,
    `**Build:** ${manifest.buildNumber}`,
    `**Commit:** ${manifest.commit}`,
    `**Timestamp:** ${manifest.timestamp}`,
    '',
    '## Highlights',
    '',
    '- Production hardening (Sprint 65)',
    '- End-to-end production validation (Sprint 66)',
    '- Beta launch environment & live provider activation (Sprint 67)',
    '- Production deployment & launch automation (Sprint 68)',
    '- Real beta operations & production monitoring (Sprint 69)',
    '- GA release manager & version manifest (Sprint 70)',
    '',
    '## Safe defaults',
    '',
    '- Mock payments (`VITE_PAYMENT_PROVIDER=mock`)',
    '- Live providers OFF unless Edge secrets + feature flags',
    '- No architecture or business-engine rewrites in GA packaging',
    '',
    '## Upgrade',
    '',
    'None. Additive ops/release layer only.',
    '',
  ].join('\n')
}
