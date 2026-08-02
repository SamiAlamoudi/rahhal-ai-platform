/** Alias route — conversation is Chat powered by TravelBrain. */
import { Navigate } from 'react-router-dom'

export default function ConversationPage() {
  return <Navigate to="/chat" replace />
}
