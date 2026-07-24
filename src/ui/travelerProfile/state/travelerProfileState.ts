import { isTravelerProfileEnabled } from '../travelerProfileRegistry'
import type {
  TravelerProfileLocale,
  TravelerProfileTheme,
  TravelerProfileUiState,
} from '../types'
import { TRAVELER_PROFILE_ISOLATION } from '../types'

export function createDemoTravelerProfileState(options?: {
  locale?: TravelerProfileLocale
  theme?: TravelerProfileTheme
  enabled?: boolean
}): TravelerProfileUiState {
  const locale = options?.locale ?? 'ar'
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)

  return {
    locale,
    theme: options?.theme ?? 'light',
    displayName: t('سامي العَمودي', 'Sami Alamoudi'),
    headline: t('مسافر تنفيذي · عائلي', 'Executive · Family traveler'),
    overview: t(
      'مركز ملف المسافر — تفضيلات ووثائق وولاء وإعدادات. واجهة فقط.',
      'Traveler Profile Center — preferences, documents, loyalty, and settings. Presentation only.',
    ),
    personalInfo: [
      { id: 'p1', label: t('الاسم', 'Name'), value: t('سامي العَمودي', 'Sami Alamoudi') },
      { id: 'p2', label: t('البريد', 'Email'), value: 'sami@example.com' },
      { id: 'p3', label: t('الهاتف', 'Phone'), value: '+966 5X XXX XXXX' },
      { id: 'p4', label: t('المدينة', 'Home city'), value: t('جدة', 'Jeddah') },
    ],
    travelPreferences: [
      { id: 'tp1', label: t('عائلي', 'Family'), active: true },
      { id: 'tp2', label: t('أعمال', 'Business'), active: true },
      { id: 'tp3', label: t('فاخر', 'Luxury'), active: false },
      { id: 'tp4', label: t('مغامرة', 'Adventure'), active: false },
    ],
    languages: [
      { id: 'l1', label: t('العربية', 'Arabic'), active: true },
      { id: 'l2', label: 'English', active: true },
      { id: 'l3', label: 'Français', active: false },
    ],
    currencies: [
      { id: 'c1', label: 'SAR', active: true },
      { id: 'c2', label: 'USD', active: true },
      { id: 'c3', label: 'EUR', active: false },
    ],
    timeZone: 'Asia/Riyadh (GMT+3)',
    travelDocuments: [
      {
        id: 'd1',
        title: t('هوية وطنية', 'National ID'),
        subtitle: t('سارية', 'Valid'),
        statusLabel: t('واجهة فقط', 'Placeholder'),
      },
      {
        id: 'd2',
        title: t('رخصة قيادة دولية', 'Intl. driving permit'),
        subtitle: t('اختياري', 'Optional'),
        statusLabel: t('واجهة فقط', 'Placeholder'),
      },
    ],
    passports: [
      {
        id: 'pp1',
        country: t('السعودية', 'Saudi Arabia'),
        numberMasked: 'P•••• 4821',
        expiresLabel: t('تنتهي 2031', 'Expires 2031'),
      },
      {
        id: 'pp2',
        country: t('جواز ثانٍ', 'Second passport'),
        numberMasked: 'P•••• 1190',
        expiresLabel: t('تنتهي 2029', 'Expires 2029'),
      },
    ],
    visaPlaceholder: t(
      'حالة التأشيرة — واجهة فقط',
      'Visa status — placeholder',
    ),
    boardingPassPlaceholder: t(
      'بطاقات الصعود — واجهة فقط',
      'Boarding passes — placeholder',
    ),
    emergencyContacts: [
      {
        id: 'e1',
        name: t('نورة', 'Noura'),
        relation: t('زوجة', 'Spouse'),
        phoneMasked: '+966 5X ••• ••12',
      },
    ],
    familyMembers: [
      {
        id: 'f1',
        name: t('ليان', 'Layan'),
        relation: t('ابنة', 'Daughter'),
        phoneMasked: '—',
      },
      {
        id: 'f2',
        name: t('عمر', 'Omar'),
        relation: t('ابن', 'Son'),
        phoneMasked: '—',
      },
    ],
    frequentFlyerPrograms: [
      {
        id: 'ff1',
        program: 'Alfursan',
        tier: 'Gold',
        pointsLabel: '84,200',
      },
      {
        id: 'ff2',
        program: 'Emirates Skywards',
        tier: 'Silver',
        pointsLabel: '22,400',
      },
    ],
    hotelLoyaltyPrograms: [
      {
        id: 'hl1',
        program: 'Marriott Bonvoy',
        tier: 'Platinum',
        pointsLabel: '112,000',
      },
      {
        id: 'hl2',
        program: 'Hilton Honors',
        tier: 'Gold',
        pointsLabel: '48,500',
      },
    ],
    preferredAirlines: [
      { id: 'a1', label: 'Saudia', active: true },
      { id: 'a2', label: 'Emirates', active: true },
      { id: 'a3', label: 'Qatar Airways', active: false },
    ],
    preferredHotels: [
      { id: 'h1', label: 'Ritz-Carlton', active: true },
      { id: 'h2', label: 'Four Seasons', active: true },
      { id: 'h3', label: 'Hilton', active: false },
    ],
    preferredSeat: t('ممر · أمامي', 'Aisle · Forward'),
    mealPreferences: [
      { id: 'm1', label: t('حلال', 'Halal'), active: true },
      { id: 'm2', label: t('قليل الصوديوم', 'Low sodium'), active: false },
      { id: 'm3', label: t('نباتي', 'Vegetarian'), active: false },
    ],
    paymentMethodsPlaceholder: t(
      'طرق الدفع — واجهة فقط (لا تخزين ولا مدفوعات)',
      'Payment methods — placeholder (no storage or payments)',
    ),
    savedTravelers: [
      { id: 'st1', name: t('نورة', 'Noura'), role: t('بالغ', 'Adult') },
      { id: 'st2', name: t('ليان', 'Layan'), role: t('طفل', 'Child') },
    ],
    privacySettings: [
      {
        id: 'pr1',
        label: t('مشاركة الملف مع المساعد', 'Share profile with assistant'),
        valueLabel: t('إيقاف (واجهة)', 'Off (UI)'),
      },
      {
        id: 'pr2',
        label: t('سجل الرحلات', 'Trip history visibility'),
        valueLabel: t('خاص', 'Private'),
      },
    ],
    notificationSettings: [
      {
        id: 'n1',
        label: t('تذكير الرحلات', 'Trip reminders'),
        valueLabel: t('واجهة فقط', 'UI only'),
      },
      {
        id: 'n2',
        label: t('عروض الولاء', 'Loyalty offers'),
        valueLabel: t('واجهة فقط', 'UI only'),
      },
    ],
    securityStatus: t('آمن · واجهة فقط', 'Secure · presentation only'),
    securityItems: [
      {
        id: 's1',
        label: t('جلسات نشطة', 'Active sessions'),
        valueLabel: t('واجهة فقط', 'Placeholder'),
      },
      {
        id: 's2',
        label: t('المصادقة الثنائية', 'Two-factor auth'),
        valueLabel: t('واجهة فقط', 'Placeholder'),
      },
    ],
    profileCompletionPercent: 72,
    completionTimeline: [
      { id: 'ct1', label: t('المعلومات الشخصية', 'Personal info'), done: true },
      { id: 'ct2', label: t('الجوازات', 'Passports'), done: true },
      { id: 'ct3', label: t('التفضيلات', 'Preferences'), done: true },
      { id: 'ct4', label: t('طرق الدفع', 'Payment methods'), done: false },
      { id: 'ct5', label: t('جهات الطوارئ', 'Emergency contacts'), done: true },
    ],
    featureEnabled: isTravelerProfileEnabled({ enabled: options?.enabled }),
  }
}

export function assertTravelerProfileIsolation(): typeof TRAVELER_PROFILE_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...TRAVELER_PROFILE_ISOLATION,
    presentationOnly: true,
  }
}
