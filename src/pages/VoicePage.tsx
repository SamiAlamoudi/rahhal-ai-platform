/**
 * Production Voice — mock STT → TravelBrain → UI. No live STT/TTS.
 */

import { useNavigate } from 'react-router-dom'
import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { BrainVoiceScreen } from '../brain-ui/screens/BrainVoiceScreen'
import { DsPhoneShell } from '../design-system/components/primitives'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function VoicePage() {
  const navigate = useNavigate()
  return (
    <ProductAppChrome title="الصوت">
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <DsPhoneShell title="رحّال صوت">
          <BrainVoiceScreen onSwitchToChat={() => navigate('/chat')} />
        </DsPhoneShell>
      </div>
    </ProductAppChrome>
  )
}
