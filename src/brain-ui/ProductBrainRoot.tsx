import type { ReactNode } from 'react'
import { BrainProvider } from './BrainProvider'
import { useAuth } from '../lib/auth'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

/**
 * Production root wrapper — shared BrainProvider for all product routes.
 */
export function ProductBrainRoot({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? 'rahhal-user'
  return (
    <BrainProvider shared userId={userId} locale="ar" autoStart>
      {children}
    </BrainProvider>
  )
}
