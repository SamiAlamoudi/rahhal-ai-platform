import { parseTravelIntent, type TravelIntent } from './tripAnalyzer'
import {
  analyzeRequirements,
  createEmptyProfile,
  getNextAnalysisQuestion,
  type RequirementProfile,
} from './requirementAnalyzer'

export type BudgetCurrency = 'SAR' | 'USD' | 'EUR' | 'GBP' | 'AED' | ''
export type VisaStatus = '' | 'visa-free' | 'visa-required' | 'visa-on-arrival' | 'has-visa'
export type FlexibleDates = '' | 'flexible' | 'fixed'
export type DirectFlightPreference = '' | 'direct-only' | 'direct-preferred' | 'any'
export type BaggagePreference = '' | 'carry-on-only' | 'checked-bag' | 'extra-baggage'
export type TransportPreference = '' | 'public-transport' | 'private-transfer' | 'rental-car' | 'taxi-ride-hail'
export type AccommodationPreference = '' | 'hotel' | 'resort' | 'apartment' | 'villa' | 'hostel'
export type CabinClass = '' | 'economy' | 'premium-economy' | 'business' | 'first'

// Re-export the profile types so consumers can import from travelSession
export type {
  TravelPurpose, TravelerType, PreferredClimate, HotelCategory as AnalysisHotelCategory,
  ActivityStyle, FoodPreference, TransportationPreference as AnalysisTransportPreference,
  BudgetPriority, PriorityLevel, FlightTimePreference, PreferredLanguage,
  VisaConcern, HotelAreaPreference, RequirementProfile,
} from './requirementAnalyzer'

export interface TravelSession {
  // ── Core session fields (conversation-collected) ──
  destination: string
  departureCity: string
  departureCountry: string
  departureDate: string
  returnDate: string
  durationDays: number | null
  adults: number | null
  children: number | null
  infants: number | null
  budgetAmount: number | null
  budgetCurrency: BudgetCurrency
  tripPurpose: string
  preferredAirline: string
  preferredHotelCategory: string
  cabinClass: CabinClass
  visaStatus: VisaStatus
  interests: string
  flexibleDates: FlexibleDates
  directFlightPreference: DirectFlightPreference
  baggagePreference: BaggagePreference
  transportPreference: TransportPreference
  accommodationPreference: AccommodationPreference

  // ── Analysis profile (inferred by requirementAnalyzer) ──
  travelPurpose: string
  travelerType: string
  preferredClimate: string
  hotelCategory: string
  activityStyle: string
  foodPreference: string
  transportationPreference: string
  flexibilityScore: number
  budgetPriority: string
  comfortPriority: number
  luxuryPriority: number
  familyRequirements: string
  childFriendlyRequired: boolean
  accessibilityNeeds: string
  preferredFlightTime: string
  preferredHotelArea: string
  preferredLanguage: string
  visaConcern: string
  shoppingInterest: number
  natureInterest: number
  cultureInterest: number
  entertainmentInterest: number
  beachInterest: number
  cityInterest: number
  safetyPriority: number
  fieldConfidence: Record<string, string>

  // ── Decision profile ──
  decisionProfileConfirmed: boolean
  explicitFields: string[]
  inferredFields: string[]
  inferenceConfidence: Record<string, string>
  confirmedAt: string | null

  // ── Meta ──
  lastConversationText: string
  completedFields: string[]
  missingFields: string[]
  completionPercentage: number
  lastUpdatedAt: string
}

export const SESSION_STORAGE_KEY = 'rahhal_travel_session'

const ESSENTIAL_FIELDS: (keyof TravelSession)[] = [
  'destination',
  'departureCity',
  'departureDate',
  'durationDays',
  'adults',
  'children',
  'budgetAmount',
  'tripPurpose',
  'visaStatus',
  'cabinClass',
  'preferredHotelCategory',
]

export const ALL_TRACKED_FIELDS: (keyof TravelSession)[] = [
  'destination',
  'departureCity',
  'departureCountry',
  'departureDate',
  'returnDate',
  'durationDays',
  'adults',
  'children',
  'infants',
  'budgetAmount',
  'budgetCurrency',
  'tripPurpose',
  'preferredAirline',
  'preferredHotelCategory',
  'cabinClass',
  'visaStatus',
  'interests',
  'flexibleDates',
  'directFlightPreference',
  'baggagePreference',
  'transportPreference',
  'accommodationPreference',
  'lastConversationText',
  'decisionProfileConfirmed',
  'confirmedAt',
]

const QUESTION_PRIORITY: (keyof TravelSession)[] = [
  'destination',
  'departureCity',
  'departureDate',
  'durationDays',
  'adults',
  'budgetAmount',
  'tripPurpose',
  'visaStatus',
  'cabinClass',
  'preferredHotelCategory',
]

export const QUESTION_TEXTS: Record<string, string> = {
  destination: 'إلى أين تحلم أن تسافر؟',
  departureCity: 'من أي مدينة ستكون المغادرة؟',
  departureDate: 'متى تخطط للسفر؟ يمكنك ذكر الشهر أو التاريخ التقريبي.',
  durationDays: 'كم تتمنى أن تستغرق الرحلة؟',
  adults: 'كم عدد المسافرين البالغين في هذه الرحلة؟',
  children: 'هل يسافر معك أطفال؟ كم عددهم؟',
  budgetAmount: 'ما هي ميزانيتك التقريبية لهذه الرحلة؟',
  tripPurpose: 'ما الغرض من رحلتك؟ عطلة، عمل، عائلة، شهر عسل؟',
  visaStatus: 'هل لديك تأشيرة للوجهة، أم تفضل وجهة بدون تأشيرة؟',
  cabinClass: 'ما هي درجة المقصورة المفضلة لديك؟ اقتصادي، رجال أعمال، أو درجة أولى؟',
  preferredHotelCategory: 'ما نوع الإقامة المفضل لديك؟ فندق، شقة، منتجع؟',
}

