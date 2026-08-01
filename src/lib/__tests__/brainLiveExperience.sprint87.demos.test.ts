/**
 * Sprint 87 — writes demo transcripts artifact used in the PR.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { createConversationManager } from '../brain/v1'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('Sprint 87 — demo transcripts artifact', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('writes docs/SPRINT87_DEMO_TRANSCRIPTS.md', () => {
    const manager = createConversationManager()
    const turn = (text: string, prior?: Parameters<typeof manager.turn>[0]['priorSession']) =>
      manager.turn({ text, locale: 'en', priorSession: prior ?? null }, { enabled: true })

    const scenarios: Array<{ name: string; lines: string[] }> = []

    const push = (name: string, turns: Array<ReturnType<typeof turn> & { user: string }>) => {
      const lines: string[] = [`## ${name}`, '']
      turns.forEach((t, i) => {
        lines.push(`### Turn ${i + 1}`, '')
        lines.push(`**User:** ${t.user}`, '')
        lines.push(`**Assistant:** ${t.response?.en ?? ''}`, '')
        lines.push(`- Destination: \`${t.knownSlots?.destination ?? '—'}\``)
        lines.push(`- Provided value: \`${t.response?.providedValue}\``)
        lines.push(`- Question count: \`${t.response?.questionCount}\``)
        lines.push(`- Question slot: \`${t.question?.slot ?? 'none'}\``)
        if (t.knownSlots?.specialRequests) {
          lines.push(`- Special: \`${t.knownSlots.specialRequests}\``)
        }
        if (t.revisedSlots.length) {
          lines.push(`- Revised slots: \`${t.revisedSlots.join(', ')}\``)
        }
        lines.push('')
      })
      scenarios.push({ name, lines })
    }

    {
      const r = turn('I want to travel to Morocco.')
      push('Scenario 1 — Morocco (Value First)', [{ ...r, user: 'I want to travel to Morocco.' }])
      expect(r.response?.providedValue).toBe(true)
    }
    {
      const r = turn('Japan')
      push('Scenario 2 — Japan', [{ ...r, user: 'Japan' }])
    }
    {
      const r = turn('Business trip London')
      push('Scenario 3 — Business trip London', [{ ...r, user: 'Business trip London' }])
    }
    {
      const r = turn('Weekend Dubai')
      push('Scenario 4 — Weekend Dubai', [{ ...r, user: 'Weekend Dubai' }])
    }
    {
      const r = turn('Family Switzerland')
      push('Scenario 5 — Family Switzerland', [{ ...r, user: 'Family Switzerland' }])
    }
    {
      const a = turn('I want to travel to Morocco.')
      const b = turn('Actually make it Agadir', a.session)
      push('Incremental — Morocco → Agadir', [
        { ...a, user: 'I want to travel to Morocco.' },
        { ...b, user: 'Actually make it Agadir' },
      ])
      expect(b.knownSlots?.destination).toBe('Agadir')
      expect(b.session?.plan?.planId).toBe(a.session?.plan?.planId)
    }

    const md = [
      '# Sprint 87 — Demo Conversation Transcripts',
      '',
      'Generated from Conversation Manager (Brain preview path; foundation flag exercised via enabled override).',
      '',
      'Each scenario demonstrates **Value First**, memory, and ≤1 question.',
      '',
      ...scenarios.flatMap((s) => s.lines),
    ].join('\n')

    const out = resolve(root, 'docs/SPRINT87_DEMO_TRANSCRIPTS.md')
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, md, 'utf8')

    const snapDir = resolve('/opt/cursor/artifacts/sprint87-demos')
    mkdirSync(snapDir, { recursive: true })
    writeFileSync(resolve(snapDir, 'transcripts.md'), md, 'utf8')
    for (const s of scenarios) {
      const file = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      writeFileSync(resolve(snapDir, `${file}.txt`), s.lines.join('\n'), 'utf8')
    }

    expect(md).toMatch(/Scenario 1 — Morocco/)
    expect(md).toMatch(/Actually make it Agadir/)
    expect(md).not.toMatch(/I updated only the affected parts\. Marrakech is lively/)
  })
})
