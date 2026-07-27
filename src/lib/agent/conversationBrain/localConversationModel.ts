/**
 * Local conversation model — generative fallback when no remote LLM key is set
 * (or when the remote path fails). Must still sound like a premium Arabic consultant.
 */

import type { TravelFacts } from './travelFacts'
import {
  destinationLabel,
  formatBudgetPhrase,
  formatConsultantParagraphs,
  polishConsultantProse,
} from './consultantLocale'

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

function optimizeLocalSpoken(text: string, locale: 'ar' | 'en'): string {
  return polishConsultantProse(text, locale)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 360)
}

function dest(facts: TravelFacts): string {
  return destinationLabel(
    facts.known.destination || facts.known.destinations?.[0] || facts.plan?.destinations?.[0],
    facts.locale,
  )
}

/** Next hard intake slot derived from known facts (not only concierge askFields). */
export function nextHardSlot(facts: TravelFacts): string | null {
  const known = facts.known
  const isFilled = (slot: string): boolean => {
    if (slot === 'destination') {
      return Boolean(known.destination || (known.destinations && known.destinations.length > 0))
    }
    if (slot === 'durationDays') return known.durationDays != null
    if (slot === 'budgetAmount') return known.budgetAmount != null || Boolean(known.budgetFlexible)
    if (slot === 'travelers') return known.travelers != null || Boolean(known.travelerType)
    if (slot === 'origin') return Boolean(known.origin)
    return false
  }

  const ordered = [
    ...facts.missingSlots,
    'destination',
    'durationDays',
    'budgetAmount',
    'travelers',
    'origin',
  ]
  const seen = new Set<string>()
  for (const slot of ordered) {
    if (!slot || seen.has(slot)) continue
    seen.add(slot)
    if (!['destination', 'durationDays', 'budgetAmount', 'travelers', 'origin'].includes(slot)) {
      continue
    }
    if (!isFilled(slot)) return slot
  }
  return null
}

function askForSlot(slot: string, facts: TravelFacts, seed: number, ar: boolean): string {
  const d = dest(facts)
  const variants: Record<string, { ar: string[]; en: string[] }> = {
    destination: {
      ar: [
        'تميلون لبحر وهدوء، ولا مدينة وثقافة — أو عندكم وجهة معيّنة؟',
        'ما الإحساس الذي تبحثون عنه: استرخاء، معالم، أم مزيج هادئ؟',
      ],
      en: [
        'Are you imagining beach and calm, city and culture — or a place already in mind?',
        'What feeling should lead: recovery, landmarks, or a quiet mix?',
      ],
    },
    durationDays: {
      ar: [
        d !== 'وجهتكم'
          ? `لـ${d}، هل تفكّرون في عطلة قصيرة، أم أسبوع كامل تقريباً؟`
          : 'هل تميلون لعطلة قصيرة، أم أسبوع كامل تقريباً؟',
      ],
      en: [
        `For ${d}, a short break or closer to a full week?`,
      ],
    },
    budgetAmount: {
      ar: [
        'ما الميزانية التقريبية التي ترتاحون لها لهذه الرحلة؟',
        'نضبط الخيارات على سقف واضح للميزانية، أم نتركها مرنة؟',
      ],
      en: [
        'What approximate budget feels comfortable for this trip?',
        'Shall I shape options around a clear ceiling, or keep it flexible?',
      ],
    },
    travelers: {
      ar: ['الرحلة فردية، لاثنين، أم أجواء عائلية؟'],
      en: ['Is this solo, for two, or a family-style trip?'],
    },
    origin: {
      ar: ['من أي مدينة تكون المغادرة؟'],
      en: ['Which city will you depart from?'],
    },
  }
  const pack = variants[slot] ?? {
    ar: ['ما التفصيلة الناقصة حتى أكمل التخطيط؟'],
    en: ['What one detail is still blocking the plan?'],
  }
  return pick(seed, ar ? pack.ar : pack.en)
}

