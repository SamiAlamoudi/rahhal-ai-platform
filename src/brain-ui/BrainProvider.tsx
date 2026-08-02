import {
  createContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { BrainSessionController } from './BrainSessionController'
import { getProductBrainController } from './productBrain'
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
  getPlan: () => ReturnType<BrainSessionController['getPlan']>
  getConcierge: () => ReturnType<BrainSessionController['getConcierge']>
  restoreDecision: (id: string) => void
  setLocale: (locale: LocaleCode) => void
  controller: BrainSessionController
}

export const TravelBrainContext = createContext<TravelBrainApi | null>(null)

export function BrainProvider({
  children,
  userId = 'rahhal-user',
  locale = 'ar',
  autoStart = true,
  /** Production default: one shared controller across routes. */
  shared = true,
}: {
  children: ReactNode
  userId?: string
  locale?: LocaleCode
  autoStart?: boolean
  shared?: boolean
}) {
  const controller = useMemo(
    () => (shared ? getProductBrainController() : new BrainSessionController()),
    [shared],
  )
  const [state, setState] = useState<BrainUiState>(() => controller.getState())

  const onState = useEffectEvent((next: BrainUiState) => {
    setState(next)
  })

  useEffect(() => {
    const unsub = controller.subscribe(onState)
    if (autoStart && !controller.getState().ready) {
      void controller.start(userId, locale)
    } else if (autoStart) {
      controller.setLocale(locale)
    }
    return () => {
      unsub()
      if (!shared) controller.dispose()
    }
  }, [controller, autoStart, userId, locale, shared])

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
      getPlan: () => controller.getPlan(),
      getConcierge: () => controller.getConcierge(),
      restoreDecision: (id) => controller.restoreDecision(id),
      setLocale: (l) => controller.setLocale(l),
      controller,
    }),
    [controller, state],
  )

  return <TravelBrainContext.Provider value={api}>{children}</TravelBrainContext.Provider>
}
