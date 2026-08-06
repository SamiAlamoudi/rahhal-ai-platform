/**
 * Concierge Decision Engine — intelligence layer.
 *
 * Philosophy: ask "Can I already provide value?" before "Which field is missing?"
 * Never drives form-style interrogation. Provider-agnostic; no planTurn changes.
 */

import type { AgentLocale, TripRequirements } from '../agent/types'
import type { ConciergeAction, ConciergeState } from './types'

export type ConciergeValueMode =
  | 'none'
  | 'destination_cities'
  | 'season_guidance'
  | 'budget_framed_cities'
  | 'style_narrow'
  | 'itinerary_ideas'

export interface ConciergeValueAssessment {
  /** True when the consultant can educate / recommend / compare / inspire now. */
  canProvideValue: boolean
  mode: ConciergeValueMode
  /** Preferred concierge action when providing value. */
  action: Extract<ConciergeAction, 'advise' | 'propose_options'>
  /** Rich option lines for Conversation Brain (not form labels). */
  valueBrief: string[]
  /** Optional short education line before options. */
  framingNote: string | null
  /** Meaningful closer — preference, not field census. */
  preferenceQuestion: string | null
  rationale: string
}

const BROAD_DESTINATIONS = new Set([
  'morocco', 'japan', 'italy', 'spain', 'france', 'turkey', 'egypt',
  'indonesia', 'maldives', 'canada', 'switzerland', 'austria', 'norway',
  'iceland', 'new zealand', 'greece', 'portugal', 'thailand', 'uae',
])

/** City / micro-destination packs for consultant framing (not live inventory). */
const CITY_PACKS: Record<string, { en: Array<{ title: string; why: string }>; ar: Array<{ title: string; why: string }> }> = {
  morocco: {
    en: [
      { title: 'Agadir', why: 'Great beaches and typically lower hotel costs.' },
      { title: 'Marrakech', why: 'Culture, souks, and food-led evenings.' },
      { title: 'Casablanca', why: 'Urban pace, modern dining, coastal walks.' },
    ],
    ar: [
      { title: 'أكادير', why: 'شواطئ ممتازة وتكلفة فنادق عادةً أخف.' },
      { title: 'مراكش', why: 'ثقافة وأسواق وأجواء طعام غنية.' },
      { title: 'الدار البيضاء', why: 'تجربة مدنية عصرية على الساحل.' },
    ],
  },
  japan: {
    en: [
      { title: 'Tokyo', why: 'Energy, food, and neighbourhood variety.' },
      { title: 'Kyoto', why: 'Temples, gardens, and slower cultural days.' },
      { title: 'Osaka', why: 'Street food and a lively urban base.' },
    ],
    ar: [
      { title: 'طوكيو', why: 'حيوية وتنوع أحياء ومأكولات.' },
      { title: 'كيوتو', why: 'معابد وحدائق وإيقاع ثقافي أهدأ.' },
      { title: 'أوساكا', why: 'طعام شارع وقاعدة حضرية نابضة.' },
    ],
  },
  italy: {
    en: [
      { title: 'Rome', why: 'History in every walk.' },
      { title: 'Florence', why: 'Art, compact historic centre.' },
      { title: 'Amalfi / coast', why: 'Scenic coast and slower evenings.' },
    ],
    ar: [
      { title: 'روما', why: 'تاريخ في كل جولة.' },
      { title: 'فلورنسا', why: 'فن ومركز تاريخي مدمج.' },
      { title: 'الساحل', why: 'إطلالات وإيقاع أهدأ.' },
    ],
  },
  spain: {
    en: [
      { title: 'Barcelona', why: 'Architecture, food, and beach access.' },
      { title: 'Madrid', why: 'Museums and late-night energy.' },
      { title: 'Andalusia', why: 'Historic cities and warmer evenings.' },
    ],
    ar: [
      { title: 'برشلونة', why: 'عمارة وطعام وقرب من البحر.' },
      { title: 'مدريد', why: 'متاحف وحيوية ليلية.' },
      { title: 'الأندلس', why: 'مدن تاريخية وأجواء أدفأ.' },
    ],
  },
  turkey: {
    en: [
      { title: 'Istanbul', why: 'Two continents, food, and layers of history.' },
      { title: 'Cappadocia', why: 'Landscapes and slower mornings.' },
      { title: 'Antalya', why: 'Beach resort ease.' },
    ],
    ar: [
      { title: 'إسطنبول', why: 'قارتان وطعام وتاريخ متراكب.' },
      { title: 'كابدوكيا', why: 'طبيعة وإيقاع أهدأ.' },
      { title: 'أنطاليا', why: 'استجمام شاطئي سهل.' },
    ],
  },
  egypt: {
    en: [
      { title: 'Cairo', why: 'Museums and city pulse.' },
      { title: 'Luxor', why: 'Temples and Nile atmosphere.' },
      { title: 'Red Sea', why: 'Resort rest and clear water.' },
    ],
    ar: [
      { title: 'القاهرة', why: 'متاحف ونبض المدينة.' },
      { title: 'الأقصر', why: 'معابد وأجواء النيل.' },
      { title: 'البحر الأحمر', why: 'استجمام ومياه صافية.' },
    ],
  },
}