export const QUESTION_REASONS: Record<string, string> = {
  destination: 'الوجهة هي نقطة البداية لكل خطة — بدونها لا أستطيع البحث عن رحلات أو فنادق أو تأشيرات.',
  departureCity: 'أحتاج مدينة المغادرة حتى أبحث عن أفضل الرحلات الجوية المتاحة لك.',
  departureDate: 'تاريخ السفر يحدد أسعار الرحلات والفنادق ومدى توفرها.',
  durationDays: 'مدة الرحلة تساعدني على تقسيم الأيام بين المدن والأنشطة بشكل متوازن.',
  adults: 'عدد المسافرين يؤثر على نوع الغرف وتذاكر الطيران والتكلفة الإجمالية.',
  children: 'وجود أطفال يغيّر نوع الإقامة والأنشطة المناسبة لرحلتك.',
  budgetAmount: 'الميزانية توجّه اختياراتي نحو الخيارات الأنسب لك دون إهدار وقتك.',
  tripPurpose: 'غرض الرحلة يغيّر نوع الأنشطة والإقامة التي سأوصي بها تماماً.',
  visaStatus: 'حالة التأشيرة تحدد ما إذا كانت الوجهة متاحة لك أم تحتاج ترتيبات إضافية.',
  cabinClass: 'درجة المقصومة تحدد مستوى الراحة وميزانية الطيران المناسبة لك.',
  preferredHotelCategory: 'تفضيل الإقامة يجعل توصياتي أكثر دقة ومناسبة لذوقك.',
}

export const QUESTION_PLACEHOLDERS: Record<string, string> = {
  destination: 'مثال: اليابان، باريس، دبي',
  departureCity: 'مثال: الرياض',
  departureDate: 'مثال: 15 أكتوبر أو نوفمبر القادم',
  durationDays: 'مثال: 7 أيام أو أسبوعين',
  adults: 'مثال: 2 بالغين',
  children: 'مثال: طفلين، أو لا يوجد أطفال',
  budgetAmount: 'مثال: 15,000 ريال',
  tripPurpose: 'مثال: عطلة عائلية، عمل، شهر عسل',
  visaStatus: 'مثال: بدون تأشيرة، أو لدي تأشيرة',
  cabinClass: 'مثال: اقتصادي، رجال أعمال، درجة أولى',
  preferredHotelCategory: 'مثال: فندق 4 نجوم، شقة، منتجع',
}

export const QUESTION_ACKNOWLEDGMENT = 'ممتاز... بقي لدي سؤال واحد فقط.'

export const SESSION_FIELD_LABELS: Record<string, string> = {
  destination: 'الوجهة',
  departureCity: 'مدينة المغادرة',
  departureCountry: 'دولة المغادرة',
  departureDate: 'تاريخ المغادرة',
  returnDate: 'تاريخ العودة',
  durationDays: 'المدة',
  adults: 'البالغون',
  children: 'الأطفال',
  infants: 'الرضع',
  budgetAmount: 'الميزانية',
  budgetCurrency: 'عملة الميزانية',
  tripPurpose: 'الغرض من الرحلة',
  preferredAirline: 'الطيران المفضل',
  preferredHotelCategory: 'فئة الإقامة',
  cabinClass: 'درجة المقصومة',
  visaStatus: 'حالة التأشيرة',
  interests: 'الاهتمامات',
  flexibleDates: 'مرونة التواريخ',
  directFlightPreference: 'تفضيل الرحلة المباشرة',
  baggagePreference: 'تفضيل الأمتعة',
  transportPreference: 'تفضيل المواصلات',
  accommodationPreference: 'نوع الإقامة',
  // Inferred fields
  travelPurpose: 'غرض الرحلة (مستنتج)',
  travelerType: 'نوع المسافر',
  preferredClimate: 'المناخ المفضل',
  hotelCategory: 'فئة الفندق (مستنتجة)',
  activityStyle: 'نمط النشاط',
  foodPreference: 'تفضيل الطعام',
  transportationPreference: 'تفضيل التنقل (مستنتج)',
  flexibilityScore: 'مرونة التواريخ (مستنتجة)',
  budgetPriority: 'أولوية الميزانية',
  comfortPriority: 'أولوية الراحة',
  luxuryPriority: 'أولوية الفخامة',
  familyRequirements: 'متطلبات العائلة',
  childFriendlyRequired: 'مناسب للأطفال',
  accessibilityNeeds: 'احتياجات ذوي الهمم',
  preferredFlightTime: 'وقت الرحلة المفضل',
  preferredHotelArea: 'منطقة الفندق المفضلة',
  preferredLanguage: 'اللغة المفضلة',
  visaConcern: 'مخاوف التأشيرة (مستنتجة)',
  shoppingInterest: 'اهتمام التسوق',
  natureInterest: 'اهتمام الطبيعة',
  cultureInterest: 'اهتمام الثقافة',
  entertainmentInterest: 'اهتمام الترفيه',
  beachInterest: 'اهتمام الشواطئ',
  cityInterest: 'اهتمام المدن',
  safetyPriority: 'أولوية السلامة',
}

