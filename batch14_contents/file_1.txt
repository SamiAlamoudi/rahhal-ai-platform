export interface TravelIntent {
  destination: string
  departureCity: string
  departureCountry: string
  departureDate: string
  returnDate: string
  duration: string
  adults: string
  children: string
  budget: string
  tripPurpose: string
  preferredAirline: string
  preferredHotel: string
  cabinClass: string
  visaStatus: string
  interests: string
  flexibleDates: string
}

export const EMPTY_INTENT: TravelIntent = {
  destination: '',
  departureCity: '',
  departureCountry: '',
  departureDate: '',
  returnDate: '',
  duration: '',
  adults: '',
  children: '',
  budget: '',
  tripPurpose: '',
  preferredAirline: '',
  preferredHotel: '',
  cabinClass: '',
  visaStatus: '',
  interests: '',
  flexibleDates: '',
}

export type IntentField = keyof TravelIntent

export interface FieldMeta {
  key: IntentField
  label: string
  icon: string
}

export const FIELD_META: FieldMeta[] = [
  { key: 'destination', label: 'الوجهة', icon: '📍' },
  { key: 'departureCity', label: 'مدينة المغادرة', icon: '🏙️' },
  { key: 'departureCountry', label: 'دولة المغادرة', icon: '🗺️' },
  { key: 'departureDate', label: 'تاريخ المغادرة', icon: '📅' },
  { key: 'returnDate', label: 'تاريخ العودة', icon: '🔙' },
  { key: 'duration', label: 'المدة', icon: '🗓️' },
  { key: 'adults', label: 'البالغون', icon: '🧑' },
  { key: 'children', label: 'الأطفال', icon: '🧒' },
  { key: 'budget', label: 'الميزانية', icon: '💰' },
  { key: 'tripPurpose', label: 'الغرض من الرحلة', icon: '🎯' },
  { key: 'preferredAirline', label: 'الطيران المفضل', icon: '🛩️' },
  { key: 'preferredHotel', label: 'الإقامة المفضلة', icon: '🏨' },
  { key: 'cabinClass', label: 'درجة المقصورة', icon: '💺' },
  { key: 'visaStatus', label: 'حالة التأشيرة', icon: '🛂' },
  { key: 'interests', label: 'الاهتمامات', icon: '⭐' },
  { key: 'flexibleDates', label: 'مرونة التواريخ', icon: '🔄' },
]

export const FOLLOWUP_PRIORITY: IntentField[] = [
  'destination',
  'departureCity',
  'departureDate',
  'duration',
  'adults',
  'budget',
  'tripPurpose',
  'visaStatus',
  'preferredHotel',
  'preferredAirline',
]

export const FOLLOWUP_QUESTIONS: Record<string, string> = {
  destination: 'إلى أين تحلم أن تسافر؟',
  departureCity: 'من أي مدينة ستكون المغادرة؟',
  departureDate: 'متى تخطط للسفر؟ يمكنك ذكر الشهر أو التاريخ التقريبي.',
  duration: 'كم تتمنى أن تستغرق الرحلة؟',
  adults: 'كم عدد المسافرين في هذه الرحلة؟',
  budget: 'ما هي ميزانيتك التقريبية لهذه الرحلة؟',
  tripPurpose: 'ما الغرض من رحلتك؟ عطلة، عمل، عائلة، شهر عسل؟',
  visaStatus: 'هل لديك تأشيرة للوجهة، أم تفضل وجهة بدون تأشيرة؟',
  preferredHotel: 'ما نوع الإقامة المفضل لديك؟ فندق، شقة، منتجع؟',
  preferredAirline: 'هل تفضل الطيران مع شركة معينة؟',
}

export const FOLLOWUP_PLACEHOLDERS: Record<string, string> = {
  destination: 'مثال: اليابان، باريس، دبي',
  departureCity: 'مثال: الرياض',
  departureDate: 'مثال: 15 أكتوبر أو نوفمبر القادم',
  duration: 'مثال: 7 أيام أو أسبوعين',
  adults: 'مثال: 2 بالغين وطفلين',
  budget: 'مثال: 15,000 ريال',
  tripPurpose: 'مثال: عطلة عائلية، عمل، شهر عسل',
  visaStatus: 'مثال: بدون تأشيرة، أو لدي تأشيرة',
  preferredHotel: 'مثال: فندق 4 نجوم، شقة، منتجع',
  preferredAirline: 'مثال: الخطوط السعودية، طيران الإمارات',
}

