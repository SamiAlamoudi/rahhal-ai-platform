/**
 * Arabic dialect adaptation layer (language only).
 * Does not change Realtime / WebRTC architecture.
 *
 * Rules:
 * - Adapt to the traveler's dialect when clear.
 * - Default to conversational MSA if unknown.
 * - Never exaggerate, stereotype, or mix unrelated dialects in one reply.
 * - Keep travel terminology clear.
 */

export type ArabicDialectId =
  | 'auto'
  | 'fusha'
  | 'white'
  | 'saudi'
  | 'gulf'
  | 'emirati'
  | 'kuwaiti'
  | 'qatari'
  | 'bahraini'
  | 'omani'
  | 'egyptian'
  | 'levantine'
  | 'iraqi'
  | 'yemeni'
  | 'moroccan'
  | 'algerian'
  | 'tunisian'

export type DialectDetectionResult = {
  dialect: ArabicDialectId
  /** 0–1 soft confidence; below threshold → treat as unknown → MSA. */
  confidence: number
  source: 'preference' | 'detected' | 'default_msa'
}

const MSA_FALLBACK: ArabicDialectId = 'fusha'
const DETECT_THRESHOLD = 0.45

type DialectMeta = {
  id: ArabicDialectId
  labelAr: string
  /** Soft wording guidance — never caricature. */
  guidance: string
  group: 'msa' | 'peninsula' | 'gulf' | 'egypt' | 'levant' | 'iraq' | 'yemen' | 'maghreb' | 'neutral'
}

export const ARABIC_DIALECT_CATALOG: DialectMeta[] = [
  {
    id: 'auto',
    labelAr: 'تلقائي (يتكيف مع كلامك)',
    group: 'neutral',
    guidance:
      'Adapt naturally to the traveler\'s spoken dialect when clear. If unclear, use warm conversational Modern Standard Arabic. Never mix unrelated dialects in one reply.',
  },
  {
    id: 'fusha',
    labelAr: 'الفصحى المعاصرة / MSA',
    group: 'msa',
    guidance:
      'Clear conversational Modern Standard Arabic (فصحى معاصرة مبسّطة). Warm and spoken — not classical oratory or news-anchor formality. Keep travel terms precise.',
  },
  {
    id: 'white',
    labelAr: 'العربية البيضاء',
    group: 'neutral',
    guidance:
      'Neutral educated Arabic (العربية البيضاء): clear, modern, widely understood. Warm spoken dialogue — not formal written Arabic.',
  },
  {
    id: 'saudi',
    labelAr: 'السعودية (نجدي / حجازي / خليجي)',
    group: 'peninsula',
    guidance:
      'Natural educated Saudi travel-consultant Arabic. Soft Najdi/Hijazi/Gulf coloring only as the traveler speaks — never exaggerated slang theatre. Prefer clear words like: حياك، تمام، خلنا، وين، إن شاء الله. Keep flight/hotel terms clear.',
  },
  {
    id: 'gulf',
    labelAr: 'خليجية عامة',
    group: 'gulf',
    guidance:
      'Natural Gulf conversational Arabic with warm pacing. Soft Gulf rhythm — not caricature. If a marker is unclear, prefer clear Gulf-leaning or MSA travel wording.',
  },
  {
    id: 'emirati',
    labelAr: 'الإماراتية',
    group: 'gulf',
    guidance:
      'Light natural Emirati conversational coloring when clear (حياك، زين، شو رأيك). Stay premium and clear; never cartoon Gulf slang. Travel terms stay precise.',
  },
  {
    id: 'kuwaiti',
    labelAr: 'الكويتية',
    group: 'gulf',
    guidance:
      'Light natural Kuwaiti conversational coloring when clear. Warm and concise; no stereotype particles stacked for effect. Keep booking language clear.',
  },
  {
    id: 'qatari',
    labelAr: 'القطرية',
    group: 'gulf',
    guidance:
      'Light natural Qatari conversational coloring when clear. Soft Gulf rhythm; clarity first for destinations, dates, and prices.',
  },
  {
    id: 'bahraini',
    labelAr: 'البحرينية',
    group: 'gulf',
    guidance:
      'Light natural Bahraini conversational coloring when clear. Friendly Gulf pacing without exaggeration.',
  },
  {
    id: 'omani',
    labelAr: 'العُمانية',
    group: 'gulf',
    guidance:
      'Light natural Omani conversational coloring when clear. Calm, clear, respectful — never forced rural caricature.',
  },
  {
    id: 'egyptian',
    labelAr: 'المصرية',
    group: 'egypt',
    guidance:
      'Natural Egyptian conversational Arabic when the traveler uses it (مثلاً: إزيك، كده، عايز، تمام). Soft coloring only; keep travel vocabulary clear to any Arabic speaker.',
  },
  {
    id: 'levantine',
    labelAr: 'الشامية (أردن / فلسطين / سوريا / لبنان)',
    group: 'levant',
    guidance:
      'Natural Levantine conversational Arabic (Jordan/Palestine/Syria/Lebanon) when clear (مثلاً: كيفك، بدّي، هلق، منيح). No exaggerated street slang. Travel terms stay clear.',
  },
  {
    id: 'iraqi',
    labelAr: 'العراقية',
    group: 'iraq',
    guidance:
      'Light natural Iraqi conversational coloring when clear. Warm and respectful; avoid heavy slang that harms clarity. Keep flights/hotels wording precise.',
  },
  {
    id: 'yemeni',
    labelAr: 'اليمنية',
    group: 'yemen',
    guidance:
      'Light natural Yemeni conversational coloring when clear. Soft and clear — never caricature. Prefer widely understood wording for travel logistics.',
  },
  {
    id: 'moroccan',
    labelAr: 'المغربية',
    group: 'maghreb',
    guidance:
      'Light Moroccan Darija coloring only if still clear to a broad audience. If heavy Darija would confuse, lean toward clear Maghrebi-influenced or MSA travel Arabic.',
  },
  {
    id: 'algerian',
    labelAr: 'الجزائرية',
    group: 'maghreb',
    guidance:
      'Light Algerian conversational coloring when clear. Prefer clarity over dense Darija; travel terms in clear Arabic.',
  },
  {
    id: 'tunisian',
    labelAr: 'التونسية',
    group: 'maghreb',
    guidance:
      'Light Tunisian conversational coloring when clear. Soft Maghrebi rhythm; keep destinations, dates, and prices widely understandable.',
  },
]

