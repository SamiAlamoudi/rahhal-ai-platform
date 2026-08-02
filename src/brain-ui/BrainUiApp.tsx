import { useState } from 'react'
import { DsChip, DsPhoneShell, DsText } from '../design-system/components/primitives'
import { BrainProvider } from './BrainProvider'
import { BrainChatScreen } from './screens/BrainChatScreen'
import { BrainHomeScreen } from './screens/BrainHomeScreen'
import { BrainVoiceScreen } from './screens/BrainVoiceScreen'

type Tab = 'home' | 'chat' | 'voice'

/**
 * Conversation-driven Premium UI shell wired to TravelBrain (mock only).
 * Does not modify Design System tokens / brand primitives.
 */
export function BrainUiApp() {
  const [tab, setTab] = useState<Tab>('home')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl')

  return (
    <div
      data-rahhal-ds
      data-theme={theme}
      dir={dir}
      className="rh-atmosphere"
      style={{
        minHeight: '100vh',
        background: 'var(--ds-bg)',
        color: 'var(--ds-ink)',
        padding: '24px clamp(16px, 3vw, 40px) 48px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'grid', gap: 10 }}>
          <DsText as="h1" variant="display">
            رحّال · Brain ⇄ UI
          </DsText>
          <DsText variant="callout" tone="secondary">
            Premium screens driven by TravelBrain mocks — no providers, no network.
          </DsText>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <DsChip active={tab === 'home'} onClick={() => setTab('home')}>
              Home
            </DsChip>
            <DsChip active={tab === 'chat'} onClick={() => setTab('chat')}>
              Chat
            </DsChip>
            <DsChip active={tab === 'voice'} onClick={() => setTab('voice')}>
              Voice
            </DsChip>
            <DsChip active={theme === 'light'} onClick={() => setTheme('light')}>
              Light
            </DsChip>
            <DsChip active={theme === 'dark'} onClick={() => setTheme('dark')}>
              Dark
            </DsChip>
            <DsChip active={dir === 'rtl'} onClick={() => setDir('rtl')}>
              RTL
            </DsChip>
            <DsChip active={dir === 'ltr'} onClick={() => setDir('ltr')}>
              LTR
            </DsChip>
          </div>
        </header>

        <BrainProvider locale={dir === 'rtl' ? 'ar' : 'en'}>
          <main style={{ display: 'grid', justifyItems: 'center' }}>
            <DsPhoneShell title="Rahhal Brain">
              {tab === 'home' ? (
                <BrainHomeScreen
                  onOpenChat={() => setTab('chat')}
                  onOpenVoice={() => setTab('voice')}
                />
              ) : null}
              {tab === 'chat' ? <BrainChatScreen /> : null}
              {tab === 'voice' ? (
                <BrainVoiceScreen onSwitchToChat={() => setTab('chat')} />
              ) : null}
            </DsPhoneShell>
          </main>
        </BrainProvider>
      </div>
    </div>
  )
}