const SEASON_PACKS: Record<string, { en: string[]; ar: string[]; question: { en: string; ar: string } }> = {
  japan: {
    en: [
      'Cherry blossom (spring) — magical, and usually the most expensive window.',
      'Autumn colours — often better value with excellent weather.',
      'Winter — quieter cities, and easy to combine with snow destinations.',
    ],
    ar: [
      'موسم الساكورا (الربيع) — ساحر وغالباً الأعلى تكلفة.',
      'ألوان الخريف — قيمة أفضل وطقس ممتاز غالباً.',
      'الشتاء — مدن أهدأ، وسهل دمجه مع وجهات ثلجية.',
    ],
    question: {
      en: 'Before I estimate costs — which season are you considering?',
      ar: 'قبل ما أقدّر التكاليف — أي موسم تفكّر فيه؟',
    },
  },
}

function normalizeDestKey(destination: string | null | undefined): string {
  return (destination || '').trim().toLowerCase()
}

export function isBroadDestination(destination: string | null | undefined): boolean {
  const key = normalizeDestKey(destination)
  if (!key) return false
  return BROAD_DESTINATIONS.has(key)
}

function primaryDestination(req: TripRequirements): string | null {
  return req.destination || req.destinations[0] || null
}

function hasTimingSignal(req: TripRequirements): boolean {
  return Boolean(req.startDate || req.endDate || req.durationDays != null)
}

function isVagueFutureTiming(userText: string, req: TripRequirements): boolean {
  if (hasTimingSignal(req) && req.startDate) {
    // Explicit month/date is not "vague season" territory.
    return false
  }
  const lower = userText.toLowerCase()
  return /\bnext year\b|\bin \d{4}\b|العام القادم|السنة القادمة|السنه القادمه/.test(lower)
    || (/\byear\b|عام|سنة|سنه/.test(lower) && !hasTimingSignal(req))
}

function styleOptions(locale: AgentLocale, dest: string | null): string[] {
  if (locale === 'ar') {
    return dest
      ? [
        'أجواء شاطئ واسترخاء',
        'مدينة وثقافة وطعام',
        'طبيعة وهدوء بعيداً عن الزحام',
      ]
      : [
        'شاطئ واسترخاء',
        'مدينة ومعالم',
        'مغامرة أو طبيعة',
      ]
  }
  return dest
    ? [
      'Beach and slow mornings',
      'City culture and food',
      'Nature and quieter days',
    ]
    : [
      'Beach and recovery',
      'City landmarks and dining',
      'Nature or light adventure',
    ]
}

function preferenceQuestionFor(
  mode: ConciergeValueMode,
  locale: AgentLocale,
  dest: string | null,
): string {
  const ar = locale === 'ar'
  if (mode === 'season_guidance' && dest && SEASON_PACKS[normalizeDestKey(dest)]) {
    return SEASON_PACKS[normalizeDestKey(dest)]!.question[ar ? 'ar' : 'en']
  }
  if (mode === 'destination_cities' || mode === 'budget_framed_cities') {
    return ar
      ? 'من هذه الاتجاهات، أيّها يشدّك أكثر؟'
      : 'From these directions, which interests you most?'
  }
  if (mode === 'style_narrow') {
    return ar
      ? 'تميل لبحر وهدوء، ولا مدينة وثقافة؟'
      : 'Are you leaning beach and calm, or city and culture?'
  }
  return ar
    ? 'أي اتجاه نقرّب عليه؟'
    : 'Which direction should we lean into?'
}

function cityBrief(destKey: string, locale: AgentLocale): string[] | null {
  const pack = CITY_PACKS[destKey]
  if (!pack) return null
  const rows = locale === 'ar' ? pack.ar : pack.en
  return rows.map((row) => `${row.title} — ${row.why}`)
}

/**
 * Core intelligence: given what we already know, can Bilamo help now?
 */
