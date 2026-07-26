/**
 * Local conversation model — generative fallback when no remote LLM key is set.
 * Produces unique wording from Travel Facts (seeded by context), not fixed script templates.
 * Production with VITE_OPENAI_API_KEY uses the real OpenAI adapter instead.
 */

import { consultantAck } from '../../consultantIntelligence'
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
        'حتى أساعدك بالشكل المناسب: تميل لبحر وهدوء، ولا مدينة وثقافة — أو لديك وجهة معيّنة؟',
        'ما الإحساس الأقرب لرحلتك: استرخاء، معالم، ولا مغامرة؟',
        'لو حدّدنا طابع الرحلة أولاً، أرشّح الوجهات بدقة أعلى.',
      ],
      en: [
        'To help you properly: beach and calm, city and culture — or do you already have a place in mind?',
        'What feeling fits the trip best: recovery, landmarks, or a bit of adventure?',
        'If we lock the character of the trip first, I can recommend destinations with more confidence.',
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
  const dest = facts.known.destination || facts.known.destinations?.[0]
  if (bits.length === 0) {
    return pick(seed, ar
      ? ['فهمت.', 'خلّنا نضبط الاتجاه بهدوء.', 'جاهز نخطّط معك.']
      : ['Understood.', 'Let’s set the direction calmly.', 'Ready to plan with you.'])
  }
  // Destination praise when we only just locked a place.
  if (dest && bits.length <= 2 && bits[0] === dest) {
    return pick(seed + 1, ar
      ? [
        `${dest} اختيار رائع.`,
        `${dest} قاعدة ممتازة لنبدأ منها.`,
        `${dest} — حتى أساعدك بالشكل المناسب، نضيّق الاتجاه.`,
      ]
      : [
        `${dest} is an excellent choice.`,
        `${dest} is a strong base to start from.`,
        `${dest} — to help you properly, let’s narrow the direction.`,
      ])
  }
  const joined = bits.slice(0, 4).join(ar ? ' · ' : ' · ')
  return consultantAck(joined, ar ? 'ar' : 'en', seed + 3)
}

