const STORAGE_KEY = 'rahhal.chat.activeConversationId'

export function readStoredConversationId(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : null,
): string | null {
  try {
    const value = storage?.getItem(STORAGE_KEY)
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

export function writeStoredConversationId(
  id: string | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : null,
): void {
  if (!storage) return
  try {
    if (!id) storage.removeItem(STORAGE_KEY)
    else storage.setItem(STORAGE_KEY, id)
  } catch {
    // ignore quota / private mode
  }
}

export function conversationIdFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    const id = params.get('conversation')?.trim()
    return id || null
  } catch {
    return null
  }
}

export function buildChatSearch(conversationId: string | null, existingSearch = ''): string {
  const params = new URLSearchParams(
    existingSearch.startsWith('?') ? existingSearch.slice(1) : existingSearch,
  )
  if (conversationId) params.set('conversation', conversationId)
  else params.delete('conversation')
  const raw = params.toString()
  return raw ? `?${raw}` : ''
}

export function resolveInitialConversationId(input: {
  search: string
  availableIds: string[]
  storage?: Pick<Storage, 'getItem'> | null
}): string | null {
  const fromUrl = conversationIdFromSearch(input.search)
  if (fromUrl && input.availableIds.includes(fromUrl)) return fromUrl
  const stored = readStoredConversationId(input.storage)
  if (stored && input.availableIds.includes(stored)) return stored
  return input.availableIds[0] ?? null
}