export function evaluateConciergeValueOpportunity(input: {
  requirements: TripRequirements
  locale: AgentLocale
  userText: string
  previous: ConciergeState | null
}): ConciergeValueAssessment {
  const { requirements: req, locale, userText } = input
  const dest = primaryDestination(req)
  const destKey = normalizeDestKey(dest)
  const ar = locale === 'ar'

  // Open-ended discovery already handled upstream — still mark as value-capable.
  if (req.destinationFlexible && !dest) {
    return {
      canProvideValue: true,
      mode: 'style_narrow',
      action: 'propose_options',
      valueBrief: styleOptions(locale, null),
      framingNote: ar
        ? 'خلّينا نضيّق الإحساس أولاً قبل ما نثبّت وجهة.'
        : 'Let us narrow the feeling of the trip before locking a place.',
      preferenceQuestion: preferenceQuestionFor('style_narrow', locale, null),
      rationale: 'Open preference — inspire with style choices before census fields.',
    }
  }

  if (dest && isVagueFutureTiming(userText, req) && SEASON_PACKS[destKey]) {
    const seasons = SEASON_PACKS[destKey]!
    return {
      canProvideValue: true,
      mode: 'season_guidance',
      action: 'advise',
      valueBrief: ar ? seasons.ar : seasons.en,
      framingNote: ar
        ? `${dest} خيار ممتاز — والتكلفة تختلف كثيراً حسب الموسم.`
        : `${dest} is a strong choice — and cost swings sharply by season.`,
      preferenceQuestion: seasons.question[ar ? 'ar' : 'en'],
      rationale: 'Destination known with vague future timing — educate on seasons before cost estimates.',
    }
  }

  if (dest && isBroadDestination(dest) && cityBrief(destKey, locale)) {
    const brief = cityBrief(destKey, locale)!
    const hasBudget = req.budgetAmount != null || req.budgetFlexible === true
    const hasTiming = hasTimingSignal(req)
    if (hasBudget && hasTiming) {
      const amount = req.budgetAmount
      const currency = req.budgetCurrency || (ar ? 'ر.س' : 'SAR')
      const when = req.startDate
        ? (ar ? `حوالي ${req.startDate}` : `around ${req.startDate}`)
        : req.durationDays != null
          ? (ar ? `${req.durationDays} أيام` : `${req.durationDays} days`)
          : (ar ? 'في الفترة المذكورة' : 'in that window')
      return {
        canProvideValue: true,
        mode: 'budget_framed_cities',
        action: 'propose_options',
        valueBrief: brief,
        framingNote: amount != null
          ? (ar
            ? `بميزانية حول ${amount} ${currency} والسفر ${when}، ${dest} يفتح عدة خيارات قوية.`
            : `With a budget around ${amount} ${currency} and travel ${when}, ${dest} opens several strong options.`)
          : (ar
            ? `مع مرونة بالميزانية والسفر ${when}، هذه اتجاهات ${dest} الأنسب للبداية.`
            : `With flexible budget and travel ${when}, these ${dest} directions are the strongest start.`),
        preferenceQuestion: preferenceQuestionFor('budget_framed_cities', locale, dest),
        rationale: 'Country + budget + timing — recommend cities before more intake.',
      }
    }
    return {
      canProvideValue: true,
      mode: 'destination_cities',
      action: 'propose_options',
      valueBrief: brief,
      framingNote: ar
        ? `${dest} يتيح أنماطاً مختلفة جداً — هذه أبرز الاتجاهات.`
        : `${dest} supports very different trip styles — here are the strongest directions.`,
      preferenceQuestion: preferenceQuestionFor('destination_cities', locale, dest),
      rationale: 'Broad destination known — compare cities before asking census fields.',
    }
  }

  if (dest) {
    // Specific city/destination — still provide itinerary / style value.
    return {
      canProvideValue: true,
      mode: 'itinerary_ideas',
      action: 'advise',
      valueBrief: styleOptions(locale, dest).map((line) =>
        ar ? `${dest}: ${line}` : `${dest}: ${line}`,
      ),
      framingNote: ar
        ? `ممتاز — ${dest} قاعدة قوية. خلّينا نضبط طابع الرحلة.`
        : `Strong base — ${dest}. Let us shape the character of the trip.`,
      preferenceQuestion: preferenceQuestionFor('style_narrow', locale, dest),
      rationale: 'Specific destination known — inspire with trip character before form fields.',
    }
  }

  return {
    canProvideValue: false,
    mode: 'none',
    action: 'propose_options',
    valueBrief: [],
    framingNote: null,
    preferenceQuestion: null,
    rationale: 'Not enough signal yet for a confident recommendation.',
  }
}

/**
 * Should this turn deliver value instead of an intake question?
 * After a value beat, allow one contextual follow-up only if nothing new was learned
 * and we still cannot refine the brief.
 */
export function shouldLeadWithValue(input: {
  requirements: TripRequirements
  locale: AgentLocale
  userText: string
  previous: ConciergeState | null
  hardMissing: number
}): ConciergeValueAssessment & { leadWithValue: boolean } {
  const assessment = evaluateConciergeValueOpportunity(input)
  if (!assessment.canProvideValue) {
    return { ...assessment, leadWithValue: false }
  }

  const prev = input.previous
  const lastWasValue = prev?.lastAction === 'propose_options' || prev?.lastAction === 'advise'

  // First opportunity — always lead with value.
  if (!lastWasValue) {
    return { ...assessment, leadWithValue: true }
  }

  // If hard intake is now complete enough to frame richer advice, lead with value again.
  if (
    assessment.mode === 'budget_framed_cities'
    || assessment.mode === 'season_guidance'
  ) {
    return { ...assessment, leadWithValue: true }
  }

  // Otherwise do not interrogate — still give a refined value beat (never bare Budget?/Days?).
  return { ...assessment, leadWithValue: true }
}
