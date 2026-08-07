#!/usr/bin/env node
/**
 * Bilamo Brand Separation — branding inventory + CI guardrail.
 *
 * Scans active runtime paths for legacy Rahhal / Arabic brand tokens and
 * brand-coupled domain identifiers. Failures:
 *  - Active user-facing hits (never allowlisted)
 *  - Hits not covered by scripts/branding-allowlist.json
 *  - New Bilamo* domain-model identifiers outside product presentation paths
 *
 * Usage:
 *   node scripts/branding-inventory.mjs
 *   node scripts/branding-inventory.mjs --json
 *   node scripts/branding-inventory.mjs --write-allowlist   # regenerate allowlist (reviewed commits only)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const ALLOWLIST_PATH = join(ROOT, 'scripts', 'branding-allowlist.json')
const WRITE_ALLOWLIST = process.argv.includes('--write-allowlist')
const AS_JSON = process.argv.includes('--json')

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
])

/** Active paths that must remain Bilamo-clean for user-facing surfaces. */
const SCAN_ROOTS = ['src', 'api', 'e2e', 'public', 'vite.config.ts', 'index.html']

const FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|html|md)$/i

const LEGACY_LINE_RE = /رحّال|رحال|\bRahhal\b|\brahhal\b|\brahal\b|\bRAHHAL\b|\bRahal\b/i