export const FOLLOWUP_REASONS: Record<string, string> = {
  destination: 'الوجهة هي نقطة البداية لكل خطة — بدونها لا أستطيع البحث عن رحلات أو فنادق أو تأشيرات.',
  departureCity: 'أحتاج مدينة المغادرة حتى أبحث عن أفضل الرحلات الجوية المتاحة لك.',
  departureDate: 'تاريخ السفر يحدد أسعار الرحلات والفنادق ومدى توفرها.',
  duration: 'مدة الرحلة تساعدني على تقسيم الأيام بين المدن والأنشطة بشكل متوازن.',
  adults: 'عدد المسافرين يؤثر على نوع الغرف وتذاكر الطيران والتكلفة الإجمالية.',
  budget: 'الميزانية توجّه اختياراتي نحو الخيارات الأنسب لك دون إهدار وقتك.',
  tripPurpose: 'غرض الرحلة يغيّر نوع الأنشطة والإقامة التي سأوصي بها تماماً.',
  visaStatus: 'حالة التأشيرة تحدد ما إذا كانت الوجهة متاحة لك أم تحتاج ترتيبات إضافية.',
  preferredHotel: 'تفضيل الإقامة يجعل توصياتي أكثر دقة ومناسبة لذوقك.',
  preferredAirline: 'معرفة شركة الطيران المفضلة تساعدني على البحث عن أفضل رحلاتها أولاً.',
}

export const FOLLOWUP_ACKNOWLEDGMENT = 'ممتاز... بقي لدي سؤال واحد فقط.'

const normalize = (text: string): string =>
  text
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو',
  'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر',
]
const ARABIC_MONTHS_NORM = ARABIC_MONTHS.map(normalize)

const ENGLISH_MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const DESTINATIONS = [
  'اليابان', 'كوريا', 'الصين', 'تايلاند', 'اندونيسيا', 'ماليزيا',
  'سنغافورة', 'الهند', 'تركيا', 'الإمارات', 'دبي', 'قطر', 'عمان',
  'البحرين', 'الكويت', 'مصر', 'المغرب', 'تونس', 'السعودية', 'لبنان',
  'الأردن', 'العراق', 'سوريا', 'اليمن', 'ايران', 'فرنسا', 'باريس',
  'انجلترا', 'لندن', 'بريطانيا', 'ايطاليا', 'روما', 'اسبانيا', 'مدريد',
  'برشلونة', 'المانيا', 'برلين', 'هولندا', 'امستردام', 'سويسرا',
  'النمسا', 'اليونان', 'امريكا', 'نيويورك', 'كندا', 'استراليا',
  'طوكيو', 'كيوتو', 'اوساكا', 'مالديف', 'سيشل', 'سريلانكا',
]

const COUNTRIES = [
  'السعودية', 'الإمارات', 'قطر', 'عمان', 'البحرين', 'الكويت',
  'مصر', 'الاردن', 'لبنان', 'العراق', 'اليمن', 'تركيا', 'ايران',
]

const DEPARTURE_CITIES = [
  'الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'ابها', 'تبوك',
  'الطائف', 'القصيم', 'بريدة', 'حائل', 'نجران', 'جازان', 'ينبع',
  'الأحساء', 'الجبيل', 'خميس مشيط', 'العاصمة',
]

const AIRLINES: Record<string, string> = {
  'سعوديا': 'الخطوط السعودية',
  'السعودية': 'الخطوط السعودية',
  'طيران ناس': 'طيران ناس',
  'فلاي ناس': 'طيران ناس',
  'طيران الخليج': 'طيران الخليج',
  'الخليج': 'طيران الخليج',
  'طيران الامارات': 'طيران الإمارات',
  'الامارات': 'طيران الإمارات',
  'القطرية': 'الخطوط القطرية',
  'قطر': 'الخطوط القطرية',
  'طيران الاتحاد': 'الاتحاد للطيران',
  'الاتحاد': 'الاتحاد للطيران',
  'الخطوط التركية': 'الخطوط التركية',
  'الطيران التركي': 'الخطوط التركية',
  'لوفتهانزا': 'لوفتهانزا',
  'اير فرانس': 'إير فرانس',
  'كيه ال ام': 'كيه إل إم',
  'الاسكندنافية': 'الخطوط الإسكندنافية',
}