export const SESSION_FIELD_ICONS: Record<string, string> = {
  destination: '📍',
  departureCity: '🏙️',
  departureCountry: '🗺️',
  departureDate: '📅',
  returnDate: '🔙',
  durationDays: '🗓️',
  adults: '🧑',
  children: '🧒',
  infants: '👶',
  budgetAmount: '💰',
  budgetCurrency: '💱',
  tripPurpose: '🎯',
  preferredAirline: '🛩️',
  preferredHotelCategory: '🏨',
  cabinClass: '💺',
  visaStatus: '🛂',
  interests: '⭐',
  flexibleDates: '🔄',
  directFlightPreference: '✈️',
  baggagePreference: '🧳',
  transportPreference: '🚕',
  accommodationPreference: '🏠',
  // Inferred fields
  travelPurpose: '🎯',
  travelerType: '👥',
  preferredClimate: '🌤️',
  hotelCategory: '🏨',
  activityStyle: '🎨',
  foodPreference: '🍽️',
  transportationPreference: '🚗',
  flexibilityScore: '📊',
  budgetPriority: '⚖️',
  comfortPriority: '🛋️',
  luxuryPriority: '💎',
  familyRequirements: '👨‍👩‍👧',
  childFriendlyRequired: '🧸',
  accessibilityNeeds: '♿',
  preferredFlightTime: '⏰',
  preferredHotelArea: '🗺️',
  preferredLanguage: '🗣️',
  visaConcern: '🛂',
  shoppingInterest: '🛍️',
  natureInterest: '🌿',
  cultureInterest: '🏛️',
  entertainmentInterest: '🎭',
  beachInterest: '🏖️',
  cityInterest: '🏙️',
  safetyPriority: '🛡️',
}

const VISA_STATUS_LABELS: Record<VisaStatus, string> = {
  '': '',
  'visa-free': 'بدون تأشيرة',
  'visa-required': 'يحتاج تأشيرة',
  'visa-on-arrival': 'تأشيرة عند الوصول',
  'has-visa': 'لديه تأشيرة',
}

const CABIN_CLASS_LABELS: Record<CabinClass, string> = {
  '': '',
  'economy': 'الدرجة الاقتصادية',
  'premium-economy': 'درجة سياحية متميزة',
  'business': 'درجة رجال الأعمال',
  'first': 'درجة أولى',
}

const FLEXIBLE_DATES_LABELS: Record<FlexibleDates, string> = {
  '': '',
  'flexible': 'تواريخ مرنة',
  'fixed': 'تواريخ ثابتة',
}

const DIRECT_FLIGHT_LABELS: Record<DirectFlightPreference, string> = {
  '': '',
  'direct-only': 'رحلة مباشرة فقط',
  'direct-preferred': 'يفضل رحلة مباشرة',
  'any': 'أي رحلة',
}

const BAGGAGE_LABELS: Record<BaggagePreference, string> = {
  '': '',
  'carry-on-only': 'حقيبة يد فقط',
  'checked-bag': 'حقيبة مسجلة',
  'extra-baggage': 'أمتعة إضافية',
}

const TRANSPORT_LABELS: Record<TransportPreference, string> = {
  '': '',
  'public-transport': 'مواصلات عامة',
  'private-transfer': 'نقل خاص',
  'rental-car': 'سيارة مستأجرة',
  'taxi-ride-hail': 'تاكسي / تطبيق نقل',
}

const ACCOMMODATION_LABELS: Record<AccommodationPreference, string> = {
  '': '',
  'hotel': 'فندق',
  'resort': 'منتجع',
  'apartment': 'شقة',
  'villa': 'فيلا',
  'hostel': 'هوستل',
}

const ALL_LABEL_MAPS: Record<string, Record<string, string>> = {
  visaStatus: VISA_STATUS_LABELS,
  cabinClass: CABIN_CLASS_LABELS,
  flexibleDates: FLEXIBLE_DATES_LABELS,
  directFlightPreference: DIRECT_FLIGHT_LABELS,
  baggagePreference: BAGGAGE_LABELS,
  transportPreference: TRANSPORT_LABELS,
  accommodationPreference: ACCOMMODATION_LABELS,
}

export function getDisplayValue(field: keyof TravelSession, session: TravelSession): string {
  const raw = session[field]
  if (raw === null || raw === undefined || raw === '') return ''
  const labelMap = ALL_LABEL_MAPS[field as string]
  if (labelMap && typeof raw === 'string') {
    return labelMap[raw as string] ?? String(raw)
  }
  if (field === 'durationDays') {
    return `${raw} أيام`
  }
  if (field === 'adults') {
    return `${raw} بالغين`
  }
  if (field === 'children') {
    return `${raw} أطفال`
  }
  if (field === 'infants') {
    return `${raw} رضيع`
  }
  if (field === 'budgetAmount') {
    const currencyLabel = session.budgetCurrency
      ? `${raw} ${session.budgetCurrency}`
      : `${raw}`
    return currencyLabel
  }
  return String(raw)
}

export function createEmptyTravelSession(): TravelSession {
  const emptyProfile = createEmptyProfile()
  return {
    destination: '',
    departureCity: '',
    departureCountry: '',
    departureDate: '',
    returnDate: '',
    durationDays: null,
    adults: null,
    children: null,
    infants: null,
    budgetAmount: null,
    budgetCurrency: '',
    tripPurpose: '',
    preferredAirline: '',
    preferredHotelCategory: '',
    cabinClass: '',
    visaStatus: '',
    interests: '',
    flexibleDates: '',
    directFlightPreference: '',
    baggagePreference: '',
    transportPreference: '',
    accommodationPreference: '',
    // Analysis profile fields
    travelPurpose: emptyProfile.travelPurpose,
    travelerType: emptyProfile.travelerType,
    preferredClimate: emptyProfile.preferredClimate,
    hotelCategory: emptyProfile.hotelCategory,
    activityStyle: emptyProfile.activityStyle,
    foodPreference: emptyProfile.foodPreference,
    transportationPreference: emptyProfile.transportationPreference,
    flexibilityScore: emptyProfile.flexibilityScore,
    budgetPriority: emptyProfile.budgetPriority,
    comfortPriority: emptyProfile.comfortPriority,
    luxuryPriority: emptyProfile.luxuryPriority,
    familyRequirements: emptyProfile.familyRequirements,
    childFriendlyRequired: emptyProfile.childFriendlyRequired,
    accessibilityNeeds: emptyProfile.accessibilityNeeds,
    preferredFlightTime: emptyProfile.preferredFlightTime,
    preferredHotelArea: emptyProfile.preferredHotelArea,
    preferredLanguage: emptyProfile.preferredLanguage,
    visaConcern: emptyProfile.visaConcern,
    shoppingInterest: emptyProfile.shoppingInterest,
    natureInterest: emptyProfile.natureInterest,
    cultureInterest: emptyProfile.cultureInterest,
    entertainmentInterest: emptyProfile.entertainmentInterest,
    beachInterest: emptyProfile.beachInterest,
    cityInterest: emptyProfile.cityInterest,
    safetyPriority: emptyProfile.safetyPriority,
    fieldConfidence: {},
    decisionProfileConfirmed: false,
    explicitFields: [],
    inferredFields: [],
    inferenceConfidence: {},
    confirmedAt: null,
    lastConversationText: '',
    completedFields: [],
    missingFields: [],
    completionPercentage: 0,
    lastUpdatedAt: new Date().toISOString(),
  }
}