function renderPlanDisplay(facts: TravelFacts, ar: boolean): string {
  const plan = facts.plan
  if (!plan) {
    return ar
      ? 'لم نجهّز الخطة بعد — نكمّل التفاصيل أولاً.'
      : 'We have not finished the plan yet — let’s complete the details first.'
  }
  const lines: string[] = []
  lines.push(ar
    ? `جهّزت تصوّراً لـ${plan.destinations.join('، ')} — التفاصيل تحت، وقل لي لو تبي نعدّل.`
    : `I put together a first cut for ${plan.destinations.join(', ')} — details below; tell me what to refine.`)
  lines.push('')
  lines.push(`## ${plan.title}`)
  lines.push('')
  lines.push(ar ? '### الملخص' : '### Summary')
  lines.push(plan.summary)
  lines.push('')
  lines.push(ar ? `**المدة:** ${plan.durationDays} أيام` : `**Duration:** ${plan.durationDays} days`)
  lines.push(ar ? `**التواريخ:** ${plan.dates}` : `**Dates:** ${plan.dates}`)
  if (plan.estimatedTotal) {
    lines.push(ar
      ? `**التقدير:** ${plan.estimatedTotal.amount.toLocaleString('en-US')} ${plan.estimatedTotal.currency}`
      : `**Estimate:** ${plan.estimatedTotal.amount.toLocaleString('en-US')} ${plan.estimatedTotal.currency}`)
  }
  if (plan.budgetBreakdown.length) {
    lines.push('')
    lines.push(ar ? '### تفصيل الميزانية' : '### Budget breakdown')
    for (const row of plan.budgetBreakdown.slice(0, 6)) {
      lines.push(`- ${row.label}: ${row.amount.toLocaleString('en-US')} ${row.currency}`)
    }
  }
  if (plan.hotels[0]) {
    lines.push('')
    lines.push(ar ? '### الفنادق / الإقامة' : '### Hotels')
    for (const h of plan.hotels.slice(0, 3)) {
      lines.push(`- ${h.name} (${h.area})`)
    }
  }
  if (plan.flights[0]) {
    lines.push('')
    lines.push(ar ? '### الرحلات الجوية' : '### Flights')
    for (const f of plan.flights.slice(0, 4)) {
      lines.push(`- ${f.from} → ${f.to}${f.airline ? ` · ${f.airline}` : ''}`)
    }
  }
  if (plan.days.length) {
    lines.push('')
    lines.push(ar ? '### برنامج الأيام' : '### Daily itinerary')
    for (const day of plan.days) {
      lines.push('')
      lines.push(`**${day.title}** — ${day.location}`)
      for (const act of day.activities.slice(0, 4)) lines.push(`- ${act}`)
    }
  }
  if (plan.whyChoices.length) {
    lines.push('')
    lines.push(ar ? '### لماذا هذه الخيارات' : '### Why these choices')
    for (const reason of plan.whyChoices) lines.push(`- ${reason}`)
  }
  if (plan.tradeoffs && plan.tradeoffs.length) {
    lines.push('')
    lines.push(ar ? '### المقايضات' : '### Trade-offs')
    for (const t of plan.tradeoffs) lines.push(`- ${t}`)
  }
  if (plan.confidence != null && Number.isFinite(plan.confidence)) {
    lines.push('')
    lines.push(
      ar
        ? `### الثقة: ${Math.round(plan.confidence * 100)}%`
        : `### Confidence: ${Math.round(plan.confidence * 100)}%`,
    )
  }
  if (plan.alternatives && plan.alternatives.length) {
    lines.push('')
    lines.push(ar ? '### بدائل' : '### Alternatives')
    for (const a of plan.alternatives) lines.push(`- ${a}`)
  }
  if (plan.nextAction) {
    lines.push('')
    lines.push(ar ? '### الخطوة التالية' : '### Next action')
    lines.push(`- ${plan.nextAction}`)
  }
  return lines.join('\n')
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
      `جهّزت تصوّراً لـ${dest} لمدة ${plan.durationDays} أيام${hotel ? ` مع إقامة في ${hotel}` : ''}${total ? `، بتقدير حوالي ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}. التفاصيل على الشاشة.`,
      `أرشح هذه المسودة لـ${dest}. ${hotel ? `الإقامة الأنسب في حالتك: ${hotel}. ` : ''}راجع التفاصيل وقل لي وش نعدّل.`,
      `${dest} صارت أوضح الآن — خطة ${plan.durationDays} أيام جاهزة للمراجعة على الشاشة.`,
    ])
  }
  return pick(seed, [
    `Here is a first cut for ${dest} across ${plan.durationDays} days${hotel ? `, leaning toward ${hotel}` : ''}${total ? `, around ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}. Details are on screen.`,
    `I recommend this draft for ${dest}. ${hotel ? `Best stay fit for your case: ${hotel}. ` : ''}Skim the details and tell me what to tune.`,
    `${dest} is clearer now — a ${plan.durationDays}-day outline is ready on screen for you to react to.`,
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
        ? ['لم نجهّز الخطة للحفظ بعد — خلّنا نكمّل التفاصيل أولاً.', 'لسه ما جهّزنا الخطة — كمّل معي شوي وبعدين نحفظ.']
        : ['There is no plan to save yet — let’s finish shaping it first.', 'We have not drafted the plan yet — a little more detail and we can save.'])
      return { displayText: spokenText, spokenText }
    }
    case 'propose_options':
    case 'advise': {
      const ack = acknowledge(input.facts, seed, ar)
      const draft = input.facts.planningDraft
      const empathyOrTip = input.facts.recommendations?.find((row) =>
        !/[?؟]\s*$/.test(row.trim()) && row.trim().length > 12,
      )
      const framing = draft?.rankingNote
        || empathyOrTip
        || input.facts.recommendations?.[0]
        || pick(seed + 2, ar
          ? ['من واقع تجربتي، هذه قراءة أولية على ما لدينا الآن.', 'خلّيني أضيّق لك الاتجاه قبل أي تفاصيل إضافية.']
          : ['From experience, here is a first consultant read on what we know.', 'Let me narrow direction before asking for more detail.'])

      let hints = ''
      let primaryRec = ''
      if (draft && draft.cities.length > 0) {
        const top = draft.cities[0]!
        primaryRec = ar
          ? `أرشح ${top.name} لأنها ${top.why.replace(/^لأنها\s*/i, '').replace(/^because\s*/i, '')}`
          : `I recommend ${top.name} because ${top.why.replace(/^because\s*/i, '')}`
        const cityLines = draft.cities.slice(0, 3).map((city) =>
          ar
            ? `• ${city.name} — ${city.why}`
            : `• ${city.name} — ${city.why}`,
        )
        const b = draft.breakdown
        const fmt = (est: { low: number; high: number; mid: number; currency: string }) =>
          est.low === est.high ? `≈${est.mid} ${est.currency}` : `${est.low}–${est.high} ${est.currency}`
        const split = ar
          ? [
            `تقدير أوّلي (ثقة ${draft.confidence}):`,
            `• طيران ${fmt(b.flights)} — ${b.flights.reason}`,
            `• فنادق ${fmt(b.hotels)} — ${b.hotels.reason}`,
            `• طعام ${fmt(b.food)} — ${b.food.reason}`,
            `• تنقل ${fmt(b.transportation)} — ${b.transportation.reason}`,
            `• أنشطة ${fmt(b.activities)} — ${b.activities.reason}`,
          ].join('\n')
          : [
            `First-pass ranges (${draft.confidence} confidence):`,
            `• Flights ${fmt(b.flights)} — ${b.flights.reason}`,
            `• Hotels ${fmt(b.hotels)} — ${b.hotels.reason}`,
            `• Food ${fmt(b.food)} — ${b.food.reason}`,
            `• Transport ${fmt(b.transportation)} — ${b.transportation.reason}`,
            `• Activities ${fmt(b.activities)} — ${b.activities.reason}`,
          ].join('\n')
        const trade = draft.tradeoffs[0] ? `• ${draft.tradeoffs[0]}` : ''
        const partyNote = draft.travelerCount == null
          ? (ar
            ? '• عدد المسافرين غير محدد — لذلك المبالغ كمديات.'
            : '• Party size unknown — amounts are ranges, not point figures.')
          : ''
        hints = [primaryRec, ...cityLines, '', split, trade, partyNote].filter(Boolean).join('\n')
      } else if (input.facts.optionHints?.length) {
        const first = input.facts.optionHints[0]!
        const [title, ...whyParts] = first.split('—').map((s) => s.trim())
        if (title && whyParts.length) {
          primaryRec = ar
            ? `أرشح ${title} لأنها ${whyParts.join(' — ')}`
            : `I recommend ${title} because ${whyParts.join(' — ')}`
        }
        hints = [primaryRec, ...input.facts.optionHints.map((h) => `• ${h}`)].filter(Boolean).join('\n')
      }

      const beachCity = draft?.cities.some((c) =>
        /agadir|antalya|bali|beach|شاطئ|أكادير|أنطاليا|بالي/i.test(`${c.name} ${c.why}`),
      ) || input.facts.optionHints?.some((h) => /agadir|أكادير|beach|شاطئ/i.test(h))
      const historicCity = draft?.cities.some((c) =>
        /marrakech|مراكش|kyoto|كيوتو/i.test(`${c.name} ${c.why}`),
      ) || input.facts.optionHints?.some((h) => /marrakech|مراكش/i.test(h))
      const styleCloser = beachCity && historicCity
        ? (ar
          ? 'هل تميل أكثر للأجواء الشاطئية مثل أغادير، أم المدن التاريخية مثل مراكش؟'
          : 'Are you leaning more toward beach vibes like Agadir, or historic cities like Marrakech?')
        : beachCity
          ? (ar
            ? 'إذا كان هدفك الاسترخاء، هل نثبّت قاعدة شاطئية أولاً؟'
            : 'If the goal is recovery, shall we lock a beach base first?')
          : null
      const questionFromFacts = input.facts.recommendations?.find((row) => /[?؟]\s*$/.test(row.trim()))
      const closer = styleCloser
        || questionFromFacts
        || pick(seed + 1, ar
          ? ['من هذه الاتجاهات، أيّها يشدّك أكثر؟', 'بحر وهدوء، ولا مدينة وثقافة؟']
          : ['From these directions, which interests you most?', 'Beach and calm, or city and culture?'])
      const proactive = (input.facts.recommendations ?? [])
        .filter((row) => row !== framing && row !== closer && !/[?؟]\s*$/.test(row.trim()))
        .slice(0, 1)
      const displayText = [ack, framing, hints, ...proactive, closer].filter(Boolean).join('\n\n')
      return { displayText, spokenText: `${ack} ${primaryRec || framing} ${closer}` }
    }
    case 'confirm_understanding': {
      const heard = input.facts.heardSummary?.join(ar ? ' · ' : ' · ') || acknowledge(input.facts, seed, ar)
      const spokenText = pick(seed, ar
        ? [`قبل ما أكمّل: ${heard}. إذا تمام، قل نعم.`, `هذا فهمي: ${heard}. نكمّل؟`]
        : [`Before I continue: ${heard}. If that is right, say yes.`, `Here is what I understood: ${heard}. Shall I continue?`])
      return { displayText: spokenText, spokenText }
    }
    case 'collect_missing':
    case 'greet_or_continue':
    case 'general':
    default: {
      if (input.facts.recommendations?.length && !input.facts.missingSlots[0]) {
        const seedNote = input.facts.recommendations.join(' · ')
        const spokenText = pick(seed, ar
          ? [
            `هذا ملخص الوضع الآن: ${seedNote.slice(0, 180)}. نكمّل من هنا؟`,
            `خلّيني ألخّص لك الصورة: ${seedNote.slice(0, 180)}.`,
          ]
          : [
            `Here is where things stand: ${seedNote.slice(0, 200)}. Shall we continue from here?`,
            `Quickly — ${seedNote.slice(0, 200)}.`,
          ])
        return { displayText: spokenText, spokenText }
      }
      const ack = acknowledge(input.facts, seed, ar)
      const empathy = input.facts.recommendations?.find((row) =>
        /مبروك|أطفال|قيمة|congrats|children|value/i.test(row),
      )
      const slot = input.facts.missingSlots[0]
      if (!slot) {
        const bits = knownBits(input.facts, ar)
        const spokenText = bits.length
          ? pick(seed + 7, ar
            ? [`${ack} نقدر نبني على هذا الأساس متى ما جاهز.`, `${ack} قل «ابني الخطة» وأكمل لك.`]
            : [`${ack} We can build on this whenever you are ready.`, `${ack} Say “build the plan” and I will continue.`])
          : pick(seed + 7, ar
            ? ['الصورة كافية لنبدأ — قل «ابني الخطة» متى ما جاهز.', 'الصورة مكتملة تقريباً. نجهّز أفضل خيار في حالتك؟']
            : ['We have enough to begin — say “build the plan” when you are ready.', 'The picture is nearly complete. Shall I assemble the best fit for your case?'])
        return { displayText: spokenText, spokenText }
      }
      const question = askForSlot(slot, input.facts, seed + 11, ar)
      const displayText = [ack, empathy, question].filter(Boolean).join(' ')
      return { displayText, spokenText: displayText }
    }
  }
}
