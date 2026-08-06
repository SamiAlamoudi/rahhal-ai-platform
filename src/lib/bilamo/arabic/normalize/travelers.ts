/**
 * Normalize dialect / Arabic traveler phrasing → canonical counts + MSA cues.
 */

export type TravelerHints = {
  travelers: number | null
  travelerType: 'solo' | 'couple' | 'family' | 'friends' | null
  children: number | null
  infants: number | null
}

function applyHints(base: TravelerHints, patch: Partial<TravelerHints>): TravelerHints {
  return {
    travelers: patch.travelers ?? base.travelers,
    travelerType: patch.travelerType ?? base.travelerType,
    children: patch.children ?? base.children,
    infants: patch.infants ?? base.infants,
  }
}

const WORD_COUNTS: Record<string, number> = {
  واحد: 1,
  اثنين: 2,
  اثنان: 2,
  ثلاثة: 3,
  ثلاث: 3,
  اربعة: 4,
  أربعة: 4,
  خمسة: 5,
  ستة: 6,
  سبعة: 7,
  ثمانية: 8,
  تسعة: 9,
  عشرة: 10,
}

export function normalizeTravelerPhrases(text: string): {
  text: string
  changed: boolean
  hints: TravelerHints
} {
  let out = text
  let changed = false
  let hints: TravelerHints = {
    travelers: null,
    travelerType: null,
    children: null,
    infants: null,
  }

  const run = (re: RegExp, to: string, hint?: Partial<TravelerHints>) => {
    re.lastIndex = 0
    if (!re.test(out)) {
      re.lastIndex = 0
      return
    }
    re.lastIndex = 0
    const next = out.replace(re, to)
    if (hint) hints = applyHints(hints, hint)
    if (next !== out) {
      changed = true
      out = next
    } else if (hint) {
      changed = true
    }
  }

  run(
    /أنا\s*وزوجتي|انا\s*وزوجتي|أنا\s*وزوجي|انا\s*وزوجي|أنا\s*ومراتي|احنا\s*اتنين|إحنا\s*اتنين|نحن\s*اثنين/g,
    'لشخصين',
    { travelers: 2, travelerType: 'couple' },
  )
  run(
    /أنا\s*والعائله|انا\s*والعائله|أنا\s*والعائلة|انا\s*والعائلة|مع\s*العائلة|مع\s*العائله|العائلة\s*كلها|العيله/g,
    'عائلة من 4 أشخاص',
    { travelers: 4, travelerType: 'family', children: 2 },
  )
  run(
    /ثلاثه\s*كبار|ثلاثة\s*كبار|٣\s*كبار|3\s*كبار/g,
    '3 بالغين',
    { travelers: 3, travelerType: 'friends' },
  )
  run(/طفلين|طفلان|ولدين|بنتين/g, 'طفلين', { children: 2 })
  run(/رضيع|رضيعة|بيبي|طفل\s*رضيع|مولود/g, 'رضيع', { infants: 1 })
  run(/شخصين|شخصان|لشخصين|فردين/g, 'لشخصين', { travelers: 2, travelerType: 'couple' })
  run(/بدنا\s*اثنين|بدنا\s*اتنين|احنا\s*ثنين/g, 'لشخصين', { travelers: 2, travelerType: 'couple' })
  run(
    /لحالي|بنفس[يى]|أنا\s*وحدي|انا\s*وحدي|بروحي|لحالي\s*بس/g,
    'شخص واحد',
    { travelers: 1, travelerType: 'solo' },
  )

  // English party phrases — set hints only; keep English so locale detection stays stable.
  if (/\bjust\s+me\b|\bonly\s+me\b|\bby\s+myself\b/i.test(out)) {
    hints = applyHints(hints, { travelers: 1, travelerType: 'solo' })
    changed = true
  }
  if (/\bcouple\b/i.test(out)) {
    hints = applyHints(hints, { travelers: 2, travelerType: 'couple' })
    changed = true
  }
  if (/\bfamily\b/i.test(out)) {
    hints = applyHints(hints, { travelers: 4, travelerType: 'family', children: 2 })
    changed = true
  }

  const arabicCount = out.match(
    /(?:^|[\s،,])(واحد|اثنين|اثنان|ثلاثة|ثلاث|اربعة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة|\d+)\s*(?:أشخاص|اشخاص|فرد|افراد|بالغين)/,
  )
  if (arabicCount && hints.travelers == null) {
    const word = arabicCount[1] || ''
    const n = WORD_COUNTS[word] ?? Number(word)
    if (Number.isFinite(n) && n > 0) {
      hints = applyHints(hints, {
        travelers: n,
        travelerType: n >= 3 ? 'family' : n === 2 ? 'couple' : 'solo',
      })
    }
  }

  if (hints.travelers == null && (hints.children != null || hints.infants != null)) {
    hints = applyHints(hints, {
      travelers: 2 + (hints.children ?? 0) + (hints.infants ?? 0),
      travelerType: 'family',
    })
  }

  out = out.replace(/\s+/g, ' ').trim()
  return { text: out, changed, hints }
}
