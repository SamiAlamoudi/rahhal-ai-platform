import { memo, useCallback } from 'react'
import {
  updateSessionField,
  type TravelSession,
  type BudgetCurrency,
  type VisaStatus,
  type FlexibleDates,
  type DirectFlightPreference,
  type CabinClass,
  type AccommodationPreference,
  type TransportPreference,
  type BaggagePreference,
} from '../utils/travelSession'

interface Props {
  session: TravelSession
  onSessionChange: (session: TravelSession) => void
}

const CURRENCY_OPTIONS: { value: BudgetCurrency; label: string }[] = [
  { value: 'SAR', label: 'ريال سعودي' },
  { value: 'USD', label: 'دولار أمريكي' },
  { value: 'EUR', label: 'يورو' },
  { value: 'GBP', label: 'جنيه إسترليني' },
  { value: 'AED', label: 'درهم إماراتي' },
]

const VISA_OPTIONS: { value: VisaStatus; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'visa-free', label: 'بدون تأشيرة' },
  { value: 'visa-required', label: 'يحتاج تأشيرة' },
  { value: 'visa-on-arrival', label: 'تأشيرة عند الوصول' },
  { value: 'has-visa', label: 'لدي تأشيرة' },
]

const FLEX_OPTIONS: { value: FlexibleDates; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'flexible', label: 'تواريخ مرنة' },
  { value: 'fixed', label: 'تواريخ ثابتة' },
]

const CABIN_OPTIONS: { value: CabinClass; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'economy', label: 'اقتصادية' },
  { value: 'premium-economy', label: 'اقتصادية محسّنة' },
  { value: 'business', label: 'رجال أعمال' },
  { value: 'first', label: 'درجة أولى' },
]

const DIRECT_OPTIONS: { value: DirectFlightPreference; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'direct-only', label: 'مباشر فقط' },
  { value: 'direct-preferred', label: 'يفضل مباشر' },
  { value: 'any', label: 'أي رحلة' },
]

const ACCOMMODATION_OPTIONS: { value: AccommodationPreference; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'hotel', label: 'فندق' },
  { value: 'resort', label: 'منتجع' },
  { value: 'apartment', label: 'شقة' },
  { value: 'villa', label: 'فيلا' },
  { value: 'hostel', label: 'هوستل' },
]

const TRANSPORT_OPTIONS: { value: TransportPreference; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'public-transport', label: 'مواصلات عامة' },
  { value: 'private-transfer', label: 'نقل خاص' },
  { value: 'rental-car', label: 'سيارة مستأجرة' },
  { value: 'taxi-ride-hail', label: 'تاكسي / تطبيق نقل' },
]

const BAGGAGE_OPTIONS: { value: BaggagePreference; label: string }[] = [
  { value: '', label: 'غير محدد' },
  { value: 'carry-on-only', label: 'حقيبة يد فقط' },
  { value: 'checked-bag', label: 'حقيبة مسجلة' },
  { value: 'extra-baggage', label: 'أمتعة إضافية' },
]

const HOTEL_RATING_OPTIONS = [
  { value: '', label: 'غير محدد' },
  { value: '3-star', label: '3 نجوم' },
  { value: '4-star', label: '4 نجوم' },
  { value: '5-star', label: '5 نجوم' },
  { value: 'apartment', label: 'شقة' },
  { value: 'resort', label: 'منتجع' },
]

