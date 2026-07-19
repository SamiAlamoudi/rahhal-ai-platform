/**
 * Sprint 28 — Memory & Context Engine facade.
 * Wires ConversationMemoryService, UserPreferenceStore, MemoryExtractor,
 * ContextAssembler, and ConversationSummarizer into one turn API.
 */

import type { BrainLocale, TravelIntent } from '../types'
import { ContextAssembler } from './contextAssembler'
import {
  ConversationMemoryService,
  getConversationMemoryService,
  resetConversationMemoryService,
  type ConversationMemoryServiceHandle,
} from './conversationMemoryService'
import { ConversationSummarizer } from './conversationSummarizer'
import { applyEnrichedPatch, ensureEnriched } from './enrichedMemory'
import { isBrainContextMemoryEnabled } from './feature'
import { MemoryExtractor } from './memoryExtractor'
import {
  getUserPreferenceStore,
  resetUserPreferenceStore,
  UserPreferenceStore,
  type UserPreferenceStoreHandle,
} from './userPreferenceStore'
import type {
  AssembledContext,
  MemoryEngineTurnResult,
  MemoryExpirationPolicy,
  ShortTermMemoryState,
} from './types'

export type MemoryContextEngineOptions = {
  enabled?: boolean
  policy?: Partial<MemoryExpirationPolicy>
  personalizationAllowed?: boolean
  allowSensitiveRetention?: boolean
  shortTerm?: ConversationMemoryServiceHandle
  longTerm?: UserPreferenceStoreHandle
  now?: () => number
}

export type MemoryContextEngineHandle = {
  runTurn: (input: {
    conversationId: string
    userText: string
    locale?: BrainLocale
    userId?: string | null
    intent?: TravelIntent | null
    /** Persist long-term patches from this turn. */
    persistLongTerm?: boolean
  }) => MemoryEngineTurnResult
  assembleOnly: (input: {
    conversationId: string
    userText?: string
    locale?: BrainLocale
    userId?: string | null
    intent?: TravelIntent | null
  }) => AssembledContext | null
  getShortTerm: (conversationId: string) => ShortTermMemoryState | null
  getLongTerm: (userId: string | null | undefined) => ReturnType<UserPreferenceStoreHandle['get']>
  seedFromBrainMemory: (input: {
    conversationId: string
    userId?: string | null
    locale?: BrainLocale
    memory: import('../types').ConversationMemory
  }) => ShortTermMemoryState
  clear: (conversationId?: string, userId?: string) => void
  isEnabled: () => boolean
}

/**
 * Factory for the Conversation Memory & Context Engine.
 */
