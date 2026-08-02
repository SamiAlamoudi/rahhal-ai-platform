import {
  createContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { BrainSessionController } from './BrainSessionController'
import type { BrainUiState } from './types'
import type { LocaleCode } from '../brain/types'

export type TravelBrainApi = {
  state: BrainUiState
  sendMessage: (text: string) => Promise<void>
  startVoice: () => Promise<void>
  stopVoice: () => void
  resetConversation: () => Promise<void>
  getRecommendations: () => ReturnType<BrainSessionController['getRecommendations']>
  getConversation: () => ReturnType<BrainSessionController['getConversation']>
  getTimeline: () => ReturnType<BrainSessionController['getTimeline']>
  setLocale: (locale: LocaleCode) => void
}

export const TravelBrainContext = createContext<TravelBrainApi | null>(null)

export function BrainProvider({
  children,
  userId = 'brain-ui-user',
  locale = 'ar',
  autoStart = true,
}: {
  children: ReactNode
  userId?: string
  locale?: LocaleCode
  autoStart?: boolean
}) {
  const controller = useMemo(() => new BrainSessionController(), [])
  const [state, setState] = useState<BrainUiState>(() => controller.getState())

  const onState = useEffectEvent((next: BrainUiState) => {
    setState(next)
  })

  useEffect(() => {
    const unsub = controller.subscribe(onState)
    if (autoStart) void controller.start(userId, locale)
    return () => {
      unsub()
      controller.dispose()
    }
  }, [controller, autoStart, userId, locale])

  const api = useMemo<TravelBrainApi>(
    () => ({
      state,
      sendMessage: (text) => controller.sendMessage(text),
      startVoice: () => controller.startVoice(),
      stopVoice: () => controller.stopVoice(),
      resetConversation: () => controller.resetConversation(),
      getRecommendations: () => controller.getRecommendations(),
      getConversation: () => controller.getConversation(),
      getTimeline: () => controller.getTimeline(),
      setLocale: (l) => controller.setLocale(l),
    }),
    [controller, state],
  )

  return <TravelBrainContext.Provider value={api}>{children}</TravelBrainContext.Provider>
}