function isFieldFilled(field: keyof TravelSession, session: TravelSession): boolean {
  const value = session[field]
  if (value === null || value === undefined || value === '') return false
  return true
}

function computeMissingFields(session: TravelSession): string[] {
  const missing: string[] = []
  for (const field of ESSENTIAL_FIELDS) {
    if (!isFieldFilled(field, session)) {
      missing.push(field)
    }
  }
  return missing
}

function computeCompletedFields(session: TravelSession): string[] {
  const completed: string[] = []
  for (const field of ALL_TRACKED_FIELDS) {
    if (isFieldFilled(field, session)) {
      completed.push(field)
    }
  }
  return completed
}

export function calculateCompletionPercentage(session: TravelSession): number {
  let filled = 0
  for (const field of ESSENTIAL_FIELDS) {
    if (isFieldFilled(field, session)) filled++
  }
  return Math.round((filled / ESSENTIAL_FIELDS.length) * 100)
}

function withDerivedFields(session: TravelSession): TravelSession {
  const completedFields = computeCompletedFields(session)
  const missingFields = computeMissingFields(session)
  const completionPercentage = calculateCompletionPercentage(session)
  const profile = analyzeRequirements(session, session.lastConversationText ?? '')
  const explicitFields = computeExplicitFields(session)
  const inferredFields = computeInferredFields(profile)
  const inferenceConfidence = profile.confidence as unknown as Record<string, string>
  return {
    ...session,
    ...profile,
    fieldConfidence: profile.confidence as unknown as Record<string, string>,
    explicitFields,
    inferredFields,
    inferenceConfidence,
    completedFields,
    missingFields,
    completionPercentage,
    lastUpdatedAt: new Date().toISOString(),
  }
}

const DESTINATION_NORMALIZE: Record<string, string> = {
  'اليابان': 'Japan',
  'يابان': 'Japan',
  'japan': 'Japan',
  'كوريا': 'Korea',
  'كوريا الجنوبية': 'South Korea',
  'korea': 'South Korea',
  'south korea': 'South Korea',
  'تايلاند': 'Thailand',
  'thailand': 'Thailand',
  'اندونيسيا': 'Indonesia',
  'إندونيسيا': 'Indonesia',
  'indonesia': 'Indonesia',
  'ماليزيا': 'Malaysia',
  'malaysia': 'Malaysia',
  'تركيا': 'Turkey',
  'turkey': 'Turkey',
  'دبي': 'Dubai',
  'الإمارات': 'UAE',
  'الامارات': 'UAE',
  'uae': 'UAE',
  'قطر': 'Qatar',
  'qatar': 'Qatar',
  'مصر': 'Egypt',
  'egypt': 'Egypt',
  'فرنسا': 'France',
  'france': 'France',
  'باريس': 'Paris',
  'paris': 'Paris',
  'انجلترا': 'England',
  'لندن': 'London',
  'بريطانيا': 'UK',
  'ايطاليا': 'Italy',
  'إيطاليا': 'Italy',
  'italy': 'Italy',
  'روما': 'Rome',
  'اسبانيا': 'Spain',
  'إسبانيا': 'Spain',
  'spain': 'Spain',
  'المانيا': 'Germany',
  'ألمانيا': 'Germany',
  'germany': 'Germany',
  'امريكا': 'USA',
  'أمريكا': 'USA',
  'usa': 'USA',
  'مالديف': 'Maldives',
  'maldives': 'Maldives',
}

const CITY_NORMALIZE: Record<string, string> = {
  'الرياض': 'Riyadh',
  'riyadh': 'Riyadh',
  'جدة': 'Jeddah',
  'jeddah': 'Jeddah',
  'الدمام': 'Dammam',
  'dammam': 'Dammam',
  'مكة': 'Mecca',
  'المدينة': 'Madinah',
  'ابها': 'Abha',
  'تبوك': 'Tabuk',
  'الطائف': 'Taif',
}

const AIRLINE_NORMALIZE: Record<string, string> = {
  'سعوديا': 'Saudia',
  'السعودية': 'Saudia',
  'saudia': 'Saudia',
  'الخطوط السعودية': 'Saudia',
  'طيران ناس': 'Flynas',
  'فلاي ناس': 'Flynas',
  'flynas': 'Flynas',
  'طيران الخليج': 'Gulf Air',
  'gulf air': 'Gulf Air',
  'طيران الامارات': 'Emirates',
  'الامارات': 'Emirates',
  'emirates': 'Emirates',
  'القطرية': 'Qatar Airways',
  'قطر': 'Qatar Airways',
  'qatar airways': 'Qatar Airways',
  'طيران الاتحاد': 'Etihad',
  'الاتحاد': 'Etihad',
  'etihad': 'Etihad',
  'الخطوط التركية': 'Turkish Airlines',
  'الطيران التركي': 'Turkish Airlines',
  'turkish airlines': 'Turkish Airlines',
  'لوفتهانزا': 'Lufthansa',
  'lufthansa': 'Lufthansa',
}