const HOTEL_KEYWORDS: Record<string, string> = {
  'فندق 5': 'فندق 5 نجوم',
  'فندق خمس': 'فندق 5 نجوم',
  'خمس نجوم': 'فندق 5 نجوم',
  'فندق 4': 'فندق 4 نجوم',
  'فندق اربع': 'فندق 4 نجوم',
  'اربع نجوم': 'فندق 4 نجوم',
  'فندق 3': 'فندق 3 نجوم',
  'فندق ثلاث': 'فندق 3 نجوم',
  'ثلاث نجوم': 'فندق 3 نجوم',
  'شقة': 'شقة',
  'شقق': 'شقة',
  'فيلا': 'فيلا',
  'منتجع': 'منتجع',
  'استضافة': 'استضافة',
  'هوستل': 'هوستل',
  'كبسولة': 'كبسولة',
}

const TRIP_PURPOSE_KEYWORDS: Record<string, string> = {
  'عطلة': 'عطلة',
  'اجازة': 'عطلة',
  'استجمام': 'عطلة',
  'عائلة': 'عائلة',
  'عائلي': 'عائلة',
  'عمل': 'عمل',
  'مؤتمر': 'عمل',
  'اجتماع': 'عمل',
  'شهر العسل': 'شهر عسل',
  'شهر عسل': 'شهر عسل',
  'مغامرة': 'مغامرة',
  'تخييم': 'مغامرة',
  'غوص': 'مغامرة',
  'تسلق': 'مغامرة',
  'ديني': 'ديني',
  'عمرة': 'ديني',
  'حج': 'ديني',
  'زيارة': 'زيارة',
  'اكتشاف': 'اكتشاف',
}

const CABIN_KEYWORDS: Record<string, string> = {
  'درجة اولى': 'درجة أولى',
  'الدرجة الاولى': 'درجة أولى',
  'اول كلاس': 'درجة أولى',
  'اول': 'درجة أولى',
  'رجال اعمال': 'درجة رجال الأعمال',
  'رجال الاعمال': 'درجة رجال الأعمال',
  'بيزنس': 'درجة رجال الأعمال',
  'business': 'درجة رجال الأعمال',
  'سياحي': 'الدرجة السياحية',
  'اقتصادي': 'الدرجة الاقتصادية',
  'economy': 'الدرجة الاقتصادية',
}

const VISA_KEYWORDS: Record<string, string> = {
  'بدون تاشيره': 'بدون تأشيرة',
  'بدون تااشيره': 'بدون تأشيرة',
  'دون تاشيره': 'بدون تأشيرة',
  'بدون فيزا': 'بدون تأشيرة',
  'فيزا': 'يحتاج تأشيرة',
  'تاشيره': 'يحتاج تأشيرة',
  'لدي تاشيره': 'لديه تأشيرة',
}

const INTERESTS_MAP: Record<string, string> = {
  'تسوق': 'تسوق',
  'ثقافة': 'ثقافة',
  'ثقافه': 'ثقافة',
  'طبيعة': 'طبيعة',
  'طبيعه': 'طبيعة',
  'شواطئ': 'شواطئ',
  'شواطي': 'شواطئ',
  'بحر': 'شواطئ',
  'مطاعم': 'مطاعم',
  'اكل': 'مطاعم',
  'طعام': 'مطاعم',
  'مزارات': 'مزارات سياحية',
  'مزارت': 'مزارات سياحية',
  'معالم': 'معالم سياحية',
  'متاحف': 'متاحف',
  'حياة ليلية': 'حياة ليلية',
  'ترفيه': 'ترفيه',
  'رياضة': 'رياضة',
  'رياضه': 'رياضة',
  'غوص': 'غوص',
  'حماية': 'حماية بيئية',
}

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}
function toWesternDigits(s: string): string {
  return s.replace(/[٠-٩]/g, d => ARABIC_DIGITS_MAP[d] || d)
}
function toArabicDigits(s: string): string {
  const reverseMap: Record<string, string> = {}
  for (const [ar, en] of Object.entries(ARABIC_DIGITS_MAP)) reverseMap[en] = ar
  return s.replace(/[0-9]/g, d => reverseMap[d] || d)
}

function findFirst(textNorm: string, words: string[]): string | null {
  for (const w of words) {
    if (textNorm.includes(normalize(w))) return w
  }
  return null
}

