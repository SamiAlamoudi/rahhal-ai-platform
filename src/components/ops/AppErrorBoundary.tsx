import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getLogger } from '../../lib/ops/logging/structuredLogger'
import { extractErrorText, toAppError } from '../../lib/ops/errors/canonicalError'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  userMessage: string
  correlationId: string | null
}

/**
 * Minimal error boundary — ops resilience only (not a UI redesign).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    userMessage: '',
    correlationId: null,
  }

  static getDerivedStateFromError(error: unknown): State {
    const appError = toAppError(error, { domain: 'ui', operation: 'react_render' })
    const userMessage = extractErrorText(
      appError.userMessage && appError.userMessage !== '[object Object]'
        ? appError.userMessage
        : appError,
      'Something went wrong. Please try again.',
    )
    return {
      hasError: true,
      userMessage: userMessage === '[object Object]'
        ? 'Something went wrong. Please try again.'
        : userMessage,
      correlationId: appError.correlationId,
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const appError = toAppError(error, { domain: 'ui', operation: 'react_render' })
    getLogger().error('ui', 'react_error_boundary', appError.message, {
      code: appError.code,
      componentStack: info.componentStack?.slice(0, 500),
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: '2rem', fontFamily: 'Cairo, sans-serif' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </h1>
          <p style={{ marginBottom: '0.75rem' }}>{this.state.userMessage}</p>
          {this.state.correlationId ? (
            <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>
              Reference: {this.state.correlationId}
            </p>
          ) : null}
          <button type="button" onClick={() => window.location.assign('/')}>
            Go home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
