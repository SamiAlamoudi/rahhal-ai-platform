import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import TravelConversationCard from '../components/TravelConversationCard'
import QuickActions from '../components/QuickActions'
import { useAuth } from '../lib/auth'
import { getFeatureRegistry } from '../lib/ai'
import AiHomeExperience from './AiHomeExperience'

/**
 * Recovery Phase 1 — ONE home composition for product traffic.
 * ProductionHomeScreen remains quarantined under `src/ui/integration` (tests only).
 * Intake always seeds `/chat` (not `/travel-conversation`).
 */

function LegacyHome() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [tripText, setTripText] = useState('')

  const handleStartPlanning = () => {
    navigate('/chat', { state: { initialPrompt: tripText, tripText } })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-600/30">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">رحّال</h1>
              <p className="text-[11px] leading-tight text-slate-400">منصة القرار السفر الذكية</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              to="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              الرئيسية
            </Link>
            <button
              type="button"
              onClick={() => navigate('/search')}
              data-testid="nav-search"
              className="rounded-lg px-3 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
            >
              مساحة البحث
            </button>
            <button
              type="button"
              onClick={() => navigate('/my-trips')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              رحلاتي
            </button>
            <button
              type="button"
              onClick={() => navigate('/saved-trips')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              المحفوظة
            </button>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              المحادثة
            </button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              الإعدادات
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="rounded-lg px-3 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
              >
                لوحة التحكم
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 px-6 py-12 text-white shadow-xl shadow-primary-900/20 sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-300" />
              ذكاء اصطناعي يخطط رحلتك
            </span>
            <h2 className="mt-4 text-2xl font-bold leading-snug sm:text-4xl sm:leading-tight">
              خطّط رحلتك التالية بالطريقة التي تفكر بها
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-100 sm:text-base">
              رحّال لا يبحث عن تذكرة فقط. يفكر في رحلتك كاملة، يقارن الخيارات، ويوصي بأفضل تجربة لك.
            </p>
          </div>
        </section>

        <div className="-mt-8 relative z-20">
          <TravelConversationCard
            value={tripText}
            onChange={setTripText}
            onStartPlanning={handleStartPlanning}
          />
        </div>

        <QuickActions onAction={() => navigate('/search')} />
      </main>
    </div>
  )
}

export default function Home() {
  // Recovery Phase 1: ignore ui.production_integration for routing.
  const aiHomeEnabled = getFeatureRegistry().isEnabled('ui.ai_home')
  if (aiHomeEnabled) return <AiHomeExperience />
  return <LegacyHome />
}