function softAck(facts: TravelFacts, seed: number, ar: boolean): string {
  const d = dest(facts)
  const days = facts.known.durationDays
  const couple = facts.known.travelerType === 'couple' || facts.known.travelers === 2
  const budget = formatBudgetPhrase(facts.known.budgetAmount, facts.known.budgetCurrency, facts.locale)

  if (ar) {
    if (d !== 'وجهتكم' && days && budget && couple) {
      const durationPhrase = days === 7 ? 'أسبوع' : `${days} أيام`
      return pick(seed, [
        `ميزانيتكم ممتازة لرحلة ${durationPhrase} إلى ${d}.`,
        `${d} لـ${durationPhrase} مع شريكتكم — إطار واضح وجميل نقدر نبني عليه.`,
      ])
    }
    if (d !== 'وجهتكم' && days) {
      const durationPhrase = days <= 3
        ? 'عطلة قصيرة'
        : days === 7
          ? 'أسبوع'
          : `${days} أيام`
      return pick(seed, [
        `تمام — ${durationPhrase} في ${d} مناسبة جداً.`,
        `حسناً، نخليها ${durationPhrase} في ${d}.`,
      ])
    }
    if (d !== 'وجهتكم') {
      // Never leave the traveler with a dead-end ack — confirm then continue.
      return pick(seed, [
        `ممتاز، سأبني الرحلة على ${d}.`,
        `حسنًا — نثبّت ${d} ونكمل التخطيط.`,
      ])
    }
    return pick(seed, ['فهمت طلبكم.', 'خلونا نضبط الأساسيات بهدوء.'])
  }

  if (d !== 'your destination' && days && budget && couple) {
    return `A ${days}-day trip to ${d} for two within ${budget} is a strong starting frame.`
  }
  return d !== 'your destination'
    ? `Great — I will build the trip around ${d}.`
    : 'Understood.'
}

/**
 * Destination confirmed → always continue (ask next slot or start shaping the plan).
 * Never return a bare acknowledgement.
 */
function continueAfterDestination(facts: TravelFacts, seed: number, ar: boolean): LocalConversationResult {
  const d = dest(facts)
  const slot = nextHardSlot(facts)
  const ack = softAck(facts, seed, ar)

  if (slot && slot !== 'destination') {
    const question = askForSlot(slot, facts, seed + 11, ar)
    const displayText = polishConsultantProse(
      formatConsultantParagraphs(`${ack}\n\n${question}`),
      facts.locale,
    )
    return {
      displayText,
      spokenText: optimizeLocalSpoken(`${ack} ${question}`, facts.locale),
    }
  }

  // Hard intake complete enough — move into consulting / plan shaping.
  if (ar) {
    const lines = [
      ack,
      `سأجهّز لكم أفضل الرحلات والفنادق المناسبة في ${d !== 'وجهتكم' ? d : 'وجهتكم'}.`,
      'تميلون لإيقاع مرتاح، أم لأيام أغنى بالمعالم؟',
    ]
    const displayText = polishConsultantProse(formatConsultantParagraphs(lines.join('\n\n')), 'ar')
    return {
      displayText,
      spokenText: optimizeLocalSpoken(
        `${ack} سأجهّز الرحلات والفنادق. تميلون لإيقاع مرتاح أم لأيام أغنى بالمعالم؟`,
        'ar',
      ),
    }
  }

  const displayText = `${ack} I will shape flights and stays next. Prefer a relaxed pace, or a fuller landmark day?`
  return { displayText, spokenText: displayText }
}

function moroccoStyleAdvice(facts: TravelFacts, seed: number): LocalConversationResult | null {
  const rawDest = (facts.known.destination || facts.known.destinations?.[0] || '').toLowerCase()
  const isMorocco = /morocco|المغرب|marrakech|مراكش|agadir|أكادير/.test(
    `${rawDest} ${facts.planningDraft?.cities.map((c) => c.name).join(' ') || ''}`,
  )
  if (!isMorocco || facts.locale !== 'ar') return null

  const budget = formatBudgetPhrase(facts.known.budgetAmount, facts.known.budgetCurrency, 'ar')
  const days = facts.known.durationDays || 7
  const durationPhrase = days === 7 ? 'أسبوع' : `${days} أيام`
  const opening = budget
    ? `ميزانيتكم ممتازة لرحلة ${durationPhrase} إلى المغرب.`
    : `رحلة ${durationPhrase} إلى المغرب إطار ممتاز لنبدأ منه.`

  const body = pick(seed, [
    [
      opening,
      'إذا كنتم تبحثون عن الاسترخاء فأرشح أكادير،',
      'أما إذا كنتم تفضلون الثقافة والأسواق التقليدية فمراكش خيار رائع.',
      'بعد أن تختاروا المدينة سأجهز لكم أفضل الرحلات والفنادق المناسبة.',
    ].join('\n\n'),
    [
      opening,
      'مراكش تناسبكم إن أحببتم الأجواء الحية والأسواق التقليدية.',
      'وأكادير أنسب إن كان الهدف راحة وشاطئ بإيقاع أهدأ.',
      'أخبروني أيّ المدينتين أقرب لكم حتى أرتّب الطيران والإقامة بهدوء ودقة.',
    ].join('\n\n'),
  ])

  const spoken = optimizeLocalSpoken(
    [
      opening,
      'إذا كنتم تبحثون عن الاسترخاء فأرشح أكادير، أما إذا كنتم تفضلون الثقافة والأسواق التقليدية فمراكش خيار رائع.',
      'بعد أن تختاروا المدينة سأجهز لكم أفضل الرحلات والفنادق المناسبة.',
    ].join(' '),
    'ar',
  )

  return {
    displayText: polishConsultantProse(body, 'ar'),
    spokenText: spoken,
  }
}

