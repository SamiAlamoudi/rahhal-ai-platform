import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BilamoShell, Button, Input, Logo, brand, springs } from '../design-system'
import { motion } from 'framer-motion'
import { authService, validateEmail, mapAuthErrorMessage } from '../lib/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setLoading(true)
    const result = await authService.resetPassword(email)
    setLoading(false)
    if (!result.success) {
      setError(mapAuthErrorMessage(result.error))
      return
    }
    setSent(true)
  }

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
            {sent ? 'Check your email' : 'Recover access'}
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--bilamo-muted)]/90">
            {sent
              ? `We sent a reset link to ${email}.`
              : 'Enter your email and we will send a reset link.'}
          </p>
        </motion.div>
        <div className="bilamo-glass rounded-[1.5rem] p-5 sm:p-6">
          {sent ? (
            <Link
              to="/login"
              className="block text-center text-[14px] text-[var(--bilamo-secondary)]"
            >
              Back to sign in
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error ? (
                <p className="text-[13px] text-[var(--bilamo-danger)]/90" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </BilamoShell>
  )
}
