/**
 * Sprint 70 — GA release contracts.
 */

export type GAReleaseType = 'GA' | 'RC' | 'beta' | 'patch'

export type GACheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

export interface GACheckResult {
  id: string
  area: string
  status: GACheckStatus
  summary: string
}

export interface VersionManifest {
  rahhalVersion: string
  packageVersion: string
  releaseType: GAReleaseType
  buildNumber: string
  commit: string
  timestamp: string
  sprint: number
  codename: string
}

export interface CompatibilityReport {
  ok: boolean
  packageAligned: boolean
  opsModulesPresent: string[]
  missingModules: string[]
  notes: string[]
  generatedAt: string
}

export interface GAIntegrityReport {
  ok: boolean
  checks: GACheckResult[]
  generatedAt: string
}

export interface GAScorecard {
  overall: number
  production: number
  security: number
  reliability: number
  availability: number
  performance: number
  maintainability: number
  documentation: number
  coverage: number
  recovery: number
  providerReadiness: number
  paymentReadiness: number
  notificationReadiness: number
}

export interface GAReadinessReport {
  ok: boolean
  gaReady: boolean
  version: string
  scores: GAScorecard
  checks: GACheckResult[]
  manifest: VersionManifest
  compatibility: CompatibilityReport
  integrity: GAIntegrityReport
  artifacts: Record<string, string>
  checklist: Array<{ id: string; label: string; done: boolean }>
  recommendation: string
  generatedAt: string
}

export const RAHHAL_GA_VERSION = '1.0.0'
export const SPRINT70_GA_VERSION = '1.0.0-ga'
