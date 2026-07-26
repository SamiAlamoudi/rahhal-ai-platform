import type {
  AgentLocale,
  AgentMemory,
  TripPlan,
  TripRequirements,
  TravelerType,
} from './types'
import { nextMissingIntakeField } from './memory'
import { t } from './locale'

/**
 * Conversation-first follow-up (Experience Sprint 1).
 * One warm acknowledgment + at most ONE natural question.
 * Never sounds like a form, wizard, or inventory checklist.
 */
export function buildFollowUpQuestion(
  memory: AgentMemory,
  missing: Array<keyof TripRequirements>,
): string {
  const locale = memory.locale
  const next = missing[0] ?? nextMissingIntakeField(memory.requirements)

  if (!next) {
    return t(locale, {
      ar: 'بناءً على تفضيلاتك، نستطيع البدء. قل «ابني الخطة» وسأجهّز الخيارات.',
      en: 'Based on your preferences, we can begin. Say “build the plan” and I will put options together.',
    })
  }

  const ack = warmAck(memory.requirements, locale)
  const question = conversationalAsk(next, locale, memory.requirements)
  return `${ack} ${question}`.trim()
}

/** Short spoken summary for voice — never the full itinerary. */
export function buildSpokenPlanSummary(plan: TripPlan, locale: AgentLocale): string {
  const dest = plan.destinations[0] || (locale === 'ar' ? 'وجهتك' : 'your trip')
  const days = plan.durationDays
  const daysLabel = locale === 'ar'
    ? (days === 1 ? 'يوم واحد' : `${days} أيام`)
    : (days === 1 ? 'one day' : `${days} days`)
  const party = plan.travelerType
    ? labelTraveler(plan.travelerType, locale)
    : (plan.travelers != null
      ? (locale === 'ar' ? `${plan.travelers} مسافرين` : `${plan.travelers} travelers`)
      : null)
  const hotel = plan.accommodations[0]?.name
  const flight = plan.flights[0]
  const budget = plan.estimatedCosts

  if (locale === 'ar') {
    const bits = [
      `جهّزت لك تصوّراً لـ${dest} لمدة ${daysLabel}${party ? ` — ${party}` : ''}.`,
    ]
    if (hotel) bits.push(`الإقامة المقترحة: ${hotel}.`)
    if (flight?.from && flight?.to) {
      bits.push(`الطيران من ${flight.from} إلى ${flight.to}.`)
    }
    if (budget?.amount != null) {
      bits.push(`التقدير الإجمالي حوالي ${budget.amount.toLocaleString('en-US')} ${budget.currency}.`)
    }
    bits.push('التفاصيل كاملة على الشاشة — قل لي لو تبي نعدّل شيء.')
    return bits.join(' ')
  }

  const bits = [
    `I prepared a first cut for ${dest} — ${daysLabel}${party ? ` for a ${party}` : ''}.`,
  ]
  if (hotel) bits.push(`I am leaning toward ${hotel} for the stay.`)
  if (flight?.from && flight?.to) {
    bits.push(`Flights look like ${flight.from} to ${flight.to}.`)
  }
  if (budget?.amount != null) {
    bits.push(`Ballpark total around ${budget.amount.toLocaleString('en-US')} ${budget.currency}.`)
  }
  bits.push('The full details are on screen — tell me what you would like to refine.')
  return bits.join(' ')
}

/**
 * Screen content: conversational opener + rich visual itinerary.
 * Voice should use buildSpokenPlanSummary / meta.spokenText — not this whole string.
 */
export function composeTripPlanDisplay(plan: TripPlan, locale: AgentLocale): string {
  const spoken = buildSpokenPlanSummary(plan, locale)
  const details = formatTripPlanDetails(plan, locale)
  return `${spoken}\n\n${details}`
}

/** @deprecated Prefer composeTripPlanDisplay for chat; keep details helper for tests. */
export function formatTripPlanReply(plan: TripPlan, locale: AgentLocale): string {
  return composeTripPlanDisplay(plan, locale)
}

/** Bridge line spoken immediately while planning runs (ChatGPT-Voice feel). */
export function buildThinkingBridge(locale: AgentLocale): string {
  return t(locale, {
    ar: 'لحظة — أراجع أفضل الخيارات لرحلتك.',
    en: 'Give me a second — I am comparing the strongest options for your trip.',
  })
}

/** Prefer meta.spokenText; fall back to a safe short speech string. */
export function resolveSpokenText(input: {
  spokenText?: string | null
  reply: string
  tripPlan?: TripPlan | null
  locale: AgentLocale
}): string {
  if (input.spokenText?.trim()) return input.spokenText.trim()
  if (input.tripPlan) return buildSpokenPlanSummary(input.tripPlan, input.locale)
  return shortenForSpeech(input.reply)
}

