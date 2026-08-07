export { AuthProvider, useAuth } from './AuthContext'
export { ProtectedRoute, PublicOnlyRoute, AdminRoute } from './ProtectedRoute'
export { isAdminUser } from './adminAccess'
export {
  isDemoAuthEnabled,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
} from './demoAuth'
export {
  authService,
  type SignUpResult,
  type SignInResult,
  type ForgotPasswordResult,
  type UpdateProfileInput,
  type AuthActionResult,
} from './authService'
export {
  validateEmail,
  validatePassword,
  validateSignUpForm,
  validateSignInForm,
  mapAuthErrorMessage,
  isAuthNetworkError,
  type AuthError,
} from './authValidation'
