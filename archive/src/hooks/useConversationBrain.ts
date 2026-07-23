import { useCallback, useRef, useState } from 'react'
import {
  ConversationOrchestrator,
  type BrainTurnInput,
  type BrainTurnResult,
  type ConversationContext,
  type ConversationOrchestratorOptions,
} from '../lib/brain'

export type UseConversationBrainOptions = ConversationOrchestratorOptions

export type UseConversationBrainReturn = {
  context: ConversationContext
  lastResult: BrainTurnResult | null
  runTurn: (input: BrainTurnInput | string) => BrainTurnResult
  reset: () => void
}

/**
 * Sprint 19 — conversation brain orchestration hook (no LLM).
 */
export function useConversationBrain(
  options: UseConversationBrainOptions = {},
): UseConversationBrainReturn {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const orchestratorRef = useRef(ConversationOrchestrator(options))
  const [context, setContext] = useState(() => orchestratorRef.current.getContext())
  const [lastResult, setLastResult] = useState<BrainTurnResult | null>(null)

  const runTurn = useCallback((input: BrainTurnInput | string) => {
    const payload: BrainTurnInput =
      typeof input === 'string' ? { userText: input } : input
    const result = orchestratorRef.current.runTurn(payload)
    setContext(result.context)
    setLastResult(result)
    return result
  }, [])

  const reset = useCallback(() => {
    orchestratorRef.current = ConversationOrchestrator(optionsRef.current)
    setContext(orchestratorRef.current.getContext())
    setLastResult(null)
  }, [])

  return { context, lastResult, runTurn, reset }
}
