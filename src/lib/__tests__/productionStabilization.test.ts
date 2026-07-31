/**
 * Production stabilization — pipeline diagnostics + voice silence/auth gates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../ops/errors/canonicalError'
import { diagnosePipelineError, userFacingErrorMessage } from '../chat/pipelineDiagnostics'
import { assertChatDatabaseAuth } from '../chat/chatAuthGate'
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
})

describe('production stabilization silence defaults', () => {
  it('uses ChatGPT-like think-pause silence defaults', () => {
    expect(DEFAULT_SILENCE_MS).toBe(3000)
    // Experience Sprint 1 — hands-free default raised so natural mid-thought pauses do not cut users off.
    expect(DEFAULT_HANDS_FREE_SILENCE_MS).toBe(2500)
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
