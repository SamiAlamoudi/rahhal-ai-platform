import type {
  AgentLocale,
  AgentMemory,
  TripPlan,
  TripRequirements,
  TravelerType,
} from './types'
import { nextMissingIntakeField } from './memory'
import { t } from './locale'

export function buildFollowUpQuestion(
  memory: AgentMemory,
  missing: Array<keyof TripRequirements>,
): string {
  const locale = memory.locale
  const next = missing[0] ?? nextMissingIntakeField(memory.requirements)
  const known = summarizeKnown(memory.requirements, locale)

  const lines: string[] = [
    t(locale, {
      ar: 'سأبني خطة سفر ذكية — لكن أحتاج تفاصيل أكثر قبل التوليد (بدون تخمين).',
      en: 'I will build a smart trip plan — but I need a few more details before generating (no guessing).',
    }),
  ]

  if (known.length) {
    lines.push('')
    lines.push(t(locale, { ar: 'ما حفظته حتى الآن:', en: 'What I have so far:' }))
    for (const row of known) lines.push(`• ${row}`)
  }

  lines.push('')
  if (!next) {
    lines.push(t(locale, {
      ar: 'أعتقد أنني جاهز — أكّد وسأولّد الخطة.',
      en: 'I think I have enough — confirm and I will generate the plan.',
    }))
    return lines.join('\n')
  }

  lines.push(t(locale, { ar: 'سؤال التالي:', en: 'Next question:' }))
  lines.push(questionForField(next, locale))
  return lines.join('\n')
}

function questionForField(field: keyof TripRequirements, locale: AgentLocale): string {
  switch (field) {
    case 'destination':
      return t(locale, {
        ar: '• إلى أين تريد السفر؟ (مثال: اليابان، بالي، لندن، الرياض)',
        en: '• Where do you want to travel? (e.g. Japan, Bali, London, Riyadh)',
      })
    case 'durationDays':
      return t(locale, {
        ar: '• متى؟ كم مدة الرحلة بالأيام، أو تاريخ البداية والنهاية؟',
        en: '• When? How many days, or what start/end dates?',
      })
    case 'budgetAmount':
      return t(locale, {
        ar: '• ما الميزانية التقريبية وعملتها؟ (أو قل «مرنة»)',
        en: '• What is your budget (amount + currency)? Or say “flexible”.',
      })
    case 'travelers':
      return t(locale, {
        ar: '• كم عدد المسافرين؟',
        en: '• How many travelers?',
      })
    case 'travelerType':
      return t(locale, {
        ar: '• سفر فردي، زوجين، عائلة، أصدقاء، أم عمل؟',
        en: '• Family, solo, couple, friends, or business?',
      })
    case 'interests':
      return t(locale, {
        ar: '• ما اهتماماتك؟ (طعام، ثقافة، شاطئ، طبيعة، تسوق، مغامرة… أو «فاجأني»)',
        en: '• What are your interests? (food, culture, beach, nature, shopping, adventure… or “surprise me”)',
      })
    case 'weatherPreference':
      return t(locale, {
        ar: '• ما الطقس المفضل؟ (معتدل، حار، بارد، جاف، مرن…)',
        en: '• Preferred weather? (mild, warm, cool, dry, flexible…)',
      })
    case 'budgetStyle':
      return t(locale, {
        ar: '• أسلوب الرحلة: فاخر، متوسط، أم اقتصادي؟',
        en: '• Luxury, mid-range, or budget style?',
      })
    case 'hotelPreference':
      return t(locale, {
        ar: '• تفضيل الفندق؟ (وسط المدينة، بوتيك، منتجع، شقة، أي فندق…)',
        en: '• Hotel preference? (central, boutique, resort, apartment, any…)',
      })
    case 'packageScope':
      return t(locale, {
        ar: '• طيران فقط أم باقة كاملة (طيران + فنادق + أنشطة)؟',
        en: '• Flights only, or a full package (flights + hotels + activities)?',
      })
    default:
      return t(locale, {
        ar: '• هل يمكنك توضيح هذا التفصيل؟',
        en: '• Could you clarify that detail?',
      })
  }
}

