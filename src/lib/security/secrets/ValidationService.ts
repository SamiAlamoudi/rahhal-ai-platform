/**
 * Sprint 14 — ValidationService (missing / empty / malformed / whitespace / authz).
 */

import { expandKeyCandidates, getSecretRegistry } from './SecretRegistry'
import type {
  SecretProviderId,
  SecretValidationIssue,
  SecretValidationReport,
} from './types'

const OPENAI_PREFIX = /^sk-/i
const JWT_LIKE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export class ValidationService {
  validateValue(
    key: string,
    value: string | null | undefined,
    format?: string,
  ): SecretValidationIssue[] {
    const issues: SecretValidationIssue[] = []
    if (value == null) {
      issues.push({
        code: 'missing',
        key,
        detail: 'Secret is missing',
        critical: false,
      })
      return issues
    }
    if (!String(value).trim()) {
      issues.push({
        code: 'empty',
        key,
        detail: 'Secret is empty',
        critical: false,
      })
      return issues
    }
    if (String(value) !== String(value).trim() || /\s{2,}/.test(value)) {
      issues.push({
        code: 'unexpected_whitespace',
        key,
        detail: 'Secret has unexpected whitespace',
        critical: false,
      })
    }
    if (format === 'openai_sk' && value.startsWith('sk-') === false && value.length > 0) {
      // Allow placeholders without sk-; only flag clear wrong prefixes like "pk-"
      if (/^(pk-|rk-|ak-)/i.test(value)) {
        issues.push({
          code: 'invalid_prefix',
          key,
          detail: 'Unexpected OpenAI key prefix',
          critical: false,
        })
      }
    }
    if (format === 'openai_sk' && OPENAI_PREFIX.test(value) && value.length < 20) {
      issues.push({
        code: 'malformed',
        key,
        detail: 'OpenAI key appears truncated',
        critical: false,
      })
    }
    if (format === 'url') {
      try {
        // eslint-disable-next-line no-new
        new URL(value)
      } catch {
        issues.push({
          code: 'malformed',
          key,
          detail: 'Expected URL',
          critical: false,
        })
      }
    }
    if (format === 'jwt_like' && value.length > 20 && !JWT_LIKE.test(value) && !value.includes('placeholder')) {
      // Soft — anon keys are JWTs; placeholders in examples may not be
      if (value.startsWith('eyJ') && value.split('.').length !== 3) {
        issues.push({
          code: 'malformed',
          key,
          detail: 'JWT-like value malformed',
          critical: false,
        })
      }
    }
    return issues
  }

  validateProvider(
    providerId: SecretProviderId,
    resolve: (key: string) => string | null,
  ): SecretValidationReport {
    const reg = getSecretRegistry().get(providerId)
    const issues: SecretValidationIssue[] = []
    if (!reg) {
      return {
        ok: false,
        issues: [{
          code: 'missing',
          key: providerId,
          providerId,
          detail: 'Unknown provider',
          critical: false,
        }],
        criticalFailures: [],
        optionalDisabled: [providerId],
      }
    }

    for (const def of reg.required) {
      const value = firstResolved(def, resolve)
      const local = this.validateValue(def.key, value, def.format)
      for (const issue of local) {
        issues.push({
          ...issue,
          providerId,
          critical: def.criticality === 'critical',
        })
      }
    }
    for (const def of reg.optional ?? []) {
      const value = firstResolved(def, resolve)
      if (value == null) continue
      const local = this.validateValue(def.key, value, def.format)
      for (const issue of local) {
        issues.push({ ...issue, providerId, critical: false })
      }
    }

    const criticalFailures = issues.filter((i) => i.critical)
    const optionalDisabled =
      reg.required.every((d) => d.criticality === 'optional')
      && reg.required.some((d) => !firstResolved(d, resolve))
        ? [providerId]
        : []

    return {
      ok: criticalFailures.length === 0,
      issues,
      criticalFailures,
      optionalDisabled,
    }
  }

  validateStartup(input: {
    resolve: (key: string) => string | null
    production: boolean
  }): SecretValidationReport {
    const allIssues: SecretValidationIssue[] = []
    const optionalDisabled: SecretProviderId[] = []
    for (const reg of getSecretRegistry().list()) {
      const report = this.validateProvider(reg.providerId, input.resolve)
      allIssues.push(...report.issues)
      optionalDisabled.push(...report.optionalDisabled)
    }
    const criticalFailures = allIssues.filter((i) => i.critical)
    // In production, critical missing secrets fail startup
    const ok = input.production ? criticalFailures.length === 0 : true
    return {
      ok,
      issues: allIssues,
      criticalFailures,
      optionalDisabled: [...new Set(optionalDisabled)],
    }
  }
}

function firstResolved(
  def: { key: string; aliases?: string[] | undefined; scope?: string; criticality?: string },
  resolve: (key: string) => string | null,
): string | null {
  for (const key of expandKeyCandidates(def as Parameters<typeof expandKeyCandidates>[0])) {
    const v = resolve(key)
    if (v) return v
  }
  return null
}

export function createValidationService(): ValidationService {
  return new ValidationService()
}
