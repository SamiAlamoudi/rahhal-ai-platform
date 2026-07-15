/**
 * Phase AG — structured API error helpers (AR/EN user-safe messages).
 */

export type ApiLocale = 'ar' | 'en'

const MESSAGES: Record<string, { en: string; ar: string; field?: string }> = {
  INVALID_JSON: {
    en: 'Request body must be valid JSON.',
    ar: 'يجب أن يكون محتوى الطلب بتنسيق JSON صالح.',
  },
  INVALID_CONTENT_TYPE: {
    en: 'Content-Type must be application/json.',
    ar: 'يجب أن يكون نوع المحتوى application/json.',
  },
  REQUEST_TOO_LARGE: {
    en: 'Request body is too large.',
    ar: 'حجم الطلب أكبر من المسموح.',
  },
  MISSING_IDEMPOTENCY_KEY: {
    en: 'Idempotency-Key header is required.',
    ar: 'رأس Idempotency-Key مطلوب.',
    field: 'Idempotency-Key',
  },
  INVALID_IDEMPOTENCY_KEY: {
    en: 'Idempotency-Key format is invalid.',
    ar: 'صيغة Idempotency-Key غير صالحة.',
    field: 'Idempotency-Key',
  },
  UNAUTHENTICATED: {
    en: 'Authentication required.',
    ar: 'يلزم تسجيل الدخول.',
  },
  FORBIDDEN: {
    en: 'You do not have access to this plan.',
    ar: 'ليس لديك صلاحية الوصول إلى هذه الخطة.',
  },
  NOT_FOUND: {
    en: 'Plan not found.',
    ar: 'لم يتم العثور على الخطة.',
  },
  IDEMPOTENCY_CONFLICT: {
    en: 'Idempotency-Key was reused with a different request body.',
    ar: 'تم إعادة استخدام Idempotency-Key مع محتوى مختلف.',
  },
  DUPLICATE_ACTIVE: {
    en: 'A plan with this idempotency key is already in progress.',
    ar: 'هناك خطة قيد التنفيذ بنفس مفتاح التكرار.',
  },
  INVALID_STATE: {
    en: 'This action is not allowed for the current plan state.',
    ar: 'هذا الإجراء غير مسموح لحالة الخطة الحالية.',
  },
  RATE_LIMITED: {
    en: 'Too many requests. Please try again later.',
    ar: 'طلبات كثيرة. حاول لاحقاً.',
  },
  METHOD_NOT_ALLOWED: {
    en: 'Method not allowed.',
    ar: 'الطريقة غير مسموحة.',
  },
  missing_destination: {
    en: 'At least one destination is required.',
    ar: 'يلزم اختيار وجهة واحدة على الأقل.',
    field: 'destinations',
  },
  invalid_travel_dates: {
    en: 'Travel dates are invalid.',
    ar: 'تواريخ السفر غير صالحة.',
    field: 'travelDates',
  },
  invalid_budget: {
    en: 'Budget must be a positive amount.',
    ar: 'الميزانية يجب أن تكون رقماً موجباً.',
    field: 'budget',
  },
  unsupported_currency: {
    en: 'Currency is not supported.',
    ar: 'العملة غير مدعومة.',
    field: 'currency',
  },
  invalid_traveler_count: {
    en: 'Traveler count is invalid.',
    ar: 'عدد المسافرين غير صالح.',
    field: 'travelers',
  },
  conflicting_constraints: {
    en: 'Constraints conflict with each other.',
    ar: 'هناك قيود متعارضة.',
    field: 'constraints',
  },
  expired_request_context: {
    en: 'This planning request has expired.',
    ar: 'انتهت صلاحية طلب التخطيط.',
    field: 'expiresAt',
  },
  invalid_duration: {
    en: 'Trip duration is invalid.',
    ar: 'مدة الرحلة غير صالحة.',
    field: 'durationDays',
  },
  unsupported_language: {
    en: 'Preferred language must be Arabic (ar) or English (en).',
    ar: 'اللغة المفضلة يجب أن تكون العربية أو الإنجليزية.',
    field: 'preferredLanguage',
  },
  TIMEOUT: {
    en: 'Trip planning timed out.',
    ar: 'انتهت مهلة تخطيط الرحلة.',
  },
  INTERNAL_ERROR: {
    en: 'Unexpected server error.',
    ar: 'خطأ غير متوقع في الخادم.',
  },
  SERVICE_UNAVAILABLE: {
    en: 'Trip planner temporarily unavailable.',
    ar: 'خدمة تخطيط الرحلة غير متاحة مؤقتاً.',
  },
}

const API_TO_MESSAGE_KEY: Record<string, string> = {
  INVALID_TRAVEL_DATES: 'invalid_travel_dates',
  INVALID_BUDGET: 'invalid_budget',
  MISSING_DESTINATION: 'missing_destination',
  UNSUPPORTED_CURRENCY: 'unsupported_currency',
  INVALID_TRAVELER_COUNT: 'invalid_traveler_count',
  CONFLICTING_CONSTRAINTS: 'conflicting_constraints',
  EXPIRED_REQUEST_CONTEXT: 'expired_request_context',
  INVALID_DURATION: 'invalid_duration',
  UNSUPPORTED_LANGUAGE: 'unsupported_language',
}

export function mapValidationCodeToApi(code: string): string {
  switch (code) {
    case 'invalid_travel_dates':
      return 'INVALID_TRAVEL_DATES'
    case 'invalid_budget':
      return 'INVALID_BUDGET'
    case 'missing_destination':
      return 'MISSING_DESTINATION'
    case 'unsupported_currency':
      return 'UNSUPPORTED_CURRENCY'
    case 'invalid_traveler_count':
      return 'INVALID_TRAVELER_COUNT'
    case 'conflicting_constraints':
      return 'CONFLICTING_CONSTRAINTS'
    case 'expired_request_context':
      return 'EXPIRED_REQUEST_CONTEXT'
    case 'invalid_duration':
      return 'INVALID_DURATION'
    case 'unsupported_language':
      return 'UNSUPPORTED_LANGUAGE'
    default:
      return code.toUpperCase()
  }
}

export function localizeApiError(
  code: string,
  locale: ApiLocale,
  fallback?: string,
): { message: string; field?: string } {
  const key = API_TO_MESSAGE_KEY[code] ?? code
  const entry = MESSAGES[key] ?? MESSAGES[code]
  if (!entry) {
    return { message: fallback ?? code }
  }
  return {
    message: locale === 'ar' ? entry.ar : entry.en,
    field: entry.field,
  }
}

export function buildErrorBody(
  code: string,
  correlationId: string,
  locale: ApiLocale,
  options: { field?: string; retryable?: boolean; message?: string } = {},
) {
  const localized = localizeApiError(code, locale, options.message)
  return {
    error: {
      code,
      message: options.message ?? localized.message,
      field: options.field ?? localized.field,
      retryable: options.retryable === true,
      correlationId,
    },
  }
}