const TOKEN_RE =
  /ai\.rahhal_[a-z0-9_]+|--rahhal-[a-z0-9-]+|x-rahhal-[a-z0-9-]+|X-Rahhal-[A-Za-z0-9-]+|rahhal:\/\/[^\s'"`]+|https?:\/\/[^\s'"`]*rahhal[^\s'"`]*|[A-Za-z0-9_.+-]+@rahhal\.[A-Za-z0-9.]+|RAHHAL_[A-Z0-9_]+|Rahhal[A-Za-z0-9_]*|rahhal[A-Za-z0-9_./:-]*|رحّال|رحال|\brahal\b|\bRahal\b/gi

/** Brand-coupled domain model names that should use stable domain vocabulary. */
const FORBIDDEN_BILAMO_DOMAIN_RE =
  /\bBilamo(Order|Revenue|FlightOffer|HotelOffer|Brain|BookingService|BookingOrder)\b/g

const PRODUCT_PRESENTATION_RE =
  /(^|\/)(design-system|pages\/Bilamo|lib\/bilamo|ui\/|components\/premium|components\/productUx|components\/home)(\/|$)/i

function walkFile(abs, out) {
  const rel = relative(ROOT, abs).split(sep).join('/')
  if (SKIP_DIRS.has(rel.split('/')[0])) return
  const st = statSync(abs)
  if (st.isDirectory()) {
    for (const name of readdirSync(abs)) {
      if (SKIP_DIRS.has(name)) continue
      walkFile(join(abs, name), out)
    }
    return
  }
  if (!FILE_RE.test(abs) && !abs.endsWith('vite.config.ts') && !abs.endsWith('index.html')) return
  out.push(rel)
}

function listScanFiles() {
  const out = []
  for (const root of SCAN_ROOTS) {
    const abs = join(ROOT, root)
    if (!existsSync(abs)) continue
    const st = statSync(abs)
    if (st.isFile()) out.push(root)
    else walkFile(abs, out)
  }
  return out.sort()
}

function classify(rel, line, token) {
  const t = token
  const tl = t.toLowerCase()
  const ll = line.toLowerCase()
  const inTest = /\/__tests__\/|\.test\.(ts|tsx)$|\/e2e\//.test(rel)
  const inMigration = rel.startsWith('supabase/migrations/')
  const inPagesOrComponents =
    rel.startsWith('src/pages/') ||
    rel.startsWith('src/components/') ||
    rel.startsWith('src/ui/') ||
    rel.startsWith('src/design-system/') ||
    rel === 'index.html' ||
    rel.startsWith('public/')

  if (inMigration) {
    return { classification: 'Applied migration', reason: 'Applied SQL migration artifact' }
  }

  if (/رحّال|رحال/.test(t)) {
    if (inPagesOrComponents || rel.startsWith('e2e/') || rel.startsWith('api/openai/')) {
      return { classification: 'Active user-facing', reason: 'Arabic legacy brand in active surface' }
    }
    return { classification: 'Historical archive', reason: 'Arabic brand in non-UI documentation' }
  }

  if (
    tl.startsWith('ai.rahhal_') ||
    tl.startsWith('--rahhal-') ||
    /x-rahhal-|x-rahhal/.test(tl) ||
    tl.startsWith('rahhal.') ||
    tl.startsWith('rahhal_') ||
    tl.startsWith('rahhal://') ||
    /rahhal-ticket-v1|rahhal-bp-v1|rahhal-docs-/.test(tl) ||
    /rahhal-ai-platform|rahhal\.app/.test(tl) ||
    /@rahhal\./.test(tl) ||
    tl === 'rahhal:demo-auth' ||
    /data-rahhal-/.test(tl) ||
    /source=rahhal|source', 'rahhal'|source", "rahhal"/.test(ll) ||
    tl === 'rahhal_brain'
  ) {
    return {
      classification: 'Compatibility',
      reason: 'Persisted key, wire contract, format id, or deploy allow-list',
    }
  }

  if (/rahhal-ai-platform|vercel\.app/.test(tl) || rel.startsWith('api/_lib/edgeGuard')) {
    return { classification: 'Infrastructure', reason: 'Deploy / CORS / hosting identity' }
  }

  if (
    /name:\s*['"]platform-/.test(ll) ||
    /\[platform\]|\[conversation\]|\[agent-runtime\]/.test(ll)
  ) {
    return { classification: 'Internal technical', reason: 'Already neutralized internal token' }
  }

  if (/^Rahhal[A-Z]/.test(t) || /^RAHHAL_/.test(t) || /^rahhal[A-Z_]/.test(t)) {
    return {
      classification: 'Internal technical',
      reason: inTest
        ? 'Test / exported symbol still using legacy type name'
        : 'Exported or internal TypeScript symbol pending domain rename',
    }
  }

  if (/\(rahhal\|bilamo\)|rahhal \)?points|rahhal generate/.test(ll)) {
    return {
      classification: 'Compatibility',
      reason: 'NLU back-compat utterance pattern',
    }
  }

  if (inTest) {
    return { classification: 'Internal technical', reason: 'Test fixture or historical test title' }
  }

  if (inPagesOrComponents && /\bRahhal\b/.test(t) && /['"`]/.test(line)) {
    return { classification: 'Active user-facing', reason: 'Possible user-visible string' }
  }

  if (/\.md$/i.test(rel)) {
    return { classification: 'Historical archive', reason: 'In-tree markdown near runtime code' }
  }

  return { classification: 'Internal technical', reason: 'Legacy identifier in active codebase' }
}

function extractTokens(line) {
  const tokens = new Set()
  for (const m of line.matchAll(TOKEN_RE)) tokens.add(m[0])
  if (tokens.size === 0 && LEGACY_LINE_RE.test(line)) tokens.add('Rahhal')
  return [...tokens]
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { version: 1, entries: [] }
  return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
}

function allowlistMatches(entries, hit) {
  return entries.find(
    (e) =>
      e.path === hit.file &&
      (hit.token === e.token || hit.lineText.includes(e.token) || hit.token.includes(e.token)),
  )
}

