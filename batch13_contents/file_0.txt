export type ErrorCategory =
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'validation'
  | 'provider'
  | 'timeout'
  | 'unknown'

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal'

export interface ProviderError {
  code: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  retryable: boolean
  timestamp: string
}

export interface ProviderWarning {
  code: string
  message: string
  field?: string
}

export interface ProviderResult<T> {
  providerId: string
  providerName: string
  success: boolean
  latency: number
  source: string
  data: T | null
  errors: ProviderError[]
  warnings: ProviderWarning[]
}

export function okResult<T>(
  providerId: string,
  providerName: string,
  data: T,
  latency: number,
  source: string,
  warnings: ProviderWarning[] = [],
): ProviderResult<T> {
  return {
    providerId,
    providerName,
    success: true,
    latency,
    source,
    data,
    errors: [],
    warnings,
  }
}

export function errorResult<T>(
  providerId: string,
  providerName: string,
  errors: ProviderError[],
  latency: number,
  source: string,
  warnings: ProviderWarning[] = [],
): ProviderResult<T> {
  return {
    providerId,
    providerName,
    success: false,
    latency,
    source,
    data: null,
    errors,
    warnings,
  }
}

export function fromThrown(thrown: unknown, _providerId: string): ProviderError {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return {
    code: 'UNCAUGHT',
    category: 'unknown',
    severity: 'error',
    message,
    retryable: false,
    timestamp: new Date().toISOString(),
  }
}
