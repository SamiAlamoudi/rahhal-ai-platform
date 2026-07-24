/**
 * Evolution Sprint 5 — DestinationAffinity
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

const DEST_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /istanbul|إسطنبول|اسطنبول/i, name: 'Istanbul' },
  { re: /dubai|دبي/i, name: 'Dubai' },
  { re: /baku|باكو/i, name: 'Baku' },
  { re: /maldives|المالديف/i, name: 'Maldives' },
  { re: /cairo|القاهرة/i, name: 'Cairo' },
  { re: /paris|باريس/i, name: 'Paris' },
  { re: /london|لندن/i, name: 'London' },
  { re: /bali|بالي/i, name: 'Bali' },
  { re: /georgia|جورجيا/i, name: 'Georgia' },
]

export function analyzeDestinationAffinity(ctx: AnalyzerContext): PreferenceSignal[] {
  const out: PreferenceSignal[] = []
  for (const row of DEST_PATTERNS) {
    if (row.re.test(ctx.text)) {
      out.push(
        signal(
          ctx,
          'destination_affinity',
          row.name,
          0.6,
          0.8,
          `Named destination affinity: ${row.name}`,
        ),
      )
      break
    }
  }
  if (testAny(ctx.text, [/somewhere new|وجهة جديدة|open to destinations|مو محددة|any destination/i])) {
    out.push(
      signal(ctx, 'destination_affinity', 'open', 0.1, 0.65, 'Open destination affinity'),
    )
  }
  return out
}

export const DestinationAffinity = { analyze: analyzeDestinationAffinity }