function scan() {
  const hits = []
  const bilamoDomainHits = []

  const SKIP_SCAN = new Set([
    'scripts/branding-allowlist.json',
    'scripts/branding-inventory.mjs',
    'src/lib/__tests__/brandingInventory.guardrail.test.ts',
  ])

  for (const rel of listScanFiles()) {
    if (SKIP_SCAN.has(rel)) continue
    let text
    try {
      text = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (LEGACY_LINE_RE.test(line)) {
        for (const token of extractTokens(line)) {
          const { classification, reason } = classify(rel, line, token)
          hits.push({
            file: rel,
            line: i + 1,
            token,
            classification,
            reason,
            lineText: line.trim().slice(0, 200),
          })
        }
      }
      if (!PRODUCT_PRESENTATION_RE.test(rel)) {
        for (const m of line.matchAll(FORBIDDEN_BILAMO_DOMAIN_RE)) {
          bilamoDomainHits.push({
            file: rel,
            line: i + 1,
            token: m[0],
            classification: 'Active user-facing',
            reason:
              'Brand-coupled domain identifier — use stable domain name (see DOMAIN_NAMING_POLICY.md)',
            lineText: line.trim().slice(0, 200),
          })
        }
      }
    }
  }
  return { hits, bilamoDomainHits }
}

function main() {
  const { hits, bilamoDomainHits } = scan()

  if (WRITE_ALLOWLIST) {
    const entries = []
    const seen = new Set()
    for (const h of hits) {
      if (h.classification === 'Active user-facing') continue
      const key = `${h.file}::${h.token}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({
        path: h.file,
        token: h.token,
        classification: h.classification,
        reason: h.reason,
      })
    }
    entries.sort((a, b) => a.path.localeCompare(b.path) || a.token.localeCompare(b.token))
    const payload = {
      version: 1,
      description:
        'Reviewed allowlist for legacy Rahhal technical tokens. Do not add Active user-facing entries. Prefer domain renames over expanding this list.',
      entries,
    }
    writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${entries.length} allowlist entries → scripts/branding-allowlist.json`)
    process.exit(0)
  }

  const allowlist = loadAllowlist()
  const failures = []
  const allowed = []

  for (const h of hits) {
    if (h.classification === 'Active user-facing') {
      failures.push({ ...h, failure: 'active_user_facing' })
      continue
    }
    const match = allowlistMatches(allowlist.entries || [], h)
    if (!match) {
      failures.push({
        ...h,
        failure: 'unapproved_legacy',
        reason: `${h.reason} (not in branding-allowlist.json)`,
      })
    } else {
      allowed.push({
        ...h,
        classification: match.classification || h.classification,
        reason: match.reason || h.reason,
      })
    }
  }

  for (const h of bilamoDomainHits) {
    failures.push({ ...h, failure: 'brand_coupled_domain' })
  }

  const byClass = {}
  for (const h of [...allowed, ...failures]) {
    byClass[h.classification] = (byClass[h.classification] || 0) + 1
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ allowed, failures, byClass, totals: { allowed: allowed.length, failures: failures.length } }, null, 2))
  } else {
    console.log('Bilamo branding inventory\n')
    console.log(`Allowed: ${allowed.length}    Failures: ${failures.length}\n`)
    console.log('By classification:')
    for (const [k, v] of Object.entries(byClass).sort()) console.log(`  ${k}: ${v}`)
    console.log('')
    if (allowed.length) {
      console.log('--- Allowed (sample up to 40) ---')
      for (const h of allowed.slice(0, 40)) {
        console.log(
          `${h.file}:${h.line}  token=${JSON.stringify(h.token)}  class=${h.classification}  reason=${h.reason}`,
        )
      }
      if (allowed.length > 40) console.log(`… +${allowed.length - 40} more allowed`)
      console.log('')
    }
    if (failures.length) {
      console.log('--- FAILURES ---')
      for (const h of failures) {
        console.log(
          `${h.file}:${h.line}  token=${JSON.stringify(h.token)}  class=${h.classification}  failure=${h.failure}`,
        )
        console.log(`  reason: ${h.reason}`)
        console.log(`  line: ${h.lineText}`)
      }
    } else {
      console.log('No unauthorized legacy or brand-coupled domain hits.')
    }
  }

  process.exit(failures.length ? 1 : 0)
}

main()
