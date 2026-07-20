/**
 * Sprint 42 — chat theme modes (light / dark / high contrast).
 */

export type ChatThemeMode = 'light' | 'dark' | 'high_contrast'

const STORAGE_KEY = 'rahhal.chat.theme'

export function resolveChatTheme(mode: ChatThemeMode | 'system' = 'system'): ChatThemeMode {
  if (mode === 'light' || mode === 'dark' || mode === 'high_contrast') return mode
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function readStoredChatTheme(): ChatThemeMode | 'system' {
  if (typeof localStorage === 'undefined') return 'system'
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'high_contrast' || raw === 'system') return raw
  return 'system'
}

export function writeStoredChatTheme(mode: ChatThemeMode | 'system'): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, mode)
}

export function chatThemeClassName(mode: ChatThemeMode): string {
  if (mode === 'dark') return 'chat-theme-dark'
  if (mode === 'high_contrast') return 'chat-theme-contrast'
  return 'chat-theme-light'
}
