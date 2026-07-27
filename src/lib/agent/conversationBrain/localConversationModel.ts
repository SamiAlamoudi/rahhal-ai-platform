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
        'خلّينا نضيّق الإحساس أولاً: بحر وهدوء، ولا مدينة وثقافة — أو عندك وجهة معيّنة؟',
        'وش طابع الرحلة في بالك: استرخاء، معالم، ولا مغامرة؟ هذا يكفي لأضيّق الوجهات.',
        'لو وصفت لي إحساس الرحلة، أبني عليك اتجاهات واضحة بسرعة.',
      ],
      en: [
        'Let’s narrow the feeling first: beach and calm, or city and culture — or do you already have a place in mind?',
        'What character of trip are you imagining: recovery, landmarks, or adventure? That is enough for me to narrow destinations.',
        'Describe the feeling of the trip and I will put clear directions in front of you.',
      ],
    },
    durationDays: {
      ar: [
        dest
          ? `${dest} يتغيّر كثيراً حسب مدة الإقامة. تميل لعطلة قصيرة مركّزة، ولا أسبوع كامل بهدوء؟`
          : 'تميل لعطلة قصيرة مركّزة، ولا أسبوع كامل تقريباً؟',
        dest
          ? `لـ${dest}: أيام قليلة بإيقاع سريع، ولا إقامة أطول أهدأ؟`
          : 'إيقاع الرحلة: أيام قليلة مركّزة، ولا إقامة أطول؟',
      ],
      en: [
        dest
          ? `${dest} changes a lot with trip length. Are you thinking a short focused break, or closer to a full week?`
          : 'Are you thinking a short focused break, or closer to a full week?',
        dest
          ? `For ${dest}: a few sharper days, or a longer, slower stay?`
          : 'A few focused days, or a longer, slower stay?',
      ],
    },
    budgetAmount: {
      ar: [
        'نضبط الخيارات على سقف واضح عشان أحسّن توزيع الطيران والإقامة والأنشطة، ولا نتركها مرنة ونقارن مستويات؟',
        'تحب أركّز على شريحة مريحة ومتوازنة، ولا أقصى قيمة مقابل السعر؟',
      ],
      en: [
        'Shall I shape options around a clear ceiling so I can optimize flights, stays and activities — or keep it flexible and compare tiers?',
        'Would you rather see a comfortable balanced band, or stretch for maximum value?',
      ],
    },
    travelers: {
      ar: [
        'عشان أحسّن التوزيع بدقة: الرحلة فردية، لاثنين، ولا أجواء عائلية؟',
        'تميل لتجربة هادئة لشخصين، ولا مجموعة؟',
      ],
      en: [
        'So I can optimize the split accurately: is this solo, for two, or a family-style trip?',
        'Are you imagining a quiet trip for two, or a larger group?',
      ],
    },
    origin: {
      ar: [
        'من أي مدينة تبي الإقلاع؟ هذا يضبط تقدير الطيران فوراً.',
        'وين نقطة المغادرة؟',
      ],
      en: [
        'Which city will you depart from? That locks a realistic flight range immediately.',
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

/** Brief lead-in only — never return this alone; always pair with an action. */
function reflectKnown(facts: TravelFacts, seed: number, ar: boolean): string {
  const bits = knownBits(facts, ar)
  if (bits.length === 0) {
    return pick(seed, ar
      ? ['نبني الرحلة معاً خطوة بخطوة.', 'نضبط الأساسيات بهدوء.', 'نبدأ التخطيط من الآن.']
      : ['Let’s build the trip together step by step.', 'Let’s lock the essentials calmly.', 'We start planning from here.'])
  }
  const joined = bits.slice(0, 4).join(ar ? ' · ' : ' · ')
  return pick(seed + 3, ar
    ? [
      `فهمت: ${joined}.`,
      `${joined} — نبني عليها.`,
      `${joined} — هذا الأساس.`,
    ]
    : [
      `Understood: ${joined}.`,
      `${joined} — we can build on that.`,
      `${joined} — that is the base.`,
    ])
}

/**
 * Soft recommendation that replaces a slot question when we can infer a usable default.
 * Returns null only when asking is still required to unblock progress.
 */
function recommendInsteadOfAsk(
  slot: string,
  facts: TravelFacts,
  seed: number,
  ar: boolean,
): string | null {
  const dest = facts.known.destination || facts.known.destinations?.[0]
  const travelerType = facts.known.travelerType

  if (slot === 'travelers' && (travelerType === 'couple' || travelerType === 'solo' || travelerType === 'family')) {
    if (travelerType === 'couple') {
      return pick(seed, ar
        ? ['أفترض رحلة لشخصين وأضبط التوزيع على هذا الأساس — صحّح لي لو غير كذا.', 'بما إنها أجواء ثنائية، أمشي على مسافرَين كافتراض واضح.']
        : ['I am assuming two travelers and optimizing around that — correct me if not.', 'Given the couple vibe, I will plan for two travelers as the default.'])
    }
    if (travelerType === 'solo') {
      return pick(seed, ar
        ? ['أفترض مسافراً واحداً وأبني الخطة على إيقاع مرن.', 'أمشي على رحلة فردية كافتراض واضح.']
        : ['I am assuming a solo traveler and keeping the pace flexible.', 'I will plan this as a solo trip by default.'])
    }
    return pick(seed, ar
      ? ['أفترض أجواء عائلية وأميل لإيقاع أهدأ وإقامة مناسبة للعائلة.', 'أمشي على توزيع عائلي كافتراض عملي الآن.']
      : ['I am assuming a family-style trip and leaning toward a calmer pace and family-friendly stay.', 'I will use a family split as the working default.'])
  }

  if (slot === 'durationDays' && dest) {
    return pick(seed, ar
      ? [
        `ثبّتّ لـ${dest} أساساً من 5–7 أيام عشان يضبط الطيران والإيقاع معاً — بدون استعجال.`,
        `نفّذت افتراض أسبوع تقريباً لـ${dest} كنقطة انطلاق للرحلة كاملة؛ نقدر نقصّر أو نطوّل بعدين.`,
      ]
      : [
        `I set a 5–7 day base for ${dest} so flights and pace lock together — without rushing.`,
        `I locked roughly a week for ${dest} as the working start for the whole journey; we can shorten or extend later.`,
      ])
  }

  if (slot === 'budgetAmount' && dest) {
    return pick(seed, ar
      ? [
        `ضبطت لـ${dest} شريحة متوازنة وأعيد توزيع الطيران والإقامة معاً داخلها — لو عندك سقف أدق نعيد الضبط فوراً.`,
        `أمشي على مستوى متوسط-مريح لـ${dest} عشان الرحلة كاملة تتحسن، مو بس رقم الميزانية.`,
      ]
      : [
        `I set a comfortable mid tier for ${dest} and retune flights and stays together inside it — give a harder ceiling anytime and I retune.`,
        `I am running a balanced comfortable band for ${dest} so the whole journey improves — not only the budget number.`,
      ])
  }

  if (slot === 'hotelPreference' && dest) {
    return pick(seed, ar
      ? [
        `قارنت لـ${dest} وبدأت بإقامة مركزية سهلة التنقل — نبدّل لهدوء أكثر إذا صار الطابع استرخاء.`,
        `اخترت لـ${dest} فندقاً بموقع عملي وسط الحركة السياحية كأفضل افتراض أول.`,
      ]
      : [
        `I compared lodging for ${dest} and started with a central, easy-to-reach stay — we can switch quieter if the trip turns recovery-focused.`,
        `I selected a practical central hotel for ${dest} as the first default.`,
      ])
  }

  // Origin / destination usually block progress if unknown — keep asking.
  return null
}

/** Concrete Execute / Search / Compare / Recommend closer — act first, explain briefly; no permission asks. */
function advanceForGoal(facts: TravelFacts, seed: number, ar: boolean): string {
  const dest = facts.known.destination || facts.known.destinations?.[0]
  switch (facts.currentGoal) {
    case 'Collect destination':
      // Preference fork only when destination is still open.
      return pick(seed + 5, ar
        ? [
          'ضيّقت الاتجاه إلى فرعين عمليين: بحر وهدوء، أو مدينة وثقافة — نثبّت واحداً ونكمّل البحث.',
          'أوصي نبدأ بساحل استرخاء أو مدينة معالم كأقوى مسارين؛ اختر الاتجاه وأبني عليه فوراً.',
        ]
        : [
          'I narrowed this to two workable forks: beach and calm, or city and culture — lock one and I continue the search.',
          'I recommend a recovery coast or a landmark city as the strongest opening paths; pick the direction and I build on it immediately.',
        ])
    case 'Compare hotels':
      return pick(seed + 5, ar
        ? [
          dest
            ? `قارنت لـ${dest} إقامة مركزية مقابل خيار أهدأ — أميل للمركزي كأفضل افتراض أول.`
            : 'قارنت إقامة مركزية مقابل خيار أهدأ — أميل للمركزي كأفضل افتراض أول.',
          dest
            ? `نفّذت مقارنة سريعة لإقامة ${dest}: موقع عملي وسط الحركة السياحية هو التوصية الأولى.`
            : 'نفّذت مقارنة سريعة للإقامة: موقع عملي وسط الحركة السياحية هو التوصية الأولى.',
        ]
        : [
          dest
            ? `I compared a central stay vs a quieter one for ${dest} — central wins as the first default.`
            : 'I compared a central stay vs a quieter one — central wins as the first default.',
          dest
            ? `I ran a quick lodging compare for ${dest}: a practical, well-located hotel is the first recommendation.`
            : 'I ran a quick lodging compare: a practical, well-located hotel is the first recommendation.',
        ])
    case 'Finalize booking':
      return pick(seed + 5, ar
        ? [
          'نفّذت ملخص الحجز والدفع الآن عشان نثبّت بوضوح — راجع الناتج وصحّح لو لزم.',
          'جهّزت مراجعة الدفع التالية؛ الخطوة الجاية تأكيد الحجز على هذا الملخص.',
        ]
        : [
          'I prepared the booking and payment summary now so we can confirm cleanly — review the result and correct if needed.',
          'Payment summary is ready; next step is confirming the booking on this pass.',
        ])
    case 'Confirm itinerary':
      return pick(seed + 5, ar
        ? [
          'ثبّتّ المسودة كأساس وأقفل الأيام أولاً — عدّل أي يوم أو إقامة لو تبي.',
          'أكّدت البرنامج كمسودة عمل؛ الفندق قابل للتعديل فوراً بدون إعادة البداية.',
        ]
        : [
          'I locked this draft as the base and confirmed the days first — correct any day or stay as needed.',
          'I confirmed the program as the working draft; the hotel can be retuned immediately without restarting.',
        ])
    case 'Recommend flights':
    default:
      return pick(seed + 5, ar
        ? [
          dest
            ? `بحثت اتجاه الطيران لـ${dest} وأوصي بنافذة مغادرة صباحية كافتراض مريح لمعظم رحلات الترفيه.`
            : 'بحثت اتجاه الطيران وأوصي بنافذة مغادرة صباحية كافتراض مريح لمعظم رحلات الترفيه.',
          dest
            ? `جهّزت توصية طيران لـ${dest}: صباح + أقصى مرونة ممكنة في التذكرة.`
            : 'جهّزت توصية طيران: صباح + أقصى مرونة ممكنة في التذكرة.',
        ]
        : [
          dest
            ? `I searched flight direction for ${dest} and recommend morning departure windows as the comfortable leisure default.`
            : 'I searched flight direction and recommend morning departure windows as the comfortable leisure default.',
          dest
            ? `Flight recommendation for ${dest} is ready: morning departure and the most flexible ticket we can justify.`
            : 'Flight recommendation is ready: morning departure and the most flexible ticket we can justify.',
        ])
  }
}

function renderPlanDisplay(facts: TravelFacts, ar: boolean): string {
  const plan = facts.plan
  if (!plan) {
    return ar
      ? 'لسه نكمّل التفاصيل قبل ما نثبّت الخطة.'
      : 'We still need a little more detail before locking the plan.'
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
    return `${reflectKnown(facts, seed, ar)} ${advanceForGoal(facts, seed + 1, ar)}`
  }
  const dest = plan.destinations[0] || (ar ? 'وجهتك' : 'your trip')
  const hotel = plan.hotels[0]?.name
  const total = plan.estimatedTotal
  if (ar) {
    return pick(seed, [
      `جهّزت تصوّراً لـ${dest} لمدة ${plan.durationDays} أيام${hotel ? ` مع إقامة في ${hotel}` : ''}${total ? `، بتقدير حوالي ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}. التفاصيل على الشاشة.`,
      `مسودة قوية لـ${dest} جاهزة. ${hotel ? `أميل لـ${hotel}. ` : ''}راجع التفاصيل وقل لي وش نعدّل.`,
      `${dest} صارت أوضح الآن — خطة ${plan.durationDays} أيام جاهزة للمراجعة على الشاشة.`,
    ])
  }
  return pick(seed, [
    `I drafted ${dest} across ${plan.durationDays} days${hotel ? `, leaning toward ${hotel}` : ''}${total ? `, around ${total.amount.toLocaleString('en-US')} ${total.currency}` : ''}. Details are on screen.`,
    `A solid draft for ${dest} is ready. ${hotel ? `I like ${hotel} for the stay. ` : ''}Skim the details and tell me what to tune.`,
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
      const next = advanceForGoal(input.facts, seed + 2, ar)
      const spokenText = pick(seed, ar
        ? [`حفظت «${title}» لك. ${next}`, `تم تنفيذ الحفظ لـ«${title}». ${next}`]
        : [`I saved “${title}” for you. ${next}`, `Executed — “${title}” is in Saved Trips. ${next}`])
      return { displayText: spokenText, spokenText }
    }
    case 'acknowledge_edit': {
      const spokenText = pick(seed, ar
        ? ['جاهز أعدّل الخطة الآن — قل التغيير المطلوب: الميزانية، الوجهة، التواريخ، أو أي تفصيل.', 'نفّذ التعديل مباشرة: وش أول تغيير نسويه في الخطة؟']
        : ['I will reshape the plan now — name the change: budget, place, dates, or any detail.', 'Executing the edit path: what is the first change we make to the plan?'])
      return { displayText: spokenText, spokenText }
    }
    case 'explain_unavailable': {
      const next = advanceForGoal(input.facts, seed + 2, ar)
      const spokenText = pick(seed, ar
        ? [`لسه ما ثبّتنا خطة للحفظ. ${next}`, `نكمل تشكيل الرحلة أولاً ثم نحفظ بثقة. ${next}`]
        : [`We have not locked a plan to save yet. ${next}`, `Let’s finish shaping the trip first, then save with confidence. ${next}`])
      return { displayText: spokenText, spokenText }
    }
    case 'propose_options':
    case 'advise': {
      const ack = reflectKnown(input.facts, seed, ar)
      const draft = input.facts.planningDraft
      const framing = draft?.rankingNote
        || input.facts.recommendations?.[0]
        || pick(seed + 2, ar
          ? ['أضبط الرحلة كاملة على ما عرفناه — مو بس آخر جملة.', 'نحسّن المسار الكلي: وجهة، طيران، إقامة، وإيقاع.']
          : ['I am tuning the whole trip from what we know — not only the last sentence.', 'Improving the full journey: destination, flights, stay, and pace.'])

      // Discovery stays conversational — light city comparisons, not a full cost report.
      let hints = ''
      if (draft && draft.cities.length > 0) {
        const cityLines = draft.cities.slice(0, 3).map((city) => `• ${city.name} — ${city.why}`)
        const trade = draft.tradeoffs[0] ? `• ${draft.tradeoffs[0]}` : ''
        hints = [...cityLines, trade].filter(Boolean).join('\n')
      } else if (input.facts.optionHints?.length) {
        hints = input.facts.optionHints.slice(0, 3).map((h) => `• ${h}`).join('\n')
      }

      const beachCity = draft?.cities.some((c) =>
        /agadir|antalya|bali|beach|شاطئ|أكادير|أنطاليا|بالي/i.test(`${c.name} ${c.why}`),
      )
      const hasDestination = Boolean(
        input.facts.known.destination || input.facts.known.destinations?.length,
      )
      // Infer → Execute/Recommend: act when destination is known; ask only for a true preference fork.
      const styleCloser = beachCity
        ? (ar
          ? 'أميل لبدء الشاطئ كافتراض للاسترخاء — نقدر نحوّل لمدينة إذا تبي إيقاعاً أكثر حركة.'
          : 'I am leaning beach-first as the recovery default — we can pivot to a city if you want more energy.')
        : null
      const recommendCloser = pick(seed + 1, ar
        ? [
          draft?.cities[0]
            ? `أنصح نبدأ بـ${draft.cities[0].name} كأقوى افتراض الآن، ونعدّل لو حسّيت بغير اتجاه.`
            : 'أنصح نثبّت أقوى اتجاه من القائمة أعلاه كافتراض عملي ونكمّل عليه.',
          'أفترض الاتجاه الأقوى مما سبق وأبني عليه — صحّح لي لو تبي فرعاً آخر.',
        ]
        : [
          draft?.cities[0]
            ? `I recommend starting with ${draft.cities[0].name} as the strongest default now — correct me if you want another fork.`
            : 'I recommend locking the strongest direction above as the working default and building on it.',
          'I will assume the strongest direction above and build on it — steer me if you want the other fork.',
        ])
      const questionFromFacts = input.facts.recommendations?.find((row) => /[?؟]\s*$/.test(row.trim()))
      const needsPreferenceAsk = !hasDestination && !draft?.cities.length && !input.facts.optionHints?.length && !beachCity
      const closer = styleCloser
        || (hasDestination && !draft?.cities.length && !input.facts.optionHints?.length
          ? advanceForGoal(input.facts, seed + 1, ar)
          : null)
        || (!needsPreferenceAsk ? recommendCloser : null)
        || questionFromFacts
        || (needsPreferenceAsk
          ? pick(seed + 1, ar
            ? ['بحر وهدوء، ولا مدينة وثقافة — أيّهما نثبّت؟']
            : ['Beach and calm, or city and culture — which do we lock?'])
          : recommendCloser)
      const displayText = [ack, framing, hints, closer].filter(Boolean).join('\n\n')
      const spokenText = [ack, framing, closer].filter(Boolean).join(' ')
      return { displayText, spokenText }
    }
    case 'confirm_understanding': {
      const heard = input.facts.heardSummary?.join(ar ? ' · ' : ' · ') || reflectKnown(input.facts, seed, ar)
      const next = advanceForGoal(input.facts, seed + 3, ar)
      const spokenText = pick(seed, ar
        ? [`أؤكّد فهمي: ${heard}. ${next}`, `هذا تثبيتي: ${heard}. ${next}`]
        : [`Confirming what I have: ${heard}. ${next}`, `Locked in: ${heard}. ${next}`])
      return { displayText: spokenText, spokenText }
    }
    case 'collect_missing':
    case 'greet_or_continue':
    case 'general':
    default: {
      if (input.facts.recommendations?.length && !input.facts.missingSlots[0]) {
        // Domain facts / notes — rewrite into advisor voice (never echo form labels).
        const seedNote = input.facts.recommendations.join(' · ')
        const next = advanceForGoal(input.facts, seed + 2, ar)
        const spokenText = pick(seed, ar
          ? [
            `هذا وضع الرحلة الآن: ${seedNote.slice(0, 180)}. ${next}`,
            `خلّيني ألخّص لك الوضع: ${seedNote.slice(0, 180)}. ${next}`,
          ]
          : [
            `Here is where the trip stands: ${seedNote.slice(0, 200)}. ${next}`,
            `Quickly — ${seedNote.slice(0, 200)}. ${next}`,
          ])
        return { displayText: spokenText, spokenText }
      }
      const ack = reflectKnown(input.facts, seed, ar)
      const slot = input.facts.missingSlots[0]
      if (!slot) {
        const next = advanceForGoal(input.facts, seed + 7, ar)
        const spokenText = `${ack} ${next}`
        return { displayText: spokenText, spokenText }
      }
      const inferred = recommendInsteadOfAsk(slot, input.facts, seed + 11, ar)
      if (inferred) {
        const displayText = `${ack} ${inferred}`
        return { displayText, spokenText: displayText }
      }
      // Ask only when uncertainty still blocks progress.
      const question = askForSlot(slot, input.facts, seed + 11, ar)
      const displayText = `${ack} ${question}`
      return { displayText, spokenText: displayText }
    }
  }
}
