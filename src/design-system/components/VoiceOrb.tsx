import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springs, type OrbState } from '../tokens'

export interface VoiceOrbProps {
  state?: OrbState
  /** Mic RMS 0–1 */
  level?: number
  /** Frequency bands 0–1 for realtime waveform */
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
      <motion.div
        className="absolute inset-[4%] rounded-full"
        style={{
          background:
            state === 'listening'
              ? 'radial-gradient(circle, var(--bilamo-glow-secondary) 0%, transparent 68%)'
              : 'radial-gradient(circle, var(--bilamo-glow-primary) 0%, transparent 70%)',
          filter: 'blur(2px)',
        }}
        animate={
          state === 'listening'
            ? { opacity: 0.28 + amp * 0.55, scale: 1 + amp * 0.18 }
            : state === 'speaking'
              ? { opacity: [0.32, 0.72, 0.32], scale: [1, 1.08, 1] }
              : state === 'completed'
                ? { opacity: [0.4, 0.9, 0.45], scale: [1, 1.1, 1] }
                : state === 'thinking'
                  ? { opacity: [0.35, 0.6, 0.35], scale: [1, 1.05, 1] }
                  : { opacity: [0.2, 0.38, 0.2], scale: [1, 1.04, 1] }
        }
        transition={
          state === 'listening'
            ? springs.orb
            : {
                duration: state === 'idle' ? 4.4 : state === 'thinking' ? 2.2 : 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />

      {state === 'thinking' && (
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
              style={{
                background: i % 2 === 0 ? 'var(--bilamo-secondary)' : 'var(--bilamo-primary)',
                boxShadow: '0 0 12px var(--bilamo-glow-secondary)',
                opacity: 0.6,
                transform: `rotate(${i * 60}deg) translate(${size * 0.38}px) rotate(0deg)`,
              }}
            />
          ))}
        </motion.div>
      )}

      {state === 'thinking' && (
        <>
          <motion.div
            className="absolute inset-[16%] rounded-full border border-[color-mix(in_srgb,var(--bilamo-secondary)_30%,transparent)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-[24%] rounded-full border border-dashed border-[color-mix(in_srgb,var(--bilamo-primary)_35%,transparent)]"
            animate={{ rotate: -360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          />
        </>
      )}

      {showWave && (
        <div className="absolute inset-0" aria-hidden>
          {wave.map((value, i) => {
            const count = wave.length
            const angle = (i / count) * 360
            const barH = Math.max(4, 6 + value * size * 0.14)
            const radius = core * 0.72 + value * size * 0.04
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 origin-bottom rounded-full"
                style={{
                  width: Math.max(2, size * 0.012),
                  height: barH,
                  background:
                    state === 'listening'
                      ? 'linear-gradient(to top, var(--bilamo-secondary), rgba(255,255,255,0.85))'
                      : 'linear-gradient(to top, var(--bilamo-primary), rgba(255,255,255,0.8))',
                  opacity: 0.35 + value * 0.55,
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
                  boxShadow:
                    state === 'listening'
                      ? '0 0 10px var(--bilamo-glow-secondary)'
                      : '0 0 10px var(--bilamo-glow-primary)',
                }}
              />
            )
          })}
        </div>
      )}

      {state === 'listening' &&
        [0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[color-mix(in_srgb,var(--bilamo-secondary)_35%,transparent)]"
            style={{ width: core * 1.35, height: core * 1.35 }}
            animate={{
              scale: [1, 1.45 + amp * 0.4, 1],
              opacity: [0.4, 0, 0.4],
            }}
            transition={{
              duration: 1.7,
              repeat: Infinity,
              delay: i * 0.45,
              ease: 'easeOut',
            }}
          />
        ))}

      <motion.div
        className="relative z-10 overflow-hidden rounded-full"
        style={{
          width: core,
          height: core,
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 42%), radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--bilamo-primary) 75%, #22d3ee), color-mix(in srgb, var(--bilamo-primary) 35%, #050816) 70%, #050816)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -8px 24px rgba(0,0,0,0.25), 0 0 70px var(--bilamo-glow-primary), 0 24px 60px rgba(0,0,0,0.4)',
        }}
        animate={
          state === 'idle'
            ? { scale: [1, 1.04, 1] }
            : state === 'listening'
              ? { scale: 1 + amp * 0.14 }
              : state === 'thinking'
                ? { scale: [1, 1.035, 0.985, 1] }
                : state === 'speaking'
                  ? { scale: [1, 1.05 + amp * 0.08, 0.99, 1] }
                  : {
                      scale: [1, 1.08, 1],
                      filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'],
                    }
        }
        transition={
          state === 'listening'
            ? springs.orb
            : {
                duration:
                  state === 'idle'
                    ? 3.8
                    : state === 'thinking'
                      ? 2.2
                      : state === 'speaking'
                        ? 1.05
                        : 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      >
        {(state === 'speaking' || (state === 'listening' && amp > 0.04)) && (
          <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
            {(bands && bands.length
              ? bands.slice(0, 7)
              : [0.3, 0.5, 0.8, 1, 0.7, 0.45, 0.3]
            ).map((v, i) => (
              <motion.span
                key={i}
                className="w-[3px] rounded-full bg-white/80"
                animate={{
                  height: Math.max(8, (10 + clampLevel(v) * 34) * (0.7 + amp * 0.5)),
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              />
            ))}
          </div>
        )}

        {state === 'thinking' && (
          <motion.div
            className="absolute inset-[28%] rounded-full bg-white/15"
            animate={{ opacity: [0.15, 0.45, 0.15], scale: [0.9, 1.08, 0.9] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div className="pointer-events-none absolute inset-x-[16%] top-[11%] h-[24%] rounded-full bg-white/28 blur-[2px]" />
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
  const core = size * 0.44
  const showWave = state === 'listening' || state === 'speaking'
  const wave =
    bands && bands.length > 0
      ? bands
      : Array.from({ length: 24 }, (_, i) => {
          const phase = (i / 24) * Math.PI * 2
          return showWave
            ? 0.2 + amp * (0.45 + 0.35 * Math.abs(Math.sin(phase + amp * 4)))
            : 0.08
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
          'relative flex cursor-pointer items-center justify-center border-0 bg-transparent p-0',
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={label ?? `Bilamo orb — ${state}`}
        data-orb-state={state}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={springs.snappy}
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
      aria-label={label ?? `Bilamo orb — ${state}`}
      data-orb-state={state}
    >
      {visual}
    </div>
  )
}