const PURPOSE_OPTIONS = [
  { value: '', label: 'غير محدد' },
  { value: 'leisure', label: 'عطلة' },
  { value: 'family', label: 'عائلي' },
  { value: 'business', label: 'عمل' },
  { value: 'honeymoon', label: 'شهر عسل' },
  { value: 'adventure', label: 'مغامرة' },
  { value: 'religious', label: 'ديني' },
  { value: 'visiting', label: 'زيارة' },
  { value: 'discovery', label: 'اكتشاف' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-all duration-200 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 hover:border-slate-300'
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600'
const sectionClass = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'
const sectionTitleClass = 'mb-4 flex items-center gap-2 text-sm font-bold text-slate-900'

function AdvancedSearchControlsImpl({ session, onSessionChange }: Props) {
  const updateText = useCallback((field: keyof TravelSession, value: string) => {
    onSessionChange(updateSessionField(session, field, value))
  }, [session, onSessionChange])

  const updateDirect = useCallback((field: keyof TravelSession, value: string) => {
    onSessionChange(updateSessionField(session, field, value))
  }, [session, onSessionChange])

  return (
    <div className="space-y-4">
      {/* Destination & Origin */}
      <section className={sectionClass} aria-labelledby="location-heading">
        <div className={sectionTitleClass}>
          <span>📍</span>
          <h3 id="location-heading">الوجهة والمغادرة</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ctrl-destination">الوجهة</label>
            <input
              id="ctrl-destination"
              type="text"
              value={session.destination}
              onChange={e => updateText('destination', e.target.value)}
              placeholder="مثال: اليابان، باريس"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-departure-city">مدينة المغادرة</label>
            <input
              id="ctrl-departure-city"
              type="text"
              value={session.departureCity}
              onChange={e => updateText('departureCity', e.target.value)}
              placeholder="مثال: الرياض"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Dates & Duration */}
      <section className={sectionClass} aria-labelledby="dates-heading">
        <div className={sectionTitleClass}>
          <span>📅</span>
          <h3 id="dates-heading">التواريخ والمدة</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="ctrl-departure-date">تاريخ المغادرة</label>
            <input
              id="ctrl-departure-date"
              type="date"
              value={session.departureDate}
              onChange={e => updateText('departureDate', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-return-date">تاريخ العودة</label>
            <input
              id="ctrl-return-date"
              type="date"
              value={session.returnDate}
              onChange={e => updateText('returnDate', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-duration">المدة (أيام)</label>
            <input
              id="ctrl-duration"
              type="number"
              min={1}
              value={session.durationDays ?? ''}
              onChange={e => updateText('durationDays', e.target.value)}
              placeholder="7"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-flexible">مرونة التواريخ</label>
            <select
              id="ctrl-flexible"
              value={session.flexibleDates}
              onChange={e => updateDirect('flexibleDates', e.target.value)}
              className={inputClass}
            >
              {FLEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Travelers */}
      <section className={sectionClass} aria-labelledby="travelers-heading">
        <div className={sectionTitleClass}>
          <span>👥</span>
          <h3 id="travelers-heading">المسافرون</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="ctrl-adults">البالغون</label>
            <input
              id="ctrl-adults"
              type="number"
              min={1}
              value={session.adults ?? ''}
              onChange={e => updateText('adults', e.target.value)}
              placeholder="2"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-children">الأطفال</label>
            <input
              id="ctrl-children"
              type="number"
              min={0}
              value={session.children ?? ''}
              onChange={e => updateText('children', e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-infants">الرضع</label>
            <input
              id="ctrl-infants"
              type="number"
              min={0}
              value={session.infants ?? ''}
              onChange={e => updateText('infants', e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Budget */}
      <section className={sectionClass} aria-labelledby="budget-heading">
        <div className={sectionTitleClass}>
          <span>💰</span>
          <h3 id="budget-heading">الميزانية</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ctrl-budget">المبلغ</label>
            <input
              id="ctrl-budget"
              type="number"
              min={0}
              value={session.budgetAmount ?? ''}
              onChange={e => updateText('budgetAmount', e.target.value)}
              placeholder="15000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-currency">العملة</label>
            <select
              id="ctrl-currency"
              value={session.budgetCurrency}
              onChange={e => updateDirect('budgetCurrency', e.target.value)}
              className={inputClass}
            >
              <option value="">غير محدد</option>
              {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Flight & Cabin */}
      <section className={sectionClass} aria-labelledby="flight-heading">
        <div className={sectionTitleClass}>
          <span>✈️</span>
          <h3 id="flight-heading">الطيران والمقصورة</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ctrl-cabin">درجة المقصورة</label>
            <select
              id="ctrl-cabin"
              value={session.cabinClass}
              onChange={e => updateDirect('cabinClass', e.target.value)}
              className={inputClass}
            >
              {CABIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-direct">تفضيل الرحلة</label>
            <select
              id="ctrl-direct"
              value={session.directFlightPreference}
              onChange={e => updateDirect('directFlightPreference', e.target.value)}
              className={inputClass}
            >
              {DIRECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-baggage">الأمتعة</label>
            <select
              id="ctrl-baggage"
              value={session.baggagePreference}
              onChange={e => updateDirect('baggagePreference', e.target.value)}
              className={inputClass}
            >
              {BAGGAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-airline">شركة الطيران المفضلة</label>
            <input
              id="ctrl-airline"
              type="text"
              value={session.preferredAirline}
              onChange={e => updateText('preferredAirline', e.target.value)}
              placeholder="مثال: السعودية، الإمارات"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Purpose & Style */}
      <section className={sectionClass} aria-labelledby="purpose-heading">
        <div className={sectionTitleClass}>
          <span>🎯</span>
          <h3 id="purpose-heading">الغرض ونمط السفر</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ctrl-purpose">غرض الرحلة</label>
            <select
              id="ctrl-purpose"
              value={session.tripPurpose}
              onChange={e => updateDirect('tripPurpose', e.target.value)}
              className={inputClass}
            >
              {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-interests">الاهتمامات</label>
            <input
              id="ctrl-interests"
              type="text"
              value={session.interests}
              onChange={e => updateText('interests', e.target.value)}
              placeholder="مثال: ثقافة، طبيعة، تسوق"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Accommodation */}
      <section className={sectionClass} aria-labelledby="accommodation-heading">
        <div className={sectionTitleClass}>
          <span>🏨</span>
          <h3 id="accommodation-heading">الإقامة والتنقل</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="ctrl-hotel-rating">فئة الإقامة</label>
            <select
              id="ctrl-hotel-rating"
              value={session.preferredHotelCategory}
              onChange={e => updateDirect('preferredHotelCategory', e.target.value)}
              className={inputClass}
            >
              {HOTEL_RATING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-accommodation">نوع الإقامة</label>
            <select
              id="ctrl-accommodation"
              value={session.accommodationPreference}
              onChange={e => updateDirect('accommodationPreference', e.target.value)}
              className={inputClass}
            >
              {ACCOMMODATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-transport">وسيلة التنقل</label>
            <select
              id="ctrl-transport"
              value={session.transportPreference}
              onChange={e => updateDirect('transportPreference', e.target.value)}
              className={inputClass}
            >
              {TRANSPORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Visa & Accessibility */}
      <section className={sectionClass} aria-labelledby="visa-heading">
        <div className={sectionTitleClass}>
          <span>🛂</span>
          <h3 id="visa-heading">التأشيرة والاحتياجات الخاصة</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ctrl-visa">حالة التأشيرة</label>
            <select
              id="ctrl-visa"
              value={session.visaStatus}
              onChange={e => updateDirect('visaStatus', e.target.value)}
              className={inputClass}
            >
              {VISA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ctrl-accessibility">احتياجات ذوي الهمم</label>
            <input
              id="ctrl-accessibility"
              type="text"
              value={session.accessibilityNeeds}
              onChange={e => updateText('accessibilityNeeds', e.target.value)}
              placeholder="مثال: كرسي متحرك، مساعدة سمع"
              className={inputClass}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

export const AdvancedSearchControls = memo(AdvancedSearchControlsImpl)
