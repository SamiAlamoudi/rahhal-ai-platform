import type { Passenger, PassengerField, PassengerValidationResult } from '../../lib/passengers'
import { COMMON_COUNTRIES, PASSENGER_GENDERS, PASSENGER_TITLES } from '../../lib/passengers'

export interface PassengerFormProps {
  passenger: Passenger
  index: number
  locale?: 'ar' | 'en'
  fieldMessages?: PassengerValidationResult['fieldMessages']
  onChange: (id: string, field: PassengerField, value: string) => void
}

const TITLE_LABELS: Record<string, { ar: string; en: string }> = {
  mr: { ar: 'السيد', en: 'Mr' },
  mrs: { ar: 'السيدة', en: 'Mrs' },
  ms: { ar: 'الآنسة', en: 'Ms' },
  miss: { ar: 'الآنسة', en: 'Miss' },
  mstr: { ar: 'الشاب', en: 'Mstr' },
  dr: { ar: 'دكتور', en: 'Dr' },
}

const GENDER_LABELS: Record<string, { ar: string; en: string }> = {
  male: { ar: 'ذكر', en: 'Male' },
  female: { ar: 'أنثى', en: 'Female' },
  unspecified: { ar: 'غير محدد', en: 'Unspecified' },
}

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  adult: { ar: 'بالغ', en: 'Adult' },
  child: { ar: 'طفل', en: 'Child' },
  infant: { ar: 'رضيع', en: 'Infant' },
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-[11px] font-medium text-rose-600">{message}</p>
}

export function PassengerForm({
  passenger,
  index,
  locale = 'en',
  fieldMessages = {},
  onChange,
}: PassengerFormProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  const typeLabel = TYPE_LABELS[passenger.type]?.[locale] ?? passenger.type

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100'

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">
          {t(`مسافر ${index + 1}`, `Passenger ${index + 1}`)}
          <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {typeLabel}
          </span>
        </h3>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-600">
          {t('اللقب', 'Title')} *
          <select
            className={inputClass}
            value={passenger.title}
            onChange={(e) => onChange(passenger.id, 'title', e.target.value)}
          >
            <option value="">{t('اختر', 'Select')}</option>
            {PASSENGER_TITLES.map((title) => (
              <option key={title} value={title}>
                {TITLE_LABELS[title]?.[locale] ?? title}
              </option>
            ))}
          </select>
          <FieldError message={fieldMessages.title} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('الجنس', 'Gender')} *
          <select
            className={inputClass}
            value={passenger.gender}
            onChange={(e) => onChange(passenger.id, 'gender', e.target.value)}
          >
            <option value="">{t('اختر', 'Select')}</option>
            {PASSENGER_GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]?.[locale] ?? g}
              </option>
            ))}
          </select>
          <FieldError message={fieldMessages.gender} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('الاسم الأول', 'First name')} *
          <input
            className={inputClass}
            value={passenger.firstName}
            onChange={(e) => onChange(passenger.id, 'firstName', e.target.value)}
            autoComplete="given-name"
          />
          <FieldError message={fieldMessages.firstName} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('اسم العائلة', 'Last name')} *
          <input
            className={inputClass}
            value={passenger.lastName}
            onChange={(e) => onChange(passenger.id, 'lastName', e.target.value)}
            autoComplete="family-name"
          />
          <FieldError message={fieldMessages.lastName} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('تاريخ الميلاد', 'Date of birth')} *
          <input
            type="date"
            className={inputClass}
            value={passenger.dateOfBirth}
            onChange={(e) => onChange(passenger.id, 'dateOfBirth', e.target.value)}
          />
          <FieldError message={fieldMessages.dateOfBirth} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('الجنسية', 'Nationality')} *
          <select
            className={inputClass}
            value={passenger.nationality}
            onChange={(e) => onChange(passenger.id, 'nationality', e.target.value)}
          >
            <option value="">{t('اختر الدولة', 'Select country')}</option>
            {COMMON_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {locale === 'ar' ? c.nameAr : c.nameEn} ({c.code})
              </option>
            ))}
          </select>
          <FieldError message={fieldMessages.nationality} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('رقم الجواز', 'Passport number')} *
          <input
            className={inputClass}
            value={passenger.passportNumber}
            onChange={(e) => onChange(passenger.id, 'passportNumber', e.target.value)}
          />
          <FieldError message={fieldMessages.passportNumber} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('انتهاء الجواز', 'Passport expiry')} *
          <input
            type="date"
            className={inputClass}
            value={passenger.passportExpiry}
            onChange={(e) => onChange(passenger.id, 'passportExpiry', e.target.value)}
          />
          <FieldError message={fieldMessages.passportExpiry} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('دولة إصدار الجواز', 'Passport issuing country')} *
          <select
            className={inputClass}
            value={passenger.passportIssuingCountry}
            onChange={(e) => onChange(passenger.id, 'passportIssuingCountry', e.target.value)}
          >
            <option value="">{t('اختر الدولة', 'Select country')}</option>
            {COMMON_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {locale === 'ar' ? c.nameAr : c.nameEn} ({c.code})
              </option>
            ))}
          </select>
          <FieldError message={fieldMessages.passportIssuingCountry} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('البريد الإلكتروني', 'Email')} {passenger.type === 'adult' ? '*' : ''}
          <input
            type="email"
            className={inputClass}
            value={passenger.email}
            onChange={(e) => onChange(passenger.id, 'email', e.target.value)}
            autoComplete="email"
          />
          <FieldError message={fieldMessages.email} />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('الجوال', 'Mobile number')} {passenger.type === 'adult' ? '*' : ''}
          <input
            type="tel"
            className={inputClass}
            value={passenger.mobileNumber}
            onChange={(e) => onChange(passenger.id, 'mobileNumber', e.target.value)}
            autoComplete="tel"
            placeholder="+9665xxxxxxxx"
          />
          <FieldError message={fieldMessages.mobileNumber} />
        </label>

        <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
          {t('جهة اتصال للطوارئ (اختياري)', 'Emergency contact (optional)')}
          <input
            className={inputClass}
            value={passenger.emergencyContact}
            onChange={(e) => onChange(passenger.id, 'emergencyContact', e.target.value)}
          />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('مساعدة خاصة (اختياري)', 'Special assistance (optional)')}
          <input
            className={inputClass}
            value={passenger.specialAssistance}
            onChange={(e) => onChange(passenger.id, 'specialAssistance', e.target.value)}
          />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          {t('تفضيل الوجبة (اختياري)', 'Meal preference (optional)')}
          <input
            className={inputClass}
            value={passenger.mealPreference}
            onChange={(e) => onChange(passenger.id, 'mealPreference', e.target.value)}
          />
        </label>

        <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
          {t('رقم المسافر الدائم (اختياري)', 'Frequent flyer number (optional)')}
          <input
            className={inputClass}
            value={passenger.frequentFlyerNumber}
            onChange={(e) => onChange(passenger.id, 'frequentFlyerNumber', e.target.value)}
          />
        </label>
      </div>
    </section>
  )
}
