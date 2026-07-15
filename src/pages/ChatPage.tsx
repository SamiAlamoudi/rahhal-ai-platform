import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ConversationSidebar from '../components/chat/ConversationSidebar'
import MessageBubble from '../components/chat/MessageBubble'
import VoiceComposer from '../components/chat/VoiceComposer'
import { chatEngine } from '../lib/chat/chatEngine'
import { CHAT_ATTACHMENTS_ENABLED, uploadChatAttachment } from '../lib/chat/chatAttachments'
import { validateConversationTitle, validateUserMessage } from '../lib/chat/chatHelpers'
import type { ChatConversation, ChatMessage } from '../lib/chat/chatTypes'
import { createSpeechToTextProvider, createTextToSpeechProvider } from '../lib/chat/voice/voiceProviderFactory'
import { createVoiceSession, type CreateVoiceSessionOptions, type VoiceSession } from '../lib/chat/voice/voiceSession'
import type { VoiceInputMode, VoiceLocale, VoiceSessionStatus } from '../lib/chat/voice/voiceTypes'

type ComposerMode = 'text' | 'voice'

function buildVoiceSession(callbacks: CreateVoiceSessionOptions['callbacks']): VoiceSession {
  return createVoiceSession({
    stt: createSpeechToTextProvider(),
    tts: createTextToSpeechProvider(),
    callbacks,
  })
}

