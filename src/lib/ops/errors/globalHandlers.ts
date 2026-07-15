/**
 * Frontend global error handlers — unhandled rejections + window errors.
 */

import { getLogger } from '../logging/structuredLogger'
import { toAppError } from './canonicalError'

export interface InstallGlobalHandlersOptions {
  onError?: (error: unknown) => void
}

export function installGlobalErrorHandlers(
  options: InstallGlobalHandlersOptions = {},
): () => void {
  const logger = getLogger()

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const appError = toAppError(event.reason, { domain: 'app', operation: 'unhandled_rejection' })
    logger.error('app', 'unhandled_rejection', appError.message, {
      code: appError.code,
      correlationId: appError.correlationId,
    })
    options.onError?.(appError)
  }

  const onError = (event: ErrorEvent) => {
    const appError = toAppError(event.error ?? event.message, {
      domain: 'app',
      operation: 'window_error',
    })
    logger.error('app', 'window_error', appError.message, {
      code: appError.code,
      filename: event.filename,
    })
    options.onError?.(appError)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onError)
    }
  }

  return () => {}
}
