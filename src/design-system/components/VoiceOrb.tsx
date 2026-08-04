import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springs, type OrbState } from '../tokens'

export interface VoiceOrbProps {
  state?: OrbState
  level?: number
  className?: string
  size?: number
  label?: string
}

function clampLevel(level: number) {
  if (!Number.isFinite(level)) return 0
  return Math.min(1, Math.max(0, level))
}

export function VoiceOrb({
  state = 'idle',
  level = 0,
  className,
  size = 220,
  label,
}: VoiceOrbProps) {
  const amp = clampLevel(level)
  const core = size * 0.42

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Bilamo orb — ${state}`}
      data-orb-state={state}
    >
      {/* Soft ambient bloom */}
      <motion.div
        className="absolute inset-[8%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, var(--bilamo-glow-primary) 0%, transparent 70%)',
        }}
        animate={
          state === 'completed'
            ? { opacity: [0.35, 0.85, 0.45], scale: [1, 1.08, 1] }
            : state === 'listening'
              ? { opacity: 0.35 + amp * 0.45, scale: 1 + amp * 0.12 }
              : state === 'speaking'
                ? { opacity: [0.3, 0.7, 0.3], scale: [1, 1.06, 1] }
                : { opacity: [0.22, 0.4, 0.22], scale: [1, 1.04, 1] }
        }
        transition={
          state === 'idle' || state === 'speaking' || state === 'completed'
            ? { duration: state === 'idle' ? 4.2 : 1.8, repeat: Infinity, ease: 'easeInOut' }
            : springs.orb
        }
      />

      {/* Thinking orbit rings */}
      {(state === 'thinking' || state === 'speaking') && (
        <>
          <motion.div
            className="absolute inset-[12%] rounded-full border border-[color-mix(in_srgb,var(--bilamo-secondary)_35%,transparent)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-[20%] rounded-full border border-dashed border-[color-mix(in_srgb,var(--bilamo-primary)_40%,transparent)]"
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />
        </>
      )}

      {/* Voice pulse rings */}
      {(state === 'listening' || state === 'speaking') &&
        [0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[color-mix(in_srgb,var(--bilamo-secondary)_40%,transparent)]"
            style={{ width: core * 1.6, height: core * 1.6 }}
            animate={{
              scale: [1, 1.55 + amp * 0.35, 1],
              opacity: [0.45, 0, 0.45],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: i * 0.35,
              ease: 'easeOut',
            }}
          />
        ))}

      {/* Core glass orb */}
      <motion.div
        className="relative z-10 overflow-hidden rounded-full"
        style={{
          width: core,
          height: core,
          background:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--bilamo-primary) 70%, #22d3ee), color-mix(in srgb, var(--bilamo-primary) 40%, #050816))',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.35), 0 0 60px var(--bilamo-glow-primary), 0 20px 50px rgba(0,0,0,0.35)',
        }}
        animate={
          state === 'idle'
            ? { scale: [1, 1.045, 1] }
            : state === 'listening'
              ? { scale: 1 + amp * 0.12 }
              : state === 'thinking'
                ? { scale: [1, 1.03, 0.98, 1] }
                : state === 'speaking'
                  ? { scale: [1, 1.06 + amp * 0.08, 0.98, 1] }
                  : { scale: [1, 1.08, 1], filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1)'] }
        }
        transition={
          state === 'idle'
            ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
            : state === 'thinking'
              ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
              : state === 'speaking'
                ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
                : state === 'completed'
                  ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                  : springs.orb
        }
      >
        {/* Speaking wave bands */}
        {state === 'speaking' && (
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-white/70"
                animate={{ height: [10, 28 + amp * 18, 12] }}
                transition={{
                  duration: 0.55,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}

        {/* Specular highlight */}
        <div className="pointer-events-none absolute inset-x-[18%] top-[12%] h-[22%] rounded-full bg-white/25 blur-[2px]" />
      </motion.div>
    </div>
  )
}
