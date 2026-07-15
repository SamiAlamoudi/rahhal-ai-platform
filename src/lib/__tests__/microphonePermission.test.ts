import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  queryMicrophonePermission,
  requestMicrophoneAccess,
  subscribeMicrophonePermission,
} from '../chat/voice/microphonePermission'

describe('microphonePermission', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports unsupported without media devices', async () => {
    vi.stubGlobal('navigator', {})
    const state = await queryMicrophonePermission()
    expect(state.state).toBe('unsupported')
  })

  it('maps getUserMedia success and denial', async () => {
    const stop = vi.fn()
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    })
    await expect(requestMicrophoneAccess()).resolves.toEqual({ state: 'granted', error: null })
    expect(stop).toHaveBeenCalled()

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    })
    const denied = await requestMicrophoneAccess()
    expect(denied.state).toBe('denied')
  })

  it('subscribeMicrophonePermission no-ops without Permissions API', async () => {
    vi.stubGlobal('navigator', {})
    const unsub = await subscribeMicrophonePermission(() => {})
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('subscribeMicrophonePermission wires change listener when available', async () => {
    const listeners = new Map<string, Set<() => void>>()
    const status = {
      state: 'prompt' as PermissionState,
      addEventListener: (type: string, handler: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(handler)
      },
      removeEventListener: (type: string, handler: () => void) => {
        listeners.get(type)?.delete(handler)
      },
    }
    vi.stubGlobal('navigator', {
      permissions: {
        query: vi.fn().mockResolvedValue(status),
      },
    })

    const onChange = vi.fn()
    const unsub = await subscribeMicrophonePermission(onChange)
    status.state = 'granted'
    listeners.get('change')?.forEach((fn) => fn())
    expect(onChange).toHaveBeenCalledWith({ state: 'granted', error: null })
    unsub()
    expect(listeners.get('change')?.size ?? 0).toBe(0)
  })
})
