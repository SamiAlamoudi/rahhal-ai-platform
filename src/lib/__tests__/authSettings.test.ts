import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authService } from '../auth/authService'
import { supabase } from '../supabaseClient'
import { auditLogRepository } from '../repositories/auditLogRepository'

describe('authService settings actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updateProfile updates user metadata and audits', async () => {
    const updateUser = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.updateUser>>)
    const auditSpy = vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)

    const result = await authService.updateProfile({ fullName: 'Sami' })
    expect(result.success).toBe(true)
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: 'Sami' } })
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'update_profile' }))
  })

  it('changePassword reauthenticates then updates password', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'sami@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-01T00:00:00.000Z',
    } as Awaited<ReturnType<typeof authService.getCurrentUser>>)

    const signIn = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)

    const updateUser = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.updateUser>>)

    vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)

    const result = await authService.changePassword('old-secret', 'new-secret')
    expect(result.success).toBe(true)
    expect(signIn).toHaveBeenCalledWith({
      email: 'sami@example.com',
      password: 'old-secret',
    })
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-secret' })
  })

  it('changePassword fails when current password is wrong', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'sami@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-01T00:00:00.000Z',
    } as Awaited<ReturnType<typeof authService.getCurrentUser>>)

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', name: 'AuthApiError', status: 400 },
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)

    const result = await authService.changePassword('wrong', 'new-secret')
    expect(result.success).toBe(false)
    expect(result.error).toContain('غير صحيحة')
  })

  it('deleteAccount calls rpc then signs out', async () => {
    vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)
    const rpc = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)
    const signOut = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>)

    const result = await authService.deleteAccount()
    expect(result.success).toBe(true)
    expect(rpc).toHaveBeenCalledWith('delete_own_account')
    expect(signOut).toHaveBeenCalled()
  })

  it('deleteAccount surfaces rpc errors', async () => {
    vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'Not authenticated', details: '', hint: '', code: '42501' },
    } as unknown as Awaited<ReturnType<typeof supabase.rpc>>)

    const result = await authService.deleteAccount()
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
