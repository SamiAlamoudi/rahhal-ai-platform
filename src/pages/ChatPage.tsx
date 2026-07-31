import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ConversationSidebar from '../components/chat/ConversationSidebar'
import MessageBubble from '../components/chat/MessageBubble'
import LiveNotificationsBanner from '../components/chat/experience/LiveNotificationsBanner'
import VirtualizedMessageList from '../components/chat/experience/VirtualizedMessageList'
import { ChatWelcome } from '../components/premium'
import { ProductAppBar } from '../components/productUx'
import { VoiceStateBadge } from '../components/productUx/chat/VoiceStateBadge'
import { SuggestedReplies } from '../components/productUx/chat/SuggestedReplies'
import { isUiNewExperienceEnabled, productCopy } from '../lib/productUx'
import { setVoiceMeterLevel } from '../lib/chat/voice/voiceMeterStore'
import { useVoiceMeterLevel } from '../lib/chat/voice/useVoiceMeterLevel'

/** RC-2 — voice UI loads only when the user switches to voice mode. */
const VoicePanelLazy = lazy(() =>
  import('../components/premium/VoicePanel').then((m) => ({ default: m.VoicePanel })),
)
const VoiceComposerLazy = lazy(() => import('../components/chat/VoiceComposer'))

/** Sprint 80 P1-5 — level ticks stay inside these leaves, not LegacyChatPage. */
function VoicePanel(props: Omit<ComponentProps<typeof VoicePanelLazy>, 'level'>) {
  const level = useVoiceMeterLevel()
  return <VoicePanelLazy {...props} level={level} />
}

function VoiceComposer(props: Omit<ComponentProps<typeof VoiceComposerLazy>, 'level'>) {
  const level = useVoiceMeterLevel()
  return <VoiceComposerLazy {...props} level={level} />
}

import { travelAgentService } from '../lib/agent/travelAgentService'
import { detectAgentLocale } from '../lib/agent/locale'
import type { TripPlan } from '../lib/agent/types'
import { chatEngine } from '../lib/chat/chatEngine'
import { CHAT_ATTACHMENTS_ENABLED, uploadChatAttachment } from '../lib/chat/chatAttachments'
import { validateConversationTitle, validateUserMessage } from '../lib/chat/chatHelpers'
import { isBenignChatError, logChatError } from '../lib/chat/chatLogger'
import { userFacingErrorMessage } from '../lib/chat/pipelineDiagnostics'
import {
  buildChatSearch,
  resolveInitialConversationId,
  writeStoredConversationId,
} from '../lib/chat/chatRecovery'
import { createDeltaCoalescer } from '../lib/chat/streamUi'
import type { ChatConversation, ChatMessage } from '../lib/chat/chatTypes'
import {
  buildConversationTimeline,
  chatThemeClassName,
  createConversationBookingBridge,
  enrichPlanForBooking,
  extractConversationUiMeta,
  getConversationLiveNotificationBus,
  isConversationExperienceEnabled,
  readStoredChatTheme,
  resolveChatTheme,
  writeStoredChatTheme,
  type ChatThemeMode,
  type ConversationBookingAction,
  type ConversationBookingState,
  type ConversationLiveEvent,
  type ConversationTimelineEvent,
} from '../lib/chat/conversationExperienceUi'
import type { CreateVoiceSessionOptions, VoiceSession } from '../lib/chat/voice/voiceSession'
import type { VoiceInputMode, VoiceLocale, VoiceSessionStatus } from '../lib/chat/voice/voiceTypes'
import {
  EXPERIENCE_STATE_LABELS,
  isChatGptExperienceEnabled,
  readSessionUiRecovery,
  togglePinnedConversation,
  writeSessionUiRecovery,
  type ChatGptExperienceState,
} from '../lib/chat/chatgptExperience'

/**
 * Recovery Phase 1 — ONE Chat UI.
 * ProductionConversationScreen remains in `src/ui/integration` (quarantined) but is
 * disconnected from routing. Default path is always LegacyChatPage → chatEngine → planTurn.
 */

type ComposerMode = 'text' | 'voice'

/** RC-2 — voice stack (STT/TTS/session) is dynamically imported on first voice use. */
async function buildVoiceSession(
  callbacks: CreateVoiceSessionOptions['callbacks'],
): Promise<VoiceSession> {
  const [{ createSpeechToTextProvider, createTextToSpeechProvider }, { createVoiceSession }] =
    await Promise.all([
      import('../lib/chat/voice/voiceProviderFactory'),
      import('../lib/chat/voice/voiceSession'),
    ])
  return createVoiceSession({
    stt: createSpeechToTextProvider(),
    tts: createTextToSpeechProvider(),
    callbacks,
  })
}

export default function ChatPage() {
  return <LegacyChatPage />
}

function LegacyChatPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [composerMode, setComposerMode] = useState<ComposerMode>('voice')
  const [voiceStatus, setVoiceStatus] = useState<VoiceSessionStatus>('idle')
  const [voiceMode, setVoiceMode] = useState<VoiceInputMode>('hands_free')
  const [voiceLocale, setVoiceLocale] = useState<VoiceLocale>('ar')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported' | null>(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [themePreference, setThemePreference] = useState<ChatThemeMode | 'system'>(() => readStoredChatTheme())
  const [theme, setTheme] = useState<ChatThemeMode>(() => resolveChatTheme(readStoredChatTheme()))
  const [liveEvents, setLiveEvents] = useState<ConversationLiveEvent[]>([])
  const [bookingState, setBookingState] = useState<ConversationBookingState | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)
  const seedConsumedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const voiceRef = useRef<VoiceSession | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const streamingRef = useRef(false)
  const detailRequestRef = useRef(0)
  const bookingBridgeRef = useRef(createConversationBookingBridge())
  const experienceEnabled = isConversationExperienceEnabled()
  const chatgptOn = isChatGptExperienceEnabled()
  const [experienceState, setExperienceState] = useState<ChatGptExperienceState>('idle')
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readSessionUiRecovery()?.pinnedIds ?? [])
  const stickToBottomRef = useRef(true)

  // RC-2 — warm agent impl during idle so first planTurn avoids a cold dynamic import.
  useEffect(() => {
    const warm = () => {
      void import('../lib/agent/travelAgentService.impl')
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(warm, { timeout: 2500 })
      return () => cancelIdleCallback(id)
    }
    const timer = window.setTimeout(warm, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  const filtered = useMemo(
    () => chatEngine.searchConversations(conversations, query),
    [conversations, query],
  )

  const chatLocale = useMemo(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    return detectAgentLocale(lastUser?.content ?? '', 'ar')
  }, [messages])

  const isStreaming = messages.some((m) => m.status === 'streaming') || sending
  const voiceBusy =
    voiceStatus === 'processing'
    || voiceStatus === 'thinking'
    || voiceStatus === 'responding'
    || voiceStatus === 'speaking'
    || voiceStatus === 'reconnecting'
  streamingRef.current = isStreaming || voiceBusy

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const applyMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id)
      if (idx === -1) return [...prev, message]
      const next = [...prev]
      next[idx] = message
      return next
    })
  }, [])

  const coalescerRef = useRef(createDeltaCoalescer(applyMessage))

  useEffect(() => {
    coalescerRef.current = createDeltaCoalescer(applyMessage)
    return () => coalescerRef.current.dispose()
  }, [applyMessage])

  const upsertMessage = useCallback((message: ChatMessage) => {
    const state = message.providerMeta?.experienceState
    if (typeof state === 'string') setExperienceState(state as ChatGptExperienceState)
    if (message.status === 'streaming') coalescerRef.current.push(message)
    else {
      coalescerRef.current.flushNow()
      applyMessage(message)
      if (message.status === 'complete') setExperienceState('done')
      if (message.status === 'error' || message.status === 'cancelled') setExperienceState('error')
    }
  }, [applyMessage])

  const selectConversation = useCallback((id: string | null) => {
    setActiveId(id)
    writeStoredConversationId(id)
    const nextSearch = buildChatSearch(id, location.search)
    if (nextSearch !== location.search) {
      navigate({ pathname: '/chat', search: nextSearch }, { replace: true })
    }
  }, [location.search, navigate])

  const loadConversations = useCallback(async (preferId?: string | null) => {
    setListLoading(true)
    setListError(null)
    try {
      const rows = await chatEngine.listConversations()
      setConversations(rows)
      const ids = rows.map((r) => r.id)
      const currentSearch = typeof window !== 'undefined' ? window.location.search : ''
      const nextId = preferId && ids.includes(preferId)
        ? preferId
        : resolveInitialConversationId({
          search: currentSearch,
          availableIds: ids,
        })
      writeStoredConversationId(nextId)
      if (nextId !== activeIdRef.current) {
        setActiveId(nextId)
      } else if (!activeIdRef.current) {
        setActiveId(nextId)
      }
      const nextSearch = buildChatSearch(nextId, currentSearch)
      if (nextSearch !== currentSearch) {
        navigate({ pathname: '/chat', search: nextSearch }, { replace: true })
      }
    } catch (e) {
      logChatError('chat.list', e)
      setListError(userFacingErrorMessage(e, 'تعذر تحميل المحادثات'))
      setConversations([])
    } finally {
      setListLoading(false)
    }
  }, [navigate])

  const loadDetail = useCallback(async (id: string) => {
    // Avoid wiping in-flight streamed messages with a stale empty detail response.
    if (streamingRef.current) return
    const requestId = ++detailRequestRef.current
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await chatEngine.getConversationDetail(id)
      if (requestId !== detailRequestRef.current || activeIdRef.current !== id) return
      if (streamingRef.current) return
      setMessages(detail.messages)
      setConversations((prev) =>
        prev.map((c) => (c.id === detail.conversation.id ? detail.conversation : c)),
      )
    } catch (e) {
      if (requestId !== detailRequestRef.current || activeIdRef.current !== id) return
      logChatError('chat.detail', e)
      setDetailError(userFacingErrorMessage(e, 'تعذر تحميل المحادثة'))
      setMessages([])
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const recovered = readSessionUiRecovery()
    if (!recovered) return
    if (recovered.draft) setDraft(recovered.draft)
    if (recovered.modality === 'voice' || recovered.modality === 'text') setComposerMode(recovered.modality)
    setVoiceMode(recovered.voiceMode)
    setVoiceLocale(recovered.voiceLocale)
    setPinnedIds(recovered.pinnedIds)
  }, [])

  useEffect(() => {
    writeSessionUiRecovery({
      conversationId: activeId,
      draft,
      modality: composerMode,
      voiceMode,
      voiceLocale,
      pinnedIds,
    })
  }, [activeId, draft, composerMode, voiceMode, voiceLocale, pinnedIds])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    writeStoredConversationId(activeId)
    void loadDetail(activeId)
  }, [activeId, loadDetail])

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(!streamingRef.current)
  }, [messages, partialTranscript, scrollToBottom])

  useEffect(() => {
    if (!chatgptOn) return
    const map: Partial<Record<VoiceSessionStatus, ChatGptExperienceState>> = {
      listening: 'listening',
      processing: 'understanding',
      thinking: 'thinking',
      responding: 'responding',
      speaking: 'speaking',
      idle: 'idle',
      error: 'error',
    }
    const next = map[voiceStatus]
    if (next) setExperienceState(next)
  }, [chatgptOn, voiceStatus])

  const handleTogglePin = useCallback((id: string) => {
    setPinnedIds(togglePinnedConversation(id))
  }, [])

  const handleRegenerate = async (assistantMessageId: string) => {
    if (!activeId || isStreaming || voiceBusy || !online) return
    await runGeneration(async (handlers) => {
      const updated = await chatEngine.retryAssistantMessage(activeId, assistantMessageId, handlers)
      upsertMessage(updated)
    })
  }

  const handleEditUserMessage = (messageId: string, content: string) => {
    if (isStreaming || voiceBusy) return
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId)
      if (idx === -1) return prev
      return prev.slice(0, idx)
    })
    setDraft(content)
    setComposerMode('text')
    setExperienceState('idle')
  }

  const handleContinueGenerating = async () => {
    if (!activeId || isStreaming || voiceBusy || !online) return
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!last || (last.status !== 'cancelled' && last.status !== 'complete')) return
    await runGeneration(async (handlers) => {
      const result = await chatEngine.sendMessage({
        conversationId: activeId,
        content: 'Please continue from where you left off.',
        modality: 'text',
      }, handlers)
      setMessages((prev) => {
        const withoutAssistant = prev.filter((m) => m.id !== result.assistant.id)
        return [...withoutAssistant, result.user, result.assistant]
      })
    })
  }

  const canContinue = useMemo(() => {
    if (!chatgptOn || isStreaming || voiceBusy) return false
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!last) return false
    if (last.status === 'cancelled') return true
    const text = last.content.trim()
    return text.length > 40 && !/[.!?…。؟]$/.test(text)
  }, [chatgptOn, isStreaming, voiceBusy, messages])

  const experienceStatusLabel = useMemo(() => {
    if (!chatgptOn) return null
    if (experienceState === 'idle' || experienceState === 'done') return null
    return EXPERIENCE_STATE_LABELS[experienceState]?.en ?? experienceState
  }, [chatgptOn, experienceState])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void loadConversations(activeIdRef.current)
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadConversations])

  useEffect(() => {
    if (composerMode !== 'voice') return
    let unsubscribe = () => {}
    let cancelled = false
    void import('../lib/chat/voice/microphonePermission').then(({ subscribeMicrophonePermission }) => {
      if (cancelled) return
      void subscribeMicrophonePermission((state) => {
        setPermissionState(state.state)
        if (state.state === 'granted') setMicError(null)
      }).then((fn) => {
        if (!cancelled) unsubscribe = fn
        else fn()
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [composerMode])

  useEffect(() => {
    if (composerMode !== 'voice') {
      if (voiceRef.current) {
        voiceRef.current.dispose()
        voiceRef.current = null
      }
      return
    }
    let disposed = false
    let session: VoiceSession | null = null
    void buildVoiceSession({
      onStatus: setVoiceStatus,
      onPartialTranscript: setPartialTranscript,
      onFinalTranscript: setPartialTranscript,
      onLevel: setVoiceMeterLevel,
      onPermission: (state) => {
        setPermissionState(state.state)
        if (state.state !== 'granted') setMicError(state.error || 'يلزم إذن الميكروفون')
        else setMicError(null)
      },
      onError: (error) => {
        if (!isBenignChatError(error)) setActionError(error)
      },
      onAssistantCreate: upsertMessage,
      onDelta: upsertMessage,
      onComplete: (message) => {
        upsertMessage(message)
        void loadConversations(activeIdRef.current)
      },
      onStreamError: (message, error) => {
        upsertMessage(message)
        if (!isBenignChatError(error)) setActionError(error)
      },
    }).then((created) => {
      if (disposed) {
        created.dispose()
        return
      }
      session = created
      voiceRef.current = created
    })
    return () => {
      disposed = true
      session?.dispose()
      if (voiceRef.current === session) voiceRef.current = null
    }
  }, [composerMode, loadConversations, upsertMessage])

  useEffect(() => {
    voiceRef.current?.setLocale(voiceLocale)
  }, [voiceLocale])

  useEffect(() => {
    voiceRef.current?.setMode(voiceMode)
  }, [voiceMode])

  useEffect(() => {
    if (!mobileSidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileSidebarOpen])

  // Phase 3 — Esc stops speaking / cancels in-flight voice or streaming reply.
  const voiceBusyRef = useRef(false)
  const isStreamingRef = useRef(false)
  voiceBusyRef.current = voiceBusy
  isStreamingRef.current = isStreaming
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (voiceBusyRef.current || isStreamingRef.current) {
        e.preventDefault()
        stopGeneration()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleCreate = async () => {
    setActionError(null)
    try {
      const created = await chatEngine.createConversation()
      setConversations((prev) => [created, ...prev])
      selectConversation(created.id)
      setMessages([])
      setMobileSidebarOpen(false)
    } catch (e) {
      logChatError('chat.create', e)
      setActionError(userFacingErrorMessage(e, 'تعذر إنشاء المحادثة'))
    }
  }

  const handleRename = async (id: string) => {
    const current = conversations.find((c) => c.id === id)
    const nextTitle = window.prompt('عنوان المحادثة', current?.title ?? '')
    if (nextTitle == null) return
    const validation = validateConversationTitle(nextTitle)
    if (validation) {
      setActionError(validation)
      return
    }
    setActionError(null)
    try {
      const renamed = await chatEngine.renameConversation(id, nextTitle)
      setConversations((prev) => prev.map((c) => (c.id === id ? renamed : c)))
    } catch (e) {
      logChatError('chat.rename', e)
      setActionError(e instanceof Error ? e.message : 'تعذر إعادة التسمية')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف هذه المحادثة وجميع رسائلها؟')) return
    setActionError(null)
    try {
      await chatEngine.deleteConversation(id)
      const remaining = conversations.filter((c) => c.id !== id)
      setConversations(remaining)
      if (activeId === id) {
        selectConversation(remaining[0]?.id ?? null)
        setMessages([])
      }
    } catch (e) {
      logChatError('chat.delete', e)
      setActionError(e instanceof Error ? e.message : 'تعذر حذف المحادثة')
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
    if (chatgptOn) setExperienceState('done')
    voiceRef.current?.interrupt(() => {
      abortRef.current?.abort()
    }, { resumeHandsFree: voiceMode === 'hands_free' })
  }

  const runGeneration = async (
    runner: (handlers: {
      signal: AbortSignal
      onAssistantCreate?: (message: ChatMessage) => void
      onDelta?: (message: ChatMessage) => void
      onComplete?: (message: ChatMessage) => void
      onError?: (message: ChatMessage, error: string) => void
    }) => Promise<unknown>,
  ) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSending(true)
    setActionError(null)
    try {
      await runner({
        signal: controller.signal,
        onAssistantCreate: upsertMessage,
        onDelta: upsertMessage,
        onComplete: (message) => {
          upsertMessage(message)
          void loadConversations(activeId)
        },
        onError: (message, error) => {
          upsertMessage(message)
          if (!isBenignChatError(error)) setActionError(error)
        },
      })
    } catch (e) {
      if (!isBenignChatError(e)) {
        logChatError('chat.send', e)
        setActionError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة')
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setSending(false)
    }
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeId || isStreaming || voiceBusy || !online) return
    const validation = validateUserMessage(draft)
    if (validation) {
      setActionError(validation)
      return
    }
    const content = draft
    setDraft('')
    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversationId: activeId,
        role: 'user',
        modality: 'text',
        content: content.trim(),
        audioUrl: null,
        imageUrl: null,
        attachments: [],
        status: 'complete',
        error: null,
        providerMeta: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    await runGeneration(async (handlers) => {
      const result = await chatEngine.sendMessage({
        conversationId: activeId,
        content,
        modality: 'text',
      }, handlers)
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId && m.id !== result.assistant.id)
        return [...withoutTemp, result.user, result.assistant]
      })
    })
  }

  const handleRetry = async (assistantMessageId: string) => {
    if (!activeId || isStreaming || voiceBusy || !online) return
    await runGeneration(async (handlers) => {
      const updated = await chatEngine.retryAssistantMessage(activeId, assistantMessageId, handlers)
      upsertMessage(updated)
    })
  }

  const handleAttachImage = async () => {
    if (!activeId) return
    if (!CHAT_ATTACHMENTS_ENABLED) {
      setActionError('مرفقات الصور جاهزة معمارياً وستُفعَّل بعد تجهيز التخزين')
      return
    }
    const result = await uploadChatAttachment({
      conversationId: activeId,
      fileName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
    })
    if (!result.ready) setActionError(result.reason ?? 'تعذر رفع الصورة')
  }

  const sendAgentCommand = async (content: string) => {
    if (!activeId || isStreaming || voiceBusy || !online) return
    setDraft('')
    await runGeneration(async (handlers) => {
      const result = await chatEngine.sendMessage({
        conversationId: activeId,
        content,
        modality: 'text',
      }, handlers)
      setMessages((prev) => {
        const withoutAssistant = prev.filter((m) => m.id !== result.assistant.id)
        return [...withoutAssistant, result.user, result.assistant]
      })
    })
  }

  useEffect(() => {
    const resolved = resolveChatTheme(themePreference)
    setTheme(resolved)
    writeStoredChatTheme(themePreference)
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.chatTheme = resolved
    }
  }, [themePreference])

  useEffect(() => {
    if (!experienceEnabled) return
    return getConversationLiveNotificationBus().subscribe(setLiveEvents)
  }, [experienceEnabled])

  const timelineEvents = useMemo<ConversationTimelineEvent[]>(() => {
    if (!experienceEnabled) return []
    return buildConversationTimeline({
      trips: bookingState?.trip ? [bookingState.trip] : [],
      executionTimeline: bookingState?.execution?.session.timeline ?? [],
      bookingReference: bookingState?.execution?.summary.references.bookingReference ?? null,
      paid: Boolean(bookingState?.paymentResult?.success),
    })
  }, [experienceEnabled, bookingState])

  const latestStructuredMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const meta = extractConversationUiMeta(messages[i].providerMeta)
      if (meta.structured) return messages[i]
    }
    return null
  }, [messages])

  const handleBookingAction = async (action: ConversationBookingAction) => {
    if (!activeId || bookingBusy) return
    setBookingBusy(true)
    setActionError(null)
    try {
      const bridge = bookingBridgeRef.current
      if (action === 'reserve') {
        const plan = enrichPlanForBooking(
          extractConversationUiMeta(latestStructuredMessage?.providerMeta).structured,
        )
        if (!plan) {
          setActionError('No itinerary available to reserve')
          return
        }
        const next = await bridge.reserve({
          conversationId: activeId,
          selectedItinerary: plan,
          locale: 'ar',
        })
        setBookingState(next)
        if (next.execution?.summary.success) {
          getConversationLiveNotificationBus().publish({
            kind: 'supplier_confirmed',
            title: 'Supplier confirmed',
            body: next.message,
            tripId: next.execution.session.context.tripId,
          })
        }
        return
      }
      if (!bookingState && action !== 'view_documents' && action !== 'open_trip') {
        setActionError('Reserve a recommendation first')
        return
      }
      const current = bookingState ?? {
        execution: null,
        paymentSession: null,
        paymentResult: null,
        trip: null,
        lastAction: null,
        message: '',
      }
      if (action === 'pay') {
        const next = await bridge.pay(current)
        setBookingState(next)
        if (next.paymentResult?.success) {
          getConversationLiveNotificationBus().publish({
            kind: 'documents_issued',
            title: 'Payment received',
            body: next.message,
            tripId: next.trip?.tripId,
          })
        }
        return
      }
      if (action === 'cancel') {
        setBookingState(await bridge.cancel(current))
        return
      }
      if (action === 'refund') {
        const next = await bridge.refund(current)
        setBookingState(next)
        if (next.lastAction === 'refund') {
          getConversationLiveNotificationBus().publish({
            kind: 'refund_processed',
            title: 'Refund update',
            body: next.message,
            tripId: next.trip?.tripId,
          })
        }
        return
      }
      if (action === 'view_documents') {
        const docs = bridge.viewDocuments(current)
        setActionError(
          docs.documents.length
            ? docs.documents.map((d) => `${d.label}: ${d.uri}`).join(' · ')
            : 'No documents yet — pay to issue trip documents',
        )
        return
      }
      if (action === 'open_trip') {
        const trip = bridge.openTrip(current)
        if (trip) {
          navigate('/my-trips')
        } else {
          setActionError('No trip record yet — complete pay to open My Trip')
        }
      }
    } catch (e) {
      logChatError('chat.booking_action', e)
      setActionError(e instanceof Error ? e.message : 'Booking action failed')
    } finally {
      setBookingBusy(false)
    }
  }

  const cycleTheme = () => {
    const order: Array<ChatThemeMode | 'system'> = ['light', 'dark', 'high_contrast', 'system']
    const idx = order.indexOf(themePreference)
    setThemePreference(order[(idx + 1) % order.length])
  }

  // Sprint 16 — seed conversation from AI Home (location.state.seedMessage or ?seed=)
  useEffect(() => {
    if (seedConsumedRef.current || listLoading || !online) return
    const state = location.state as { seedMessage?: string; tripText?: string } | null
    const stateSeed = state?.seedMessage ?? state?.tripText
    const querySeed = new URLSearchParams(location.search).get('seed')
    const seed = (stateSeed || querySeed || '').trim()
    if (!seed) return

    seedConsumedRef.current = true

    void (async () => {
      try {
        const created = await chatEngine.createConversation()
        setConversations((prev) => [created, ...prev])
        selectConversation(created.id)
        navigate({ pathname: '/chat', search: buildChatSearch(created.id, '') }, { replace: true, state: {} })
        setDraft('')
        await runGeneration(async (handlers) => {
          const result = await chatEngine.sendMessage({
            conversationId: created.id,
            content: seed,
            modality: 'text',
          }, handlers)
          setMessages((prev) => {
            const withoutAssistant = prev.filter((m) => m.id !== result.assistant.id)
            return [...withoutAssistant, result.user, result.assistant]
          })
        })
      } catch (e) {
        logChatError('chat.seed', e)
        setActionError(e instanceof Error ? e.message : 'تعذر بدء المحادثة')
      }
    })()
    // Seed is one-shot (seedConsumedRef). Do not re-run on navigate clearing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after list load
  }, [listLoading, online])

  const handleSaveItinerary = async (itinerary: TripPlan) => {
    setActionError(null)
    try {
      const saved = await travelAgentService.savePlan({
        conversationId: itinerary.conversationId,
        tripPlan: itinerary,
      })
      window.alert(
        itinerary.locale === 'en'
          ? `Saved “${saved.title}” to Saved Trips.`
          : `تم حفظ «${saved.title}» في الرحلات المحفوظة.`,
      )
    } catch (e) {
      logChatError('agent.save', e)
      setActionError(e instanceof Error ? e.message : 'تعذر حفظ الخطة')
    }
  }

  const handleRegenerateItinerary = async (messageId: string) => {
    if (!activeId || isStreaming || voiceBusy || !online) return
    await runGeneration(async (handlers) => {
      // Prefer an explicit regenerate turn so conversation memory stays intact.
      const result = await chatEngine.sendMessage({
        conversationId: activeId,
        content: 'Regenerate the itinerary with the same requirements',
        modality: 'text',
      }, handlers)
      setMessages((prev) => [...prev.filter((m) => m.id !== result.assistant.id), result.user, result.assistant])
      void messageId
    })
  }

  const handleRegenerateDay = async (messageId: string, day: number) => {
    if (!activeId || isStreaming || voiceBusy || !online) return
    await runGeneration(async (handlers) => {
      const result = await chatEngine.sendMessage({
        conversationId: activeId,
        content: `Regenerate day ${day}`,
        modality: 'text',
      }, handlers)
      setMessages((prev) => [...prev.filter((m) => m.id !== result.assistant.id), result.user, result.assistant])
      void messageId
    })
  }

  const handlePushStart = async () => {
    if (!activeId || !online) return
    setActionError(null)
    try {
      await voiceRef.current?.startPushToTalk()
    } catch (e) {
      logChatError('voice.ptt.start', e)
      setActionError(e instanceof Error ? e.message : 'تعذر بدء الاستماع')
    }
  }

  const handlePushEnd = async () => {
    if (!activeId) return
    setSending(true)
    try {
      await voiceRef.current?.stopPushToTalkAndSend(activeId)
      void loadConversations(activeId)
    } catch (e) {
      if (!isBenignChatError(e)) {
        logChatError('voice.ptt.send', e)
        setActionError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة الصوتية')
      }
    } finally {
      setSending(false)
    }
  }

  const handleToggleHandsFree = async () => {
    if (!activeId || !voiceRef.current) return
    setActionError(null)
    if (voiceStatus === 'listening' && voiceMode === 'hands_free') {
      await voiceRef.current.stopListening()
      return
    }
    try {
      voiceRef.current.setMode('hands_free')
      setVoiceMode('hands_free')
      await voiceRef.current.startHandsFree(activeId)
    } catch (e) {
      logChatError('voice.handsfree', e)
      setActionError(e instanceof Error ? e.message : 'تعذر تشغيل حر اليدين')
    }
  }

  const newExperienceOn = isUiNewExperienceEnabled()
  const voiceUiState =
    voiceStatus === 'listening'
      ? 'listening'
      : voiceStatus === 'thinking' || voiceStatus === 'processing'
        ? 'thinking'
        : voiceStatus === 'speaking' || voiceStatus === 'responding'
          ? 'speaking'
          : voiceStatus === 'reconnecting'
            ? 'reconnecting'
            : !online
              ? 'offline'
              : 'ready'

  const chatHeaderTrailing = (
    <div className="flex shrink-0 items-center gap-2">
      {newExperienceOn && composerMode === 'voice' ? (
        <VoiceStateBadge state={voiceUiState} locale={chatLocale} />
      ) : null}
      <button
        type="button"
        onClick={cycleTheme}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={`Theme ${themePreference}`}
        title="Light / Dark / High contrast"
      >
        {themePreference === 'system' ? 'Theme' : themePreference}
      </button>
      <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800" role="tablist" aria-label="وضع الإدخال">
        <button
          type="button"
          role="tab"
          aria-selected={composerMode === 'text'}
          onClick={() => {
            setComposerMode('text')
            voiceRef.current?.interrupt()
          }}
          className={`rounded-md px-2.5 py-1 ${composerMode === 'text' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}
        >
          كتابة
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={composerMode === 'voice'}
          onClick={() => setComposerMode('voice')}
          className={`rounded-md px-2.5 py-1 ${composerMode === 'voice' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}
        >
          صوت
        </button>
      </div>
      <button
        type="button"
        onClick={() => void handleCreate()}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700"
      >
        محادثة جديدة
      </button>
    </div>
  )

  return (
    <div className={`flex h-[100dvh] flex-col bg-gradient-to-b from-slate-50/50 via-white to-white ${chatThemeClassName(theme)}`}>
      {newExperienceOn ? (
        <ProductAppBar
          locale={chatLocale}
          title={productCopy(chatLocale, 'chatTitle')}
          subtitle={
            online
              ? productCopy(chatLocale, 'chatSubtitle')
              : chatLocale === 'ar'
                ? 'غير متصل — وضع القراءة فقط مؤقتاً'
                : 'Offline — read-only for now'
          }
          onBack={() => navigate('/')}
          backLabel={chatLocale === 'ar' ? 'رجوع' : 'Back'}
          maxWidthClassName="max-w-6xl"
          leadingExtra={
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-expanded={mobileSidebarOpen}
              aria-controls="chat-sidebar"
              onClick={() => setMobileSidebarOpen(true)}
            >
              المحادثات
            </button>
          }
          trailing={chatHeaderTrailing}
        />
      ) : (
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-expanded={mobileSidebarOpen}
              aria-controls="chat-sidebar"
              onClick={() => setMobileSidebarOpen(true)}
            >
              المحادثات
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">وكيل سفر رحّال</h1>
              <p className="text-[10px] text-slate-400">
                {online
                  ? 'محادثة طبيعية · تخطيط · حجز · دفع داخل نفس الجلسة'
                  : 'غير متصل — وضع القراءة فقط مؤقتاً'}
              </p>
            </div>
          </div>
          {chatHeaderTrailing}
        </div>
      </header>
      )}

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1">
        <div id="chat-sidebar" className="contents">
          <ConversationSidebar
            conversations={filtered}
            activeId={activeId}
            query={query}
            pinnedIds={chatgptOn ? pinnedIds : []}
            onQueryChange={setQuery}
            onSelect={(id) => selectConversation(id)}
            onCreate={() => void handleCreate()}
            onRename={(id) => void handleRename(id)}
            onDelete={(id) => void handleDelete(id)}
            onTogglePin={chatgptOn ? handleTogglePin : undefined}
            loading={listLoading}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
        </div>

        <section className="flex min-w-0 flex-1 flex-col" aria-busy={listLoading || detailLoading}>
          {experienceEnabled && liveEvents.some((e) => e.unread) && (
            <div className="mx-4 mt-4">
              <LiveNotificationsBanner
                events={liveEvents}
                onDismiss={(id) => getConversationLiveNotificationBus().markRead(id)}
                onOpenTrip={() => navigate('/my-trips')}
              />
            </div>
          )}

          {!online && (
            <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              انقطع الاتصال. يمكنك متابعة القراءة؛ الإرسال سيعود تلقائياً عند الاتصال.
            </div>
          )}

          {listError && (
            <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p>{listError}</p>
              <button type="button" onClick={() => void loadConversations(activeId)} className="mt-2 text-xs underline">
                إعادة المحاولة
              </button>
            </div>
          )}

          {actionError && (
            <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
              {actionError}
            </div>
          )}

          {experienceStatusLabel && (
            <div
              className="mx-4 mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 transition-opacity duration-300"
              role="status"
              aria-live="polite"
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" aria-hidden="true" />
              {experienceStatusLabel}
            </div>
          )}

          {!activeId && !listLoading && (
            <div className="flex flex-1 flex-col items-center justify-center px-4">
              <ChatWelcome
                locale={chatLocale}
                disabled={!online || isStreaming}
                onPrompt={(text) => {
                  void (async () => {
                    try {
                      const created = await chatEngine.createConversation()
                      setConversations((prev) => [created, ...prev])
                      selectConversation(created.id)
                      setMobileSidebarOpen(false)
                      await runGeneration(async (handlers) => {
                        const result = await chatEngine.sendMessage({
                          conversationId: created.id,
                          content: text,
                          modality: 'text',
                        }, handlers)
                        setMessages((prev) => {
                          const withoutAssistant = prev.filter((m) => m.id !== result.assistant.id)
                          return [...withoutAssistant, result.user, result.assistant]
                        })
                      })
                    } catch (e) {
                      logChatError('chat.welcome', e)
                      setActionError(userFacingErrorMessage(e, 'تعذر بدء المحادثة'))
                    }
                  })()
                }}
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                className="mt-2 min-h-11 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                إنشاء محادثة فارغة
              </button>
            </div>
          )}

          {activeId && (
            <>
              <div
                className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 ${
                  composerMode === 'voice' ? 'pb-56' : ''
                }`}
                onScroll={(e) => {
                  const el = e.currentTarget
                  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
                  stickToBottomRef.current = distance < 96
                }}
              >
                {detailLoading && (
                  <p className="py-10 text-center text-sm text-slate-400">جاري تحميل الرسائل...</p>
                )}
                {detailError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p>{detailError}</p>
                    <button
                      type="button"
                      onClick={() => activeId && void loadDetail(activeId)}
                      className="mt-2 text-xs underline"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                )}
                {!detailLoading && !detailError && messages.length === 0 && (
                  <ChatWelcome
                    locale={chatLocale}
                    disabled={!online || isStreaming}
                    onPrompt={(text) => void sendAgentCommand(text)}
                  />
                )}
                <VirtualizedMessageList
                  messages={messages}
                  renderMessage={(message) => (
                    <MessageBubble
                      message={message}
                      isStreaming={message.status === 'streaming'}
                      busy={isStreaming || voiceBusy || bookingBusy}
                      locale={chatLocale}
                      bookingState={
                        experienceEnabled && message.id === latestStructuredMessage?.id
                          ? bookingState
                          : null
                      }
                      timelineEvents={
                        experienceEnabled && message.id === latestStructuredMessage?.id
                          ? timelineEvents
                          : []
                      }
                      onRetry={(id) => void handleRetry(id)}
                      onRegenerate={chatgptOn ? (id) => void handleRegenerate(id) : undefined}
                      onEditUserMessage={chatgptOn ? handleEditUserMessage : undefined}
                      onSaveItinerary={(itinerary) => void handleSaveItinerary(itinerary)}
                      onRegenerateItinerary={(id) => void handleRegenerateItinerary(id)}
                      onRegenerateDay={(id, day) => void handleRegenerateDay(id, day)}
                      onEditItinerary={(patchText) => void sendAgentCommand(patchText)}
                      onSmartAction={(hint) => void sendAgentCommand(hint)}
                      onBookingAction={(action) => void handleBookingAction(action)}
                      onOpenTimelineEvent={() => navigate('/my-trips')}
                    />
                  )}
                />
                <div ref={bottomRef} />
              </div>

              {composerMode === 'voice' && activeId ? (
                <Suspense fallback={null}>
                  <VoicePanel
                    status={voiceStatus}
                    partialTranscript={partialTranscript}
                    locale={voiceLocale === 'en' ? 'en' : 'ar'}
                    muted={voiceMuted}
                    online={online}
                    visible
                    onInterrupt={stopGeneration}
                    onStopSpeaking={stopGeneration}
                    onRestartListening={() => {
                      if (voiceMode === 'hands_free') void handleToggleHandsFree()
                      else void handlePushStart()
                    }}
                    onToggleMute={() => setVoiceMuted((v) => !v)}
                  />
                </Suspense>
              ) : null}

              <div
                className={`sticky bottom-0 border-t border-slate-100/80 bg-white/95 px-3 py-3 backdrop-blur-xl sm:px-6 ${
                  composerMode === 'voice' ? 'pb-4' : ''
                }`}
              >
                {newExperienceOn && composerMode === 'text' && activeId && !isStreaming ? (
                  <div className="mb-3">
                    <SuggestedReplies
                      locale={chatLocale}
                      disabled={!online}
                      onSelect={(text) => {
                        setDraft(text)
                      }}
                      replies={
                        chatLocale === 'ar'
                          ? ['اقترح خياراً أرخص', 'أظهر خط السير', 'وضّح الميزانية']
                          : ['Suggest a cheaper option', 'Show the itinerary', 'Explain the budget']
                      }
                    />
                  </div>
                ) : null}
                {composerMode === 'voice' ? (
                  <Suspense
                    fallback={
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        جاري تحميل الصوت…
                      </div>
                    }
                  >
                    <VoiceComposer
                      enabled={!!activeId && !isStreaming && !voiceMuted}
                      status={voiceStatus}
                      mode={voiceMode}
                      locale={voiceLocale}
                      partialTranscript={partialTranscript}
                      permissionError={micError}
                      permissionState={permissionState}
                      busy={isStreaming || voiceBusy}
                      online={online}
                      onModeChange={setVoiceMode}
                      onLocaleChange={setVoiceLocale}
                      onPushStart={() => void handlePushStart()}
                      onPushEnd={() => void handlePushEnd()}
                      onToggleHandsFree={() => void handleToggleHandsFree()}
                      onInterrupt={stopGeneration}
                      onRequestPermission={() => void voiceRef.current?.ensureMicPermission()}
                    />
                  </Suspense>
                ) : (
                  <form onSubmit={(e) => void handleSend(e)}>
                    <div className="rounded-[1.5rem] border border-slate-200/90 bg-white p-2 shadow-lg shadow-slate-900/5 sm:p-3">
                      <label className="sr-only" htmlFor="chat-draft">رسالتك</label>
                      <textarea
                        id="chat-draft"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        placeholder="حدّثني عن رحلة أحلامك…"
                        className="min-h-11 w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-base"
                        disabled={!activeId || voiceBusy || !online}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => void handleAttachImage()}
                          disabled={!activeId || isStreaming || voiceBusy}
                          title="مرفقات الصور (بنية جاهزة — التخزين لاحقاً)"
                          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
                        >
                          صورة
                        </button>
                        {(isStreaming || voiceBusy) && (
                          <button
                            type="button"
                            onClick={stopGeneration}
                            aria-label="إيقاف التوليد"
                            className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          >
                            إيقاف
                          </button>
                        )}
                        {canContinue && (
                          <button
                            type="button"
                            onClick={() => void handleContinueGenerating()}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          >
                            متابعة
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={!activeId || isStreaming || voiceBusy || !draft.trim() || !online}
                          className="min-h-11 rounded-xl bg-primary-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-slate-300"
                        >
                          {sending ? 'جاري الإرسال...' : 'إرسال'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
