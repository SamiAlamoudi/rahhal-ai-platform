/**
 * Durable home → /chat voice entry handoff.
 *
 * iPhone Safari (and some in-app browsers) often drop React Router `location.state`
 * across navigations. SessionStorage + query params keep the seed/startVoice flag.
 */

export const VOICE_ENTRY_STORAGE_KEY = 'rahhal_voice_entry_v1'
const HANDOFF_TTL_MS = 120_000

export type VoiceEntryHandoff = {
  seed: string
  startVoice: boolean
  ts: number
  turnId: string
}

function newTurnId(): string {
  return `vturn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function writeVoiceEntryHandoff(input: {
  seed: string
  startVoice: boolean
  turnId?: string
}): VoiceEntryHandoff | null {
  const seed = input.seed.trim()
  if (!seed) return null
  const payload: VoiceEntryHandoff = {
    seed,
    startVoice: input.startVoice === true,
    ts: Date.now(),
    turnId: input.turnId ?? newTurnId(),
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(VOICE_ENTRY_STORAGE_KEY, JSON.stringify(payload))
    }
  } catch {
    // Private mode / blocked storage — query param backup still helps for short seeds.
  }
  return payload
}

export function readVoiceEntryHandoff(): VoiceEntryHandoff | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem(VOICE_ENTRY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VoiceEntryHandoff>
    const seed = typeof parsed.seed === 'string' ? parsed.seed.trim() : ''
    if (!seed) return null
    const ts = typeof parsed.ts === 'number' ? parsed.ts : 0
    if (!ts || Date.now() - ts > HANDOFF_TTL_MS) return null
    return {
      seed,
      startVoice: parsed.startVoice === true,
      ts,
      turnId: typeof parsed.turnId === 'string' ? parsed.turnId : newTurnId(),
    }
  } catch {
    return null
  }
}

export function clearVoiceEntryHandoff(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(VOICE_ENTRY_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

/** Build /chat navigation that survives iOS Safari state drops. */
export function buildVoiceAwareChatNavigation(
  seedMessage: string,
  options?: { startVoice?: boolean; turnId?: string },
): {
  pathname: string
  search: string
  state: {
    seedMessage: string
    tripText: string
    initialPrompt: string
    startVoice?: boolean
    voiceTurnId?: string
  }
} {
  const seed = seedMessage.trim()
  const startVoice = options?.startVoice === true
  const handoff = writeVoiceEntryHandoff({
    seed,
    startVoice,
    turnId: options?.turnId,
  })
  const params = new URLSearchParams()
  // Keep URL reasonable; full seed always lives in sessionStorage.
  if (seed && seed.length <= 450) {
    params.set('seed', seed)
  }
  if (startVoice) params.set('startVoice', '1')
  if (handoff?.turnId) params.set('voiceTurn', handoff.turnId)

  return {
    pathname: '/chat',
    search: params.toString() ? `?${params.toString()}` : '',
    state: {
      seedMessage: seed,
      tripText: seed,
      initialPrompt: seed,
      ...(startVoice ? { startVoice: true } : {}),
      ...(handoff?.turnId ? { voiceTurnId: handoff.turnId } : {}),
    },
  }
}

/** Resolve seed/startVoice from router state, query, then sessionStorage. */
export function resolveChatEntrySeed(input: {
  state?: {
    seedMessage?: string
    tripText?: string
    initialPrompt?: string
    startVoice?: boolean
    voiceTurnId?: string
  } | null
  search?: string
}): {
  seed: string
  startVoice: boolean
  turnId: string | null
  source: 'state' | 'query' | 'session' | 'none'
} {
  const stateSeed = (
    input.state?.seedMessage
    ?? input.state?.tripText
    ?? input.state?.initialPrompt
    ?? ''
  ).trim()
  const params = new URLSearchParams(input.search ?? '')
  const querySeed = (params.get('seed') ?? '').trim()
  const queryVoice = params.get('startVoice') === '1' || params.get('startVoice') === 'true'
  const queryTurn = params.get('voiceTurn')
  const stored = readVoiceEntryHandoff()

  if (stateSeed) {
    return {
      seed: stateSeed,
      startVoice: input.state?.startVoice === true || queryVoice || stored?.startVoice === true,
      turnId: input.state?.voiceTurnId ?? queryTurn ?? stored?.turnId ?? null,
      source: 'state',
    }
  }
  if (querySeed) {
    return {
      seed: querySeed,
      startVoice: queryVoice || stored?.startVoice === true,
      turnId: queryTurn ?? stored?.turnId ?? null,
      source: 'query',
    }
  }
  if (stored?.seed) {
    return {
      seed: stored.seed,
      startVoice: stored.startVoice,
      turnId: stored.turnId,
      source: 'session',
    }
  }
  return { seed: '', startVoice: false, turnId: null, source: 'none' }
}