export function shortenForSpeech(text: string, maxChars = 320): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxChars) return plain
  const cut = plain.slice(0, maxChars)
  const sentence = cut.match(/^[\s\S]*?[.!?؟。](?=\s|$)/)
  if (sentence && sentence[0].length > 40) return sentence[0].trim()
  const word = cut.lastIndexOf(' ')
  return `${(word > 40 ? cut.slice(0, word) : cut).trim()}…`
}

function warmAck(requirements: TripRequirements, locale: AgentLocale): string {
  const dest = requirements.destination || requirements.destinations[0]
  const days = requirements.durationDays
  const party = partyPhrase(requirements, locale)
  const when = requirements.startDate && requirements.endDate
    ? (locale === 'ar'
      ? `من ${requirements.startDate} إلى ${requirements.endDate}`
      : `${requirements.startDate} → ${requirements.endDate}`)
    : requirements.startDate
      ? (locale === 'ar' ? `حوالي ${requirements.startDate}` : `around ${requirements.startDate}`)
      : null

  if (dest && (days != null || when) && party) {
    const timing = when ?? (locale === 'ar'
      ? `لمدة ${days} ${days === 1 ? 'يوم' : 'أيام'}`
      : `for ${days} day${days === 1 ? '' : 's'}`)
    return t(locale, {
      ar: `فهمت — ${dest} ${timing} ${party}.`,
      en: `Understood — ${dest} ${timing}${party}.`,
    })
  }
  if (dest && (days != null || when)) {
    const timing = when ?? (locale === 'ar'
      ? `لمدة ${days} ${days === 1 ? 'يوم' : 'أيام'}`
      : `for ${days} day${days === 1 ? '' : 's'}`)
    return t(locale, {
      ar: `فهمت — ${dest} ${timing}.`,
      en: `Understood — ${dest} ${timing}.`,
    })
  }
  if (dest) {
    return t(locale, {
      ar: `فهمت — الوجهة ${dest}.`,
      en: `Understood — destination ${dest}.`,
    })
  }
  return t(locale, {
    ar: 'فهمت.',
    en: 'Understood.',
  })
}

function conversationalAsk(
  field: keyof TripRequirements,
  locale: AgentLocale,
  requirements: TripRequirements,
): string {
  const dest = requirements.destination || requirements.destinations[0]
  switch (field) {
    case 'destination':
      return t(locale, {
        ar: requirements.destinationFlexible
          ? 'أي اتجاه من الترشيحات أقرب لذوقك، أو عندك وجهة في بالك؟'
          : 'خبرني أكثر عن الرحلة التي تخطط لها — وين تتخيّل نفسك؟',
        en: requirements.destinationFlexible
          ? 'Which of those directions feels closest — or do you already have a place in mind?'
          : 'Tell me a little more about the trip you are planning.',
      })
    case 'durationDays':
      return t(locale, {
        ar: dest
          ? `متى تتخيّل ${dest} — كم يوم تقريباً، أو عندك تواريخ؟`
          : 'متى تقريباً، وكم يوم تتخيّل للرحلة؟',
        en: dest
          ? `When are you imagining ${dest} — roughly how many days, or do you have dates?`
          : 'When are you thinking, and roughly how many days?',
      })
    case 'budgetAmount':
      return t(locale, {
        ar: 'وش الميزانية اللي ترتاح لها — أو نخليها مرنة ونضبط الخيارات عليها؟',
        en: 'What budget range feels comfortable — or shall we keep it flexible and shape options around that?',
      })
    case 'travelers':
      return t(locale, {
        ar: 'بتسافر لوحدك، ولا مع أحد؟',
        en: 'Are you traveling solo, or with someone?',
      })
    case 'travelerType':
      return t(locale, {
        ar: 'هذي رحلة زوجين، عيلة، أصدقاء، ولا عمل؟',
        en: 'Is this more of a couple trip, family, friends, or business?',
      })
    case 'interests':
      return t(locale, {
        ar: 'وش يهمك أكثر في الرحلة — طعام، ثقافة، هدوء، مغامرة؟',
        en: 'What matters most on this trip — food, culture, quiet, adventure?',
      })
    case 'weatherPreference':
      return t(locale, {
        ar: 'تحب طقس معتدل، دافئ، بارد، ولا ما يفرق؟',
        en: 'Do you prefer mild, warm, or cool weather — or no strong preference?',
      })
    case 'budgetStyle':
      return t(locale, {
        ar: 'تميل لأجواء فاخرة، متوسطة، ولا عملية أكثر؟',
        en: 'Do you lean luxury, mid-range, or more practical?',
      })
    case 'hotelPreference':
      return t(locale, {
        ar: 'تفضل إقامة في وسط المدينة، منتجع، ولا أي مكان يناسب الإيقاع؟',
        en: 'Prefer a central stay, a resort, or wherever fits the rhythm of the trip?',
      })
    case 'packageScope':
      return t(locale, {
        ar: 'تبي نركز على الطيران، ولا باقة كاملة مع الإقامة والأنشطة؟',
        en: 'Shall I focus on flights, or a full package with stays and activities?',
      })
    default:
      return t(locale, {
        ar: 'خبرني أكثر عشان أضبط الخيارات لك.',
        en: 'Tell me a little more so I can tune the options for you.',
      })
  }
}

