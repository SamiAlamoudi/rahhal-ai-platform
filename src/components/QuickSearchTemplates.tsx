import { memo } from 'react'
import type { TravelSession } from '../utils/travelSession'

interface Template {
  id: string
  label: string
  icon: string
  description: string
  patch: Partial<TravelSession>
}

const TEMPLATES: Template[] = [
  {
    id: 'family-vacation',
    label: 'عطلة عائلية',
    icon: '👨‍👩‍👧‍👦',
    description: 'رحلة مناسبة للعائلة مع أطفال',
    patch: {
      tripPurpose: 'family',
      accommodationPreference: 'hotel',
      preferredHotelCategory: '4-star',
      childFriendlyRequired: true,
      transportPreference: 'private-transfer',
      interests: 'entertainment nature culture',
    },
  },
  {
    id: 'business-trip',
    label: 'رحلة عمل',
    icon: '💼',
    description: 'سفر مرتيح وعملي للعمل',
    patch: {
      tripPurpose: 'business',
      cabinClass: 'business',
      preferredHotelCategory: '4-star',
      transportPreference: 'taxi-ride-hail',
      directFlightPreference: 'direct-preferred',
      baggagePreference: 'carry-on-only',
    },
  },
  {
    id: 'honeymoon',
    label: 'شهر عسل',
    icon: '❤️',
    description: 'رحلة رومانسية لا تُنسى',
    patch: {
      tripPurpose: 'honeymoon',
      cabinClass: 'business',
      accommodationPreference: 'resort',
      preferredHotelCategory: '5-star',
      interests: 'beach nature culture',
      transportPreference: 'private-transfer',
    },
  },
  {
    id: 'luxury',
    label: 'فاخر',
    icon: '💎',
    description: 'أعلى مستوى من الراحة والرفاهية',
    patch: {
      cabinClass: 'first',
      preferredHotelCategory: '5-star',
      accommodationPreference: 'villa',
      transportPreference: 'private-transfer',
      directFlightPreference: 'direct-only',
      interests: 'culture nature',
    },
  },
  {
    id: 'adventure',
    label: 'مغامرة',
    icon: '🗺️',
    description: 'استكشاف وتجارب مثيرة',
    patch: {
      tripPurpose: 'adventure',
      cabinClass: 'economy',
      accommodationPreference: 'hostel',
      preferredHotelCategory: '3-star',
      transportPreference: 'rental-car',
      baggagePreference: 'checked-bag',
      interests: 'adventure nature',
    },
  },
  {
    id: 'weekend-escape',
    label: 'هروب نهاية الأسبوع',
    icon: '⚡',
    description: 'رحلة قصيرة ومنعشة',
    patch: {
      durationDays: 2,
      flexibleDates: 'flexible',
      cabinClass: 'economy',
      preferredHotelCategory: '3-star',
      directFlightPreference: 'direct-preferred',
      baggagePreference: 'carry-on-only',
    },
  },
  {
    id: 'solo-travel',
    label: 'سفر فردي',
    icon: '🧳',
    description: 'اكتشف العالم بمفردك',
    patch: {
      adults: 1,
      tripPurpose: 'discovery',
      cabinClass: 'economy',
      accommodationPreference: 'hotel',
      preferredHotelCategory: '3-star',
      transportPreference: 'public-transport',
      interests: 'culture city discovery',
    },
  },
  {
    id: 'group-travel',
    label: 'سفر جماعي',
    icon: '👥',
    description: 'رحلة مع مجموعة أصدقاء',
    patch: {
      tripPurpose: 'leisure',
      accommodationPreference: 'apartment',
      preferredHotelCategory: '4-star',
      transportPreference: 'rental-car',
      baggagePreference: 'checked-bag',
      interests: 'entertainment city adventure',
    },
  },
]

interface Props {
  onApplyTemplate: (patch: Partial<TravelSession>) => void
}

function QuickSearchTemplatesImpl({ onApplyTemplate }: Props) {
  return (
    <section aria-labelledby="templates-heading" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">⚡</span>
        <h3 id="templates-heading" className="text-sm font-bold text-slate-900">
          قوالب سريعة
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {TEMPLATES.map(tpl => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onApplyTemplate(tpl.patch)}
            className="group flex flex-col items-start gap-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-right transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            aria-label={`تطبيق قالب ${tpl.label}`}
          >
            <span className="text-xl transition-transform duration-200 group-hover:scale-110">{tpl.icon}</span>
            <span className="text-xs font-bold text-slate-800 group-hover:text-primary-700">{tpl.label}</span>
            <span className="text-[10px] leading-snug text-slate-400 group-hover:text-primary-500">{tpl.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export const QuickSearchTemplates = memo(QuickSearchTemplatesImpl)
