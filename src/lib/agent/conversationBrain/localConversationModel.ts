/**
 * Local conversation model — generative fallback when no remote LLM key is set.
 * Produces unique wording from Travel Facts (seeded by context), not fixed script templates.
 * Production with VITE_OPENAI_API_KEY uses the real OpenAI adapter instead.
 */

import type { TravelFacts } from './travelFacts'

export type LocalConversationResult = {
  displayText: string
  spokenText: string
}

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick<T>(seed: number, items: T[]): T {
  return items[seed % items.length]!
}

function optimizeLocalSpoken(text: string): string {
  return text
    .replace(/^عندي[:：]\s*/gm, '')
    .replace(/\bعندي\s*:/g, '')
    .replace(/^•\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 360)
}

function knownBits(facts: TravelFacts, ar: boolean): string[] {
  const k = facts.known
  const bits: string[] = []
  const dest = k.destination || k.destinations?.[0]
  if (dest) bits.push(dest)
  if (k.startDate && k.endDate) {
    bits.push(ar ? `من ${k.startDate} إلى ${k.endDate}` : `${k.startDate} → ${k.endDate}`)
  } else if (k.startDate) {
    bits.push(ar ? `حوالي ${k.startDate}` : `around ${k.startDate}`)
  } else if (k.durationDays != null) {
    bits.push(ar ? `${k.durationDays} أيام` : `${k.durationDays} days`)
  }
  if (k.origin) {
    bits.push(ar ? `من ${k.origin}` : `from ${k.origin}`)
  }
  if (k.travelerType === 'couple' || k.travelers === 2) {
    bits.push(ar ? 'للاثنين' : 'for two')
  } else if (k.travelerType === 'family') {
    bits.push(ar ? 'للعائلة' : 'for the family')
  } else if (k.travelerType === 'solo' || k.travelers === 1) {
    bits.push(ar ? 'فردي' : 'solo')
  } else if (k.travelers != null) {
    bits.push(ar ? `${k.travelers} مسافرين` : `${k.travelers} travelers`)
  }
  if (k.budgetFlexible) bits.push(ar ? 'ميزانية مرنة' : 'flexible budget')
  else if (k.budgetAmount != null) {
    bits.push(`${k.budgetAmount} ${k.budgetCurrency || ''}`.trim())
  }
  return bits
}

function askForSlot(slot: string, facts: TravelFacts, seed: number, ar: boolean): string {
  const dest = facts.known.destination || facts.known.destinations?.[0]
  const variants: Record<string, { ar: string[]; en: string[] }> = {
    destination: {
      ar: [
        'تميل لبحر وهدوء، ولا مدينة وثقافة — أو عندك وجهة معيّنة؟',
        'وش نوع الرحلة اللي في بالك: استرخاء، معالم، ولا مغامرة؟',
        'لو تختار إحساساً للرحلة، أقدر أضيّق الوجهات بسرعة.',
      ],
      en: [
        'Are you imagining beach and calm, city and culture — or do you already have a place in mind?',
        'What kind of trip is taking shape: recovery, landmarks, or a bit of adventure?',
        'Give me the feeling of the trip and I will narrow destinations quickly.',
      ],
    },
    durationDays: {
      ar: [
        dest
          ? `لـ${dest}، هل تفكّر في عطلة قصيرة، ولا أسبوع كامل تقريباً؟`
          : 'هل تميل لعطلة قصيرة، ولا أسبوع كامل تقريباً؟',
        dest
          ? `إيقاع ${dest}: أيام قليلة مركّزة، ولا إقامة أطول بهدوء؟`
          : 'إيقاع الرحلة: أيام قليلة مركّزة، ولا إقامة أطول؟',
      ],
      en: [
        dest
          ? `For ${dest}, are you thinking a short break, or closer to a full week?`
          : 'Are you thinking a short break, or closer to a full week?',
        dest
          ? `Pace for ${dest}: a few focused days, or a longer, slower stay?`
          : 'A few focused days, or a longer, slower stay?',
      ],
    },
    budgetAmount: {
      ar: [
        'نضبط الخيارات على سقف واضح، ولا نتركها مرنة ونقارن مستويات؟',
        'تحب أريك شريحة مريحة، ولا أقصى قيمة مقابل السعر؟',
      ],
      en: [
        'Shall I shape options around a clear ceiling, or keep it flexible and compare tiers?',
        'Would you rather see a comfortable band, or stretch for maximum value?',
      ],
    },
    travelers: {
      ar: [
        'الرحلة فردية، لاثنين، ولا أجواء عائلية؟',
        'تميل لتجربة هادئة لشخصين، ولا مجموعة؟',
      ],
      en: [
        'Is this solo, for two, or a family-style trip?',
        'Are you imagining a quiet trip for two, or a larger group?',
      ],
    },
    origin: {
      ar: [
        'من أي مدينة المغادرة؟',
        'وين نقطة الإقلاع؟',
      ],
      en: [
        'Which city will you depart from?',
        'Where are you flying out of?',
      ],
    },
  }
  const pack = variants[slot] ?? {
    ar: ['ما التفصيلة الناقصة عشان أكمّل التخطيط؟'],
    en: ['What is the one detail still blocking the plan?'],
  }
  return pick(seed, ar ? pack.ar : pack.en)
}

