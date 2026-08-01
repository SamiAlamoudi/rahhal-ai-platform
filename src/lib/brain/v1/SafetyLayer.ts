/**
 * Sprint 81 — SafetyLayer (Brain v1).
 * Blocks unsafe / disallowed consultant outputs (foundation checks).
 */

export type BrainV1SafetyResult = {
  safe: boolean
  notes: string[]
  redactedText?: string
}

const BLOCKED = [
  /ignore (all|previous) instructions/i,
  /system prompt/i,
  /api[_-]?key/i,
  /password\s*[:=]/i,
  /sk-[a-z0-9]{10,}/i,
]

export class SafetyLayer {
  inspect(text: string): BrainV1SafetyResult {
    const notes: string[] = []
    let safe = true
    let redacted = text

    for (const pattern of BLOCKED) {
      if (pattern.test(text)) {
        safe = false
        notes.push(`Blocked pattern: ${pattern.source}`)
        redacted = redacted.replace(pattern, '[redacted]')
      }
    }

    if (/https?:\/\/(?!.*rahhal)/i.test(text) && /booking\.com|expedia/i.test(text)) {
      notes.push('External booking deep-link detected — keep consultant-owned CTA')
    }

    return { safe, notes, redactedText: redacted }
  }

  guardResponse(ar: string, en: string): BrainV1SafetyResult & { ar: string; en: string } {
    const a = this.inspect(ar)
    const e = this.inspect(en)
    return {
      safe: a.safe && e.safe,
      notes: [...a.notes, ...e.notes],
      ar: a.redactedText ?? ar,
      en: e.redactedText ?? en,
    }
  }
}

export function createSafetyLayer(): SafetyLayer {
  return new SafetyLayer()
}
