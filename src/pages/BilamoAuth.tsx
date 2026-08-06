import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BilamoShell,
  Button,
  Input,
  Logo,
  brand,
  springs,
} from '../design-system'
import { authService, validateSignInForm, mapAuthErrorMessage, type AuthError } from '../lib/auth'
import { isDemoAuthEnabled } from '../lib/auth/demoAuth'

function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <BilamoShell>
      <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-7 py-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="mb-9 space-y-3 text-center"
        >
          <Logo size="md" className="justify-center" />
          <p className="text-[13px] tracking-[-0.01em] text-[var(--bilamo-muted)]/85">
            {brand.tagline}
          </p>
          <h1 className="pt-2 text-[1.65rem] font-medium tracking-[-0.035em] text-[var(--bilamo-text)]">
            {title}
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--bilamo-muted)]/90">{subtitle}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.soft, delay: 0.04 }}
          className="bilamo-glass rounded-[1.5rem] p-5 sm:p-6"
        >
          {children}
        </motion.div>
        {footer ? (
          <div className="mt-7 text-center text-[13px] text-[var(--bilamo-muted)]/85">{footer}</div>
        ) : null}
      </div>
    </BilamoShell>
  )
}

export function BilamoLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<AuthError[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const demoEnabled = isDemoAuthEnabled()

  const fieldError = (field: string) => errors.find((e) => e.field === field)?.message

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    const formErrors = validateSignInForm(email, password)
    if (formErrors.length > 0) {
      setErrors(formErrors)
      return
    }
    setErrors([])
    setLoading(true)
    const result = await authService.signIn(email, password)
    setLoading(false)
    if (!result.success) {
      setGeneralError(mapAuthErrorMessage(result.error))
      return
    }
    navigate('/')
  }

  const handleDemoSignIn = async () => {
    setGeneralError(null)
    setErrors([])
    setLoading(true)
    const result = await authService.signInDemo()
    setLoading(false)
    if (!result.success) {
      setGeneralError(result.error ?? 'Demo sign-in failed')
      return
    }
    navigate('/')
  }

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Continue your conversation with Bilamo."
      footer={
        <>
          No account?{' '}
          <Link to="/signup" className="text-[var(--bilamo-secondary)] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint={fieldError('email')}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={fieldError('password')}
        />
        {generalError ? (
          <p className="text-sm text-[var(--bilamo-danger)]" role="alert">
            {generalError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        {demoEnabled ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={handleDemoSignIn}
          >
            Continue with demo
          </Button>
        ) : null}
        <div className="text-center">
          <Link to="/forgot-password" className="text-xs text-[var(--bilamo-muted)] hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthFrame>
  )
}

export function BilamoSignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setLoading(true)
    const result = await authService.signUp(email, password)
    setLoading(false)
    if (!result.success) {
      setGeneralError(mapAuthErrorMessage(result.error))
      return
    }
    navigate('/')
  }

  return (
    <AuthFrame
      title="Create your space"
      subtitle="One conversation. Infinite intelligence."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--bilamo-secondary)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {generalError ? (
          <p className="text-sm text-[var(--bilamo-danger)]" role="alert">
            {generalError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Creating…' : 'Get started'}
        </Button>
      </form>
    </AuthFrame>
  )
}
