/**
 * Sprint 43 — Rahhal AI Orchestrator.
 * Understands intent, routes tools, plans waves, executes in parallel,
 * ranks results, and returns one conversational response.
 * Never duplicates engine business logic.
 */

import { routeUserIntent, shouldUseOrchestratorForRoute } from './intentRouter'
import { buildPlannerDecision, flattenTools } from './planner'
import { createMemoryBridge, emptySnapshot, type MemoryBridgeHandle } from './memoryBridge'
import { executeToolWaves } from './parallelExecutor'
import { rankRecommendations } from './resultRanker'
import { buildOrchestratorResponse } from './responseBuilder'
import { createOrchestratorObservability, type OrchestratorLogSink } from './observability'
import { createToolAdapters, type ToolAdapterDeps, type ToolAdaptersHandle } from './toolAdapters'
import { isAiOrchestratorEnabled } from './feature'
import type {
  OrchestratorRunInput,
  OrchestratorRunResult,
  OrchestratorToolId,
  ToolExecutionResult,
} from './types'

export type RahhalAiOrchestratorOptions = ToolAdapterDeps & {
  enabled?: boolean
  memoryBridge?: MemoryBridgeHandle
  adapters?: ToolAdaptersHandle
  logSink?: OrchestratorLogSink
}

export type RahhalAiOrchestratorHandle = {
  isEnabled: () => boolean
  shouldHandle: (input: {
    userText: string
    commandHint?: string | null
  }) => boolean
  run: (input: OrchestratorRunInput) => Promise<OrchestratorRunResult>
}

export function RahhalAiOrchestrator(
  options: RahhalAiOrchestratorOptions = {},
): RahhalAiOrchestratorHandle {
  const memoryBridge = options.memoryBridge ?? createMemoryBridge({ enabled: true })
  const adapters =
    options.adapters
    ?? createToolAdapters({
      planner: options.planner,
      policyEngine: options.policyEngine,
      disruptionEngine: options.disruptionEngine,
      loyaltyPlatform: options.loyaltyPlatform,
      travelDocumentsPlatform: options.travelDocumentsPlatform,
      supplierMarketplace: options.supplierMarketplace,
      financePlatform: options.financePlatform,
      postBookingService: options.postBookingService,
    })
  const obs = createOrchestratorObservability({ sink: options.logSink })

  function enabled(): boolean {
    if (typeof options.enabled === 'boolean') return options.enabled
    return isAiOrchestratorEnabled()
  }

  return {
    isEnabled: enabled,

    shouldHandle(input) {
      if (!enabled()) return false
      const route = routeUserIntent(input.userText, input.commandHint)
      return shouldUseOrchestratorForRoute(route)
    },

    async run(input: OrchestratorRunInput): Promise<OrchestratorRunResult> {
      const started = Date.now()
      const locale = input.locale === 'ar' ? 'ar' : 'en'
      const userId = input.userId ?? 'anonymous'
      const fallbackReasons: string[] = []
      const errors: Array<{ tool?: OrchestratorToolId; message: string }> = []

      // Plan — absorb memory before asking questions.
      const memory =
        input.memory
        ?? memoryBridge.absorbTurn({
          conversationId: input.conversationId,
          userText: input.userText,
          locale,
          userId,
        })

      const route = routeUserIntent(input.userText, input.commandHint)
      let decision = buildPlannerDecision({ route, memory })

      // Soft-fill destination from utterance into memory snapshot for ranking/copy.
      const enrichedMemory = {
        ...memory,
        destination:
          memory.destination
          ?? guessDestination(input.userText)
          ?? null,
      }
      decision = buildPlannerDecision({ route, memory: enrichedMemory })

      obs.log({
        type: 'planner_decision',
        stage: 'plan',
        intent: decision.intent,
        waves: decision.waves,
        memoryHintsUsed: decision.memoryHintsUsed,
        missingSlots: decision.missingSlots,
      })

      // Execute — parallel waves for independent tools.
      obs.log({ type: 'planner_decision', stage: 'execute', tools: flattenTools(decision.waves) })
      const toolResults = await executeToolWaves({
        waves: decision.waves,
        signal: input.signal,
        runTool: async (tool) => {
          const result = await adapters.run(tool, {
            conversationId: input.conversationId,
            userText: input.userText,
            locale,
            userId,
            memory: enrichedMemory,
            intent: route.intent,
            signal: input.signal,
          })
          if (!result.ok) {
            errors.push({ tool, message: result.error ?? 'tool_failed' })
            fallbackReasons.push(`${tool}_failed`)
          }
          return result
        },
      })

      // Observe — merge failures / empty results into fallback path when needed.
      obs.log({
        type: 'planner_decision',
        stage: 'observe',
        okCount: toolResults.filter((r) => r.ok).length,
        failCount: toolResults.filter((r) => !r.ok).length,
      })

      let finalResults = toolResults
      let usedFallback = false
      const allFailed = toolResults.length > 0 && toolResults.every((r) => !r.ok)
      if (allFailed || route.intent === 'fallback') {
        usedFallback = true
        fallbackReasons.push(allFailed ? 'all_tools_failed' : 'low_confidence_route')
        const fallback = await adapters.run('ai_conversation', {
          conversationId: input.conversationId,
          userText: input.userText,
          locale,
          userId,
          memory: enrichedMemory,
          intent: 'fallback',
          signal: input.signal,
        })
        finalResults = mergeUniqueTools([...toolResults, fallback])
      }

      // Continue — rank and synthesize one answer.
      obs.log({ type: 'planner_decision', stage: 'continue' })
      const recommendations = rankRecommendations({
        toolResults: finalResults,
        memory: enrichedMemory,
        preferCheapest: route.intent === 'cheapest_option',
      })

      const planResult = adapters.getLastPlanResult()
      const response = buildOrchestratorResponse({
        intent: route.intent,
        locale,
        userText: input.userText,
        memory: enrichedMemory,
        toolResults: finalResults,
        recommendations,
        planResult,
        usedFallback,
      })

      const observability = obs.build({
        selectedTools: flattenTools(decision.waves),
        startedAt: started,
        plannerDecisions: decision,
        fallbackReasons,
        errors,
        parallelWaves: decision.waves.filter((w) => w.parallel).length,
      })

      return {
        intent: route.intent,
        text: response.text,
        structured: response.structured,
        planResult,
        recommendations,
        toolResults: finalResults,
        observability,
        uiMeta: response.uiMeta,
        usedFallback,
      }
    },
  }
}

function mergeUniqueTools(results: ToolExecutionResult[]): ToolExecutionResult[] {
  const map = new Map<OrchestratorToolId, ToolExecutionResult>()
  for (const row of results) map.set(row.tool, row)
  return [...map.values()]
}

function guessDestination(userText: string): string | null {
  const known: Array<{ match: RegExp; label: string }> = [
    { match: /\bmorocco\b|marrakech|casablanca|المغرب/i, label: 'Morocco' },
    { match: /\bjapan\b|tokyo|اليابان/i, label: 'Japan' },
    { match: /\bdubai\b|دبي/i, label: 'Dubai' },
    { match: /\bparis\b|باريس/i, label: 'Paris' },
    { match: /\blondon\b|لندن/i, label: 'London' },
  ]
  for (const row of known) {
    if (row.match.test(userText)) return row.label
  }
  return null
}

/** Test helper — empty memory when Sprint 28 engine is disabled. */
export function createEmptyOrchestratorMemory() {
  return emptySnapshot()
}
