import { useState } from 'react'
import {
  updateSessionField,
  confirmDecisionProfile,
  type TravelSession,
} from '../utils/travelSession'

interface Props {
  session: TravelSession
  onSessionChange: (session: TravelSession) => void
  onContinuePreferences: () => void
}

const EXPLICIT_FIELDS: (keyof TravelSession)[] = [
  'destination', 'departureCity', 'departureDate', 'durationDays',
  'adults', 'children', 'budgetAmount', 'budgetCurrency',
  'tripPurpose', 'visaStatus', 'cabinClass', 'preferredHotelCategory',
  'interests',
]

const INFERRED_FIELDS: (keyof TravelSession)[] = [
  'travelPurpose', 'travelerType', 'preferredClimate',
  'hotelCategory', 'budgetPriority', 'comfortPriority', 'luxuryPriority',
  'childFriendlyRequired', 'familyRequirements', 'visaConcern',
  'safetyPriority', 'activityStyle', 'flexibilityScore',
  'cultureInterest', 'cityInterest', 'natureInterest',
  'shoppingInterest', 'entertainmentInterest', 'beachInterest',
]

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'مرتفعة',
  medium: 'متوسطة',
  low: 'منخفضة',
  none: '',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
  none: '',
}

function confidenceLabel(conf: string | undefined): string {
  return conf ? CONFIDENCE_LABELS[conf] ?? '' : ''
}

function confidenceColor(conf: string | undefined): string {
  return conf ? CONFIDENCE_COLORS[conf] ?? '' : ''
}

function displayForField(field: keyof TravelSession, session: TravelSession): string {
  if (field === 'budgetAmount' && session.budgetAmount) {
    const currency = session.budgetCurrency || 'SAR'
    const currencyLabel: Record<string, string> = { SAR: 'ريال', USD: 'دولار', EUR: 'يورو', GBP: 'جنيه', AED: 'درهم' }
    return `${session.budgetAmount.toLocaleString()} ${currencyLabel[currency] || currency}`
  }
  if (field === 'durationDays' && session.durationDays) {
    return `${session.durationDays} ${session.durationDays === 1 ? 'يوم' : session.durationDays === 2 ? 'يومان' : 'أيام'}`
  }
  if (field === 'childFriendlyRequired') {
    return session.childFriendlyRequired ? 'نعم، مطلوب' : 'غير مطلوب'
  }
  if (typeof session[field] === 'number' && (field === 'comfortPriority' || field === 'luxuryPriority' || field === 'safetyPriority')) {
    const val = session[field] as number
    const labels: Record<number, string> = { 0: 'غير محدد', 1: 'منخفضة', 2: 'متوسطة', 3: 'عالية' }
    return labels[val] ?? String(val)
  }
  if (field === 'flexibilityScore') {
    return `${session.flexibilityScore}%`
  }
  const val = session[field]
  if (val === null || val === undefined || val === '') return ''
  const mapped: Record<string, string> = {
    'vacation': 'عطلة', 'honeymoon': 'شهر عسل', 'business': 'عمل', 'family': 'عائلي',
    'adventure': 'مغامرة', 'luxury': 'فاخر', 'shopping': 'تسوق', 'medical': 'علاج',
    'religious': 'ديني', 'visiting': 'زيارة', 'discovery': 'اكتشاف',
    'solo': 'فردي', 'couple': 'زوجان', 'family-with-kids': 'عائلة مع أطفال',
    'family-with-infants': 'عائلة مع رضع', 'group': 'مجموعة', 'business-traveler': 'مسافر عمل', 'senior': 'كبار سن',
    'hot': 'حار', 'warm': 'دافئ', 'mild': 'معتدل', 'cool': 'بارد', 'cold': 'بارد جداً', 'tropical': 'استوائي', 'desert': 'صحراوي',
    'budget': 'اقتصادي', 'mid-range': 'متوسط', 'comfort': 'مريح', 'ultra-luxury': 'فاخر جداً',
    'relaxed': 'هادئ', 'balanced': 'متوازن', 'packed': 'مكثف', 'adventurous': 'مغامر', 'cultural': 'ثقافي',
    'lowest-price': 'أقل سعر', 'premium': 'متميز',
    'high': 'مرتفعة', 'medium': 'متوسطة', 'low': 'منخفضة', 'none': 'لا يوجد',
  }
  const raw = String(val)
  return mapped[raw] ?? raw
}