function summarizeKnown(requirements: TripRequirements, locale: AgentLocale): string[] {
  const rows: string[] = []
  const dest = requirements.destination || requirements.destinations[0]
  if (dest) {
    rows.push(locale === 'ar' ? `الوجهة: ${dest}` : `Destination: ${dest}`)
  }
  if (requirements.durationDays != null) {
    rows.push(locale === 'ar'
      ? `المدة: ${requirements.durationDays} أيام`
      : `Duration: ${requirements.durationDays} days`)
  } else if (requirements.startDate && requirements.endDate) {
    rows.push(`${requirements.startDate} → ${requirements.endDate}`)
  }
  if (requirements.startDate && requirements.durationDays != null) {
    rows.push(locale === 'ar'
      ? `التوقيت: من ${requirements.startDate}`
      : `Timing from: ${requirements.startDate}`)
  }
  if (requirements.budgetFlexible) {
    rows.push(locale === 'ar' ? 'الميزانية: مرنة' : 'Budget: flexible')
  } else if (requirements.budgetAmount != null) {
    rows.push(locale === 'ar'
      ? `الميزانية: ${requirements.budgetAmount} ${requirements.budgetCurrency || ''}`
      : `Budget: ${requirements.budgetAmount} ${requirements.budgetCurrency || ''}`)
  }
  if (requirements.travelers != null) {
    rows.push(locale === 'ar'
      ? `عدد المسافرين: ${requirements.travelers}`
      : `Travelers: ${requirements.travelers}`)
  }
  if (requirements.travelerType) {
    rows.push(locale === 'ar'
      ? `نوع السفر: ${labelTraveler(requirements.travelerType, 'ar')}`
      : `Party: ${labelTraveler(requirements.travelerType, 'en')}`)
  }
  if (requirements.interests.length) {
    rows.push(locale === 'ar'
      ? `الاهتمامات: ${requirements.interests.join('، ')}`
      : `Interests: ${requirements.interests.join(', ')}`)
  }
  if (requirements.weatherPreference) {
    rows.push(locale === 'ar'
      ? `الطقس المفضل: ${requirements.weatherPreference}`
      : `Preferred weather: ${requirements.weatherPreference}`)
  }
  if (requirements.budgetStyle) {
    rows.push(locale === 'ar'
      ? `أسلوب الميزانية: ${requirements.budgetStyle}`
      : `Budget style: ${requirements.budgetStyle}`)
  }
  if (requirements.hotelPreference) {
    rows.push(locale === 'ar'
      ? `تفضيل الفندق: ${requirements.hotelPreference}`
      : `Hotel preference: ${requirements.hotelPreference}`)
  }
  if (requirements.packageScope) {
    rows.push(locale === 'ar'
      ? `نطاق الباقة: ${requirements.packageScope === 'flights_only' ? 'طيران فقط' : 'باقة كاملة'}`
      : `Package: ${requirements.packageScope === 'flights_only' ? 'flights only' : 'full package'}`)
  }
  return rows
}

export function formatTripPlanReply(plan: TripPlan, locale: AgentLocale): string {
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

  if (plan.notes.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### ملاحظات إضافية', en: '### Additional notes' }))
    for (const note of plan.notes) lines.push(`- ${note}`)
  }

  lines.push('')
  lines.push(t(locale, {
    ar: 'تم بناء هذه الخطة عبر أدوات الوكيل التجريبية (طيران/فنادق/طقس/معالم…) دون اتصالات مزود حقيقية بعد.',
    en: 'This plan used the agent tool layer (flights/hotels/weather/attractions…) with mock adapters — no live provider APIs yet.',
  }))
  lines.push('')
  lines.push(t(locale, {
    ar: 'يمكنك إعادة توليد الخطة كاملة أو يوماً واحداً، وتعديل الميزانية/الوجهة/التواريخ/عدد المسافرين من الأزرار أو بالمحادثة.',
    en: 'You can regenerate the whole trip or one day, and edit budget / destination / dates / traveler count via the actions or chat.',
  }))
  return lines.join('\n')
}

/** @deprecated Prefer formatTripPlanReply */
export const formatItineraryReply = formatTripPlanReply

export function buildSaveAck(locale: AgentLocale, title: string): string {
  return t(locale, {
    ar: `تم حفظ الخطة «${title}» في الرحلات المحفوظة. يمكنك فتحها من صفحة المحفوظة أو متابعة التعديل هنا.`,
    en: `Saved “${title}” to Saved Trips. Open it anytime from Saved Trips, or keep editing here.`,
  })
}

export function buildEditAck(locale: AgentLocale): string {
  return t(locale, {
    ar: 'حدّث لي الميزانية، الوجهة، التواريخ، أو عدد المسافرين وسأعيد بناء الخطة مع الإبقاء على ذاكرة المحادثة.',
    en: 'Tell me the new budget, destination, dates, or traveler count and I will rebuild the plan while keeping conversation memory.',
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
