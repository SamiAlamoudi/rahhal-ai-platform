import { isMemoryCenterEnabled } from '../memoryCenterRegistry'
import type {
  MemoryCenterLocale,
  MemoryCenterTheme,
  MemoryCenterUiState,
  MemoryFilterId,
} from '../types'
import { MEMORY_CENTER_ISOLATION } from '../types'

export function createDemoMemoryCenterState(options?: {
  locale?: MemoryCenterLocale
  theme?: MemoryCenterTheme
  enabled?: boolean
  activeFilter?: MemoryFilterId
}): MemoryCenterUiState {
  const locale = options?.locale ?? 'ar'
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)

  return {
    locale,
    theme: options?.theme ?? 'light',
    activeFilter: options?.activeFilter ?? 'all',
    searchQuery: '',
    overview: t(
      'مركز الذاكرة والمعرفة — يعرض ما يعرفه رحّال عنك. واجهة فقط بدون تخزين أو ذكاء اصطناعي.',
      'Memory & Knowledge Center — what Rahhal knows about you. Presentation only; no storage or AI.',
    ),
    stats: [
      { id: 's1', label: t('ذكريات', 'Memories'), value: '128' },
      { id: 's2', label: t('وجهات', 'Destinations'), value: '24' },
      { id: 's3', label: t('قواعد', 'Rules'), value: '11' },
      { id: 's4', label: t('ثقة متوسطة', 'Avg confidence'), value: '86%' },
    ],
    timeline: [
      {
        id: 't1',
        whenLabel: t('اليوم', 'Today'),
        title: t('تفضيل مقعد ممر', 'Aisle seat preference'),
        category: t('تفضيلات', 'Preferences'),
        confidence: 92,
      },
      {
        id: 't2',
        whenLabel: t('أمس', 'Yesterday'),
        title: t('فندق مفضل في دبي', 'Favorite hotel in Dubai'),
        category: t('فنادق', 'Hotels'),
        confidence: 88,
      },
      {
        id: 't3',
        whenLabel: t('الأسبوع الماضي', 'Last week'),
        title: t('ميزانية عائلية 18k', 'Family budget 18k'),
        category: t('ميزانية', 'Budget'),
        confidence: 81,
      },
    ],
    knownDestinations: [
      { id: 'kd1', name: t('باريس', 'Paris'), meta: t('3 زيارات', '3 visits') },
      { id: 'kd2', name: t('دبي', 'Dubai'), meta: t('5 زيارات', '5 visits') },
      { id: 'kd3', name: t('إسطنبول', 'Istanbul'), meta: t('2 زيارات', '2 visits') },
    ],
    favoriteCountries: [
      { id: 'fc1', name: t('فرنسا', 'France'), meta: '★★★★' },
      { id: 'fc2', name: t('الإمارات', 'UAE'), meta: '★★★★★' },
    ],
    favoriteCities: [
      { id: 'ci1', name: t('جدة', 'Jeddah'), meta: t('موطن', 'Home') },
      { id: 'ci2', name: t('لندن', 'London'), meta: t('أعمال', 'Business') },
    ],
    favoriteHotels: [
      { id: 'fh1', name: 'Atlantis The Palm', meta: 'Dubai' },
      { id: 'fh2', name: 'Le Meurice', meta: 'Paris' },
    ],
    favoriteAirlines: [
      { id: 'fa1', name: 'Saudia', meta: 'Alfursan' },
      { id: 'fa2', name: 'Emirates', meta: 'Skywards' },
    ],
    travelPreferences: [
      { id: 'tp1', label: t('عائلي', 'Family'), active: true },
      { id: 'tp2', label: t('أعمال', 'Business'), active: true },
      { id: 'tp3', label: t('فاخر', 'Luxury'), active: false },
    ],
    seatPreferences: [
      { id: 'sp1', label: t('ممر', 'Aisle'), active: true },
      { id: 'sp2', label: t('أمامي', 'Forward'), active: true },
      { id: 'sp3', label: t('نافذة', 'Window'), active: false },
    ],
    mealPreferences: [
      { id: 'mp1', label: t('حلال', 'Halal'), active: true },
      { id: 'mp2', label: t('قليل الصوديوم', 'Low sodium'), active: false },
    ],
    budgetHistory: [
      { id: 'bh1', label: '2024', value: '96k SAR' },
      { id: 'bh2', label: '2025', value: '112k SAR' },
      { id: 'bh3', label: '2026', value: '48k SAR' },
    ],
    familyMembers: [
      { id: 'fm1', name: t('نورة', 'Noura'), relation: t('زوجة', 'Spouse') },
      { id: 'fm2', name: t('ليان', 'Layan'), relation: t('ابنة', 'Daughter') },
    ],
    emergencyContacts: [
      {
        id: 'ec1',
        name: t('نورة', 'Noura'),
        relation: t('طوارئ أساسية', 'Primary'),
      },
    ],
    passports: [
      {
        id: 'pp1',
        title: t('جواز سعودي', 'Saudi passport'),
        statusLabel: t('ساري · واجهة', 'Valid · UI'),
      },
    ],
    visaHistory: [
      {
        id: 'vh1',
        title: t('شنغن · فرنسا', 'Schengen · France'),
        statusLabel: t('سجل · واجهة', 'History · UI'),
      },
    ],
    savedPlaces: [
      { id: 'plc1', name: t('برج إيفل', 'Eiffel Tower'), meta: t('معلم', 'Landmark') },
      { id: 'plc2', name: t('كورنيش جدة', 'Jeddah Corniche'), meta: t('محلي', 'Local') },
    ],
    savedTrips: [
      { id: 'tr1', name: t('باريس ربيع 2026', 'Paris Spring 2026'), meta: t('مسودة', 'Draft') },
      { id: 'tr2', name: t('دبي أعمال', 'Dubai Business'), meta: t('مكتمل', 'Done') },
    ],
    conversationMemories: [
      {
        id: 'cm1',
        title: t('تخطيط عائلي لباريس', 'Paris family planning'),
        snippet: t('يفضّل فنادق وسط المدينة…', 'Prefers central hotels…'),
      },
      {
        id: 'cm2',
        title: t('مقارنة شركات الطيران', 'Airline comparison'),
        snippet: t('سعودية مقابل الإمارات…', 'Saudia vs Emirates…'),
      },
    ],
    customRules: [
      { id: 'cr1', text: t('اقترح دائمًا خيارات عائلية', 'Always suggest family options') },
      { id: 'cr2', text: t('أظهر الميزانية بالريال', 'Show budget in SAR') },
    ],
    alwaysDo: [
      { id: 'ad1', text: t('احترم تفضيل المقعد', 'Honor seat preference') },
      { id: 'ad2', text: t('ذكّر بجوازات الأطفال', 'Remind about kids passports') },
    ],
    neverDo: [
      { id: 'nd1', text: t('لا تقترح كحولًا', 'Never suggest alcohol') },
      { id: 'nd2', text: t('لا تحجز بدون تأكيد', 'Never book without confirmation') },
    ],
    knowledgeSources: [
      { id: 'ks1', label: t('محادثة', 'Conversation'), kind: 'chat' },
      { id: 'ks2', label: t('ملف المسافر', 'Profile'), kind: 'profile' },
      { id: 'ks3', label: t('قاعدة يدوية', 'Manual rule'), kind: 'rule' },
    ],
    confidenceAverage: 86,
    memoryCategories: [
      { id: 'cat1', label: t('وجهات', 'Destinations'), count: 24 },
      { id: 'cat2', label: t('تفضيلات', 'Preferences'), count: 18 },
      { id: 'cat3', label: t('وثائق', 'Documents'), count: 7 },
      { id: 'cat4', label: t('محادثات', 'Conversations'), count: 42 },
      { id: 'cat5', label: t('قواعد', 'Rules'), count: 11 },
    ],
    bookmarks: [
      { id: 'bm1', name: t('قاعدة الميزانية', 'Budget rule'), meta: t('مثبّت', 'Pinned') },
      { id: 'bm2', name: t('فندق دبي', 'Dubai hotel'), meta: t('مثبّت', 'Pinned') },
    ],
    memoryGraph: [
      { id: 'g1', label: t('عائلة', 'Family'), weight: 90 },
      { id: 'g2', label: t('دبي', 'Dubai'), weight: 75 },
      { id: 'g3', label: t('سعودية', 'Saudia'), weight: 68 },
      { id: 'g4', label: t('ميزانية', 'Budget'), weight: 55 },
    ],
    editPlaceholder: t(
      'تعديل الذاكرة — واجهة فقط',
      'Edit memory — placeholder',
    ),
    deletePlaceholder: t(
      'حذف الذاكرة — واجهة فقط',
      'Delete memory — placeholder',
    ),
    featureEnabled: isMemoryCenterEnabled({ enabled: options?.enabled }),
  }
}

export function assertMemoryCenterIsolation(): typeof MEMORY_CENTER_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...MEMORY_CENTER_ISOLATION,
    presentationOnly: true,
  }
}
