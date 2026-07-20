/**
 * Production stabilization — assert a real Supabase auth session before chat DB ops.
 * Demo JWT tokens cannot satisfy RLS (auth.uid()).
 */

import { supabase } from '../supabaseClient'
import { AppError } from '../ops/errors/canonicalError'
import { logPipeline } from './pipelineDiagnostics'

export async function assertChatDatabaseAuth(operation: string): Promise<{ userId: string }> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    logPipeline({
      stage: 'database',
      event: 'auth_session_error',
      message: error.message,
      supabase: { message: error.message },
    })
    throw new AppError({
      code: 'auth_error',
      message: error.message,
      userMessage: 'تعذر التحقق من جلسة الدخول. سجّل الدخول مجدداً.',
      domain: 'chat.database',
      operation,
      status: 401,
      cause: error,
    })
  }

  const session = data.session
  const token = session?.access_token ?? ''
  const userId = session?.user?.id

  if (!session || !userId || token === 'demo-access-token' || token.startsWith('demo-')) {
    logPipeline({
      stage: 'database',
      event: 'auth_missing_or_demo',
      message: 'No real Supabase JWT for chat persistence',
      meta: { operation, hasSession: Boolean(session), isDemo: token.startsWith('demo') },
    })
    throw new AppError({
      code: 'auth_error',
      message: 'Chat persistence requires a real Supabase session',
      userMessage:
        'لحفظ وتحميل المحادثات يلزم تسجيل الدخول بحساب حقيقي. جلسة العرض التوضيحي لا تستطيع الكتابة في قاعدة البيانات.',
      domain: 'chat.database',
      operation,
      status: 401,
      diagnostics: { isDemo: token.startsWith('demo') },
    })
  }

  return { userId }
}
