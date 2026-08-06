/**
 * Sprint 70 — Version manifest for Rahhal GA 1.0.0.
 */

import { PLATFORM_PACKAGE_VERSION } from '../production/report'
import { RAHHAL_GA_VERSION, type VersionManifest } from './types'

function readCommitHint(): string {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    return env?.GITHUB_SHA?.slice(0, 12)
      || env?.COMMIT_SHA?.slice(0, 12)
      || env?.VITE_GIT_SHA?.slice(0, 12)
      || 'local'
  } catch {
    return 'local'
  }
}

function readBuildNumber(): string {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    return env?.GITHUB_RUN_NUMBER
      || env?.BUILD_NUMBER
      || `ga-${Date.now().toString(36)}`
  } catch {
    return `ga-${Date.now().toString(36)}`
  }
}

export function buildVersionManifest(input?: {
  packageVersion?: string
  commit?: string
  buildNumber?: string
  now?: () => number
}): VersionManifest {
  const now = input?.now ?? (() => Date.now())
  return {
    rahhalVersion: RAHHAL_GA_VERSION,
    packageVersion: input?.packageVersion ?? PLATFORM_PACKAGE_VERSION,
    releaseType: 'GA',
    buildNumber: input?.buildNumber ?? readBuildNumber(),
    commit: input?.commit ?? readCommitHint(),
    timestamp: new Date(now()).toISOString(),
    sprint: 70,
    codename: 'General Availability',
  }
}

export function formatVersionManifest(manifest: VersionManifest): string {
  return [
    '# Bilamo Version Manifest',
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| Bilamo Version | ${manifest.rahhalVersion} |`,
    `| Package Version | ${manifest.packageVersion} |`,
    `| Release Type | ${manifest.releaseType} |`,
    `| Build Number | ${manifest.buildNumber} |`,
    `| Commit | ${manifest.commit} |`,
    `| Timestamp | ${manifest.timestamp} |`,
    `| Sprint | ${manifest.sprint} |`,
    `| Codename | ${manifest.codename} |`,
    '',
  ].join('\n')
}
