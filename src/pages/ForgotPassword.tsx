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
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="mb-10 space-y-4 text-center"
        >
          <Logo size="lg" className="justify-center" />
          <p className="text-sm text-[var(--bilamo-muted)]">{brand.tagline}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {sent ? 'Check your email' : 'Recover access'}
          </h1>
          <p className="text-sm text-[var(--bilamo-muted)]">
            {sent
              ? `We sent a reset link to ${email}.`
              : 'Enter your email and we will send a reset link.'}
          </p>
        </motion.div>
        <div className="bilamo-glass rounded-[1.75rem] p-6">
          {sent ? (
            <Link to="/login" className="block text-center text-sm text-[var(--bilamo-secondary)]">
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
                <p className="text-sm text-[var(--bilamo-danger)]" role="alert">
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
