#!/usr/bin/env node
/**
 * Sprint 14 — repository secret scanner.
 * Fails CI when probable real secrets are detected (placeholders allowed).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const ALLOW_PLACEHOLDER =
  /example|placeholder|changeme|your[_-]?|xxx+|dummy|fake|test[_-]?key|not[_-]?a[_-]?secret|sk-live-should-not-leak|bridged-token|amadeus-key|sample_secret|eyJhbGciOiJub25lIn0|old-secret|new-secret|ek_test_secret|hunter2|sk-abcdefghijklmnopqrstuvwxyz|sk-test-openai/i

const PATTERNS = [
  { name: 'openai_sk', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'bearer_token', re: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/gi },
  { name: 'private_key', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'aws_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: 'password_assign', re: /\b(password|passwd|client_secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
]

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
])

const SKIP_FILES = new Set([
  'security-secret-scan.mjs',
  'secret-hygiene-scan.sh',
  'check-direct-env-access.mjs',
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|md|env|yml|yaml|toml|html|css)$/i.test(name)
      || name.startsWith('.env')) {
      if (!SKIP_FILES.has(name)) out.push(p)
    }
  }
  return out
}

const findings = []
for (const file of walk(ROOT)) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  // Skip explicit example env templates with empty/placeholder assignments
  const rel = relative(ROOT, file)
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const match = m[0]
      if (ALLOW_PLACEHOLDER.test(match) || ALLOW_PLACEHOLDER.test(rel)) continue
      // Allow supabase anon-style placeholders in docs/tests
      if (name === 'jwt' && /eyJhbGciOiJub25lIn0/.test(match)) continue
      findings.push({ file: rel, name, sample: match.slice(0, 48) })
    }
  }
}

if (findings.length) {
  console.error('Probable secrets detected:')
  for (const f of findings.slice(0, 50)) {
    console.error(`  [${f.name}] ${f.file}: ${f.sample}`)
  }
  process.exit(1)
}

console.log('Security secret scan passed (no probable real secrets).')
