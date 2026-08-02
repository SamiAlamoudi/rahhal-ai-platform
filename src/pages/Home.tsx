/**
 * Production Home — TravelBrain / BrainProvider only.
 * Legacy AiHomeExperience / NewHomeExperience / LegacyHome removed from product routing.
 */

import { useNavigate } from 'react-router-dom'
import { ProductAppChrome } from '../brain-ui/ProductAppChrome'
import { BrainHomeScreen } from '../brain-ui/screens/BrainHomeScreen'
import { DsPhoneShell } from '../design-system/components/primitives'
import '../design-system/tokens/themes.css'
import '../design-system/brand/signature.css'

export default function Home() {
  const navigate = useNavigate()
  return (
    <ProductAppChrome title="الرئيسية">
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <DsPhoneShell title="رحّال">
          <BrainHomeScreen
            onOpenChat={() => navigate('/chat')}
            onOpenVoice={() => navigate('/voice')}
          />
        </DsPhoneShell>
      </div>
    </ProductAppChrome>
  )
}
