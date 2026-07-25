#!/usr/bin/env node
/**
 * Fails when provider modules read process.env / import.meta.env directly,
 * or when secret-like keys are read outside the SecretManager boundary.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const PROVIDER_DIRS = [
  'src/lib/aggregation/providers',
  'src/lib/agent/aggregation/providers',
  'src/lib/liveProviders',
  'src/lib/agent/liveProviders',
  'src/lib/llm',
  'src/lib/agent/llm',
  'src/lib/payment',
  'src/lib/notifications',
]

const ALLOW_PATH_FRAGMENTS = [
  'src/lib/security/secrets/EnvironmentSecretProvider.ts',
  'src/lib/security/secrets/managedAccess.ts',
  'src/lib/security/secrets/startup.ts',
  'src/lib/security/secrets/envBag.ts',
  // Node/Vite middleware bridge (tsconfig.node) — not SPA providers
  'src/lib/viteNodeEnv.ts',
  'src/lib/viteAmadeusApiPlugin.ts',
  'src/lib/viteOpenAiRealtimeApiPlugin.ts',
  'src/lib/__tests__/',
  'scripts/',
]

const SECRET_KEY_RE =
  /\b(?:API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|AUTH[_-]?TOKEN|BEARER)\b/i

const ENV_ACCESS_RE = /(?:process\.env|import\.meta\.env)(?:\.[A-Za-z0-9_]+|\[[^\]]+\])?/g

function walk(dir, out = []) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name)) out.push(p)
  }
  return out
}

function isAllowed(rel) {
  return ALLOW_PATH_FRAGMENTS.some((f) => rel.includes(f))
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const failures = []

for (const dir of PROVIDER_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    if (isAllowed(rel)) continue
    const text = stripComments(readFileSync(file, 'utf8'))
    const matches = text.match(ENV_ACCESS_RE)
    if (matches?.length) {
      failures.push({ rel, reason: 'provider_direct_env', matches: [...new Set(matches)] })
    }
  }
}

// Secret-like key access anywhere outside allowlist (code only, not comments)
for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  if (isAllowed(rel)) continue
  if (rel.includes('/security/secrets/')) continue
  const text = stripComments(readFileSync(file, 'utf8'))
  for (const line of text.split('\n')) {
    if (!/(?:process\.env|import\.meta\.env)/.test(line)) continue
    if (SECRET_KEY_RE.test(line) && /(?:process\.env|import\.meta\.env)/.test(line)) {
      failures.push({ rel, reason: 'secret_like_direct_env', line: line.trim().slice(0, 160) })
    }
  }
}

if (failures.length) {
  console.error(`Direct env access violations: ${failures.length}`)
  for (const f of failures.slice(0, 40)) {
    console.error(` - [${f.reason}] ${f.rel}${f.matches ? ` :: ${f.matches.join(', ')}` : ''}${f.line ? ` :: ${f.line}` : ''}`)
  }
  process.exit(1)
}

console.log('Direct env access check passed (providers + secret-like keys).')