export function isArabicDialectId(value: string): value is ArabicDialectId {
  return ARABIC_DIALECT_CATALOG.some((d) => d.id === value)
}

export function dialectLabelAr(id: ArabicDialectId): string {
  return ARABIC_DIALECT_CATALOG.find((d) => d.id === id)?.labelAr ?? id
}

export function dialectGuidance(id: ArabicDialectId): string {
  return ARABIC_DIALECT_CATALOG.find((d) => d.id === id)?.guidance
    ?? ARABIC_DIALECT_CATALOG.find((d) => d.id === MSA_FALLBACK)!.guidance
}

type Cue = { dialect: ArabicDialectId; weight: number; re: RegExp }

/** Soft lexical cues — enough to adapt, never enough to force theatre.
 * Avoid JS `\b` (unreliable for Arabic); match tokens with Arabic letter edges.
 */
const ARB = '(?<![\\u0600-\\u06FF])'
const ARE = '(?![\\u0600-\\u06FF])'

const CUES: Cue[] = [
  // Egyptian
  { dialect: 'egyptian', weight: 0.55, re: new RegExp(`${ARB}(?:إزيك|ازيك|عايز|عاوز|كده|أوي|اوي|يعني إيه|النهارده)${ARE}`, 'u') },
  { dialect: 'egyptian', weight: 0.4, re: new RegExp(`${ARB}مش${ARE}`, 'u') },
  // Levantine
  { dialect: 'levantine', weight: 0.55, re: new RegExp(`${ARB}(?:كيفك|بدّي|بدي|بدنا|هلق|هلأ|منيح|يعني شو)${ARE}`, 'u') },
  { dialect: 'levantine', weight: 0.35, re: new RegExp(`${ARB}(?:رح|عم)\\s+\\S+`, 'u') },
  // Iraqi
  { dialect: 'iraqi', weight: 0.55, re: new RegExp(`${ARB}(?:شلونك|اكو|ماكو|هسة|خوش)${ARE}`, 'u') },
  // Yemeni
  { dialect: 'yemeni', weight: 0.5, re: new RegExp(`${ARB}(?:يا خوي|قعدة|اشترك معنا)${ARE}`, 'u') },
  // Maghreb
  { dialect: 'moroccan', weight: 0.55, re: new RegExp(`${ARB}(?:بشحال|بزاف|دابا|صافي)${ARE}`, 'u') },
  { dialect: 'moroccan', weight: 0.4, re: new RegExp(`${ARB}(?:واش|فين)${ARE}`, 'u') },
  { dialect: 'algerian', weight: 0.5, re: new RegExp(`${ARB}(?:راني|برك|صحيت)${ARE}`, 'u') },
  { dialect: 'tunisian', weight: 0.5, re: new RegExp(`${ARB}(?:شنوة|برشة|توّة|نحكي)${ARE}`, 'u') },
  // Gulf specifics
  { dialect: 'emirati', weight: 0.5, re: new RegExp(`${ARB}(?:شو رأيك|زين كذا|عساك)${ARE}`, 'u') },
  { dialect: 'kuwaiti', weight: 0.5, re: new RegExp(`${ARB}(?:شنو|اكييد)${ARE}`, 'u') },
  { dialect: 'qatari', weight: 0.45, re: new RegExp(`${ARB}ماشالله${ARE}`, 'u') },
  { dialect: 'bahraini', weight: 0.45, re: new RegExp(`${ARB}هالحين${ARE}`, 'u') },
  { dialect: 'omani', weight: 0.45, re: new RegExp(`${ARB}إن شاء الله طيب${ARE}`, 'u') },
  // Saudi / generic Gulf
  { dialect: 'saudi', weight: 0.55, re: new RegExp(`${ARB}(?:أبغى|أبغي|وش|وين|خلنا|أبشر|على عيني|تبي)${ARE}`, 'u') },
  { dialect: 'gulf', weight: 0.4, re: new RegExp(`${ARB}(?:الحين|زين|يعطيكم العافية)${ARE}`, 'u') },
  // MSA-ish formal (weak)
  { dialect: 'fusha', weight: 0.25, re: new RegExp(`${ARB}(?:أود|يرجى|بناءً|فضلاً|حضرتك|سيادتك)${ARE}`, 'u') },
]

