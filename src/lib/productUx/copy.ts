import { productBrand } from './tokens'

export type ProductLocale = 'ar' | 'en'

export type ProductCopyKey =
  | 'tagline'
  | 'promise'
  | 'homeHeadline'
  | 'homeValue'
  | 'homeTrust'
  | 'startConversation'
  | 'authLoginTitle'
  | 'authLoginSubtitle'
  | 'authSignupTitle'
  | 'authSignupSubtitle'
  | 'authForgotTitle'
  | 'authForgotSubtitle'
  | 'chatTitle'
  | 'chatSubtitle'
  | 'tripsTitle'
  | 'tripsSubtitle'
  | 'settingsTitle'
  | 'settingsSubtitle'
  | 'profileTitle'
  | 'profileSubtitle'
  | 'navHome'
  | 'navChat'
  | 'navTrips'
  | 'navSettings'
  | 'offline'
  | 'retry'
  | 'expandDetails'
  | 'collapseDetails'
  | 'selectOption'
  | 'confirmAction'
  | 'cancelAction'

const COPY: Record<ProductCopyKey, { ar: string; en: string }> = {
  tagline: {
    ar: 'ذكاء في محادثة',
    en: 'Intelligence, in conversation.',
  },
  promise: {
    ar: 'تحدث بشكل طبيعي — Bilamo يستخرج ما يهم.',
    en: 'Speak naturally — Bilamo extracts what matters.',
  },
  homeHeadline: {
    ar: 'ماذا تحتاج؟',
    en: 'What do you need?',
  },
  homeValue: {
    ar: 'أخبر Bilamo بخطتك بكلماتك — يستخرج الوجهة والتواريخ والميزانية دون نماذج حجز تقليدية.',
    en: 'Tell Bilamo your plan in your words — destination, dates, and budget without traditional booking forms.',
  },
  homeTrust: {
    ar: 'محادثة آمنة · توصيات موضّحة · تأكيد قبل أي حجز',
    en: 'Private chat · explained picks · confirm before any booking',
  },
  startConversation: {
    ar: 'ابدأ المحادثة',
    en: 'Start conversation',
  },
  authLoginTitle: {
    ar: 'أهلاً بك في Bilamo',
    en: 'Welcome to Bilamo',
  },
  authLoginSubtitle: {
    ar: 'سجّل الدخول لمتابعة محادثاتك',
    en: 'Sign in to continue your conversations',
  },
  authSignupTitle: {
    ar: 'ابدأ مع Bilamo',
    en: 'Start with Bilamo',
  },
  authSignupSubtitle: {
    ar: 'أنشئ مساحتك وابدأ المحادثة',
    en: 'Create your space and begin the conversation',
  },
  authForgotTitle: {
    ar: 'استعادة الوصول',
    en: 'Recover access',
  },
  authForgotSubtitle: {
    ar: 'أدخل بريدك وسنرسل رابط إعادة التعيين',
    en: 'Enter your email and we will send a reset link',
  },
  chatTitle: {
    ar: 'محادثة Bilamo',
    en: 'Bilamo chat',
  },
  chatSubtitle: {
    ar: 'محادثة طبيعية · تخطيط · نتائج أنيقة',
    en: 'Natural chat · planning · elegant results',
  },
  tripsTitle: {
    ar: 'رحلاتي',
    en: 'My trips',
  },
  tripsSubtitle: {
    ar: 'حجوزاتك وسجلات السفر',
    en: 'Your bookings and travel records',
  },
  settingsTitle: {
    ar: 'الإعدادات',
    en: 'Settings',
  },
  settingsSubtitle: {
    ar: 'حسابك وتفضيلات التجربة',
    en: 'Your account and experience preferences',
  },
  profileTitle: {
    ar: 'تفضيلات السفر',
    en: 'Travel preferences',
  },
  profileSubtitle: {
    ar: 'يساعد Bilamo على اقتراح خيارات أقرب لأسلوبك',
    en: 'Helps Bilamo suggest options closer to your style',
  },
  navHome: { ar: 'الرئيسية', en: 'Home' },
  navChat: { ar: 'محادثة', en: 'Chat' },
  navTrips: { ar: 'رحلاتي', en: 'Trips' },
  navSettings: { ar: 'إعدادات', en: 'Settings' },
  offline: { ar: 'أنت غير متصل حالياً', en: 'You are offline' },
  retry: { ar: 'إعادة المحاولة', en: 'Retry' },
  expandDetails: { ar: 'عرض التفاصيل', en: 'Show details' },
  collapseDetails: { ar: 'إخفاء التفاصيل', en: 'Hide details' },
  selectOption: { ar: 'اختيار', en: 'Select' },
  confirmAction: { ar: 'أؤكد المتابعة', en: 'Confirm to continue' },
  cancelAction: { ar: 'رجوع', en: 'Back' },
}

export function productCopy(locale: ProductLocale, key: ProductCopyKey): string {
  return COPY[key][locale]
}

export function productBrandName(locale: ProductLocale): string {
  return locale === 'ar' ? productBrand.nameAr : productBrand.nameEn
}