function partyPhrase(requirements: TripRequirements, locale: AgentLocale): string {
  if (requirements.travelerType === 'couple') {
    return locale === 'ar' ? 'لكم كزوجين' : ' for the two of you'
  }
  if (requirements.travelerType === 'family') {
    return locale === 'ar' ? 'للعائلة' : ' for the family'
  }
  if (requirements.travelerType === 'solo') {
    return locale === 'ar' ? 'لك' : ' for you'
  }
  if (requirements.travelers != null && requirements.travelers > 0) {
    return locale === 'ar'
      ? ` لـ${requirements.travelers} مسافرين`
      : ` for ${requirements.travelers}`
  }
  return ''
}

function formatTripPlanDetails(plan: TripPlan, locale: AgentLocale): string {
  const lines: string[] = []
  lines.push(`## ${plan.title}`)
  lines.push('')
  lines.push(t(locale, { ar: '### الملخص', en: '### Summary' }))
  lines.push(plan.summary)
  lines.push('')
  lines.push(t(locale, {
    ar: `**الوجهات:** ${plan.destinations.join('، ')}`,
    en: `**Destinations:** ${plan.destinations.join(', ')}`,
  }))
  lines.push(t(locale, {
    ar: `**التواريخ:** ${formatDates(plan, locale)}`,
    en: `**Dates:** ${formatDates(plan, locale)}`,
  }))
  lines.push(t(locale, {
    ar: `**المدة:** ${plan.durationDays} ${plan.durationDays === 1 ? 'يوم' : 'أيام'}`,
    en: `**Duration:** ${plan.durationDays} day${plan.durationDays === 1 ? '' : 's'}`,
  }))
  lines.push(t(locale, {
    ar: `**المسافرون:** ${formatTravelers(plan, locale)}`,
    en: `**Travelers:** ${formatTravelers(plan, locale)}`,
  }))
  if (plan.interests.length) {
    lines.push(t(locale, {
      ar: `**الاهتمامات:** ${plan.interests.join('، ')}`,
      en: `**Interests:** ${plan.interests.join(', ')}`,
    }))
  }
  lines.push('')
  lines.push(t(locale, { ar: '### تفصيل الميزانية', en: '### Budget breakdown' }))
  lines.push(t(locale, {
    ar: `**الإجمالي التقديري:** ${plan.estimatedCosts.amount.toLocaleString('en-US')} ${plan.estimatedCosts.currency}`,
    en: `**Estimated total:** ${plan.estimatedCosts.amount.toLocaleString('en-US')} ${plan.estimatedCosts.currency}`,
  }))
  for (const line of plan.estimatedBudget.breakdown) {
    lines.push(`- ${line.label}: ${line.amount.toLocaleString('en-US')} ${plan.estimatedBudget.currency}`)
  }

  lines.push('')
  lines.push(t(locale, { ar: '### برنامج الأيام', en: '### Daily itinerary' }))
  for (const day of plan.dailyItinerary) {
    lines.push('')
    lines.push(`**${day.title}** — ${day.location}`)
    if (day.weather) {
      const advice = day.weather.advice ? ` · ${day.weather.advice}` : ''
      lines.push(t(locale, {
        ar: `_الطقس: ${day.weather.summary}${advice}_`,
        en: `_Weather: ${day.weather.summary}${advice}_`,
      }))
    }
    for (const activity of day.activities) {
      const time = activity.time ? `${activity.time} · ` : ''
      const desc = activity.description ? ` — ${activity.description}` : ''
      lines.push(`- ${time}${activity.title}${desc}`)
    }
  }

  if (plan.flights.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### الرحلات الجوية', en: '### Flights' }))
    for (const flight of plan.flights) {
      const cost = flight.estimatedCost != null
        ? ` · ~${flight.estimatedCost} ${flight.currency || ''}`
        : ''
      lines.push(`- ${flight.from} → ${flight.to}${flight.airline ? ` · ${flight.airline}` : ''}${cost}${flight.notes ? ` (${flight.notes})` : ''}`)
    }
  }

  lines.push('')
  lines.push(t(locale, { ar: '### التنقل', en: '### Transportation' }))
  for (const item of plan.transportation) {
    lines.push(`- ${item.mode}: ${item.from} → ${item.to}${item.notes ? ` (${item.notes})` : ''}`)
  }

  if (plan.accommodations.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### الفنادق / الإقامة', en: '### Hotels' }))
    for (const stay of plan.accommodations) {
      const nightly = stay.estimatedNightly != null
        ? ` · ~${stay.estimatedNightly} ${stay.currency}/night`
        : ''
      lines.push(`- ${stay.name} (${stay.area}, ${stay.category})${nightly} — ${stay.fit}`)
    }
  }

  if (plan.attractions.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### المعالم والأنشطة', en: '### Attractions' }))
    for (const attraction of plan.attractions) {
      const tag = attraction.tag ? ` · ${attraction.tag}` : ''
      lines.push(`- ${attraction.title}${tag}`)
    }
  }

  if (plan.weatherNotes.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### ملاحظات الطقس', en: '### Weather notes' }))
    for (const note of plan.weatherNotes) lines.push(`- ${note}`)
  }

  if (plan.visaNotes.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### ملاحظات التأشيرة', en: '### Visa notes' }))
    for (const note of plan.visaNotes) lines.push(`- ${note}`)
  }

  if (plan.travelTips.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### نصائح السفر', en: '### Travel tips' }))
    for (const tip of plan.travelTips) lines.push(`- ${tip}`)
  }

  if (plan.packingSuggestions.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### اقتراحات الأمتعة', en: '### Packing suggestions' }))
    for (const item of plan.packingSuggestions) lines.push(`- ${item}`)
  }

  // Decision scores stay on screen only — never emphasized for voice.
  if (plan.decision) {
    const d = plan.decision
    lines.push('')
    lines.push(t(locale, { ar: '### لماذا هذه الخيارات', en: '### Why these choices' }))
    if (d.flight) lines.push(`- ${d.flight.whySelected}`)
    if (d.hotel) lines.push(`- ${d.hotel.whySelected}`)
    if (d.activities) lines.push(`- ${d.activities.whySelected}`)
    if (d.suggestions.length) {
      for (const tip of d.suggestions.slice(0, 3)) lines.push(`- ${tip}`)
    }
  }

  if (plan.notes.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### ملاحظات إضافية', en: '### Additional notes' }))
    for (const note of plan.notes) lines.push(`- ${note}`)
  }

  lines.push('')
  lines.push(t(locale, {
    ar: 'لو حاب نعدّل يوماً، الطيران، الفندق، أو الأنشطة — قل لي ببساطة.',
    en: 'If you want to tweak a day, flights, the hotel, or activities — just say the word.',
  }))
  return lines.join('\n')
}

