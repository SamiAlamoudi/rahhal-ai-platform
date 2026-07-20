/**
 * Production stabilization — structured pipeline diagnostics.
 * Every failure should expose HTTP status, Supabase error, stack, request id,
 * and a user-friendly message.
 */

import { AppError, toAppError } from '../ops/errors/canonicalError'
import { getCorrelationId } from '../ops/logging/correlation'
import { logChat, logChatError } from './chatLogger'

export type PipelineStage =
  | 'microphone'
  | 'stt'
  | 'conversation'
  | 'database'
  | 'ai'
  | 'streaming'
  | 'tts'
  | 'voice'

export type PipelineLogEntry = {
  stage: PipelineStage
  event: string
  message?: string
  requestId?: string
  httpStatus?: number | null
  supabase?: {
    code?: string | null
    details?: string | null
    hint?: string | null
    message?: string | null
  } | null
  error?: unknown
  stack?: string | null
  userMessage?: string
  meta?: Record<string, unknown>
}

function extractSupabaseFields(error: unknown): PipelineLogEntry['supabase'] {
  if (!error || typeof error !== 'object') return null
  const row = error as {
    code?: string
    details?: string
    hint?: string
    message?: string
    status?: number
    statusCode?: number
  }
  if (!row.code && !row.details && !row.hint && !row.message) return null
  return {
    code: row.code ?? null,
    details: row.details ?? null,
    hint: row.hint ?? null,
    message: row.message ?? null,
  }
}

function extractHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const row = error as { status?: number; statusCode?: number; code?: string }
  if (typeof row.status === 'number') return row.status
  if (typeof row.statusCode === 'number') return row.statusCode
  if (row.code === '42501' || row.code === 'PGRST301') return 403
  if (row.code === 'PGRST116') return 404
  if (row.code === '28000' || row.code === 'PGRST301') return 401
  return null
}

export function logPipeline(entry: PipelineLogEntry): void {
  const requestId = entry.requestId ?? getCorrelationId()
  const payload = {
    ...entry,
    requestId,
    at: new Date().toISOString(),
  }
  const level =
    entry.event.includes('fail')
    || entry.event.includes('error')
    || entry.error
      ? 'error'
      : entry.event.includes('warn')
        ? 'warn'
        : 'debug'
  logChat(level, `pipeline.${entry.stage}`, entry.event, payload)
}

export function diagnosePipelineError(
  stage: PipelineStage,
  operation: string,
  error: unknown,
  userMessageAr?: string,
): AppError {
  const supabase = extractSupabaseFields(error)
  const httpStatus = extractHttpStatus(error)
  const stack = error instanceof Error ? error.stack ?? null : null
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  const lower = message.toLowerCase()

  let app = error instanceof AppError
    ? error
    : toAppError(error, { domain: `chat.${stage}`, operation })

  // Map common Supabase / auth failure modes.
  if (
    lower.includes('jwt')
    || lower.includes('not authenticated')
    || lower.includes('auth')
    || supabase?.code === '28000'
  ) {
    app = new AppError({
      code: 'auth_error',
      message,
      userMessage:
        userMessageAr
        ?? 'يلزم تسجيل الدخول بحساب حقيقي لحفظ المحادثات (جلسة العرض التوضيحي لا تدعم قاعدة البيانات).',
      domain: `chat.${stage}`,
      operation,
      status: 401,
      cause: error,
      diagnostics: { supabase, httpStatus },
    })
  } else if (
    lower.includes('permission denied')
    || lower.includes('row-level security')
    || lower.includes('rls')
    || supabase?.code === '42501'
  ) {
    app = new AppError({
      code: 'forbidden',
      message,
      userMessage:
        userMessageAr
        ?? 'تعذر الوصول إلى المحادثة بسبب صلاحيات قاعدة البيانات. تحقق من تسجيل الدخول وRLS.',
      domain: `chat.${stage}`,
      operation,
      status: 403,
      cause: error,
      diagnostics: { supabase, httpStatus },
    })
  } else if (lower.includes('not found') || supabase?.code === 'PGRST116') {
    app = new AppError({
      code: 'not_found',
      message,
      userMessage: userMessageAr ?? 'المحادثة غير موجودة أو لم يعد بإمكانك الوصول إليها.',
      domain: `chat.${stage}`,
      operation,
      status: 404,
      cause: error,
      diagnostics: { supabase, httpStatus },
    })
  }

  logPipeline({
    stage,
    event: `${operation}_failed`,
    message: app.message,
    httpStatus: app.status,
    supabase,
    error,
    stack,
    userMessage: app.userMessage,
    requestId: app.correlationId,
    meta: { operation, code: app.code },
  })
  logChatError(`pipeline.${stage}.${operation}`, error, {
    requestId: app.correlationId,
    httpStatus: app.status,
    supabase,
    userMessage: app.userMessage,
  })

  return app
}

export function userFacingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.userMessage || error.message || fallback
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}