function extractDestination(textNorm: string): string {
  return findFirst(textNorm, DESTINATIONS) ?? ''
}

function extractDepartureCity(textNorm: string): string {
  const patterns = ['من ', 'من مدينة ', 'مغادرة من ', 'انطلاق من ', 'من مدينه ']
  for (const p of patterns) {
    const pNorm = normalize(p)
    const idx = textNorm.indexOf(pNorm)
    if (idx !== -1) {
      const after = textNorm.slice(idx + pNorm.length)
      for (const city of DEPARTURE_CITIES) {
        if (after.startsWith(normalize(city))) return city
      }
    }
  }
  return findFirst(textNorm, DEPARTURE_CITIES) ?? ''
}

function extractDepartureCountry(textNorm: string): string {
  return findFirst(textNorm, COUNTRIES) ?? ''
}

function parseDate(textNorm: string): string {
  const slashMatch = textNorm.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/)
  if (slashMatch) {
    return slashMatch[3]
      ? `${slashMatch[1]}/${slashMatch[2]}/${slashMatch[3]}`
      : `${slashMatch[1]}/${slashMatch[2]}`
  }

  for (let i = 0; i < ARABIC_MONTHS.length; i++) {
    if (textNorm.includes(ARABIC_MONTHS_NORM[i])) {
      const dayMatch = textNorm.match(new RegExp(`(\d{1,2})\s*${ARABIC_MONTHS_NORM[i]}`))
      const yearMatch = textNorm.match(new RegExp(`${ARABIC_MONTHS_NORM[i]}\s*(\d{4})`))
      const parts: string[] = []
      if (dayMatch) parts.push(toArabicDigits(dayMatch[1]))
      parts.push(ARABIC_MONTHS[i])
      if (yearMatch) parts.push(toArabicDigits(yearMatch[1]))
      return parts.join(' ')
    }
  }

  for (let i = 0; i < ENGLISH_MONTHS.length; i++) {
    if (textNorm.includes(ENGLISH_MONTHS[i])) {
      const dayMatch = textNorm.match(new RegExp(`(\d{1,2})\s*${ENGLISH_MONTHS[i]}`))
      const yearMatch = textNorm.match(new RegExp(`${ENGLISH_MONTHS[i]}\s*(\d{4})`))
      const parts: string[] = []
      if (dayMatch) parts.push(toArabicDigits(dayMatch[1]))
      parts.push(ENGLISH_MONTHS[i])
      if (yearMatch) parts.push(toArabicDigits(yearMatch[1]))
      return parts.join(' ')
    }
  }

  const relPatterns = [
    /(?:ايام|اسبوع|اليوم)\s*(?:قادم|مقبل|القادم|المقبل)/,
    /الاسبوع\s*(?:القادم|المقبل|قادم|مقبل)/,
    /الشهر\s*(?:القادم|المقبل|قادم|مقبل)/,
    /صيف\s*(?:القادم|المقبل|قادم|مقبل)/,
    /شتاء\s*(?:القادم|المقبل|قادم|مقبل)/,
  ]
  for (const re of relPatterns) {
    const m = textNorm.match(re)
    if (m) return m[0]
  }

  return ''
}

function extractDepartureDate(textNorm: string): string {
  const explicitPatterns = ['سفر في ', 'مغادره في ', 'المغادره في ', 'الذهاب في ', 'ابدا في ', 'رحله في ', 'تاريخ ']
  for (const p of explicitPatterns) {
    const pNorm = normalize(p)
    const idx = textNorm.indexOf(pNorm)
    if (idx !== -1) {
      const after = textNorm.slice(idx + pNorm.length)
      const d = parseDate(after)
      if (d) return d
    }
  }
  return parseDate(textNorm)
}

function extractReturnDate(textNorm: string): string {
  const patterns = ['عوده في ', 'عوده ', 'العوده في ', 'العوده ', 'ارجع في ', 'وصول ']
  for (const p of patterns) {
    const pNorm = normalize(p)
    const idx = textNorm.indexOf(pNorm)
    if (idx !== -1) {
      const after = textNorm.slice(idx + pNorm.length)
      const d = parseDate(after)
      if (d) return d
    }
  }
  return ''
}

