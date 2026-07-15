import type { AgentLocale, AgentMemory, TravelItinerary, TripRequirements } from './types'
import { t } from './locale'

export function buildFollowUpQuestion(
  memory: AgentMemory,
  missing: Array<keyof TripRequirements>,
): string {
  const locale = memory.locale
  const lines: string[] = [
    t(locale, {
      ar: 'سأساعدك في بناء خطة سفر منظمة. قبل المتابعة أحتاج تفاصيل ناقصة:',
      en: 'I can draft a structured trip plan. Before I continue, I still need:',
    }),
  ]

  for (const field of missing) {
    if (field === 'destination') {
      lines.push(t(locale, {
        ar: '• ما الوجهة المطلوبة؟ (مثال: اليابان، الرياض، باريس)',
        en: '• What destination? (e.g. Japan, Riyadh, Paris)',
      }))
    }
    if (field === 'durationDays') {
      lines.push(t(locale, {
        ar: '• كم مدة الرحلة بالأيام؟ أو تاريخ البداية والنهاية؟',
        en: '• How many days, or what start/end dates?',
      }))
    }
  }

  if (memory.requirements.budgetAmount == null) {
    lines.push(t(locale, {
      ar: 'اختياري: هل لديك سقف ميزانية وعملتها؟',
      en: 'Optional: do you have a budget ceiling and currency?',
    }))
  }
  if (memory.requirements.travelers == null) {
    lines.push(t(locale, {
      ar: 'اختياري: كم عدد المسافرين ونوع الرحلة (عائلة/زوجين/فردي)؟',
      en: 'Optional: travelers count and trip type (family/couple/solo)?',
    }))
  }

  lines.push('')
  lines.push(t(locale, {
    ar: 'أجب بجملة واحدة وسأكمل الخطة فوراً.',
    en: 'Answer in one message and I will finish the itinerary.',
  }))
  return lines.join('\n')
}

export function formatItineraryReply(itinerary: TravelItinerary, locale: AgentLocale): string {
  const lines: string[] = []
  lines.push(locale === 'ar' ? `## ${itinerary.title}` : `## ${itinerary.title}`)
  lines.push('')
  lines.push(t(locale, {
    ar: `**الوجهات:** ${itinerary.destinations.join('، ')}`,
    en: `**Destinations:** ${itinerary.destinations.join(', ')}`,
  }))
  lines.push(t(locale, {
    ar: `**التواريخ:** ${formatDates(itinerary, locale)}`,
    en: `**Dates:** ${formatDates(itinerary, locale)}`,
  }))
  lines.push(t(locale, {
    ar: `**المسافرون:** ${itinerary.travelers}${itinerary.travelerType ? ` (${labelTraveler(itinerary.travelerType, locale)})` : ''}`,
    en: `**Travelers:** ${itinerary.travelers}${itinerary.travelerType ? ` (${labelTraveler(itinerary.travelerType, locale)})` : ''}`,
  }))
  lines.push(t(locale, {
    ar: `**الميزانية التقديرية:** ${itinerary.estimatedBudget.amount.toLocaleString('en-US')} ${itinerary.estimatedBudget.currency}`,
    en: `**Estimated budget:** ${itinerary.estimatedBudget.amount.toLocaleString('en-US')} ${itinerary.estimatedBudget.currency}`,
  }))
  lines.push('')
  lines.push(t(locale, { ar: '### برنامج الأيام', en: '### Day-by-day' }))
  for (const day of itinerary.activities) {
    lines.push('')
    lines.push(`**${day.title}** — ${day.location}`)
    for (const activity of day.activities) {
      const time = activity.time ? `${activity.time} · ` : ''
      const desc = activity.description ? ` — ${activity.description}` : ''
      lines.push(`- ${time}${activity.title}${desc}`)
    }
  }
  lines.push('')
  lines.push(t(locale, { ar: '### التنقل', en: '### Transportation' }))
  for (const item of itinerary.transportation) {
    lines.push(`- ${item.mode}: ${item.from} → ${item.to}${item.notes ? ` (${item.notes})` : ''}`)
  }
  if (itinerary.notes.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### ملاحظات', en: '### Notes' }))
    for (const note of itinerary.notes) lines.push(`- ${note}`)
  }
  lines.push('')
  lines.push(t(locale, {
    ar: 'يمكنك تعديل الخطة، إعادة توليدها، أو حفظها من الأزرار أسفل الرسالة.',
    en: 'You can edit, regenerate, or save this plan using the actions under the message.',
  }))
  return lines.join('\n')
}

export function buildSaveAck(locale: AgentLocale, title: string): string {
  return t(locale, {
    ar: `تم حفظ الخطة «${title}» في الرحلات المحفوظة. يمكنك فتحها من صفحة المحفوظة أو متابعة التعديل هنا.`,
    en: `Saved “${title}” to Saved Trips. Open it anytime from Saved Trips, or keep editing here.`,
  })
}

export function buildEditAck(locale: AgentLocale): string {
  return t(locale, {
    ar: 'حدّث لي الحقل المطلوب (المدة، الميزانية، الوجهة، أو ملاحظة) وسأعيد بناء الخطة.',
    en: 'Tell me what to change (duration, budget, destination, or a note) and I will rebuild the plan.',
  })
}

function formatDates(itinerary: TravelItinerary, locale: AgentLocale): string {
  if (itinerary.startDate && itinerary.endDate) return `${itinerary.startDate} → ${itinerary.endDate}`
  if (itinerary.startDate) {
    return locale === 'ar'
      ? `${itinerary.startDate} · ${itinerary.durationDays} أيام`
      : `${itinerary.startDate} · ${itinerary.durationDays} days`
  }
  return locale === 'ar'
    ? `${itinerary.durationDays} أيام (تواريخ مرنة)`
    : `${itinerary.durationDays} days (flexible dates)`
}

function labelTraveler(
  type: NonNullable<TravelItinerary['travelerType']>,
  locale: AgentLocale,
): string {
  const map = {
    solo: { ar: 'فردي', en: 'solo' },
    couple: { ar: 'زوجين', en: 'couple' },
    family: { ar: 'عائلة', en: 'family' },
    friends: { ar: 'أصدقاء', en: 'friends' },
  } as const
  return map[type][locale]
}
