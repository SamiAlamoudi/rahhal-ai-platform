/**
 * Production Chat — TravelBrain only (BrainProvider + useTravelBrain).
 * Legacy LegacyChatPage quarantined (see archive notes / recovery freeze update).
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { BrainChatScreen } from '../brain-ui/screens/BrainChatScreen'
import { useTravelBrain } from '../brain-ui/useTravelBrain'
import { DsPhoneShell } from '../design-system/components/primitives'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

function ChatSeed() {
  const { sendMessage, state } = useTravelBrain()
  const location = useLocation()
  const seed =
    (location.state as { initialPrompt?: string; tripText?: string } | null)?.initialPrompt ??
    (location.state as { tripText?: string } | null)?.tripText

  useEffect(() => {
    if (!seed || !state.ready) return
    if (state.messages.length > 0) return
    void sendMessage(seed)
  }, [seed, state.ready, state.messages.length, sendMessage])

  return null
}

export default function ChatPage() {
  return (
    <ProductAppChrome title="المحادثة">
      <ChatSeed />
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <DsPhoneShell title="رحّال">
          <BrainChatScreen />
        </DsPhoneShell>
      </div>
    </ProductAppChrome>
  )
}

/** @deprecated Recovery Phase 1 name — product UI is BrainChatPage via TravelBrain. */
export const LegacyChatPage = ChatPage
