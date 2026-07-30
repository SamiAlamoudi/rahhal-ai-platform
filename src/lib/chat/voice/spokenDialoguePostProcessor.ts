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
  | 'luxury'
  | 'family'
  | 'business'
  | 'general'

export type SpokenDialogueOptions = {
  locale?: 'ar' | 'en'
  /** Soft max characters for spoken output (default 220). */
  maxChars?: number
  /** Known facts already understood — strip redundant restatements when safe. */
  knownFacts?: string[]
  context?: SpokenDialogueContext
  /** Seed for deterministic natural variation (default: hash of text). */
  variationSeed?: string
}

const FORMAL_AR = [
  /بناءً على ما سبق[,،]?\s*/gi,
  /في هذا السياق[,،]?\s*/gi,
  /من المهم أن نوضح أن['’]?\s*/gi,
  /يسعدني أن أقدم لكم\s*/gi,
  /يسعدني\s*(أن|بـ)?\s*/gi,
  /أستطيع أن?\s*أساعد(?:ك|كم)\s*(في|بـ)?\s*/gi,
  /أستطيع مساعدتك\s*/gi,
  /يمكنني أن?\s*/gi,
  /يمكنني مساعدتك\s*/gi,
  /سأقوم بـ?\s*/gi,
  /أود أن أخبرك[م]?\s*(بأن|أن)\s*/gi,
  /كما تعلمون[,،]?\s*/gi,
  /بشكل عام[,،]?\s*/gi,
  /في الختام[,،]?\s*/gi,
  /خلاصة القول[,،]?\s*/gi,
  /كيف يمكنني مساعدتك(?: اليوم)?[؟?]?\s*/gi,
  /كيف أقدر أساعدك(?: اليوم)?[؟?]?\s*/gi,
  /كيف أقدر أخدمك(?: اليوم)?[؟?]?\s*/gi,
  /بماذا أقدر أساعدك[؟?]?\s*/gi,
  /مرحباً بك في\s*/gi,
  /عزيزي العميل[,،]?\s*/gi,
]

const FORMAL_EN = [
  /\bbased on the (above|foregoing)[,.]?\s*/gi,
  /\bin this context[,.]?\s*/gi,
  /\bit is important to note that\s*/gi,
  /\bi('d| would) like to (inform|tell) you that\s*/gi,
  /\bi (can|could) (help|assist) you (with|to)?\s*/gi,
  /\bas you (know|may know)[,.]?\s*/gi,
  /\bin conclusion[,.]?\s*/gi,
  /\boverall[,.]?\s*/gi,
]

/** Soft thinking / filler openings — rotated; never invent travel facts. Never process narration. */
export const THINKING_BREATHS_AR = [
  'جميل… ',
  'تمام… ',
  'فكرة حلوة… ',
  'بصراحة… ',
  'على حسب… ',
  'أشوف أن… ',
  'ممكن يكون عندك خيارين… ',
] as const

const PROCESS_NARRATION_AR = [
  /خلني أبحث[^.؟!]*[.؟!…]?\s*/gi,
  /خلني أدور[^.؟!]*[.؟!…]?\s*/gi,
  /خلني أقارن الأسعار أول[….]*\s*/gi,
  /بشوف الرحلات المباشرة قبل[….]*\s*/gi,
  /أعطني ثواني[….]*\s*/gi,
  /الآن سأبحث[^.؟!]*[.؟!…]?\s*/gi,
  /سأقوم بالبحث[^.؟!]*[.؟!…]?\s*/gi,
  /\bI(?:'m| am) (?:now )?(?:searching|looking|comparing)[^.?!]*[.?!]?\s*/gi,
  /\bLet me (?:now )?(?:search|look|compare|check)[^.?!]*[.?!]?\s*/gi,
]

/** Unsolicited advice — strip unless the traveler asked for advice (handled upstream). */
const UNSOLICITED_ADVICE_AR = [
  /أنصحك(?: بأن| بـ)?\s*/gi,
  /أقترح عليك(?: أن)?\s*/gi,
  /أنصح(?:ك|كم)\s*/gi,
  /(?:لازم\s+)?تحجز بدري[^.؟!]*[.؟!…]?\s*/gi,
  /(?:لازم\s+)?احجز بدري[^.؟!]*[.؟!…]?\s*/gi,
  /احجز مبكر[اًا]?[^.؟!]*[.؟!…]?\s*/gi,
  /(?:مع\s+)?شركات موثوقة[^.؟!]*[.؟!…]?\s*/gi,
  /احجز مع شركات موثوقة[^.؟!]*[.؟!…]?\s*/gi,
  /خلنا نحدد أولاً[^.؟!]*[.؟!…]?\s*/gi,
  /قبل ما نحجز[^.؟!]*[.؟!…]?\s*/gi,
  /ربما\s+/gi,
]

const UNSOLICITED_ADVICE_EN = [
  /\bI (?:would )?suggest(?: that)?\s*/gi,
  /\bI recommend(?: that)?\s*/gi,
  /\bYou should\s+/gi,
  /\bBook with trusted (?:companies|agencies)[^.?!]*[.?!]?\s*/gi,
  /\bBook early[^.?!]*[.?!]?\s*/gi,
  /\bPerhaps(?: we(?: can| should)?)?\b[^.?!]*[.?!]?\s*/gi,
  /\bMaybe we should\b[^.?!]*[.?!]?\s*/gi,
  /\bLet's first determine\b[^.?!]*[.?!]?\s*/gi,
  /\bBefore we book\b[^.?!]*[.?!]?\s*/gi,
]

/** Never send the traveler to another booking website — Rahhal is the agent. */
const WEBSITE_REFERRAL = [
  /\b(?:use|try|check|visit|go to|book (?:on|via|through))\s+(?:Booking\.com|Kayak|Google Flights|Expedia|Skyscanner|Momondo)\b[^.?!]*[.?!]?\s*/gi,
  /\b(?:Booking\.com|Kayak|Google Flights|Expedia|Skyscanner|Momondo)\b[^.?!]*[.?!]?\s*/gi,
  /(?:استخدم|جرّب|جرب|شيك على|احجز عبر|احجز من)\s*(?:بوكنج|كاياك|جوجل فلايتس|إكسبيديا|اكسبيديا)[^.؟!]*[.؟!…]?\s*/gi,
  /(?:موقع|تطبيق)\s+(?:آخر|ثاني|خارجي)[^.؟!]*[.؟!…]?\s*/gi,
  /\bsearch online\b[^.?!]*[.?!]?\s*/gi,
  /\bbook elsewhere\b[^.?!]*[.?!]?\s*/gi,
]

/** Praise / echo fillers after short confirmations — booking agent never uses these. */
const PRAISE_OPENERS_AR = [
  /^(?:ممتاز|رائع|عظيم|جميل جد[اًا]|wonderful|great|excellent)[!！.,،…]?\s*/gi,
]

const PRAISE_OPENERS_EN = [
  /^(?:Great|Excellent|Wonderful|Amazing|Perfect)[!.,…]?\s+/gi,
]

function stripUnsolicitedAdvice(text: string, locale: 'ar' | 'en'): string {
  let out = text
  const patterns = locale === 'en' ? UNSOLICITED_ADVICE_EN : [...UNSOLICITED_ADVICE_AR, ...UNSOLICITED_ADVICE_EN]
  for (const re of patterns) out = out.replace(re, '')
  for (const re of WEBSITE_REFERRAL) out = out.replace(re, '')
  return out.replace(/\s{2,}/g, ' ').trim()
}

function stripPraiseOpeners(text: string, locale: 'ar' | 'en'): string {
  let out = text
  const patterns = locale === 'en' ? PRAISE_OPENERS_EN : [...PRAISE_OPENERS_AR, ...PRAISE_OPENERS_EN]
  for (const re of patterns) out = out.replace(re, '')
  return out.replace(/\s{2,}/g, ' ').trim()
}

const HAS_HUMAN_OPENER_AR =
  /^(?:وعليكم|السلام|مرحبا|أهلا|حياك|ممتاز|جميل|تمام|حلو|زين|طيب|أبشر|خلاص|فكرة|بصراحة|على حسب|أشوف|آسف|فهمت|ممكن|ولا يهمك|يا ساتر)/u

function detectContext(text: string, explicit?: SpokenDialogueContext): SpokenDialogueContext {
  if (explicit) return explicit
  const t = text.trim()
  if (/^(?:ال)?سلام|مرحبا|أهلا|وعليكم|hello|hi\b/i.test(t) && t.length < 80) return 'greeting'
  if (/آسف|للأسف|صعب|مشكلة|تأخير|إلغاء|sorry|unfortunately|empath|delay|cancel/i.test(t)) return 'empathy'
  if (/فاخر|فخم|luxury|سويت|درجة أولى/i.test(t)) return 'luxury'
  if (/عائلة|أطفال|family|kids/i.test(t)) return 'family'
  if (/عمل|بيزنس|business|مؤتمر/i.test(t)) return 'business'
  if (/أنصح|أفضل خيار|أقترح|recommend|suggest|option/i.test(t)) return 'recommendation'
  if (/صحيح\?|تمام\?|موافق|confirm|right\?/i.test(t)) return 'confirmation'
  if (/\?|؟/.test(t)) return 'follow_up'
  if (/فرصة|ممتاز|رائع|exciting|great news/i.test(t)) return 'excitement'
  return 'general'
}

function hashSeed(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) - h + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Soft natural variation of robotic acknowledgements / openings.
 * Deterministic per seed so the same reply stays stable in one turn.
 */
export function applyNaturalVariation(text: string, seed: string, locale: 'ar' | 'en'): string {
  if (locale !== 'ar' || !text.trim()) return text
  const h = hashSeed(seed)
  const pick = h % 5
  let out = text

  const roboticAck = /^(حسناً|حسنا|طيب|أوكي|اوكي|OK|Ok)[,،.]?\s+/i
  if (roboticAck.test(out)) {
    const alts = ['تمام، ', 'جميل، ', 'فكرة حلوة، ', 'بصراحة، ', '']
    out = out.replace(roboticAck, alts[pick] ?? '')
  }

  // Soften identical "ممتاز" openers without removing genuine praise mid-sentence.
  if (/^ممتاز[,،!]?\s+/i.test(out) && pick !== 0) {
    const alts = ['جميل، ', 'تمام، ', 'فكرة حلوة، ', 'حلو، ', '']
    out = out.replace(/^ممتاز[,،!]?\s+/i, alts[pick] ?? '')
  }

  // Vary stiff confirmations / yes-openers.
  if (/^(نعم|بالتأكيد|طبعاً|طبعا)[,،.]?\s+/i.test(out) && pick % 2 === 1) {
    const alts = ['أيوه، ', 'أكيد، ', 'تمام، ', 'بصراحة، ', '']
    out = out.replace(/^(نعم|بالتأكيد|طبعاً|طبعا)[,،.]?\s+/i, alts[pick] ?? '')
  }

  // Soften brochure connectors into spoken breath markers (not read as punctuation theatre).
  out = out
    .replace(/\bعلاوة على ذلك[,،]?\s*/gi, pick % 2 === 0 ? 'وكمان، ' : 'وبعدين، ')
    .replace(/\bبالإضافة إلى ذلك[,،]?\s*/gi, pick % 2 === 0 ? 'وكمان، ' : '')
    .replace(/\bمن ناحية أخرى[,،]?\s*/gi, pick % 2 === 0 ? 'وفي نفس الوقت، ' : 'وبعدين، ')

  // Occasional micro-pause after a short opener (helps Realtime pacing without engine changes).
  if (pick === 2 || pick === 4) {
    out = out.replace(
      /^(تمام|جميل|حلو|زين|فكرة حلوة|بصراحة|على حسب|أشوف أن|حياك)[,،]\s+/u,
      '$1… ',
    )
  }

  return out.replace(/\s{2,}/g, ' ').trim()
}

/**
 * If a reply jumps straight into content with no human lead-in, prepend a soft acknowledgement.
 * Deterministic per seed. Does not invent travel facts. Never process narration.
 */
export function ensureThinkingBreath(
  text: string,
  seed: string,
  locale: 'ar' | 'en',
  context?: SpokenDialogueContext,
): string {
  // Booking agent: never prepend praise/filler breaths.
  if (locale !== 'ar' || !text.trim()) return text
  if (
    context === 'greeting'
    || context === 'empathy'
    || context === 'confirmation'
    || context === 'follow_up'
    || context === 'business'
  ) {
    return text
  }
  if (HAS_HUMAN_OPENER_AR.test(text.trim())) return text
  // Prefer no filler — booking turns should start with substance.
  void seed
  return text
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
  if (locale === 'ar') {
    // Soften residual CS closers without inventing new questions.
    out = out.replace(/\s*علشان أقدر أساعدك[؟?]?\s*/gi, ' ')
    out = out.replace(/\s*عشان أقدر أساعدك[؟?]?\s*/gi, ' ')
    for (const re of PROCESS_NARRATION_AR) {
      out = out.replace(re, '')
    }
  }
  out = stripUnsolicitedAdvice(out, locale)
  out = stripPraiseOpeners(out, locale)
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
 * Convert long written assistant text into short spoken booking-agent dialogue.
 * Target ~20–40 spoken words (≈140 chars Arabic).
 */
export function toSpokenDialogue(
  raw: string,
  options: SpokenDialogueOptions = {},
): string {
  const locale = options.locale === 'en' ? 'en' : 'ar'
  const maxChars = options.maxChars ?? 140
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

  const ctx = detectContext(text, options.context)
  const seed = options.variationSeed || text
  const breaths = splitSpokenBreaths(text)
  let spoken = trimToSpokenBudget(breaths, maxChars)
  spoken = enforceOneQuestion(spoken)
  spoken = ensureThinkingBreath(spoken, seed, locale, ctx)
  spoken = applyNaturalVariation(spoken, seed, locale)
  spoken = stripPraiseOpeners(spoken, locale)

  // Prefer ending on a complete breath.
  if (spoken.length > 12 && !/[.!?؟…]$/.test(spoken)) {
    spoken = `${spoken}.`
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
      return 'Delivery: no praise; continue to the next booking step immediately.'
    case 'follow_up':
      return 'Delivery: exactly one booking-field question; no lecture.'
    case 'luxury':
      return 'Delivery: elegant and brief; collect fields then show options.'
    case 'family':
      return 'Delivery: clear and reassuring; ask party size if missing.'
    case 'business':
      return 'Delivery: professional and concise; zero small talk.'
    default:
      return 'Delivery: efficient booking agent; 20–40 words; never article narration.'
  }
}

export function inferSpokenContext(text: string): SpokenDialogueContext {
  return detectContext(text)
}
