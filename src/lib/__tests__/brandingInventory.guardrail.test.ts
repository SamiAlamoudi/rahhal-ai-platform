/**
 * Brand Separation foundation — inventory guardrail + Bilamo active-brand checks.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { brand } from '../../design-system/tokens'

const ROOT = process.cwd()

describe('Brand Separation — branding inventory guardrail', () => {
  it('branding-allowlist.json is present and well-formed', () => {
    const path = join(ROOT, 'scripts/branding-allowlist.json')
    expect(existsSync(path)).toBe(true)
    const data = JSON.parse(readFileSync(path, 'utf8')) as {
      version: number
      entries: Array<{ path: string; token: string; classification: string; reason: string }>
    }
    expect(data.version).toBe(1)
    expect(Array.isArray(data.entries)).toBe(true)
    expect(data.entries.length).toBeGreaterThan(0)
    for (const e of data.entries) {
      expect(e.path).toBeTruthy()
      expect(e.token).toBeTruthy()
      expect(e.classification).toBeTruthy()
      expect(e.reason).toBeTruthy()
      expect(e.classification).not.toBe('Active user-facing')
    }
  })

  it('domain naming policy and migration roadmap exist', () => {
    expect(existsSync(join(ROOT, 'docs/DOMAIN_NAMING_POLICY.md'))).toBe(true)
    expect(existsSync(join(ROOT, 'docs/BRAND_SEPARATION_MIGRATION_ROADMAP.md'))).toBe(true)
    const policy = readFileSync(join(ROOT, 'docs/DOMAIN_NAMING_POLICY.md'), 'utf8')
    expect(policy).toMatch(/Bilamo is a product brand/i)
    expect(policy).toMatch(/ConversationEngine/)
    expect(policy).toMatch(/BookingOrder/)
    expect(policy).toMatch(/Do \*\*not\*\* introduce/)
    expect(policy).toMatch(/BilamoOrder/)
  })

  it('branding inventory script passes on allowlisted tree', () => {
    const result = spawnSync(process.execPath, ['scripts/branding-inventory.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(/No unauthorized legacy/)
  })

  it('fails when an unapproved legacy token is introduced (temp probe)', () => {
    const probe = join(ROOT, 'src/lib/__tests__/_brandingProbe.tmp.ts')
    try {
      writeFileSync(probe, "// probe\nexport const BAD = 'visible Rahhal brand'\n", 'utf8')
      const result = spawnSync(process.execPath, ['scripts/branding-inventory.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
      })
      expect(result.status).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/unapproved_legacy|FAILURES|_brandingProbe/)
    } finally {
      try {
        unlinkSync(probe)
      } catch {
        /* ignore */
      }
    }
  })

  it('product brand token is Bilamo', () => {
    expect(brand.name).toBe('Bilamo')
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).toMatch(/<title>Bilamo<\/title>/)
    expect(html).not.toMatch(/رحّال|Rahhal/)
  })

  it('login / e2e booking funnel expect Bilamo, not Rahhal', () => {
    const e2e = readFileSync(join(ROOT, 'e2e/booking-funnel.spec.ts'), 'utf8')
    expect(e2e).toMatch(/heading.*Bilamo/)
    expect(e2e).toMatch(/pay-bilamo/)
    expect(e2e).toMatch(/login-demo/)
    expect(e2e).not.toMatch(/رحّال|pay-rahhal/)

    const auth = readFileSync(join(ROOT, 'src/pages/BilamoAuth.tsx'), 'utf8')
    expect(auth).toMatch(/login-demo/)
    expect(auth).toMatch(/Logo as="h1"/)
    expect(auth).not.toMatch(/رحّال|\bRahhal\b/)
  })

  it('active pages/components have no Rahhal user-facing brand strings', () => {
    const roots = ['src/pages', 'src/components', 'src/ui', 'src/design-system']
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(tsx|ts)$/.test(name)) {
          const text = readFileSync(p, 'utf8')
          if (/رحّال|رحال/.test(text)) hits.push(p)
          for (const m of text.matchAll(/(['"`])([^'"`]*\bRahhal\b[^'"`]*)\1/g)) {
            hits.push(`${p}: ${m[2]}`)
          }
        }
      }
    }
    for (const r of roots) walk(join(ROOT, r))
    expect(hits).toEqual([])
  })

  it('documents recommended domain vocabulary examples', () => {
    const policy = readFileSync(join(ROOT, 'docs/DOMAIN_NAMING_POLICY.md'), 'utf8')
    for (const name of [
      'ReasoningEngine',
      'AgentRuntime',
      'FlightOffer',
      'BookingOrder',
      'SearchOrchestrator',
      'PlatformRevenue',
    ]) {
      expect(policy).toContain(name)
    }
  })
})