function extractDuration(textNorm: string): string {
  const westernText = toWesternDigits(textNorm)
  const patterns: { re: RegExp; fmt: (m: RegExpMatchArray) => string }[] = [
    { re: /(\d+)\s*(?:يوم|ايام)/, fmt: m => `${toArabicDigits(m[1])} أيام` },
    { re: /(\d+)\s*(?:ليله|ليال|ليالي)/, fmt: m => `${toArabicDigits(m[1])} ليالي` },
    { re: /(\d+)\s*(?:اسبوع|اسابيع)/, fmt: m => `${toArabicDigits(m[1])} أسابيع` },
    { re: /(\d+)\s*(?:شهر|شهور|اشهر)/, fmt: m => `${toArabicDigits(m[1])} ${parseInt(m[1]) === 1 ? 'شهر' : 'أشهر'}` },
    { re: /(?:للمده|مدة|المده)\s*(?:حوالي\s*)?(\d+)/, fmt: m => `${toArabicDigits(m[1])} أيام` },
  ]
  for (const p of patterns) {
    const m = westernText.match(p.re)
    if (m) return p.fmt(m)
  }
  return ''
}

function extractBudget(textNorm: string): string {
  const westernText = toWesternDigits(textNorm)
  const patterns: { re: RegExp; fmt: (m: RegExpMatchArray) => string }[] = [
    { re: /(\d[\d,]*)\s*(?:ريال|ريالات|sar)/, fmt: m => `${toArabicDigits(m[1])} ريال` },
    { re: /(?:ميزانيه|بقيمه|بمبلغ|ميزانيتي)\s*(?:حوالي\s*)?(\d[\d,]*)/, fmt: m => `${toArabicDigits(m[1])} ريال` },
    { re: /(\d[\d,]*)\s*(?:دولار|usd|\$)/, fmt: m => `${toArabicDigits(m[1])} دولار` },
    { re: /(\d[\d,]*)\s*(?:يورو|eur|€)/, fmt: m => `${toArabicDigits(m[1])} يورو` },
  ]
  for (const p of patterns) {
    const m = westernText.match(p.re)
    if (m) return p.fmt(m)
  }
  return ''
}

function extractAdults(textNorm: string): string {
  const westernText = toWesternDigits(textNorm)
  const patterns: { re: RegExp; fmt: (m: RegExpMatchArray) => string }[] = [
    { re: /(\d+)\s*(?:بالغ|بالغين)/, fmt: m => `${toArabicDigits(m[1])} بالغين` },
    { re: /(\d+)\s*(?:شخص|اشخاص)/, fmt: m => {
      const n = parseInt(m[1])
      return `${toArabicDigits(m[1])} ${n === 1 ? 'شخص' : 'أشخاص'}`
    }},
  ]
  for (const p of patterns) {
    const m = westernText.match(p.re)
    if (m) return p.fmt(m)
  }

  if (textNorm.includes('زوجتي') || textNorm.includes('زوجي')) {
    if (extractChildren(textNorm)) return '2 بالغين'
    return '2 بالغين'
  }
  if (textNorm.includes('وحدي') || textNorm.includes('لوحدي') || textNorm.includes('فردي')) return '1 بالغ'
  return ''
}

function extractChildren(textNorm: string): string {
  const westernText = toWesternDigits(textNorm)
  const patterns: { re: RegExp; fmt: (m: RegExpMatchArray) => string }[] = [
    { re: /(\d+)\s*(?:اطفال|اطفال|طفل|اطفل)/, fmt: m => `${toArabicDigits(m[1])} أطفال` },
    { re: /(\d+)\s*(?:اولاد|ولد)/, fmt: m => `${toArabicDigits(m[1])} أطفال` },
    { re: /(\d+)\s*(?:بنات|بنت)/, fmt: m => `${toArabicDigits(m[1])} أطفال` },
    { re: /طفلين/, fmt: () => '2 أطفال' },
    { re: /طفل(?!\s*\d)/, fmt: () => '1 طفل' },
  ]
  for (const p of patterns) {
    const m = westernText.match(p.re)
    if (m) return p.fmt(m)
  }
  return ''
}

function extractTripPurpose(textNorm: string): string {
  for (const kw in TRIP_PURPOSE_KEYWORDS) {
    if (textNorm.includes(normalize(kw))) return TRIP_PURPOSE_KEYWORDS[kw]
  }
  return ''
}

