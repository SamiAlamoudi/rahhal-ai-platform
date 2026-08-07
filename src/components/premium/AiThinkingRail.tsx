import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  selectThinkingSteps,
  thinkingLabel,
  type ThinkingStep,
} from '../../lib/premiumExperience'

export interface AiThinkingRailProps {
  active: boolean
  seedText: string
  locale?: 'ar' | 'en'
  /** Milliseconds per step highlight while active */
  stepMs?: number
}

export function AiThinkingRail({
  active,
  seedText,
  locale = 'ar',
  stepMs = 1400,
}: AiThinkingRailProps) {
  const steps = selectThinkingSteps(seedText)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      return
    }
    if (steps.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % steps.length)
    }, stepMs)
    return () => window.clearInterval(id)
  }, [active, steps.length, stepMs])

  if (!active || steps.length === 0) return null

  const current = steps[Math.min(index, steps.length - 1)]!

  return (
    <div
      className="premium-thinking-rail"
      data-testid="ai-thinking-rail"
      role="status"
      aria-live="polite"
      aria-label={locale === 'ar' ? 'تقدم بيلامو' : 'Bilamo progress'}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {thinkingLabel(current, locale)}
            </p>
            <StepDots steps={steps} index={index} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StepDots({ steps, index }: { steps: ThinkingStep[]; index: number }) {
  return (
    <div className="mt-1.5 flex gap-1" aria-hidden>
      {steps.map((step, i) => (
        <span
          key={step.id}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= index ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </div>
  )
}
