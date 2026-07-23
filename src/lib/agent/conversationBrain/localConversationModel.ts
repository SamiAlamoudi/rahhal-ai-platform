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
        'أي وجهة نخطط لها؟',
        'وين الوجهة؟',
        'سمّ لي الوجهة ونبني عليها.',
      ],
      en: [
        'Which destination should we plan for?',
        'Where are you headed?',
        'Name the destination and I will build from there.',
      ],
    },
    durationDays: {
      ar: [
        dest ? `متى تقريباً تقصد ${dest}، وكم يوم؟` : 'متى تقريباً، وكم يوم؟',
        dest ? `ما الإطار الزمني لـ${dest}؟` : 'ما الإطار الزمني للرحلة؟',
        'أحتاج توقيتاً تقريباً أو عدد الأيام فقط.',
      ],
      en: [
        dest ? `When roughly for ${dest}, and for how many days?` : 'When roughly, and for how many days?',
        dest ? `What timing window works for ${dest}?` : 'What timing window works?',
        'I only need an approximate period or a day count.',
      ],
    },
    budgetAmount: {
      ar: [
        'ما سقف الميزانية، أو نتركها مرنة؟',
        'هل عندك ميزانية محددة، أم مرنة؟',
        'أضبط الخيارات على ميزانية معيّنة، أو بلا سقف؟',
      ],
      en: [
        'What budget ceiling should I use — or keep it flexible?',
        'Do you have a budget in mind, or shall we keep it open?',
        'Should I constrain options to a budget, or leave it flexible?',
      ],
    },
    travelers: {
      ar: [
        'كم شخص يسافر؟',
        'الرحلة فردية، لاثنين، أم أكثر؟',
      ],
      en: [
        'How many people are traveling?',
        'Solo, for two, or a larger party?',
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
      ? ['فهمت.', 'خلّنا نضبط الأساسيات.', 'جاهز نبدأ التخطيط.']
      : ['Understood.', 'Let us lock the essentials.', 'Ready to plan.'])
  }
  const joined = bits.slice(0, 4).join(ar ? ' · ' : ' · ')
  return pick(seed + 3, ar
    ? [
      `فهمت: ${joined}.`,
      `عندي: ${joined}.`,
      `${joined} — هذا الأساس.`,
    ]
    : [
      `Understood: ${joined}.`,
      `I have: ${joined}.`,
      `${joined} — that is the base.`,
    ])
}

function renderPlanDisplay(facts: TravelFacts, ar: boolean): string {
  const plan = facts.plan
  if (!plan) return ar ? 'ما عندي خطة جاهزة بعد.' : 'I do not have a finished plan yet.'
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
      `عندي مسودة قوية لـ${dest}. ${hotel ? `أميل لـ${hotel}. ` : ''}راجع التفاصيل وقل لي وش نعدّل.`,
      `${dest} صارت أوضح الآن — خطة ${plan.durationDays} أيام جاهزة للمراجعة على الشاشة.`,
    ])
  }
  return pick(seed, [
    `I have a first cut for ${dest} across ${plan.durationDays} days${hotel ? `, leaning toward ${hotel}` : ''}${total ? `, around ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}. Details are on screen.`,
    `There is a solid draft for ${dest}. ${hotel ? `I like ${hotel} for the stay. ` : ''}Skim the details and tell me what to tune.`,
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
        ? ['ما عندي خطة جاهزة للحفظ بعد — خلّنا نكمّل التفاصيل أولاً.', 'لسه ما جهّزنا الخطة — كمّل معي شوي وبعدين نحفظ.']
        : ['There is no plan to save yet — let’s finish shaping it first.', 'We have not drafted the plan yet — a little more detail and we can save.'])
      return { displayText: spokenText, spokenText }
    }
    case 'propose_options':
    case 'advise': {
      const ack = acknowledge(input.facts, seed, ar)
      const hints = input.facts.optionHints?.length
        ? input.facts.optionHints.map((h, i) => `${i + 1}. ${h}`).join('\n')
        : ''
      const closer = pick(seed + 1, ar
        ? ['أي اتجاه نكمّل عليه؟', 'وش الأنسب لك من هالخيارات؟']
        : ['Which direction should we take?', 'Which of these fits you best?'])
      const displayText = [ack, hints, closer].filter(Boolean).join('\n\n')
      return { displayText, spokenText: `${ack} ${closer}` }
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
