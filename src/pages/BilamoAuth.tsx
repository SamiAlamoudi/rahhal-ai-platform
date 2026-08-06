import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BilamoShell,
  Button,
  Input,
  Logo,
  springs,
} from '../design-system'
import { authService, validateSignInForm, mapAuthErrorMessage, type AuthError } from '../lib/auth'
import { isDemoAuthEnabled } from '../lib/auth/demoAuth'

function AuthFrame({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <BilamoShell>
      <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="mb-10 space-y-6 text-center"
        >
          <Logo size="md" className="justify-center" />
          <h1 className="text-[1.55rem] font-medium tracking-[-0.04em] text-[var(--bilamo-text)]">
            {title}
          </h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.soft, delay: 0.03 }}
          className="space-y-5"
        >
          {children}
        </motion.div>
        {footer ? (
          <div className="mt-10 text-center text-[13px] text-[var(--bilamo-muted)]/80">{footer}</div>
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
      footer={
        <>
          No account?{' '}
          <Link to="/signup" className="text-[var(--bilamo-text)]/80 hover:underline">
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
          <p className="text-[13px] text-[var(--bilamo-danger)]/90" role="alert">
            {generalError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Signing in…' : 'Continue'}
        </Button>
        {demoEnabled ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={handleDemoSignIn}
          >
            Demo
          </Button>
        ) : null}
        <div className="pt-1 text-center">
          <Link
            to="/forgot-password"
            className="text-[12px] text-[var(--bilamo-muted)]/70 hover:text-[var(--bilamo-muted)]"
          >
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
      title="Begin"
      footer={
        <>
          Already here?{' '}
          <Link to="/login" className="text-[var(--bilamo-text)]/80 hover:underline">
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
          <p className="text-[13px] text-[var(--bilamo-danger)]/90" role="alert">
            {generalError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Creating…' : 'Continue'}
        </Button>
      </form>
    </AuthFrame>
  )
}