function acknowledge(facts: TravelFacts, seed: number, ar: boolean): string {
  const bits = knownBits(facts, ar)
  if (bits.length === 0) {
    return pick(seed, ar
      ? ['فهمت طلبك.', 'خلّنا نضبط الأساسيات بهدوء.', 'جاهز نكمل التخطيط.']
      : ['I understand.', 'Let us lock the essentials.', 'Ready to shape the trip.'])
  }
  const joined = bits.slice(0, 3).join(ar ? '، ' : ', ')
  return pick(seed + 3, ar
    ? [
      `واضح — ${joined}.`,
      `نبني على ${joined}.`,
      `${joined}؛ نكمّل من هنا.`,
    ]
    : [
      `Clear — ${joined}.`,
      `Building on ${joined}.`,
      `${joined}; we continue from there.`,
    ])
}

function renderPlanDisplay(facts: TravelFacts, ar: boolean): string {
  const plan = facts.plan
  if (!plan) return ar ? 'ما زلنا نجهّز الخطة.' : 'The plan is still taking shape.'
  const dest = plan.destinations.join(ar ? ' و' : ' and ')
  const hotel = plan.hotels[0]?.name
  const total = plan.estimatedTotal
  const dayHint = plan.days[0]
    ? (ar ? ` اليوم الأول في ${plan.days[0].location}.` : ` Day one centers on ${plan.days[0].location}.`)
    : ''
  if (ar) {
    return [
      `جهّزت تصوّراً واضحاً لـ${dest} خلال ${plan.durationDays} أيام.`,
      hotel ? `الإقامة المقترحة: ${hotel}.` : '',
      total ? `التقدير الأولي حوالي ${total.amount.toLocaleString('en-US')} ${total.currency}.` : '',
      dayHint,
      'قل لي ماذا نثبّت أو نعدّل.',
    ].filter(Boolean).join(' ')
  }
  return [
    `I shaped a clear outline for ${dest} over ${plan.durationDays} days.`,
    hotel ? `Suggested stay: ${hotel}.` : '',
    total ? `Early estimate around ${total.amount.toLocaleString('en-US')} ${total.currency}.` : '',
    dayHint,
    'Tell me what to lock or change.',
  ].filter(Boolean).join(' ')
}

