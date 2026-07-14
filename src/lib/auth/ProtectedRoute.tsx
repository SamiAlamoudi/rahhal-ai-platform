import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

function LoadingScreen({ showLabel = true }: { showLabel?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        {showLabel && <p className="text-sm text-slate-500">جاري التحميل...</p>}
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** Authenticated + admin only; non-admins redirect home. */
export function AdminRoute({ children }: ProtectedRouteProps) {
  const { loading, isAuthenticated, isAdmin } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export function PublicOnlyRoute({ children }: ProtectedRouteProps) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return <LoadingScreen showLabel={false} />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