export function MemoryContextEngine(
  options: MemoryContextEngineOptions = {},
): MemoryContextEngineHandle {
  const enabled =
    typeof options.enabled === 'boolean'
      ? options.enabled
      : isBrainContextMemoryEnabled()

  const shortTerm =
    options.shortTerm ??
    ConversationMemoryService({ policy: options.policy, now: options.now })
  const longTerm =
    options.longTerm ??
    UserPreferenceStore({
      policy: options.policy,
      personalizationAllowed: options.personalizationAllowed,
      allowSensitiveRetention: options.allowSensitiveRetention,
      now: options.now,
    })
  const summarizer = ConversationSummarizer({
    policy: options.policy,
    locale: 'en',
  })
  const assembler = ContextAssembler()

  return {
    isEnabled: () => enabled,

    seedFromBrainMemory(input) {
      const state = shortTerm.getOrCreate({
        conversationId: input.conversationId,
        userId: input.userId,
        locale: input.locale,
      })
      const enriched = ensureEnriched(input.memory)
      return shortTerm.save({
        ...state,
        memory: applyEnrichedPatch(state.memory, enriched),
        userId: input.userId ?? state.userId,
      })
    },

    getShortTerm(conversationId) {
      return shortTerm.get(conversationId)
    },

    getLongTerm(userId) {
      return longTerm.get(userId)
    },

    clear(conversationId, userId) {
      if (conversationId) shortTerm.clear(conversationId)
      else shortTerm.clear()
      if (userId) longTerm.clear(userId)
    },

    assembleOnly(input) {
      if (!enabled) return null
      const st = shortTerm.get(input.conversationId)
      if (!st) return null
      const lt = longTerm.get(input.userId ?? st.userId)
      return assembler.assemble({
        conversationId: input.conversationId,
        userId: input.userId ?? st.userId,
        locale: input.locale,
        currentMessage: input.userText ?? '',
        shortTerm: st,
        previousState: st,
        longTerm: lt,
        intent: input.intent,
      })
    },

    runTurn(input) {
      const locale = input.locale ?? 'ar'
      const previousState = shortTerm.get(input.conversationId)

      if (!enabled) {
        const empty = shortTerm.getOrCreate({
          conversationId: input.conversationId,
          userId: input.userId,
          locale,
        })
        return {
          context: assembler.assemble({
            conversationId: input.conversationId,
            userId: input.userId,
            locale,
            currentMessage: input.userText,
            shortTerm: empty,
            previousState,
            longTerm: null,
            intent: input.intent ?? 'GeneralConversation',
          }),
          extraction: {
            sessionPatch: {},
            longTermPatch: {},
            entities: {},
            explicitSensitiveDisclosure: false,
          },
          shortTerm: empty,
          longTerm: null,
          summary: null,
          summarized: false,
          expired: false,
          followUpQuestions: [],
          missingSlots: [],
        }
      }

      shortTerm.purgeExpired()
      longTerm.purgeExpired()

      let state = shortTerm.getOrCreate({
        conversationId: input.conversationId,
        userId: input.userId,
        locale,
      })
      if (input.userId && !state.userId) {
        state = shortTerm.save({ ...state, userId: input.userId })
      }

      const extraction = MemoryExtractor({
        text: input.userText,
        locale,
      })

      state = shortTerm.updateMemory(
        input.conversationId,
        extraction.sessionPatch,
      )!
      state = shortTerm.appendTurn({
        conversationId: input.conversationId,
        role: 'user',
        content: input.userText,
        intent: input.intent ?? null,
      })!

      let summarized = false
      let summary = state.summary
      if (summarizer.shouldSummarize(state.turnCount, state.summary)) {
        const result = summarizer.summarize({
          conversationId: input.conversationId,
          history: state.history,
          memory: state.memory,
          locale,
          previousSummary: state.summary,
        })
        state = shortTerm.setSummary(
          input.conversationId,
          result.summary,
          result.recentHistory,
        )!
        summary = result.summary
        summarized = true
      }

      let longTermProfile = longTerm.get(input.userId ?? state.userId)
      if (
        input.persistLongTerm !== false &&
        (input.userId || state.userId) &&
        Object.keys(extraction.longTermPatch).length > 0
      ) {
        const uid = (input.userId || state.userId)!
        if (extraction.explicitSensitiveDisclosure) {
          longTermProfile = longTerm.merge(uid, {
            ...extraction.longTermPatch,
            allowSensitiveRetention: true,
          })
        } else {
          longTermProfile = longTerm.merge(uid, extraction.longTermPatch)
        }
      }

      const context = assembler.assemble({
        conversationId: input.conversationId,
        userId: input.userId ?? state.userId,
        locale,
        currentMessage: input.userText,
        shortTerm: state,
        previousState,
        longTerm: longTermProfile,
        intent: input.intent ?? 'GeneralConversation',
      })

      state = shortTerm.setFollowUps(
        input.conversationId,
        context.missingSlots,
        context.followUpQuestions,
      )!

      return {
        context: {
          ...context,
          shortTerm: state,
          followUpQuestions: context.followUpQuestions,
          missingSlots: context.missingSlots,
        },
        extraction,
        shortTerm: state,
        longTerm: longTermProfile,
        summary,
        summarized,
        expired: false,
        followUpQuestions: context.followUpQuestions,
        missingSlots: context.missingSlots,
      }
    },
  }
}

const handles = new Map<string, MemoryContextEngineHandle>()

export function getOrCreateMemoryContextEngine(
  key = 'default',
  options?: MemoryContextEngineOptions,
): MemoryContextEngineHandle {
  const existing = handles.get(key)
  if (existing) return existing
  const created = MemoryContextEngine(options)
  handles.set(key, created)
  return created
}

export function resetMemoryContextEngine(): void {
  handles.clear()
  resetConversationMemoryService()
  resetUserPreferenceStore()
}

/** Shared defaults used by orchestrator integration. */
export function getSharedMemoryServices(options?: MemoryContextEngineOptions): {
  shortTerm: ConversationMemoryServiceHandle
  longTerm: UserPreferenceStoreHandle
} {
  return {
    shortTerm: options?.shortTerm ?? getConversationMemoryService({
      policy: options?.policy,
      now: options?.now,
    }),
    longTerm: options?.longTerm ?? getUserPreferenceStore({
      policy: options?.policy,
      personalizationAllowed: options?.personalizationAllowed,
      allowSensitiveRetention: options?.allowSensitiveRetention,
      now: options?.now,
    }),
  }
}