function renderPlanDisplay(facts: TravelFacts, ar: boolean): string {
  const plan = facts.plan
  if (!plan) {
    // Never dead-end — keep asking.
    const cont = continueAfterDestination(facts, 1, ar)
    return cont.displayText
  }
  const d = destinationLabel(plan.destinations[0], facts.locale)
  const hotel = plan.hotels[0]?.name
  const total = plan.estimatedTotal
  const budget = total
    ? formatBudgetPhrase(total.amount, total.currency, facts.locale)
    : ''
  if (ar) {
    return formatConsultantParagraphs([
      `جهّزت تصوّراً واضحاً لـ${d} خلال ${plan.durationDays} أيام.`,
      hotel ? `للإقامة أميل إلى ${hotel} لأنه يناسب إيقاع الرحلة.` : '',
      budget ? `التقدير الأولي حول ${budget}، وسنضبطه بعد تثبيت التواريخ.` : '',
      'قولوا لي ماذا نثبّت أو نعدّل.',
    ].filter(Boolean).join('\n\n'))
  }
  return [
    `I shaped a clear outline for ${d} over ${plan.durationDays} days.`,
    hotel ? `For the stay I lean toward ${hotel}.` : '',
    budget ? `Early estimate around ${budget}.` : '',
    'Tell me what to lock or change.',
  ].filter(Boolean).join(' ')
}

function spokenPlan(facts: TravelFacts, seed: number, ar: boolean): string {
  const plan = facts.plan
  if (!plan) {
    return continueAfterDestination(facts, seed, ar).spokenText
  }
  const d = destinationLabel(plan.destinations[0], facts.locale)
  const hotel = plan.hotels[0]?.name
  if (ar) {
    return pick(seed, [
      `جهّزت تصوّراً لـ${d} لمدة ${plan.durationDays} أيام${hotel ? ` مع إقامة مناسبة في ${hotel}` : ''}. نراجعها معاً بهدوء.`,
      `مسودة قوية لـ${d}. قل لي ماذا نثبّت أو نعدّل.`,
    ])
  }
  return `I have a first cut for ${d} across ${plan.durationDays} days. Tell me what to tune.`
}

