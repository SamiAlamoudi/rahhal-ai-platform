import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springs, type OrbState } from '../tokens'

export interface VoiceOrbProps {
  state?: OrbState
  level?: number
  bands?: number[]
  className?: string
  size?: number
  label?: string
  onClick?: () => void
}

function clampLevel(level: number) {
  if (!Number.isFinite(level)) return 0
  return Math.min(1, Math.max(0, level))
}

function OrbVisual({
  state,
  amp,
  bands,
  size,
  core,
  showWave,
  wave,
}: {
  state: OrbState
  amp: number
  bands?: number[]
  size: number
  core: number
  showWave: boolean
  wave: number[]
}) {
  return (
    <>
      {/* Soft ambient — barely there at rest */}
      <motion.div
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            state === 'listening'
              ? 'radial-gradient(circle, var(--bilamo-glow-secondary) 0%, transparent 72%)'
              : 'radial-gradient(circle, var(--bilamo-glow-primary) 0%, transparent 72%)',
        }}
        animate={
          state === 'listening'
            ? { opacity: 0.22 + amp * 0.4, scale: 1 + amp * 0.1 }
            : state === 'speaking'
              ? { opacity: [0.24, 0.48, 0.24], scale: [1, 1.04, 1] }
              : state === 'completed'
                ? { opacity: [0.3, 0.55, 0.3], scale: [1, 1.05, 1] }
                : state === 'thinking'
                  ? { opacity: [0.26, 0.4, 0.26], scale: [1, 1.025, 1] }
                  : { opacity: [0.14, 0.26, 0.14], scale: [1, 1.02, 1] }
        }
        transition={
          state === 'listening'
            ? springs.orb
            : {
                duration: state === 'idle' ? 5.2 : state === 'thinking' ? 2.8 : 1.9,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />

      {/* Thinking — three quiet satellites, no dashed tech rings */}
      {state === 'thinking' && (
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{
                background: 'var(--bilamo-secondary)',
                opacity: 0.45 + i * 0.1,
                boxShadow: '0 0 10px var(--bilamo-glow-secondary)',
                transform: `rotate(${i * 120}deg) translate(${size * 0.36}px)`,
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Circular waveform — thinner, softer */}
      {showWave && (
        <div className="absolute inset-0" aria-hidden>
          {wave.map((value, i) => {
            const count = wave.length
            const angle = (i / count) * 360
            const barH = Math.max(3, 4 + value * size * 0.1)
            const radius = core * 0.78
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 origin-bottom rounded-full"
                style={{
                  width: Math.max(1.5, size * 0.008),
                  height: barH,
                  background:
                    'linear-gradient(to top, color-mix(in srgb, var(--bilamo-secondary) 70%, transparent), rgba(255,255,255,0.75))',
                  opacity: 0.2 + value * 0.55,
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* One soft listening ring — not a radar stack */}
      {state === 'listening' && (
        <motion.div
          className="absolute rounded-full border border-[color-mix(in_srgb,var(--bilamo-secondary)_28%,transparent)]"
          style={{ width: core * 1.28, height: core * 1.28 }}
          animate={{
            scale: [1, 1.28 + amp * 0.22, 1],
            opacity: [0.35, 0, 0.35],
          }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      <motion.div
        className="relative z-10 overflow-hidden rounded-full"
        style={{
          width: core,
          height: core,
          background:
            'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.38), transparent 40%), radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--bilamo-primary) 72%, #22d3ee), color-mix(in srgb, var(--bilamo-primary) 38%, #050816) 72%, #050816)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.38), inset 0 -10px 28px rgba(0,0,0,0.22), 0 0 48px var(--bilamo-glow-primary), 0 18px 44px rgba(0,0,0,0.28)',
        }}
        animate={
          state === 'idle'
            ? { scale: [1, 1.018, 1] }
            : state === 'listening'
              ? { scale: 1 + amp * 0.09 }
              : state === 'thinking'
                ? { scale: [1, 1.02, 0.992, 1] }
                : state === 'speaking'
                  ? { scale: [1, 1.03 + amp * 0.04, 0.995, 1] }
                  : { scale: [1, 1.04, 1] }
        }
        transition={
          state === 'listening'
            ? springs.orb
            : {
                duration:
                  state === 'idle'
                    ? 4.8
                    : state === 'thinking'
                      ? 2.6
                      : state === 'speaking'
                        ? 1.25
                        : 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      >
        {(state === 'speaking' || (state === 'listening' && amp > 0.035)) && (
          <div className="absolute inset-0 flex items-center justify-center gap-[2.5px]">
            {(bands && bands.length
              ? bands.slice(4, 11)
              : [0.28, 0.45, 0.7, 0.9, 0.65, 0.4, 0.28]
            ).map((v, i) => (
              <motion.span
                key={i}
                className="w-[2.5px] rounded-full bg-white/75"
                animate={{
                  height: Math.max(7, (8 + clampLevel(v) * 26) * (0.75 + amp * 0.4)),
                }}
                transition={springs.press}
              />
            ))}
          </div>
        )}

        {state === 'thinking' && (
          <motion.div
            className="absolute inset-[30%] rounded-full bg-white/10"
            animate={{ opacity: [0.12, 0.32, 0.12], scale: [0.94, 1.04, 0.94] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div className="pointer-events-none absolute inset-x-[18%] top-[12%] h-[22%] rounded-full bg-white/22 blur-[1.5px]" />
      </motion.div>
    </>
  )
}

export function VoiceOrb({
  state = 'idle',
  level = 0,
  bands,
  className,
  size = 220,
  label,
  onClick,
}: VoiceOrbProps) {
  const amp = clampLevel(level)
  const core = size * 0.46
  const showWave = state === 'listening' || state === 'speaking'
  const wave =
    bands && bands.length > 0
      ? bands.filter((_, i) => i % 2 === 0)
      : Array.from({ length: 18 }, (_, i) => {
          const phase = (i / 18) * Math.PI * 2
          return showWave
            ? 0.16 + amp * (0.4 + 0.3 * Math.abs(Math.sin(phase + amp * 3)))
            : 0.06
        })

  const visual = (
    <OrbVisual
      state={state}
      amp={amp}
      bands={bands}
      size={size}
      core={core}
      showWave={showWave}
      wave={wave}
    />
  )

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={cn(
          'relative flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bilamo-secondary)_50%,transparent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bilamo-bg)]',
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={label ?? `Bilamo — ${state}`}
        data-orb-state={state}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.975 }}
        transition={springs.press}
      >
        {visual}
      </motion.button>
    )
  }

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Bilamo — ${state}`}
      data-orb-state={state}
    >
      {visual}
    </div>
  )
}
