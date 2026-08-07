import { productCopy, type ProductLocale } from '../../../lib/productUx'

export type ProductStateKind =
  | 'first_use'
  | 'no_trips'
  | 'no_results'
  | 'provider_unavailable'
  | 'weak_network'
  | 'offline'
  | 'session_expired'
  | 'auth_required'
  | 'permission_denied'
  | 'microphone_unavailable'
  | 'location_unavailable'
  | 'loading'
  | 'error'

const COPY: Record<
  ProductStateKind,
  { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; actionAr: string; actionEn: string }
> = {
  first_use: {
    titleAr: 'ابدأ أول محادثة',
    titleEn: 'Start your first chat',
    bodyAr: 'أخبر بيلامو بوجهتك أو ميزانيتك — بلا نماذج حجز.',
    bodyEn: 'Tell Bilamo your destination or budget — no booking forms.',
    actionAr: 'ابدأ المحادثة',
    actionEn: 'Start conversation',
  },
  no_trips: {
    titleAr: 'لا رحلات بعد',
    titleEn: 'No trips yet',
    bodyAr: 'عندما تحفظ خطة ستظهر هنا.',
    bodyEn: 'Saved plans will appear here.',
    actionAr: 'خطّط رحلة',
    actionEn: 'Plan a trip',
  },
  no_results: {
    titleAr: 'لا نتائج مناسبة',
    titleEn: 'No matching results',
    bodyAr: 'جرّب توسيع التواريخ أو الميزانية.',
    bodyEn: 'Try widening dates or budget.',
    actionAr: 'عدّل الطلب',
    actionEn: 'Adjust request',
  },
  provider_unavailable: {
    titleAr: 'المورد غير متاح مؤقتاً',
    titleEn: 'Provider temporarily unavailable',
    bodyAr: 'نستخدم بيانات تجريبية آمنة حتى يعود الاتصال.',
    bodyEn: 'Safe mock data stays available until connectivity returns.',
    actionAr: 'إعادة المحاولة',
    actionEn: 'Retry',
  },
  weak_network: {
    titleAr: 'اتصال ضعيف',
    titleEn: 'Weak network',
    bodyAr: 'قد يتأخر الرد — يمكنك إعادة الإرسال.',
    bodyEn: 'Replies may be slow — you can resend.',
    actionAr: 'إعادة الإرسال',
    actionEn: 'Resend',
  },
  offline: {
    titleAr: 'أنت غير متصل',
    titleEn: 'You are offline',
    bodyAr: 'تحقق من الشبكة ثم أعد المحاولة.',
    bodyEn: 'Check your network, then try again.',
    actionAr: 'إعادة المحاولة',
    actionEn: 'Retry',
  },
  session_expired: {
    titleAr: 'انتهت الجلسة',
    titleEn: 'Session expired',
    bodyAr: 'سجّل الدخول مجدداً لمتابعة التخطيط.',
    bodyEn: 'Sign in again to continue planning.',
    actionAr: 'تسجيل الدخول',
    actionEn: 'Sign in',
  },
  auth_required: {
    titleAr: 'يلزم تسجيل الدخول',
    titleEn: 'Sign-in required',
    bodyAr: 'لحفظ المحادثات والرحلات سجّل الدخول.',
    bodyEn: 'Sign in to save chats and trips.',
    actionAr: 'تسجيل الدخول',
    actionEn: 'Sign in',
  },
  permission_denied: {
    titleAr: 'الإذن مرفوض',
    titleEn: 'Permission denied',
    bodyAr: 'فعّل الإذن من إعدادات المتصفح للمتابعة.',
    bodyEn: 'Enable the permission in browser settings to continue.',
    actionAr: 'حسناً',
    actionEn: 'OK',
  },
  microphone_unavailable: {
    titleAr: 'الميكروفون غير متاح',
    titleEn: 'Microphone unavailable',
    bodyAr: 'يمكنك الكتابة بدل الصوت، أو السماح بالميكروفون.',
    bodyEn: 'You can type instead, or allow microphone access.',
    actionAr: 'الكتابة بدلاً',
    actionEn: 'Type instead',
  },
  location_unavailable: {
    titleAr: 'الموقع غير متاح',
    titleEn: 'Location unavailable',
    bodyAr: 'اكتب مدينة المغادرة يدوياً.',
    bodyEn: 'Type your departure city instead.',
    actionAr: 'متابعة',
    actionEn: 'Continue',
  },
  loading: {
    titleAr: 'جاري التحميل',
    titleEn: 'Loading',
    bodyAr: 'لحظة من فضلك…',
    bodyEn: 'One moment…',
    actionAr: '',
    actionEn: '',
  },
  error: {
    titleAr: 'حدث خطأ',
    titleEn: 'Something went wrong',
    bodyAr: 'لم نتمكن من إكمال الطلب.',
    bodyEn: 'We could not complete the request.',
    actionAr: 'إعادة المحاولة',
    actionEn: 'Retry',
  },
}

export interface ProductStatePanelProps {
  kind: ProductStateKind
  locale?: ProductLocale
  onAction?: () => void
  className?: string
}

export function ProductStatePanel({
  kind,
  locale = 'ar',
  onAction,
  className = '',
}: ProductStatePanelProps) {
  const copy = COPY[kind]
  const title = locale === 'ar' ? copy.titleAr : copy.titleEn
  const body = locale === 'ar' ? copy.bodyAr : copy.bodyEn
  const action = locale === 'ar' ? copy.actionAr : copy.actionEn

  return (
    <div
      role={kind === 'error' || kind === 'offline' ? 'alert' : 'status'}
      aria-live="polite"
      data-testid={`product-state-${kind}`}
      className={`rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-5 text-center shadow-sm ${className}`}
    >
      {kind === 'loading' ? (
        <div
          className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-full bg-primary-200"
          aria-hidden
        />
      ) : null}
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{body}</p>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-11 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {action || productCopy(locale, 'retry')}
        </button>
      ) : null}
    </div>
  )
}
