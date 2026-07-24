/**
 * Phase 4 Stage 3 — Premium Voice Conversation Center root.
 * Renders only when `ui.voice_center` is enabled (or forced).
 * Own destination — not inside Chat. No STT/TTS/AI/networking.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './voiceCenter.css'
import { voiceTokenCssVariables } from '../design/voiceTokens'
import {
  applyVoiceControl,
  createInitialVoiceCenterState,
  filterSessionsByBucket,
  searchSessions,
} from '../state/voiceCenterState'
import type {
  VoiceCenterLocale,
  VoiceCenterUiState,
  VoiceControlId,
  VoiceHistoryBucket,
  VoiceShortcutId,
} from '../types'
import { isVoiceCenterEnabled } from '../voiceCenterRegistry'
import { MicrophoneStage } from './MicrophoneStage'
import { SessionHistory } from './SessionHistory'
import { TranscriptPanel } from './TranscriptPanel'
import { VoiceControls } from './VoiceControls'
import { VoicePersonalityPanel } from './VoicePersonalityPanel'
import { VoiceSettingsPanel } from './VoiceSettingsPanel'
import { VoiceShortcuts } from './VoiceShortcuts'

export interface VoiceCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: VoiceCenterLocale
  initialState?: Partial<VoiceCenterUiState>
}

const SHORTCUT_PROMPT: Record<VoiceShortcutId, { ar: string; en: string }> = {
  plan_trip: { ar: 'أريد تخطيط رحلة', en: 'I want to plan a trip' },
  ask_visa: { ar: 'أخبرني عن متطلبات التأشيرة', en: 'Tell me about visa requirements' },
  recommend_destination: {
    ar: 'اقترح وجهة مناسبة',
    en: 'Recommend a destination',
  },
  executive_travel: { ar: 'رحلة عمل تنفيذية', en: 'Executive business travel' },
  budget_planning: { ar: 'ساعدني في تخطيط الميزانية', en: 'Help me plan a budget' },
  nearby_attractions: { ar: 'ما المعالم القريبة؟', en: 'What are nearby attractions?' },
}

export function VoiceCenter({
  enabled,
  locale = 'ar',
  initialState,
}: VoiceCenterProps) {
  const voiceOn = isVoiceCenterEnabled({ enabled })
  const [state, setState] = useState<VoiceCenterUiState>(() =>
    createInitialVoiceCenterState({
      locale: initialState?.locale ?? locale,
      enabled,
      sessions: initialState?.sessions,
      transcript: initialState?.transcript,
      activeSessionId: initialState?.activeSessionId,
      sessionState: initialState?.sessionState,
    }),
  )

  const cssVars = useMemo(() => voiceTokenCssVariables() as CSSProperties, [])

  if (!voiceOn) return null

  const visibleSessions = searchSessions(
    filterSessionsByBucket(state.sessions, state.historyBucket),
    state.searchQuery,
  )

  const onControl = (control: VoiceControlId) => {
    setState((prev) => applyVoiceControl(prev, control))
  }

  const onMicClick = () => {
    setState((prev) =>
      applyVoiceControl(
        prev,
        prev.sessionState === 'listening' || prev.sessionState === 'speaking'
          ? 'stop'
          : 'start',
      ),
    )
  }

  const onShortcut = (id: VoiceShortcutId) => {
    const prompt =
      state.locale === 'en' ? SHORTCUT_PROMPT[id].en : SHORTCUT_PROMPT[id].ar
    setState((prev) => ({
      ...prev,
      currentTravelerText: prompt,
      sessionState: prev.muted ? 'muted' : 'listening',
    }))
  }

  return (
    <div
      className="rahhal-vc"
      data-testid="voice-center"
      data-vc="voice-center"
      data-locale={state.locale}
      data-session-state={state.sessionState}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <SessionHistory
        sessions={visibleSessions}
        activeSessionId={state.activeSessionId}
        bucket={state.historyBucket}
        searchQuery={state.searchQuery}
        locale={state.locale}
        onBucketChange={(bucket: VoiceHistoryBucket) =>
          setState((prev) => ({ ...prev, historyBucket: bucket }))
        }
        onSearchChange={(searchQuery) =>
          setState((prev) => ({ ...prev, searchQuery }))
        }
        onSelect={(id) =>
          setState((prev) => ({ ...prev, activeSessionId: id }))
        }
        onFavorite={(id) =>
          setState((prev) => ({
            ...prev,
            sessions: prev.sessions.map((s) =>
              s.id === id ? { ...s, favorite: !s.favorite } : s,
            ),
          }))
        }
        onRename={(id) =>
          setState((prev) => ({
            ...prev,
            sessions: prev.sessions.map((s) =>
              s.id === id ? { ...s, title: `${s.title}*` } : s,
            ),
          }))
        }
        onArchive={(id) =>
          setState((prev) => ({
            ...prev,
            sessions: prev.sessions.map((s) =>
              s.id === id ? { ...s, archived: true } : s,
            ),
          }))
        }
        onDelete={(id) =>
          setState((prev) => ({
            ...prev,
            sessions: prev.sessions.filter((s) => s.id !== id),
            activeSessionId:
              prev.activeSessionId === id ? null : prev.activeSessionId,
          }))
        }
      />

      <main className="rahhal-vc-main" data-testid="vc-main">
        <header className="rahhal-vc-brand" data-testid="vc-brand">
          <p className="rahhal-vc-brand__name">رحّال</p>
          <h1>{state.locale === 'en' ? 'Voice Center' : 'مركز الصوت'}</h1>
          <p className="rahhal-vc-brand__sub">
            {state.locale === 'en'
              ? 'A dedicated voice destination — not inside Chat.'
              : 'وجهة صوتية مستقلة — ليست داخل المحادثة.'}
          </p>
        </header>

        <MicrophoneStage
          sessionState={state.sessionState}
          locale={state.locale}
          onMicClick={onMicClick}
        />

        <VoiceControls
          locale={state.locale}
          muted={state.muted}
          speakerOn={state.speakerOn}
          headphonesOn={state.headphonesOn}
          onControl={onControl}
        />

        <VoiceShortcuts locale={state.locale} onShortcut={onShortcut} />

        <div className="rahhal-vc-panels">
          <TranscriptPanel
            entries={state.transcript}
            currentTravelerText={state.currentTravelerText}
            currentAssistantText={state.currentAssistantText}
            locale={state.locale}
            onToggleExpand={(id) =>
              setState((prev) => ({
                ...prev,
                transcript: prev.transcript.map((t) =>
                  t.id === id ? { ...t, expanded: !t.expanded } : t,
                ),
              }))
            }
          />

          <div className="rahhal-vc-side-panels">
            <VoicePersonalityPanel
              model={state.personality}
              locale={state.locale}
              onChange={(personality) =>
                setState((prev) => ({ ...prev, personality }))
              }
            />
            {state.showSettings ? (
              <VoiceSettingsPanel
                settings={state.settings}
                locale={state.locale}
                onChange={(settings) =>
                  setState((prev) => ({ ...prev, settings }))
                }
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}

/** Safe render helper for tests — returns null when flag OFF. */
export function tryRenderVoiceCenter(
  props: VoiceCenterProps = {},
): ReactElement | null {
  if (!isVoiceCenterEnabled({ enabled: props.enabled })) return null
  return <VoiceCenter {...props} />
}