function spokenPlan(facts: TravelFacts, seed: number, ar: boolean): string {
  const plan = facts.plan
  if (!plan) {
    return acknowledge(facts, seed, ar)
  }
  const dest = plan.destinations[0] || (ar ? 'وجهتك' : 'your trip')
  const hotel = plan.hotels[0]?.name
  const total = plan.estimatedTotal
  if (ar) {
    return pick(seed, [
      `جهّزت تصوّراً لـ${dest} لمدة ${plan.durationDays} أيام${hotel ? ` مع إقامة في ${hotel}` : ''}${total ? `، بتقدير حوالي ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}.`,
      `مسودة قوية لـ${dest}. ${hotel ? `أميل لـ${hotel}. ` : ''}قل لي وش نثبّت أو نعدّل.`,
      `${dest} صارت أوضح — خطة ${plan.durationDays} أيام جاهزة، وندققها معاً.`,
    ])
  }
  return pick(seed, [
    `I have a first cut for ${dest} across ${plan.durationDays} days${hotel ? `, leaning toward ${hotel}` : ''}${total ? `, around ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}.`,
    `There is a solid draft for ${dest}. ${hotel ? `I like ${hotel} for the stay. ` : ''}Tell me what to tune.`,
    `${dest} is clearer now — a ${plan.durationDays}-day outline is ready for us to refine together.`,
  ])
}

/**
 * Generate advisor copy from facts. Wording varies by seed (conversation + facts).
 */
export function generateLocalConversation(input: {
  facts: TravelFacts
  userMessage: string
  conversationId: string
}): LocalConversationResult {
  const ar = input.facts.locale === 'ar'
  const seed = hashSeed(`${input.conversationId}|${input.facts.objective}|${input.userMessage}|${JSON.stringify(input.facts.known)}|${input.facts.missingSlots.join(',')}`)

  switch (input.facts.objective) {
    case 'present_plan': {
      const spokenText = spokenPlan(input.facts, seed, ar)
      return { displayText: renderPlanDisplay(input.facts, ar), spokenText }
    }
    case 'acknowledge_save': {
      const title = input.facts.savedTitle || (ar ? 'رحلتك' : 'your trip')
      const spokenText = pick(seed, ar
        ? [`حفظت «${title}» لك.`, `تم — «${title}» صارت في المحفوظات.`]
        : [`I saved “${title}” for you.`, `Done — “${title}” is in Saved Trips.`])
      return { displayText: spokenText, spokenText }
    }
    case 'acknowledge_edit': {
      const spokenText = pick(seed, ar
        ? ['تمام — قل لي وش تبي نغيّر وأعدّل الخطة.', 'جاهز للتعديل — الميزانية، الوجهة، التواريخ، أو أي تفصيل.']
        : ['Of course — tell me what to change and I will reshape the plan.', 'Ready when you are — budget, place, dates, or any detail.'])
      return { displayText: spokenText, spokenText }
    }
    case 'explain_unavailable': {
      const spokenText = pick(seed, ar
        ? ['ما عندي خطة جاهزة للحفظ بعد — خلّنا نكمّل التفاصيل أولاً.', 'لسه ما جهّزنا الخطة — كمّل معي شوي وبعدين نحفظ.']
        : ['There is no plan to save yet — let’s finish shaping it first.', 'We have not drafted the plan yet — a little more detail and we can save.'])
      return { displayText: spokenText, spokenText }
    }
    case 'propose_options':
    case 'advise': {
      const ack = acknowledge(input.facts, seed, ar)
      const draft = input.facts.planningDraft
      const framing = draft?.rankingNote
        || input.facts.recommendations?.[0]
        || pick(seed + 2, ar
          ? ['هذه قراءة مستشار على ما لدينا الآن.', 'خلّيني أضيّق الاتجاه قبل أي سؤال إضافي.']
          : ['Here is a consultant read on what we already know.', 'Let me narrow direction before asking for more detail.'])

      let hints = ''
      if (draft && draft.cities.length > 0) {
        const cityProse = draft.cities
          .slice(0, 3)
          .map((city) => (ar ? `${city.name} لأن ${city.why}` : `${city.name} because ${city.why}`))
          .join(ar ? '؛ ' : '; ')
        const b = draft.breakdown
        const fmt = (est: { low: number; high: number; mid: number; currency: string }) =>
          est.low === est.high ? `≈${est.mid} ${est.currency}` : `${est.low}–${est.high} ${est.currency}`
        const split = ar
          ? `تقدير أولي: طيران ${fmt(b.flights)}، فنادق ${fmt(b.hotels)}، طعام ${fmt(b.food)}.`
          : `First-pass ranges: flights ${fmt(b.flights)}, hotels ${fmt(b.hotels)}, food ${fmt(b.food)}.`
        const trade = draft.tradeoffs[0] || ''
        hints = [cityProse, split, trade].filter(Boolean).join(ar ? ' ' : ' ')
      } else if (input.facts.optionHints?.length) {
        hints = input.facts.optionHints.slice(0, 3).join(ar ? '؛ ' : '; ')
      }

      const beachCity = draft?.cities.some((c) =>
        /agadir|antalya|bali|beach|شاطئ|أكادير|أنطاليا|بالي|morocco|المغرب|marrakech|مراكش/i.test(`${c.name} ${c.why}`),
      )
      const styleCloser = beachCity
        ? (ar
          ? 'تميل لرحلة شاطئ واسترخاء، ولا تجربة مدينة وثقافة؟'
          : 'Would you like a relaxing beach trip or a city experience?')
        : null
      const questionFromFacts = input.facts.recommendations?.find((row) => /[?؟]\s*$/.test(row.trim()))
      const closer = styleCloser
        || questionFromFacts
        || pick(seed + 1, ar
          ? ['من هذه الاتجاهات، أيّها يشدّك أكثر؟', 'بحر وهدوء، ولا مدينة وثقافة؟']
          : ['From these directions, which interests you most?', 'Beach and calm, or city and culture?'])
      const displayText = [ack, framing, hints, closer].filter(Boolean).join(' ')
      return { displayText, spokenText: optimizeLocalSpoken(`${ack} ${framing} ${closer}`) }
    }
    case 'confirm_understanding': {
      const heard = input.facts.heardSummary?.join(ar ? ' · ' : ' · ') || acknowledge(input.facts, seed, ar)
      const spokenText = pick(seed, ar
        ? [`قبل ما أكمّل: ${heard}. إذا تمام، قل نعم.`, `هذا فهمي: ${heard}. نكمّل؟`]
        : [`Before I continue: ${heard}. If that is right, say yes.`, `Here is what I have: ${heard}. Shall I continue?`])
      return { displayText: spokenText, spokenText }
    }
    case 'collect_missing':
    case 'greet_or_continue':
    case 'general':
    default: {
      if (input.facts.recommendations?.length && !input.facts.missingSlots[0]) {
        // Domain facts / notes — rewrite into advisor voice (never echo form labels).
        const seedNote = input.facts.recommendations.join(' · ')
        const spokenText = pick(seed, ar
          ? [
            `هذا اللي عندي الآن: ${seedNote.slice(0, 180)}. تبي نكمّل من هنا؟`,
            `خلّيني ألخّص لك الوضع: ${seedNote.slice(0, 180)}.`,
          ]
          : [
            `Here is where things stand: ${seedNote.slice(0, 200)}. Shall we continue from here?`,
            `Quickly — ${seedNote.slice(0, 200)}.`,
          ])
        return { displayText: spokenText, spokenText }
      }
      const ack = acknowledge(input.facts, seed, ar)
      const slot = input.facts.missingSlots[0]
      if (!slot) {
        const bits = knownBits(input.facts, ar)
        const spokenText = bits.length
          ? pick(seed + 7, ar
            ? [`${ack} نقدر نبني على هذا الأساس متى ما جاهز.`, `${ack} قل «ابني الخطة» وأكمل لك.`]
            : [`${ack} We can build on this whenever you are ready.`, `${ack} Say “build the plan” and I will continue.`])
          : pick(seed + 7, ar
            ? ['عندي ما يكفي لنبدأ — قل «ابني الخطة» متى ما جاهز.', 'الصورة مكتملة تقريباً. نجهّز الخيارات؟']
            : ['I have enough to begin — say “build the plan” when you are ready.', 'The picture is nearly complete. Shall I put options together?'])
        return { displayText: spokenText, spokenText }
      }
      const question = askForSlot(slot, input.facts, seed + 11, ar)
      const displayText = `${ack} ${question}`
      return { displayText, spokenText: displayText }
    }
  }
}