const HOTEL_CATEGORY_NORMALIZE: Record<string, string> = {
  'فندق 5': '5-star',
  'فندق خمس': '5-star',
  'خمس نجوم': '5-star',
  '5 star': '5-star',
  '5-star': '5-star',
  'فندق 4': '4-star',
  'فندق اربع': '4-star',
  'اربع نجوم': '4-star',
  '4 star': '4-star',
  '4-star': '4-star',
  'فندق 3': '3-star',
  'فندق ثلاث': '3-star',
  'ثلاث نجوم': '3-star',
  '3 star': '3-star',
  '3-star': '3-star',
  'فندق': 'hotel',
  'شقة': 'apartment',
  'شقق': 'apartment',
  'apartment': 'apartment',
  'فيلا': 'villa',
  'villa': 'villa',
  'منتجع': 'resort',
  'resort': 'resort',
  'استضافة': 'hostel',
  'هوستل': 'hostel',
  'hostel': 'hostel',
}

const CABIN_NORMALIZE: Record<string, CabinClass> = {
  'درجة اولى': 'first',
  'الدرجة الاولى': 'first',
  'اول كلاس': 'first',
  'first': 'first',
  'first class': 'first',
  'رجال اعمال': 'business',
  'رجال الاعمال': 'business',
  'بيزنس': 'business',
  'business': 'business',
  'سياحي': 'economy',
  'اقتصادي': 'economy',
  'economy': 'economy',
  'سياحي متميز': 'premium-economy',
  'premium economy': 'premium-economy',
  'premium-economy': 'premium-economy',
}

const VISA_NORMALIZE: Record<string, VisaStatus> = {
  'بدون تاشيره': 'visa-free',
  'بدون تااشيره': 'visa-free',
  'دون تاشيره': 'visa-free',
  'بدون فيزا': 'visa-free',
  'visa-free': 'visa-free',
  'visa free': 'visa-free',
  'يحتاج تاشيره': 'visa-required',
  'يحتاج تااشيره': 'visa-required',
  'فيزا': 'visa-required',
  'visa-required': 'visa-required',
  'visa required': 'visa-required',
  'عند الوصول': 'visa-on-arrival',
  'visa on arrival': 'visa-on-arrival',
  'لدي تاشيره': 'has-visa',
  'لدي تااشيره': 'has-visa',
  'لدي تأشيرة': 'has-visa',
  'has visa': 'has-visa',
  'has-visa': 'has-visa',
}

const PURPOSE_NORMALIZE: Record<string, string> = {
  'عطلة': 'leisure',
  'اجازة': 'leisure',
  'استجمام': 'leisure',
  'leisure': 'leisure',
  'vacation': 'leisure',
  'عائلة': 'family',
  'عائلي': 'family',
  'family': 'family',
  'عمل': 'business',
  'مؤتمر': 'business',
  'اجتماع': 'business',
  'business': 'business',
  'شهر العسل': 'honeymoon',
  'شهر عسل': 'honeymoon',
  'honeymoon': 'honeymoon',
  'مغامرة': 'adventure',
  'adventure': 'adventure',
  'ديني': 'religious',
  'عمرة': 'religious',
  'حج': 'religious',
  'religious': 'religious',
  'زيارة': 'visiting',
  'اكتشاف': 'discovery',
}

const FLEXIBLE_NORMALIZE: Record<string, FlexibleDates> = {
  'مرن': 'flexible',
  'مرونه': 'flexible',
  'مرنه': 'flexible',
  'اي وقت': 'flexible',
  'مفتوح': 'flexible',
  'flexible': 'flexible',
  'ثابت': 'fixed',
  'محدد': 'fixed',
  'تواريخ ثابته': 'fixed',
  'fixed': 'fixed',
}

const CURRENCY_KEYWORDS: { kw: string; currency: BudgetCurrency }[] = [
  { kw: 'ريال', currency: 'SAR' },
  { kw: 'ريالات', currency: 'SAR' },
  { kw: 'sar', currency: 'SAR' },
  { kw: 'دولار', currency: 'USD' },
  { kw: 'usd', currency: 'USD' },
  { kw: '$', currency: 'USD' },
  { kw: 'يورو', currency: 'EUR' },
  { kw: 'eur', currency: 'EUR' },
  { kw: '€', currency: 'EUR' },
  { kw: 'جنيه', currency: 'GBP' },
  { kw: 'gbp', currency: 'GBP' },
  { kw: 'درهم', currency: 'AED' },
  { kw: 'aed', currency: 'AED' },
]

const DIRECT_FLIGHT_NORMALIZE: Record<string, DirectFlightPreference> = {
  'مباشر فقط': 'direct-only',
  'direct only': 'direct-only',
  'رحله مباشره': 'direct-only',
  'يفضل مباشر': 'direct-preferred',
  'direct preferred': 'direct-preferred',
  'افضل مباشر': 'direct-preferred',
  'اي رحله': 'any',
  'any': 'any',
}

const BAGGAGE_NORMALIZE: Record<string, BaggagePreference> = {
  'حقيبة يد': 'carry-on-only',
  'يد فقط': 'carry-on-only',
  'carry-on': 'carry-on-only',
  'carry on': 'carry-on-only',
  'حقيبة مسجلة': 'checked-bag',
  'مسجلة': 'checked-bag',
  'checked bag': 'checked-bag',
  'checked': 'checked-bag',
  'امتعة اضافية': 'extra-baggage',
  'أمتعة إضافية': 'extra-baggage',
  'اضافية': 'extra-baggage',
  'extra baggage': 'extra-baggage',
  'extra': 'extra-baggage',
}

const TRANSPORT_NORMALIZE: Record<string, TransportPreference> = {
  'مواصلات عامة': 'public-transport',
  'public transport': 'public-transport',
  'نقل خاص': 'private-transfer',
  'private transfer': 'private-transfer',
  'سيارة مستأجرة': 'rental-car',
  'rental car': 'rental-car',
  'تاكسي': 'taxi-ride-hail',
  'uber': 'taxi-ride-hail',
  'كريم': 'taxi-ride-hail',
}

