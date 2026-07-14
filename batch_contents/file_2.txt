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

export function mapAuthErrorMessage(error: unknown): string {
  const msg = typeof error === 'string'
    ? error
    : (error && typeof error === 'object' && 'message' in error)
      ? (error as { message: string }).message
      : ''
  if (!msg) return 'حدث خطأ غير متوقع'
  if (msg.includes('Invalid login credentials')) return 'بيانات الدخول غير صحيحة'
  if (msg.includes('User already registered')) return 'هذا البريد مسجل بالفعل'
  if (msg.includes('Email not confirmed')) return 'البريد الإلكتروني غير مؤكد'
  if (msg.includes('Password should be at least')) return 'كلمة المرور قصيرة جداً'
  if (msg.includes('rate limit')) return 'محاولات كثيرة، حاول لاحقاً'
  return msg
}
