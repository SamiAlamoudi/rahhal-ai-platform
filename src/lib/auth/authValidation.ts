export interface AuthError {
  field: 'email' | 'password' | 'confirmPassword' | 'general'
  message: string
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'البريد الإلكتروني مطلوب'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'صيغة البريد الإلكتروني غير صحيحة'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'كلمة المرور مطلوبة'
  if (password.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
  return null
}

export function validateSignUpForm(email: string, password: string, confirmPassword: string): AuthError[] {
  const errors: AuthError[] = []
  const emailError = validateEmail(email)
  if (emailError) errors.push({ field: 'email', message: emailError })
  const passwordError = validatePassword(password)
  if (passwordError) errors.push({ field: 'password', message: passwordError })
  if (password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'كلمتا المرور غير متطابقتين' })
  }
  return errors
}

export function validateSignInForm(email: string, password: string): AuthError[] {
  const errors: AuthError[] = []
  const emailError = validateEmail(email)
  if (emailError) errors.push({ field: 'email', message: emailError })
  const passwordError = validatePassword(password)
  if (passwordError) errors.push({ field: 'password', message: passwordError })
  return errors
}

const AUTH_NETWORK_ERROR_RE =
  /failed to fetch|fetch failed|networkerror|load failed|network request failed|authretryablefetcherror|err_connection|err_name_not_resolved|err_timed_out/i

/** True when Supabase Auth could not be reached (DNS/CORS/offline/gateway). */
export function isAuthNetworkError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'object') {
    const name = 'name' in error ? String((error as { name?: unknown }).name ?? '') : ''
    if (name === 'AuthRetryableFetchError' || name === 'TypeError') {
      const msg = 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
      if (!msg || AUTH_NETWORK_ERROR_RE.test(msg)) return true
    }
    const status = 'status' in error ? Number((error as { status?: unknown }).status) : NaN
    // auth-js uses status 0 for transport failures
    if (status === 0) return true
  }
  const msg = typeof error === 'string'
    ? error
    : (error && typeof error === 'object' && 'message' in error)
      ? String((error as { message: unknown }).message ?? '')
      : ''
  return AUTH_NETWORK_ERROR_RE.test(msg)
}

export function mapAuthErrorMessage(error: unknown): string {
  const msg = typeof error === 'string'
    ? error
    : (error && typeof error === 'object' && 'message' in error)
      ? (error as { message: string }).message
      : ''
  if (!msg) return 'حدث خطأ غير متوقع'
  if (isAuthNetworkError(error) || isAuthNetworkError(msg)) {
    return 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الشبكة أو إعدادات Supabase ثم أعد المحاولة'
  }
  if (msg.includes('Invalid login credentials')) return 'بيانات الدخول غير صحيحة'
  if (msg.includes('User already registered')) return 'هذا البريد مسجل بالفعل'
  if (msg.includes('Email not confirmed')) return 'البريد الإلكتروني غير مؤكد'
  if (msg.includes('Password should be at least')) return 'كلمة المرور قصيرة جداً'
  if (msg.includes('rate limit')) return 'محاولات كثيرة، حاول لاحقاً'
  if (msg.includes('Missing required auth env') || msg.includes('VITE_SUPABASE_')) {
    return 'إعدادات المصادقة غير مكتملة (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)'
  }
  return msg
}