const ACCOMMODATION_NORMALIZE: Record<string, AccommodationPreference> = {
  'فندق': 'hotel',
  'hotel': 'hotel',
  'منتجع': 'resort',
  'resort': 'resort',
  'شقة': 'apartment',
  'apartment': 'apartment',
  'فيلا': 'villa',
  'villa': 'villa',
  'هوستل': 'hostel',
  'hostel': 'hostel',
}

function normalizeText(text: string): string {
  return text
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
}

function toWesternDigits(s: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  }
  return s.replace(/[٠-٩]/g, d => map[d] || d)
}

function lookupNormalized(
  textNorm: string,
  map: Record<string, string>,
): string | null {
  for (const key in map) {
    if (textNorm.includes(normalizeText(key))) {
      return map[key]
    }
  }
  return null
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const western = toWesternDigits(text)
  const m = western.match(pattern)
  if (m) {
    const n = parseInt(m[1], 10)
    if (!isNaN(n)) return n
  }
  return null
}

function parseIntentToSessionUpdates(text: string): Partial<TravelSession> {
  const textNorm = normalizeText(text)
  const intent = parseTravelIntent(text)
  const updates: Partial<TravelSession> = {}

  if (intent.destination) {
    const norm = lookupNormalized(textNorm, DESTINATION_NORMALIZE)
    updates.destination = norm ?? intent.destination
  }

  if (intent.departureCity) {
    const norm = lookupNormalized(textNorm, CITY_NORMALIZE)
    updates.departureCity = norm ?? intent.departureCity
  }

  if (intent.departureCountry) {
    updates.departureCountry = intent.departureCountry
  }

  if (intent.departureDate) {
    updates.departureDate = intent.departureDate
  }

  if (intent.returnDate) {
    updates.returnDate = intent.returnDate
  }

  const durationDays = extractNumber(textNorm, /(\d+)\s*(?:يوم|ايام)/) ??
    extractNumber(textNorm, /(?:للمده|مدة|المده)\s*(?:حوالي\s*)?(\d+)/) ??
    null
  if (durationDays !== null) {
    updates.durationDays = durationDays
  } else if (intent.duration) {
    const fromIntent = extractNumber(intent.duration, /(\d+)/)
    if (fromIntent !== null) updates.durationDays = fromIntent
  }

  const adultsNum = extractNumber(textNorm, /(\d+)\s*(?:بالغ|بالغين|شخص|اشخاص)/)
  if (adultsNum !== null) {
    updates.adults = adultsNum
  } else if (textNorm.includes('زوجتي') || textNorm.includes('زوجي')) {
    updates.adults = 2
  } else if (textNorm.includes('وحدي') || textNorm.includes('لوحدي') || textNorm.includes('فردي')) {
    updates.adults = 1
  }

  const childrenNum = extractNumber(textNorm, /(\d+)\s*(?:اطفال|اطفال|طفل|اطفل|اولاد|ولد|بنات|بنت)/)
  if (childrenNum !== null) {
    updates.children = childrenNum
  } else if (textNorm.includes('طفلين')) {
    updates.children = 2
  } else if (textNorm.includes('طفل') && !childrenNum) {
    updates.children = 1
  }

  const infantsNum = extractNumber(textNorm, /(\d+)\s*(?:رضيع|رضعا|رضع)/)
  if (infantsNum !== null) {
    updates.infants = infantsNum
  } else if (textNorm.includes('رضيع') && !infantsNum) {
    updates.infants = 1
  }

  const hasThousand = textNorm.includes('الف') || textNorm.includes('الاف') || textNorm.includes('thousand') || textNorm.includes('k')
  const rawBudgetNum = extractNumber(textNorm, /(\d[\d,]*)\s*(?:الف|الاف|thousand|k)?\s*(?:ريال|ريالات|sar|دولار|usd|\$|يورو|eur|€)/) ??
    extractNumber(textNorm, /(?:ميزانيه|بقيمه|بمبلغ|ميزانيتي)\s*(?:حوالي\s*)?(\d[\d,]*)/)
  const budgetNum = rawBudgetNum !== null && hasThousand ? rawBudgetNum * 1000 : rawBudgetNum
  if (budgetNum !== null) {
    updates.budgetAmount = budgetNum
    for (const c of CURRENCY_KEYWORDS) {
      if (textNorm.includes(normalizeText(c.kw)) || textNorm.includes(c.kw.toLowerCase())) {
        updates.budgetCurrency = c.currency
        break
      }
    }
    if (!updates.budgetCurrency) {
      updates.budgetCurrency = 'SAR'
    }
  }

  if (intent.tripPurpose) {
    const norm = lookupNormalized(textNorm, PURPOSE_NORMALIZE)
    updates.tripPurpose = norm ?? intent.tripPurpose
  }

  if (intent.preferredAirline) {
    const norm = lookupNormalized(textNorm, AIRLINE_NORMALIZE)
    updates.preferredAirline = norm ?? intent.preferredAirline
  }

  if (intent.preferredHotel) {
    const norm = lookupNormalized(textNorm, HOTEL_CATEGORY_NORMALIZE)
    if (norm) {
      updates.preferredHotelCategory = norm
      const accNorm = lookupNormalized(textNorm, ACCOMMODATION_NORMALIZE)
      if (accNorm) {
        updates.accommodationPreference = accNorm as AccommodationPreference
      }
    }
  }

  if (intent.cabinClass) {
    const norm = lookupNormalized(textNorm, CABIN_NORMALIZE)
    if (norm) updates.cabinClass = norm as CabinClass
  }

  if (intent.visaStatus) {
    const norm = lookupNormalized(textNorm, VISA_NORMALIZE)
    if (norm) updates.visaStatus = norm as VisaStatus
  }

  if (intent.interests) {
    updates.interests = intent.interests
  }

  if (intent.flexibleDates) {
    const norm = lookupNormalized(textNorm, FLEXIBLE_NORMALIZE)
    if (norm) updates.flexibleDates = norm as FlexibleDates
  }

  const directNorm = lookupNormalized(textNorm, DIRECT_FLIGHT_NORMALIZE)
  if (directNorm) updates.directFlightPreference = directNorm as DirectFlightPreference

  const baggageNorm = lookupNormalized(textNorm, BAGGAGE_NORMALIZE)
  if (baggageNorm) updates.baggagePreference = baggageNorm as BaggagePreference

  const transportNorm = lookupNormalized(textNorm, TRANSPORT_NORMALIZE)
  if (transportNorm) updates.transportPreference = transportNorm as TransportPreference

  return updates
}