export default function ChatPage() {
  const navigate = useNavigate()
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
  const [composerMode, setComposerMode] = useState<ComposerMode>('text')
  const [voiceStatus, setVoiceStatus] = useState<VoiceSessionStatus>('idle')
  const [voiceMode, setVoiceMode] = useState<VoiceInputMode>('push_to_talk')
  const [voiceLocale, setVoiceLocale] = useState<VoiceLocale>('ar')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const voiceRef = useRef<VoiceSession | null>(null)
  const activeIdRef = useRef<string | null>(null)

  const filtered = useMemo(
    () => chatEngine.searchConversations(conversations, query),
    [conversations, query],
  )

  const isStreaming = messages.some((m) => m.status === 'streaming') || sending
  const voiceBusy = voiceStatus === 'processing' || voiceStatus === 'speaking'

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id)
      if (idx === -1) return [...prev, message]
      const next = [...prev]
      next[idx] = message
      return next
    })
  }, [])

  const loadConversations = useCallback(async (preferId?: string | null) => {
    setListLoading(true)
    setListError(null)
    try {
      const rows = await chatEngine.listConversations()
      setConversations(rows)
      const nextId = preferId && rows.some((r) => r.id === preferId)
        ? preferId
        : (activeIdRef.current && rows.some((r) => r.id === activeIdRef.current)
          ? activeIdRef.current
          : rows[0]?.id ?? null)
      setActiveId(nextId)
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'تعذر تحميل المحادثات')
      setConversations([])
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await chatEngine.getConversationDetail(id)
      setMessages(detail.messages)
      setConversations((prev) =>
        prev.map((c) => (c.id === detail.conversation.id ? detail.conversation : c)),
      )
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'تعذر تحميل المحادثة')
      setMessages([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    void loadDetail(activeId)
  }, [activeId, loadDetail])

  useEffect(() => {
    scrollToBottom()
  }, [messages, partialTranscript, scrollToBottom])

  useEffect(() => {
    const session = buildVoiceSession({
      onStatus: setVoiceStatus,
      onPartialTranscript: setPartialTranscript,
      onFinalTranscript: setPartialTranscript,
      onPermission: (state) => {
        if (state.state !== 'granted') setMicError(state.error || 'يلزم إذن الميكروفون')
        else setMicError(null)
      },
      onError: (error) => setActionError(error),
      onAssistantCreate: upsertMessage,
      onDelta: upsertMessage,
      onComplete: (message) => {
        upsertMessage(message)
        void loadConversations(activeIdRef.current)
      },
      onStreamError: (message, error) => {
        upsertMessage(message)
        if (error !== 'cancelled') setActionError(error)
      },
    })
    voiceRef.current = session
    return () => {
      session.dispose()
      voiceRef.current = null
    }
  }, [loadConversations, upsertMessage])

  useEffect(() => {
    voiceRef.current?.setLocale(voiceLocale)
  }, [voiceLocale])

  useEffect(() => {
    voiceRef.current?.setMode(voiceMode)
  }, [voiceMode])

  const handleCreate = async () => {
    setActionError(null)
    try {
      const created = await chatEngine.createConversation()
      setConversations((prev) => [created, ...prev])
      setActiveId(created.id)
      setMessages([])
      setMobileSidebarOpen(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر إنشاء المحادثة')
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
        setActiveId(remaining[0]?.id ?? null)
        setMessages([])
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر حذف المحادثة')
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
    voiceRef.current?.interrupt()
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
          if (error !== 'cancelled') setActionError(error)
        },
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setSending(false)
    }
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeId || isStreaming || voiceBusy) return
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
    if (!activeId || isStreaming || voiceBusy) return
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

  const handlePushStart = async () => {
    if (!activeId) return
    setActionError(null)
    try {
      await voiceRef.current?.startPushToTalk()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر بدء الاستماع')
    }
  }

  const handlePushEnd = async () => {
    if (!activeId) return
    setSending(true)
    try {
      await voiceRef.current?.stopPushToTalkAndSend(activeId)
      await loadConversations(activeId)
      await loadDetail(activeId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر إرسال الرسالة الصوتية')
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
      setActionError(e instanceof Error ? e.message : 'تعذر تشغيل حر اليدين')
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              المحادثات
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900">محادثة رحّال</h1>
              <p className="text-[10px] text-slate-400">نص وصوت على نفس المحرك والسجل</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setComposerMode('text')
                  void voiceRef.current?.stopListening()
                }}
                className={`rounded-md px-2.5 py-1 ${composerMode === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                كتابة
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('voice')}
                className={`rounded-md px-2.5 py-1 ${composerMode === 'voice' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
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
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1">
        <ConversationSidebar
          conversations={filtered}
          activeId={activeId}
          query={query}
          onQueryChange={setQuery}
          onSelect={setActiveId}
          onCreate={() => void handleCreate()}
          onRename={(id) => void handleRename(id)}
          onDelete={(id) => void handleDelete(id)}
          loading={listLoading}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          {listError && (
            <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p>{listError}</p>
              <button type="button" onClick={() => void loadConversations()} className="mt-2 text-xs underline">
                إعادة المحاولة
              </button>
            </div>
          )}

          {actionError && (
            <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </div>
          )}

          {!activeId && !listLoading && (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
              <p className="text-sm text-slate-500">ابدأ محادثة ثم بدّل بين الكتابة والصوت في أي وقت</p>
              <button
                type="button"
                onClick={() => void handleCreate()}
                className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
              >
                إنشاء محادثة
              </button>
            </div>
          )}

          {activeId && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
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
                  <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                    <p className="text-sm text-slate-500">لا توجد رسائل بعد. اكتب أو تحدّث بالأسفل.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isStreaming={message.status === 'streaming'}
                      onRetry={(id) => void handleRetry(id)}
                    />
                  ))}
                </div>
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
                {composerMode === 'voice' ? (
                  <VoiceComposer
                    enabled={!!activeId && !isStreaming}
                    status={voiceStatus}
                    mode={voiceMode}
                    locale={voiceLocale}
                    partialTranscript={partialTranscript}
                    permissionError={micError}
                    busy={isStreaming || voiceBusy}
                    onModeChange={setVoiceMode}
                    onLocaleChange={setVoiceLocale}
                    onPushStart={() => void handlePushStart()}
                    onPushEnd={() => void handlePushEnd()}
                    onToggleHandsFree={() => void handleToggleHandsFree()}
                    onInterrupt={stopGeneration}
                    onRequestPermission={() => void voiceRef.current?.ensureMicPermission()}
                  />
                ) : (
                  <form onSubmit={(e) => void handleSend(e)}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="sr-only" htmlFor="chat-draft">رسالتك</label>
                      <textarea
                        id="chat-draft"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        placeholder="اسأل رحّال عن وجهتك، الميزانية، أو خطة السفر..."
                        className="min-h-[44px] w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                        disabled={!activeId || voiceBusy}
                      />
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleAttachImage()}
                          disabled={!activeId || isStreaming || voiceBusy}
                          title="مرفقات الصور (بنية جاهزة — التخزين لاحقاً)"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        >
                          صورة
                        </button>
                        {(isStreaming || voiceBusy) && (
                          <button
                            type="button"
                            onClick={stopGeneration}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100"
                          >
                            إيقاف
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={!activeId || isStreaming || voiceBusy || !draft.trim()}
                          className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300"
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
