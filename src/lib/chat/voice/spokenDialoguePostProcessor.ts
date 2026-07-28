/**
 * Lightweight spoken-dialogue post-processor.
 * Transforms long written / article-like replies into short spoken consultant dialogue.
 * Does NOT invent travel facts. Does NOT call the Realtime/TTS engine.
 */

export type SpokenDialogueContext =
  | 'greeting'
  | 'excitement'
  | 'recommendation'
  | 'empathy'
  | 'confirmation'
  | 'follow_up'
  | 'general'

export type SpokenDialogueOptions = {
  locale?: 'ar' | 'en'
  /** Soft max characters for spoken output (default 220). */
  maxChars?: number
  /** Known facts already understood — strip redundant restatements when safe. */
  knownFacts?: string[]
  context?: SpokenDialogueContext
}

const FORMAL_AR = [
  /بناءً على ما سبق[,،]?\s*/gi,
  /في هذا السياق[,،]?\s*/gi,
  /من المهم أن نوضح أن['’]?\s*/gi,
  /يسعدني أن أقدم لكم\s*/gi,
  /أود أن أخبرك[م]?\s*(بأن|أن)\s*/gi,
  /كما تعلمون[,،]?\s*/gi,
  /بشكل عام[,،]?\s*/gi,
  /في الختام[,،]?\s*/gi,
  /خلاصة القول[,،]?\s*/gi,
]

const FORMAL_EN = [
  /\bbased on the (above|foregoing)[,.]?\s*/gi,
  /\bin this context[,.]?\s*/gi,
  /\bit is important to note that\s*/gi,
  /\bi('d| would) like to (inform|tell) you that\s*/gi,
  /\bas you (know|may know)[,.]?\s*/gi,
  /\bin conclusion[,.]?\s*/gi,
  /\boverall[,.]?\s*/gi,
]

function detectContext(text: string, explicit?: SpokenDialogueContext): SpokenDialogueContext {
  if (explicit) return explicit
  const t = text.trim()
  if (/^(?:ال)?سلام|مرحبا|أهلا|وعليكم|hello|hi\b/i.test(t) && t.length < 80) return 'greeting'
  if (/آسف|للأسف|صعب|مشكلة|sorry|unfortunately|empath/i.test(t)) return 'empathy'
  if (/أنصح|أفضل خيار|أقترح|recommend|suggest|option/i.test(t)) return 'recommendation'
  if (/صحيح\?|تمام\?|موافق|confirm|right\?/i.test(t)) return 'confirmation'
  if (/\?|؟/.test(t)) return 'follow_up'
  if (/فرصة|ممتاز|رائع|exciting|great news/i.test(t)) return 'excitement'
  return 'general'
}

function stripChrome(text: string): string {
  let out = text
  out = out.replace(/```[\s\S]*?```/g, ' ')
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1')
  out = out.replace(/\*([^*]+)\*/g, '$1')
  out = out.replace(/`([^`]+)`/g, '$1')
  out = out.replace(/^#{1,6}\s+/gm, '')
  out = out.replace(/\r/g, '')
  return out
}

function stripFormal(text: string, locale: 'ar' | 'en'): string {
  let out = text
  for (const re of locale === 'ar' ? FORMAL_AR : FORMAL_EN) {
    out = out.replace(re, '')
  }
  return out
}

/** Split into short spoken breaths (sentences / clauses). */
export function splitSpokenBreaths(text: string): string[] {
  const normalized = text
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
  if (!normalized) return []

  const parts = normalized
    .split(/(?<=[.!?؟…])\s+|(?<=[،,;؛])\s+(?=[^\d])|\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const breaths: string[] = []
  for (const part of parts) {
    if (part.length <= 90) {
      breaths.push(part)
      continue
    }
    // Split long clauses on "و" / "and" when safe.
    const soft = part.split(/(?<=\S)\s+(?:و|and)\s+/i)
    if (soft.length > 1) {
      soft.forEach((s, i) => {
        const piece = s.trim()
        if (!piece) return
        breaths.push(i === 0 ? piece : (/^[وW]/i.test(piece) ? piece : `و ${piece}`))
      })
    } else {
      breaths.push(part)
    }
  }
  return breaths
}

function listToSpoken(text: string, locale: 'ar' | 'en'): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const bulletish = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l))
  if (bulletish.length < 2) return text
  const items = bulletish.map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, '').trim())
  if (locale === 'ar') {
    const ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس']
    return items
      .slice(0, 5)
      .map((item, i) => `${ordinals[i] || `رقم ${i + 1}`}: ${item}`)
      .join('. ')
  }
  const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth']
  return items
    .slice(0, 5)
    .map((item, i) => `${ordinals[i] || `Number ${i + 1}`}: ${item}`)
    .join('. ')
}

function dropRedundantKnownFacts(text: string, knownFacts: string[] | undefined): string {
  if (!knownFacts?.length) return text
  let out = text
  for (const fact of knownFacts) {
    const f = fact.trim()
    if (f.length < 3) continue
    // Only strip explicit "as you said / already" restatements, not all mentions.
    const patterns = [
      new RegExp(`(?:كما ذكرت|مثل ما قلت|سبق و[أا]ن قلت|as you (?:said|mentioned)|you already (?:said|told))[^.؟!\\n]*${escapeReg(f)}[^.؟!\\n]*[.؟!]?`, 'gi'),
      new RegExp(`(?:إذن|يعني|so)\\s*(?:أنت|you)\\s*(?:تبي|تبيون|want)[^.؟!\\n]*${escapeReg(f)}[^.؟!\\n]*[.؟!]?`, 'gi'),
    ]
    for (const re of patterns) out = out.replace(re, ' ')
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function enforceOneQuestion(text: string): string {
  const marks = text.match(/[؟?]/g) || []
  if (marks.length <= 1) return text
  // Keep text up to and including the first question.
  const idx = Math.min(
    ...['؟', '?'].map((m) => {
      const i = text.indexOf(m)
      return i === -1 ? Number.POSITIVE_INFINITY : i
    }),
  )
  if (!Number.isFinite(idx)) return text
  return text.slice(0, idx + 1).trim()
}

function trimToSpokenBudget(breaths: string[], maxChars: number): string {
  if (!breaths.length) return ''
  const joined = breaths.join(' ')
  if (joined.length <= maxChars) return joined.replace(/\s+/g, ' ').trim()

  const kept: string[] = []
  let size = 0
  for (const b of breaths) {
    const next = size === 0 ? b.length : size + 1 + b.length
    if (next > maxChars && kept.length > 0) break
    kept.push(b)
    size = next
    if (size >= Math.min(maxChars, 160) && /[؟?]/.test(b)) break
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Convert long written assistant text into short spoken consultant dialogue.
 */
export function toSpokenDialogue(
  raw: string,
  options: SpokenDialogueOptions = {},
): string {
  const locale = options.locale === 'en' ? 'en' : 'ar'
  const maxChars = options.maxChars ?? 220
  let text = (raw || '').trim()
  if (!text) return ''

  text = listToSpoken(text, locale)
  text = stripChrome(text)
  text = stripFormal(text, locale)
  text = dropRedundantKnownFacts(text, options.knownFacts)
  text = text
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim()

  const breaths = splitSpokenBreaths(text)
  let spoken = trimToSpokenBudget(breaths, maxChars)
  spoken = enforceOneQuestion(spoken)

  // Prefer ending on a complete breath.
  if (spoken.length > 12 && !/[.!?؟…]$/.test(spoken)) {
    spoken = `${spoken}${locale === 'ar' ? '.' : '.'}`
  }

  return spoken.trim()
}

/**
 * Soft speaking cue for Realtime session instructions (not read aloud).
 * Helps vary delivery without changing the speech engine.
 */
export function spokenToneCue(context: SpokenDialogueContext): string {
  switch (context) {
    case 'greeting':
      return 'Delivery: warm brief greeting; light smile in the voice; one short question.'
    case 'excitement':
      return 'Delivery: warm interest, not hype; keep calm confidence.'
    case 'recommendation':
      return 'Delivery: clear and decisive; compare briefly; no inventory dump.'
    case 'empathy':
      return 'Delivery: slower, softer, reassuring; then one practical next step.'
    case 'confirmation':
      return 'Delivery: crisp and calm; confirm only what is new; ask one yes/no if needed.'
    case 'follow_up':
      return 'Delivery: curious and light; exactly one question; short lead-in.'
    default:
      return 'Delivery: natural live-call consultant; short breaths; never article narration.'
  }
}

export function inferSpokenContext(text: string): SpokenDialogueContext {
  return detectContext(text)
}