/** @deprecated Prefer formatTripPlanReply / composeTripPlanDisplay */
export const formatItineraryReply = formatTripPlanReply

export function buildSaveAck(locale: AgentLocale, title: string): string {
  return t(locale, {
    ar: `حفظت «${title}» لك. تقدر ترجع لها من المحفوظات في أي وقت، أو نكمّل التعديل هنا بهدوء.`,
    en: `I saved “${title}” for you. You can reopen it anytime from Saved Trips, or we can keep refining it here.`,
  })
}

export function buildEditAck(locale: AgentLocale): string {
  return t(locale, {
    ar: 'تمام — قل لي وش تبي نغيّر: الميزانية، الوجهة، التواريخ، أو عدد المسافرين، وأنا أعدّل الخطة مع الإبقاء على كل اللي اتفقنا عليه.',
    en: 'Of course — tell me what to change: budget, destination, dates, or travelers, and I will reshape the plan while keeping what we already agreed.',
  })
}

function formatDates(plan: TripPlan, locale: AgentLocale): string {
  if (plan.startDate && plan.endDate) return `${plan.startDate} → ${plan.endDate}`
  if (plan.startDate) {
    return locale === 'ar'
      ? `${plan.startDate} · ${plan.durationDays} أيام`
      : `${plan.startDate} · ${plan.durationDays} days`
  }
  return locale === 'ar'
    ? `${plan.durationDays} أيام (تواريخ مرنة)`
    : `${plan.durationDays} days (flexible dates)`
}

function formatTravelers(plan: TripPlan, locale: AgentLocale): string {
  const count = plan.travelers == null
    ? (locale === 'ar' ? 'غير مؤكد' : 'unconfirmed')
    : String(plan.travelers)
  if (!plan.travelerType) return count
  return `${count} (${labelTraveler(plan.travelerType, locale)})`
}

function labelTraveler(type: TravelerType, locale: AgentLocale): string {
  const map: Record<TravelerType, { ar: string; en: string }> = {
    solo: { ar: 'فردي', en: 'solo' },
    couple: { ar: 'زوجين', en: 'couple' },
    family: { ar: 'عائلة', en: 'family' },
    friends: { ar: 'أصدقاء', en: 'friends' },
    business: { ar: 'عمل', en: 'business' },
  }
  return map[type][locale]
}