function extractAirline(textNorm: string): string {
  for (const kw in AIRLINES) {
    if (textNorm.includes(normalize(kw))) return AIRLINES[kw]
  }
  return ''
}

function extractHotel(textNorm: string): string {
  for (const kw in HOTEL_KEYWORDS) {
    if (textNorm.includes(normalize(kw))) return HOTEL_KEYWORDS[kw]
  }
  if (textNorm.includes(normalize('فندق'))) return 'فندق'
  return ''
}

function extractCabinClass(textNorm: string): string {
  for (const kw in CABIN_KEYWORDS) {
    if (textNorm.includes(normalize(kw))) return CABIN_KEYWORDS[kw]
  }
  return ''
}

function extractVisaStatus(textNorm: string): string {
  for (const kw in VISA_KEYWORDS) {
    if (textNorm.includes(normalize(kw))) return VISA_KEYWORDS[kw]
  }
  return ''
}

function extractInterests(textNorm: string): string {
  const found: string[] = []
  const seen = new Set<string>()
  for (const kw in INTERESTS_MAP) {
    if (textNorm.includes(normalize(kw))) {
      const val = INTERESTS_MAP[kw]
      if (!seen.has(val)) {
        seen.add(val)
        found.push(val)
      }
    }
  }
  return found.join('، ')
}

function extractFlexibleDates(textNorm: string): string {
  if (textNorm.includes(normalize('مرن')) || textNorm.includes(normalize('مرونه')) || textNorm.includes(normalize('مرنه'))) {
    if (textNorm.includes(normalize('غير مرن')) || textNorm.includes(normalize('ثابت')) || textNorm.includes(normalize('محدد'))) return 'تواريخ ثابتة'
    return 'تواريخ مرنة'
  }
  if (textNorm.includes(normalize('اي وقت')) || textNorm.includes(normalize('مفتوح'))) return 'تواريخ مرنة'
  if (textNorm.includes(normalize('تواريخ ثابته')) || textNorm.includes(normalize('محدد'))) return 'تواريخ ثابتة'
  return ''
}

export function parseTravelIntent(text: string): TravelIntent {
  if (!text.trim()) return { ...EMPTY_INTENT }
  const textNorm = normalize(text)

  return {
    destination: extractDestination(textNorm),
    departureCity: extractDepartureCity(textNorm),
    departureCountry: extractDepartureCountry(textNorm),
    departureDate: extractDepartureDate(textNorm),
    returnDate: extractReturnDate(textNorm),
    duration: extractDuration(textNorm),
    adults: extractAdults(textNorm),
    children: extractChildren(textNorm),
    budget: extractBudget(textNorm),
    tripPurpose: extractTripPurpose(textNorm),
    preferredAirline: extractAirline(textNorm),
    preferredHotel: extractHotel(textNorm),
    cabinClass: extractCabinClass(textNorm),
    visaStatus: extractVisaStatus(textNorm),
    interests: extractInterests(textNorm),
    flexibleDates: extractFlexibleDates(textNorm),
  }
}

export function mergeIntent(current: TravelIntent, newText: string): TravelIntent {
  const parsed = parseTravelIntent(newText)
  const merged = { ...current }
  for (const key of Object.keys(merged) as IntentField[]) {
    if (parsed[key]) {
      merged[key] = parsed[key]
    }
  }
  return merged
}

export function getFilledFields(intent: TravelIntent): FieldMeta[] {
  return FIELD_META.filter(f => intent[f.key])
}

export function getConfidencePercent(intent: TravelIntent): number {
  const weights: Record<IntentField, number> = {
    destination: 15,
    departureCity: 10,
    departureCountry: 5,
    departureDate: 10,
    returnDate: 5,
    duration: 10,
    adults: 8,
    children: 5,
    budget: 10,
    tripPurpose: 5,
    preferredAirline: 4,
    preferredHotel: 4,
    cabinClass: 3,
    visaStatus: 3,
    interests: 2,
    flexibleDates: 1,
  }
  let score = 0
  for (const key of Object.keys(intent) as IntentField[]) {
    if (intent[key]) score += weights[key]
  }
  return Math.min(100, score)
}

export function getNextMissingField(intent: TravelIntent): FieldMeta | null {
  for (const key of FOLLOWUP_PRIORITY) {
    if (!intent[key]) {
      const meta = FIELD_META.find(f => f.key === key)
      if (meta) return meta
    }
  }
  return null
}
