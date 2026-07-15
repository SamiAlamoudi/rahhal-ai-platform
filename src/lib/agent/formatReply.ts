import type { AgentLocale, AgentMemory, TripPlan, TripRequirements, TravelerType } from './types'
import { t } from './locale'

export function buildFollowUpQuestion(
  memory: AgentMemory,
  missing: Array<keyof TripRequirements>,
): string {
  const locale = memory.locale
  const lines: string[] = [
    t(locale, {
      ar: 'سأبني خطة سفر منظمة عبر وكيل رحّال. قبل المتابعة أحتاج معلومات ناقصة (بدون تخمين):',
      en: 'I will draft a structured trip plan via the Rahhal agent. Before continuing I need missing details (no guessing):',
    }),
  ]

  for (const field of missing) {
    if (field === 'destination') {
      lines.push(t(locale, {
        ar: '• ما الوجهة المطلوبة؟ (مثال: اليابان، بالي، لندن، الرياض)',
        en: '• What destination? (e.g. Japan, Bali, London, Riyadh)',
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
      ar: 'اختياري: كم عدد المسافرين؟',
      en: 'Optional: how many travelers?',
    }))
  }

  lines.push('')
  lines.push(t(locale, {
    ar: 'أجب بجملة واحدة وسأكمل الخطة فوراً.',
    en: 'Answer in one message and I will finish the plan.',
  }))
  return lines.join('\n')
}

export function formatTripPlanReply(plan: TripPlan, locale: AgentLocale): string {
  const lines: string[] = []
  lines.push(`## ${plan.title}`)
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
  lines.push(t(locale, {
    ar: `**التكاليف التقديرية:** ${plan.estimatedCosts.amount.toLocaleString('en-US')} ${plan.estimatedCosts.currency}`,
    en: `**Estimated costs:** ${plan.estimatedCosts.amount.toLocaleString('en-US')} ${plan.estimatedCosts.currency}`,
  }))
  lines.push('')
  lines.push(t(locale, { ar: '### برنامج الأيام', en: '### Daily itinerary' }))
  for (const day of plan.dailyItinerary) {
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
  for (const item of plan.transportation) {
    lines.push(`- ${item.mode}: ${item.from} → ${item.to}${item.notes ? ` (${item.notes})` : ''}`)
  }
  if (plan.accommodations.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### توصيات الإقامة', en: '### Accommodation recommendations' }))
    for (const stay of plan.accommodations) {
      const nightly = stay.estimatedNightly != null
        ? ` · ~${stay.estimatedNightly} ${stay.currency}/night`
        : ''
      lines.push(`- ${stay.name} (${stay.area}, ${stay.category})${nightly} — ${stay.fit}`)
    }
  }
  if (plan.notes.length) {
    lines.push('')
    lines.push(t(locale, { ar: '### ملاحظات', en: '### Notes' }))
    for (const note of plan.notes) lines.push(`- ${note}`)
  }
  lines.push('')
  lines.push(t(locale, {
    ar: 'يمكنك تعديل الخطة، إعادة توليدها، أو حفظها من الأزرار أسفل الرسالة.',
    en: 'You can edit, regenerate, or save this plan using the actions under the message.',
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
    ar: 'حدّث لي الحقل المطلوب (المدة، الميزانية، الوجهة، أو ملاحظة) وسأعيد بناء الخطة.',
    en: 'Tell me what to change (duration, budget, destination, or a note) and I will rebuild the plan.',
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