export function mergeTravelSession(
  currentSession: TravelSession,
  newData: string | Partial<TravelSession>,
): TravelSession {
  let updates: Partial<TravelSession>
  let conversationText = currentSession.lastConversationText
  if (typeof newData === 'string') {
    updates = parseIntentToSessionUpdates(newData)
    conversationText = newData
  } else {
    updates = newData
  }

  const merged: TravelSession = { ...currentSession, lastConversationText: conversationText }
  for (const key of Object.keys(updates) as (keyof TravelSession)[]) {
    const newValue = updates[key]
    if (newValue === undefined) continue
    if (newValue === null) continue
    if (newValue === '') continue
    if (Array.isArray(newValue)) {
      if (newValue.length > 0) (merged as unknown as Record<string, unknown>)[key] = newValue
      continue
    }
    (merged as unknown as Record<string, unknown>)[key] = newValue
  }

  return withDerivedFields(merged)
}

export function getMissingFields(session: TravelSession): string[] {
  return computeMissingFields(session)
}

// ── Decision Profile ────────────────────────────────────────────────────────

const EXPLICIT_PROFILE_FIELDS: (keyof TravelSession)[] = [
  'destination', 'departureCity', 'departureDate', 'durationDays',
  'adults', 'children', 'budgetAmount', 'budgetCurrency',
  'tripPurpose', 'visaStatus', 'cabinClass', 'preferredHotelCategory',
  'interests',
]

const INFERRED_PROFILE_FIELDS: (keyof TravelSession)[] = [
  'travelPurpose', 'travelerType', 'preferredClimate', 'hotelCategory',
  'activityStyle', 'foodPreference', 'transportationPreference',
  'flexibilityScore', 'budgetPriority', 'comfortPriority', 'luxuryPriority',
  'familyRequirements', 'childFriendlyRequired', 'accessibilityNeeds',
  'preferredFlightTime', 'preferredHotelArea', 'preferredLanguage',
  'visaConcern', 'shoppingInterest', 'natureInterest', 'cultureInterest',
  'entertainmentInterest', 'beachInterest', 'cityInterest', 'safetyPriority',
]

function computeExplicitFields(session: TravelSession): string[] {
  return EXPLICIT_PROFILE_FIELDS.filter(f => {
    const val = session[f]
    return val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0)
  })
}

function computeInferredFields(profile: RequirementProfile): string[] {
  return INFERRED_PROFILE_FIELDS.filter(f => {
    const val = profile[f as keyof RequirementProfile]
    if (typeof val === 'boolean') return val
    if (typeof val === 'number') return val > 0
    return val !== null && val !== undefined && val !== ''
  })
}

export function isDecisionProfileReady(session: TravelSession): boolean {
  const has = (f: keyof TravelSession): boolean => {
    const val = session[f]
    return val !== null && val !== undefined && val !== ''
  }
  const hasDuration = session.durationDays !== null && session.durationDays !== undefined && session.durationDays > 0
  const hasReturnDate = !!session.returnDate
  const hasDate = has('departureDate') || session.flexibleDates !== ''
  return !!(
    has('destination') &&
    has('departureCity') &&
    hasDate &&
    (hasDuration || hasReturnDate) &&
    has('adults') &&
    has('budgetAmount') &&
    has('budgetCurrency')
  )
}

export function updateSessionField(
  session: TravelSession,
  field: keyof TravelSession,
  value: string,
): TravelSession {
  const updates = parseIntentToSessionUpdates(value)
  const updated: TravelSession = { ...session }
  const directFields: (keyof TravelSession)[] = [
    'destination', 'departureCity', 'departureDate', 'returnDate',
    'durationDays', 'adults', 'children', 'infants',
    'budgetAmount', 'budgetCurrency', 'tripPurpose',
    'cabinClass', 'visaStatus', 'interests',
    'preferredHotelCategory', 'preferredAirline',
    'flexibleDates', 'directFlightPreference', 'baggagePreference',
    'transportPreference', 'accommodationPreference',
  ]
  if (directFields.includes(field)) {
    if (field in updates && updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
      ;(updated as unknown as Record<string, unknown>)[field] = updates[field]
    } else {
      if (field === 'durationDays' || field === 'adults' || field === 'children' || field === 'infants' || field === 'budgetAmount') {
        ;(updated as unknown as Record<string, unknown>)[field] = parseInt(value) || null
      } else {
        ;(updated as unknown as Record<string, unknown>)[field] = value
      }
    }
  } else {
    ;(updated as unknown as Record<string, unknown>)[field] = value
  }
  return withDerivedFields(updated)
}

export function confirmDecisionProfile(session: TravelSession): TravelSession {
  return withDerivedFields({
    ...session,
    decisionProfileConfirmed: true,
    confirmedAt: new Date().toISOString(),
  })
}