function cityAdvice(facts: TravelFacts, seed: number, ar: boolean): LocalConversationResult {
  const morocco = moroccoStyleAdvice(facts, seed)
  if (morocco) return morocco

  const d = dest(facts)
  const slot = nextHardSlot(facts)

  // Destination just confirmed (or only destination known) → continue the workflow.
  if (d !== 'وجهتكم' && d !== 'your destination' && slot && slot !== 'destination') {
    return continueAfterDestination(facts, seed, ar)
  }

  const ack = softAck(facts, seed, ar)
  const draft = facts.planningDraft

  if (draft && draft.cities.length > 0) {
    const top = draft.cities.slice(0, 2).map((city) => ({
      name: destinationLabel(city.name, facts.locale),
      why: polishConsultantProse(city.why, facts.locale),
    }))
    if (ar) {
      const lines = [
        ack,
        top[0] ? `إن بحثتم عن ${top[0].why} فـ${top[0].name} اتجاه قوي.` : '',
        top[1] ? `أما إن فضّلتم ${top[1].why} فـ${top[1].name} يناسبكم أكثر.` : '',
        'أيّهما أقرب لكم حتى أجهّز الرحلات والفنادق؟',
      ].filter(Boolean)
      const displayText = polishConsultantProse(formatConsultantParagraphs(lines.join('\n\n')), 'ar')
      const spokenText = optimizeLocalSpoken(
        `${ack} أرشّح ${top.map((c) => c.name).join(' أو ')}. أيّهما أقرب لكم؟`,
        'ar',
      )
      return { displayText, spokenText }
    }
  }

  if (ar) {
    const displayText = polishConsultantProse(formatConsultantParagraphs([
      ack,
      d !== 'وجهتكم'
        ? `خلوني أضيّق لكم أفضل الأحياء والإيقاع داخل ${d} قبل أي تفاصيل إضافية.`
        : 'خلوني أضيّق الاتجاه قبل أي سؤال إضافي.',
      'تميلون للاسترخاء، أم للثقافة والتجربة المحلية؟',
    ].join('\n\n')), 'ar')
    return {
      displayText,
      spokenText: optimizeLocalSpoken(`${ack} تميلون للاسترخاء أم للثقافة؟`, 'ar'),
    }
  }

  return {
    displayText: `${ack} Beach and calm, or city and culture?`,
    spokenText: `${ack} Beach and calm, or city and culture?`,
  }
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
  const locale = input.facts.locale
  const seed = hashSeed(`${input.conversationId}|${input.facts.objective}|${input.userMessage}|${JSON.stringify(input.facts.known)}|${input.facts.missingSlots.join(',')}`)

  switch (input.facts.objective) {
    case 'present_plan': {
      if (!input.facts.plan) {
        return continueAfterDestination(input.facts, seed, ar)
      }
      const spokenText = optimizeLocalSpoken(spokenPlan(input.facts, seed, ar), locale)
      return {
        displayText: polishConsultantProse(renderPlanDisplay(input.facts, ar), locale),
        spokenText,
      }
    }
    case 'acknowledge_save': {
      const title = input.facts.savedTitle || (ar ? 'رحلتكم' : 'your trip')
      const spokenText = pick(seed, ar
        ? [`حفظت «${title}» لكم.`, `تم — «${title}» صارت في المحفوظات.`]
        : [`I saved “${title}” for you.`, `Done — “${title}” is in Saved Trips.`])
      return { displayText: spokenText, spokenText }
    }
    case 'acknowledge_edit': {
      const spokenText = pick(seed, ar
        ? ['تمام — قولوا لي ماذا نغيّر وأعدّل الخطة.', 'جاهز للتعديل — الميزانية، الوجهة، التواريخ، أو أي تفصيل.']
        : ['Of course — tell me what to change and I will reshape the plan.', 'Ready when you are.'])
      return { displayText: spokenText, spokenText }
    }
    case 'explain_unavailable': {
      const spokenText = pick(seed, ar
        ? ['ما زالت الخطة غير جاهزة للحفظ — نكمّل التفاصيل أولاً.', 'لسه ما جهّزنا الخطة — نكمّل قليلاً ثم نحفظ.']
        : ['There is no plan to save yet — let’s finish shaping it first.', 'We have not drafted the plan yet.'])
      return { displayText: spokenText, spokenText }
    }
    case 'propose_options':
    case 'advise':
      return cityAdvice(input.facts, seed, ar)
    case 'confirm_understanding': {
      const d = dest(input.facts)
      const spokenText = pick(seed, ar
        ? [`قبل أن أكمّل: نخطط لـ${d}. إذا كان هذا صحيحاً قولوا نعم.`, `هذا فهمي لـ${d}. نكمّل؟`]
        : [`Before I continue: we are planning ${d}. If that is right, say yes.`, `Here is what I have for ${d}. Shall I continue?`])
      return { displayText: spokenText, spokenText: optimizeLocalSpoken(spokenText, locale) }
    }
    case 'collect_missing':
    case 'greet_or_continue':
    case 'general':
    default: {
      const slot = nextHardSlot(input.facts)
      if (!slot) {
        if (input.facts.known.destination && input.facts.known.durationDays && input.facts.known.budgetAmount) {
          return cityAdvice(input.facts, seed, ar)
        }
        return continueAfterDestination(input.facts, seed, ar)
      }
      if (slot === 'destination') {
        const ack = softAck(input.facts, seed, ar)
        const question = askForSlot(slot, input.facts, seed + 11, ar)
        return {
          displayText: polishConsultantProse(formatConsultantParagraphs(`${ack}\n\n${question}`), locale),
          spokenText: optimizeLocalSpoken(`${ack} ${question}`, locale),
        }
      }
      // Destination (or other slots) present — continue workflow, never ack-only.
      return continueAfterDestination(input.facts, seed, ar)
    }
  }
}

/** True when a reply acknowledges without asking/continuing the workflow. */
export function looksLikeDeadEndAck(text: string, locale: 'ar' | 'en' = 'ar'): boolean {
  const t = (text || '').trim()
  if (!t) return true
  if (/[؟?]/.test(t)) return false
  if (locale === 'ar') {
    if (/نركز على|سأبني الرحلة على|حسنًا\s*[—\-،,]?\s*نثبّت|واضح أن الوجهة|ممتاز/.test(t)) {
      const hasContinue = /كم يوم|ميزانية|تميلون|أسبوع|مغادرة|أجهّز|سأجهّز|ابني الخطة|رحلات|فنادق/.test(t)
      return !hasContinue
    }
    if (t.length < 60 && /^(حسنًا|واضح|فهمت|تمام)/.test(t)) return true
  }
  return false
}

/** True when the model re-asks duration even though durationDays is already known. */
export function looksLikeDurationReask(text: string, facts: TravelFacts): boolean {
  if (facts.known.durationDays == null) return false
  const t = (text || '').trim()
  return /عطلة قصيرة|أسبوع كامل|كم يوم|كم يوما|short break|full week|how many days/i.test(t)
    && /(?:أم|أو|or|\?|؟)/.test(t)
}