export default function DecisionProfile({ session, onSessionChange, onContinuePreferences }: Props) {
  const [editingField, setEditingField] = useState<keyof TravelSession | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showConfirmedMessage, setShowConfirmedMessage] = useState(false)

  const explicitItems = EXPLICIT_FIELDS.filter(f => {
    const val = session[f]
    return val !== null && val !== undefined && val !== '' && !(typeof val === 'number' && val === 0)
  })

  const inferredItems = INFERRED_FIELDS.filter(f => {
    const val = session[f]
    if (typeof val === 'boolean') return val
    if (typeof val === 'number') return val > 0
    return val !== null && val !== undefined && val !== ''
  })

  const handleEdit = (field: keyof TravelSession) => {
    setEditingField(field)
    const current = session[field]
    setEditValue(current === null || current === undefined ? '' : String(current))
  }

  const handleSaveEdit = () => {
    if (!editingField) return
    const updated = updateSessionField(session, editingField, editValue)
    onSessionChange(updated)
    setEditingField(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const handleConfirm = () => {
    const confirmed = confirmDecisionProfile(session)
    onSessionChange(confirmed)
    setShowConfirmedMessage(true)
  }

  return (
    <section className="rounded-2xl border border-primary-200 bg-gradient-to-b from-primary-50/60 to-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <span className="text-xl">📋</span>
        <h2 className="text-lg font-bold text-slate-900">ملخص رحلتك</h2>
      </div>

      {/* ما ذكرته */}
      <div className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-primary-500" />
          <h3 className="text-sm font-bold text-slate-700">ما ذكرته</h3>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {explicitItems.map(field => (
            <div key={String(field)} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              {editingField === field ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400">{field}</p>
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    autoFocus
                    className="w-full rounded-lg border border-primary-300 px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-700"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-400">
                      {labelFor(field)}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                      {displayForField(field, session)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEdit(field)}
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-primary-500 transition-colors hover:bg-primary-50 hover:text-primary-700"
                  >
                    تعديل
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ما استنتجه رحّال */}
      {inferredItems.length > 0 && (
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-amber-400" />
            <h3 className="text-sm font-bold text-slate-700">ما استنتجه رحّال</h3>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {inferredItems.map(field => {
              const conf = session.inferenceConfidence?.[String(field)] ?? session.fieldConfidence?.[String(field)] ?? ''
              const confText = confidenceLabel(conf)
              const confColor = confidenceColor(conf)
              return (
                <div key={String(field)} className="rounded-xl border border-amber-50 bg-amber-50/30 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-400">
                        {labelFor(field)}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                        {displayForField(field, session)}
                      </p>
                    </div>
                    {confText && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${confColor}`}>
                        {confText}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confirmation message */}
      {showConfirmedMessage && session.decisionProfileConfirmed && (
        <div className="mb-5 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-center">
          <p className="text-sm font-bold text-success-700">
            أصبحت خطتك جاهزة للبحث والمقارنة.
          </p>
        </div>
      )}

      {/* Actions */}
      {!session.decisionProfileConfirmed && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-2xl bg-primary-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-700 active:scale-[0.98]"
          >
            أكد خطتي
          </button>
          <button
            type="button"
            onClick={onContinuePreferences}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-bold text-slate-700 transition-all hover:border-primary-300 hover:bg-primary-50/50 active:scale-[0.98]"
          >
            أكمل التفضيلات
          </button>
        </div>
      )}
    </section>
  )
}

function labelFor(field: keyof TravelSession): string {
  const labels: Partial<Record<keyof TravelSession, string>> = {
    destination: 'الوجهة',
    departureCity: 'مدينة المغادرة',
    departureDate: 'تاريخ السفر',
    durationDays: 'المدة',
    adults: 'البالغون',
    children: 'الأطفال',
    budgetAmount: 'الميزانية',
    budgetCurrency: 'العملة',
    tripPurpose: 'غرض الرحلة',
    visaStatus: 'حالة التأشيرة',
    cabinClass: 'درجة المقصورة',
    preferredHotelCategory: 'الإقامة المفضلة',
    interests: 'الاهتمامات',
    travelPurpose: 'غرض الرحلة',
    travelerType: 'نوع المسافر',
    preferredClimate: 'المناخ المفضل',
    hotelCategory: 'فئة الفندق',
    budgetPriority: 'أولوية الميزانية',
    comfortPriority: 'أولوية الراحة',
    luxuryPriority: 'أولوية الفخامة',
    childFriendlyRequired: 'مناسب للأطفال',
    familyRequirements: 'متطلبات العائلة',
    visaConcern: 'مخاوف التأشيرة',
    safetyPriority: 'أولوية السلامة',
    activityStyle: 'نمط النشاط',
    flexibilityScore: 'مرونة التواريخ',
    cultureInterest: 'اهتمام الثقافة',
    cityInterest: 'اهتمام المدن',
    natureInterest: 'اهتمام الطبيعة',
    shoppingInterest: 'اهتمام التسوق',
    entertainmentInterest: 'اهتمام الترفيه',
    beachInterest: 'اهتمام الشواطئ',
  }
  return labels[field] ?? String(field)
}
