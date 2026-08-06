import { useLocation } from 'react-router-dom'
import { BilamoConversationExperience } from './bilamo/BilamoConversationExperience'

interface LocationSeed {
  initialPrompt?: string
  tripText?: string
  voiceStart?: boolean
}

/**
 * /chat uses the same living Bilamo surface as Home.
 * No separate dashboard chat chrome.
 */
export default function BilamoChat() {
  const location = useLocation()
  const seed = (location.state as LocationSeed | null) ?? null
  const prompt = seed?.initialPrompt ?? seed?.tripText ?? null

  return (
    <BilamoConversationExperience
      initialPrompt={prompt}
      autoListen={Boolean(seed?.voiceStart)}
    />
  )
}
