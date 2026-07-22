/**
 * Production stabilization — pipeline diagnostics + voice silence/auth gates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../ops/errors/canonicalError'
import { diagnosePipelineError, userFacingErrorMessage } from '../chat/pipelineDiagnostics'
import { assertChatDatabaseAuth } from '../chat/chatAuthGate'
import { chatService } from '../chat/chatService'
import {
  clearLocalChatStore,
  isLocalChatAuthError,
  shouldUseLocalChatFallback,
} from '../chat/localChatStore'
import { conversationRepository } from '../repositories/conversationRepository'
import {
  DEFAULT_HANDS_FREE_SILENCE_MS,
  MAX_HANDS_FREE_SILENCE_MS,
  MIN_HANDS_FREE_SILENCE_MS,
} from '../chat/voice/voiceTypes'
import { DEFAULT_SILENCE_MS } from '../../hooks/useSpeechRecognition'
import { supabase } from '../supabaseClient'

describe('production stabilization diagnostics', () => {
  it('maps RLS / permission denied to forbidden with user message', () => {
    const err = diagnosePipelineError('database', 'insert', {
      code: '42501',
      message: 'permission denied for table conversations',
      details: null,
      hint: null,
    })
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('forbidden')
    expect(err.status).toBe(403)
    expect(err.correlationId).toBeTruthy()
    expect(userFacingErrorMessage(err, 'fallback')).toContain('قاعدة')
  })

  it('maps missing auth to auth_error', () => {
    const err = diagnosePipelineError('conversation', 'create', new Error('JWT expired'))
    expect(err.code).toBe('auth_error')
    expect(err.status).toBe(401)
  })

  it('surfaces real messages from plain objects instead of [object Object]', () => {
    const err = diagnosePipelineError('conversation', 'createConversation', {
      code: 'PGRST301',
      message: 'JWT expired',
      details: null,
      hint: null,
    })
    expect(err.message).toBe('JWT expired')
    expect(err.message).not.toBe('[object Object]')
    expect(userFacingErrorMessage(err, 'fallback')).not.toContain('[object Object]')
    expect(
      userFacingErrorMessage(
        { message: 'تعذر إنشاء المحادثة بسبب الشبكة' },
        'fallback',
      ),
    ).toBe('تعذر إنشاء المحادثة بسبب الشبكة')
  })

  it('recognizes plain PostgREST/network objects for local chat fallback', () => {
    const fetchFailed = {
      message: 'TypeError: fetch failed',
      details: 'ENOTFOUND example.supabase.co',
      hint: '',
      code: '',
    }
    expect(String(fetchFailed)).toBe('[object Object]')
    expect(isLocalChatAuthError(fetchFailed)).toBe(false)
    expect(shouldUseLocalChatFallback(fetchFailed)).toBe(true)
    expect(shouldUseLocalChatFallback({
      code: '42501',
      message: 'permission denied for table conversations',
    })).toBe(true)

    const diagnosed = diagnosePipelineError('conversation', 'createConversation', fetchFailed)
    expect(diagnosed.message).toBe('TypeError: fetch failed')
    expect(diagnosed.message).not.toBe('[object Object]')
    expect(userFacingErrorMessage(diagnosed, 'fallback')).not.toContain('[object Object]')
    expect(shouldUseLocalChatFallback(diagnosed)).toBe(true)
  })
})

describe('createConversation persistence recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearLocalChatStore()
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real',
          refresh_token: 'x',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'user-real-1' } as never,
        } as never,
      },
      error: null,
    } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearLocalChatStore()
  })

  it('falls back to local store when Supabase insert returns fetch-failed object', async () => {
    vi.spyOn(conversationRepository, 'create').mockRejectedValue({
      message: 'TypeError: fetch failed',
      details: 'TypeError: fetch failed',
      hint: '',
      code: '',
    })

    const created = await chatService.createConversation('رحلة اختبار')
    expect(created.id.startsWith('lconv_')).toBe(true)
    expect(created.title).toBe('رحلة اختبار')
  })

  it('falls back to local store on RLS 42501 plain objects', async () => {
    vi.spyOn(conversationRepository, 'create').mockRejectedValue({
      code: '42501',
      message: 'permission denied for table conversations',
      details: null,
      hint: null,
    })

    const created = await chatService.createConversation()
    expect(created.id.startsWith('lconv_')).toBe(true)
  })

  it('passes authenticated user_id into conversation insert', async () => {
    const createSpy = vi.spyOn(conversationRepository, 'create').mockResolvedValue({
      id: 'conv-db-1',
      user_id: 'user-real-1',
      title: 'محادثة جديدة',
      modality_default: 'text',
      travel_session_id: null,
      last_message_preview: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)

    const created = await chatService.createConversation()
    expect(created.id).toBe('conv-db-1')
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-real-1' }),
    )
  })
})

describe('production stabilization silence defaults', () => {
  it('uses ChatGPT-like think-pause silence defaults', () => {
    expect(DEFAULT_SILENCE_MS).toBe(3000)
    // Experience Sprint 1 — hands-free default raised so natural mid-thought pauses do not cut users off.
    expect(DEFAULT_HANDS_FREE_SILENCE_MS).toBe(3500)
    expect(DEFAULT_HANDS_FREE_SILENCE_MS).toBeGreaterThanOrEqual(2000)
    expect(DEFAULT_HANDS_FREE_SILENCE_MS).toBeLessThanOrEqual(6000)
    expect(MIN_HANDS_FREE_SILENCE_MS).toBe(2000)
    expect(MAX_HANDS_FREE_SILENCE_MS).toBe(6000)
    expect(MIN_HANDS_FREE_SILENCE_MS).toBeLessThanOrEqual(DEFAULT_HANDS_FREE_SILENCE_MS)
    expect(MAX_HANDS_FREE_SILENCE_MS).toBeGreaterThanOrEqual(DEFAULT_HANDS_FREE_SILENCE_MS)
  })
})

describe('production stabilization auth gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects demo access tokens for chat persistence', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'demo-access-token',
          refresh_token: 'demo',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'demo-user' } as never,
        } as never,
      },
      error: null,
    } as never)

    await expect(assertChatDatabaseAuth('createConversation')).rejects.toMatchObject({
      code: 'auth_error',
      status: 401,
    })
  })

  it('accepts a real user session', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real',
          refresh_token: 'x',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'user-real-1' } as never,
        } as never,
      },
      error: null,
    } as never)

    await expect(assertChatDatabaseAuth('listConversations')).resolves.toEqual({
      userId: 'user-real-1',
    })
  })
})
