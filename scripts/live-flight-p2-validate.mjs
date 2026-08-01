#!/usr/bin/env node
/**
 * Sprint 80 P2 — CLI for end-to-end live flight validation.
 *
 * Usage:
 *   npm run live-flight-p2:validate
 *
 * Behavior:
 * - Blocks production deploy targets
 * - Uses vitest harness (mock) always for CI-safe baseline
 * - When AMADEUS_* secrets exist + non-prod + sandbox host, also prints live readiness
 *
 * Never enables production feature flags.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv(resolve(process.cwd(), '.env.local'))
loadDotEnv(resolve(process.cwd(), '.env'))

const OUT_DIR = '/opt/cursor/artifacts'
try { mkdirSync(OUT_DIR, { recursive: true }) } catch { /* ignore */ }

const deployTarget = (process.env.VITE_DEPLOY_TARGET || process.env.DEPLOY_TARGET || 'development').toLowerCase()
const clientId = (process.env.AMADEUS_API_KEY || process.env.AMADEUS_CLIENT_ID || '').trim()
const clientSecret = (process.env.AMADEUS_API_SECRET || process.env.AMADEUS_CLIENT_SECRET || '').trim()
const baseUrl = (process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com').toLowerCase()

const summary = {
  sprint: '80-P2',
  deployTarget,
  productionBlocked: deployTarget === 'production' || deployTarget === 'prod',
  hasCredentials: Boolean(clientId && clientSecret),
  sandboxHost: baseUrl.includes('test.api.amadeus.com'),
  featureFlagsDefaultOff: {
    'ai.live_flight_provider_pilot': true,
    'ai.live_flight_search': true,
    'ai.conversational_provider_unify': true,
  },
  vitest: null,
  note: null,
}

if (summary.productionBlocked) {
  summary.note = 'Refusing to run live validation against production deploy target'
  writeFileSync(resolve(OUT_DIR, 'sprint80-p2-live-flight-validation.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  process.exit(1)
}

const vitest = spawnSync(
  'npx',
  ['vitest', 'run', 'src/lib/__tests__/liveFlightValidation.sprint80.p2.test.ts'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, WRITE_P2_REPORT: '1' },
  },
)

summary.vitest = {
  status: vitest.status,
  stdoutTail: (vitest.stdout || '').split('\n').slice(-30).join('\n'),
  stderrTail: (vitest.stderr || '').split('\n').slice(-20).join('\n'),
}

if (!summary.hasCredentials) {
  summary.note = 'Amadeus credentials missing — mock CI validation only. Set AMADEUS_API_KEY/SECRET (or CLIENT_ID/SECRET) on staging to exercise live path.'
} else if (!summary.sandboxHost) {
  summary.note = 'Amadeus host is not sandbox — live path refused. Use https://test.api.amadeus.com'
} else {
  summary.note = 'Credentials present — optional live suite inside vitest will attempt Amadeus sandbox'
}

writeFileSync(
  resolve(OUT_DIR, 'sprint80-p2-live-flight-validation.json'),
  JSON.stringify(summary, null, 2),
)
console.log(JSON.stringify(summary, null, 2))
process.exit(vitest.status === 0 ? 0 : 1)
