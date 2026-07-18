import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { verifyPreviewEnvironment } from '../ops/preview/previewEnvCheck'

function parseEnvExample(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    out[key] = value
  }
  return out
}

describe('preview:verify CLI contract', () => {
  it('passes against .env.preview.example defaults', () => {
    const raw = readFileSync(resolve(process.cwd(), '.env.preview.example'), 'utf8')
    const env = parseEnvExample(raw)
    const result = verifyPreviewEnvironment({ env })
    expect(result.ok, result.report).toBe(true)
    expect(result.resolved.paymentProvider).toBe('mock')
    expect(result.resolved.liveProvidersEnabled).toBe(false)
  })
})
