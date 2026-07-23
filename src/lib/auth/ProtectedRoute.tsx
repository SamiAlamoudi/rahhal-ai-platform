import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import RouteSkeleton from '../../components/ux/RouteSkeleton'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

function LoadingScreen({ showLabel = true }: { showLabel?: boolean }) {
  return <RouteSkeleton label={showLabel ? 'جاري التحميل…' : undefined} />
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
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}
