/**
 * Recovery Phase 2 — reply presentation helpers (UI only).
 * Summary first; long bodies expand on demand.
 */

export const DETAILS_MARKER = '\n\n<!--RAHHAL_DETAILS-->\n\n'

export interface SplitConsultantReply {
  summary: string
  details: string | null
}

/** Split a reply into a short consultant summary + optional expandable details. */
export function splitConsultantReply(
  content: string,
  options?: { maxSummaryLines?: number; maxSummaryChars?: number },
): SplitConsultantReply {
  const raw = content.trim()
  if (!raw) return { summary: '', details: null }

  const marked = raw.split(/<!--\s*RAHHAL_DETAILS\s*-->/i)
  if (marked.length >= 2) {
    const summary = marked[0]!.trim()
    const details = marked.slice(1).join('\n\n').trim()
    return { summary, details: details || null }
  }

  const maxLines = options?.maxSummaryLines ?? 5
  const maxChars = options?.maxSummaryChars ?? 420
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)

  // Short enough already.
  if (lines.length <= maxLines && raw.length <= maxChars) {
    return { summary: raw, details: null }
  }

  const summaryLines: string[] = []
  let chars = 0
  for (const line of lines) {
    if (summaryLines.length >= maxLines) break
    if (chars + line.length > maxChars && summaryLines.length > 0) break
    // Prefer stopping before heavy markdown sections.
    if (summaryLines.length > 0 && /^#{1,3}\s|^\*\*|Daily itinerary|برنامج الأيام|Budget breakdown|تفصيل الميزانية/i.test(line)) {
      break
    }
    summaryLines.push(line)
    chars += line.length + 1
  }

  if (summaryLines.length === 0) {
    summaryLines.push(lines[0]!.slice(0, maxChars))
  }

  const summary = summaryLines.join('\n\n')
  const remainder = raw.slice(findRemainderStart(raw, summaryLines)).trim()
  if (!remainder || remainder === summary) return { summary: raw, details: null }
  return { summary, details: remainder }
}

function findRemainderStart(raw: string, summaryLines: string[]): number {
  let idx = 0
  for (const line of summaryLines) {
    const at = raw.indexOf(line, idx)
    if (at < 0) return raw.length
    idx = at + line.length
  }
  return idx
}

/** Progressive card kinds order for a living conversation reveal. */
export type ProgressiveCardKind = 'flight' | 'hotel' | 'activity' | 'budget'

export const PROGRESSIVE_CARD_ORDER: ProgressiveCardKind[] = [
  'flight',
  'hotel',
  'activity',
  'budget',
]