const OPTIONAL_QUESTIONS: { field: keyof TravelSession; text: string; reason: string }[] = [
  { field: 'directFlightPreference', text: 'هل تفضل رحلة مباشرة فقط، أم أنك منفتح على رحلات التوقف؟', reason: 'الرحلة المباشرة توفر الوقت، لكن التوقف قد يوفر المال.' },
  { field: 'cabinClass', text: 'ما درجة المقصومة المفضلة لديك؟ اقتصادي، رجال أعمال، أم درجة أولى؟', reason: 'درجة المقصومة تؤثر على راحتك وتكلفة الرحلة.' },
  { field: 'preferredHotelCategory', text: 'ما مستوى الإقامة المفضل؟ 3، 4، أم 5 نجوم؟', reason: 'مستوى الفندق يحدد جودة الإقامة والسعر.' },
  { field: 'interests', text: 'ما الذي يهمك في الوجهة؟ ثقافة، طبيعة، تسوق، ترفيه، شواطئ؟', reason: 'اهتماماتك تساعدني على اقتراح أنشطة ومدن مناسبة.' },
  { field: 'transportPreference', text: 'كيف تفضل التنقل داخل الوجهة؟ سيارة مستأجرة، نقل خاص، أم مواصلات عامة؟', reason: 'وسيلة التنقل تؤثر على ميزانية ومرونة رحلتك.' },
]

export function getNextOptionalQuestion(session: TravelSession): { field: keyof TravelSession; text: string; reason: string } | null {
  for (const q of OPTIONAL_QUESTIONS) {
    const val = session[q.field]
    if (val === null || val === undefined || val === '') {
      return q
    }
  }
  return null
}

export interface NextQuestion {
  field: keyof TravelSession
  text: string
  reason: string
  placeholder: string
}

export function getNextBestQuestion(session: TravelSession): NextQuestion | null {
  const essentialMissing = QUESTION_PRIORITY.some(field => !isFieldFilled(field, session))
  if (essentialMissing) {
    for (const field of QUESTION_PRIORITY) {
      if (!isFieldFilled(field, session)) {
        return {
          field,
          text: QUESTION_TEXTS[field] ?? '',
          reason: QUESTION_REASONS[field] ?? '',
          placeholder: QUESTION_PLACEHOLDERS[field] ?? '',
        }
      }
    }
  }
  // After essential fields, check for low-confidence analysis gaps
  const profile = analyzeRequirements(session, session.lastConversationText ?? '')
  const analysisGap = getNextAnalysisQuestion(profile)
  if (analysisGap && (analysisGap.confidence === 'low' || analysisGap.confidence === 'none')) {
    return {
      field: analysisGap.field as keyof TravelSession,
      text: analysisGap.question,
      reason: 'لتحسين دقة التوصيات المقدمة لك.',
      placeholder: '',
    }
  }
  return null
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateTravelSession(session: TravelSession): ValidationResult {
  const errors: string[] = []

  if (!session.destination) errors.push('الوجهة مطلوبة')
  if (!session.departureCity) errors.push('مدينة المغادرة مطلوبة')
  if (!session.departureDate) errors.push('تاريخ المغادرة مطلوب')
  if (session.durationDays === null || session.durationDays <= 0) errors.push('مدة الرحلة مطلوبة')
  if (session.adults === null || session.adults <= 0) errors.push('عدد البالغين مطلوب')
  if (session.budgetAmount === null || session.budgetAmount <= 0) errors.push('الميزانية مطلوبة')

  if (session.adults !== null && session.children !== null && session.infants !== null) {
    if (session.adults + session.children + session.infants === 0) {
      errors.push('يجب أن يكون هناك مسافر واحد على الأقل')
    }
  }

  if (session.budgetAmount !== null && session.budgetAmount < 0) {
    errors.push('الميزانية لا يمكن أن تكون سلبية')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

function sanitizeSession(raw: unknown): TravelSession {
  const empty = createEmptyTravelSession()
  if (typeof raw !== 'object' || raw === null) return empty
  const obj = raw as Record<string, unknown>
  const sanitized: TravelSession = { ...empty }

  const stringFields: (keyof TravelSession)[] = [
    'destination', 'departureCity', 'departureCountry', 'departureDate', 'returnDate',
    'budgetCurrency', 'tripPurpose', 'preferredAirline', 'preferredHotelCategory',
    'cabinClass', 'visaStatus', 'interests', 'flexibleDates',
    'directFlightPreference', 'baggagePreference', 'transportPreference',
    'accommodationPreference', 'lastConversationText',
  ]
  for (const f of stringFields) {
    if (typeof obj[f as string] === 'string') {
      (sanitized as unknown as Record<string, unknown>)[f] = obj[f as string]
    }
  }

  const numberFields: (keyof TravelSession)[] = [
    'durationDays', 'adults', 'children', 'infants', 'budgetAmount',
  ]
  for (const f of numberFields) {
    const val = obj[f as string]
    if (typeof val === 'number') {
      (sanitized as unknown as Record<string, unknown>)[f] = val
    }
  }

  return withDerivedFields(sanitized)
}

export function saveSession(session: TravelSession): void {
  try {
    const data: Record<string, unknown> = {}
    for (const f of ALL_TRACKED_FIELDS) {
      data[f] = session[f]
    }
    data['lastUpdatedAt'] = session.lastUpdatedAt
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function loadSession(): TravelSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return sanitizeSession(parsed)
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function sessionToIntent(session: TravelSession): TravelIntent {
  return {
    destination: session.destination,
    departureCity: session.departureCity,
    departureCountry: session.departureCountry,
    departureDate: session.departureDate,
    returnDate: session.returnDate,
    duration: session.durationDays ? `${session.durationDays} أيام` : '',
    adults: session.adults ? `${session.adults} بالغين` : '',
    children: session.children ? `${session.children} أطفال` : '',
    budget: session.budgetAmount ? `${session.budgetAmount} ${session.budgetCurrency}` : '',
    tripPurpose: session.tripPurpose,
    preferredAirline: session.preferredAirline,
    preferredHotel: session.preferredHotelCategory,
    cabinClass: session.cabinClass,
    visaStatus: session.visaStatus,
    interests: session.interests,
    flexibleDates: session.flexibleDates,
  }
}