/**
 * Soft-detect dialect from a traveler utterance.
 * Returns MSA (`fusha`) with low confidence when unknown.
 */
export function detectArabicDialect(text: string): DialectDetectionResult {
  const t = (text || '').trim()
  if (!t) {
    return { dialect: MSA_FALLBACK, confidence: 0, source: 'default_msa' }
  }

  const scores = new Map<ArabicDialectId, number>()
  for (const cue of CUES) {
    if (cue.re.test(t)) {
      scores.set(cue.dialect, (scores.get(cue.dialect) || 0) + cue.weight)
    }
  }

  let best: ArabicDialectId = MSA_FALLBACK
  let bestScore = 0
  for (const [id, score] of scores) {
    if (score > bestScore) {
      best = id
      bestScore = score
    }
  }

  if (bestScore < DETECT_THRESHOLD) {
    return { dialect: MSA_FALLBACK, confidence: bestScore, source: 'default_msa' }
  }

  return {
    dialect: best,
    confidence: Math.min(1, bestScore),
    source: 'detected',
  }
}

/**
 * Resolve the dialect to speak in this turn.
 * Preference wins when not `auto`; otherwise detect; unknown → MSA.
 */
export function resolveSpokenDialect(input: {
  preference?: ArabicDialectId | string | null
  utterance?: string
}): DialectDetectionResult {
  const pref = (input.preference || 'auto') as string
  if (pref !== 'auto' && isArabicDialectId(pref)) {
    return { dialect: pref, confidence: 1, source: 'preference' }
  }
  return detectArabicDialect(input.utterance || '')
}

/** Instruction block for Realtime / chat — language adaptation only. */
export function buildDialectAdaptationInstructions(input: {
  preference?: ArabicDialectId | string | null
  utterance?: string
}): string {
  const resolved = resolveSpokenDialect(input)
  const guide = dialectGuidance(resolved.dialect)
  const label = dialectLabelAr(resolved.dialect)

  return [
    'ARABIC DIALECT ADAPTATION (language layer only)',
    `- Active dialect for this turn: ${label} (${resolved.dialect}), source=${resolved.source}.`,
    guide,
    'Rules:',
    '- Do not use one fixed Arabic style across all travelers.',
    '- If the traveler speaks a dialect, respond naturally in that dialect — no exaggeration, no stereotypes, no catchphrase spam.',
    '- If dialect is unknown, use conversational Modern Standard Arabic.',
    '- Never mix unrelated dialects in the same reply.',
    '- Keep travel terminology (flights, hotels, dates, prices, visas) clear even in dialect.',
    '- Preserve the same premium consultant behavior across all dialects.',
  ].join('\n')
}
