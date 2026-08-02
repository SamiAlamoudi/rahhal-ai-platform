import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes } from 'react'

export type RahhalOrbState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error'
  | 'offline'

export type RahhalOrbSize = number | 'sm' | 'md' | 'lg' | 'hero'

type Shared = {
  state?: RahhalOrbState
  size?: RahhalOrbSize
  label?: string
  interactive?: boolean
  className?: string
}

type AsButton = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    interactive: true
  }

type AsDiv = Shared &
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    interactive?: false
  }

export type RahhalOrbProps = AsButton | AsDiv

const NAMED: Record<'sm' | 'md' | 'lg' | 'hero', number> = {
  sm: 48,
  md: 64,
  lg: 96,
  hero: 160,
}

function resolveSize(size: RahhalOrbSize): number {
  return typeof size === 'number' ? size : NAMED[size]
}

/**
 * Rahhal Orb — proprietary AI brand mark.
 * Seven states with distinct motion; never a generic mic glyph.
 */
export function RahhalOrb(props: RahhalOrbProps) {
  const {
    state = 'idle',
    size = 'md',
    label,
    interactive = false,
    className,
    ...rest
  } = props

  const px = resolveSize(size)
  const style = {
    '--rh-orb-size': `${px}px`,
    width: px,
    height: px,
  } as CSSProperties

  const aria =
    label ??
    ({
      idle: 'رحّال — جاهز',
      listening: 'رحّال يستمع',
      thinking: 'رحّال يفكّر',
      speaking: 'رحّال يتحدث',
      success: 'رحّال — تم بنجاح',
      error: 'رحّال — خطأ',
      offline: 'رحّال غير متصل',
    }[state] as string)

  const body = (
    <>
      <span className="rahhal-orb__halo" aria-hidden />
      <span className="rahhal-orb__core">
        <span className="rahhal-orb__ring" aria-hidden />
        <span className="rahhal-orb__eye" aria-hidden />
        {state === 'listening' || state === 'speaking' ? (
          <span className="rahhal-orb__wave" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : null}
        {state === 'thinking' ? <span className="rahhal-orb__orbit" aria-hidden /> : null}
        {state === 'success' ? <span className="rahhal-orb__check" aria-hidden /> : null}
        {state === 'error' ? <span className="rahhal-orb__alert" aria-hidden /> : null}
        {state === 'offline' ? <span className="rahhal-orb__slash" aria-hidden /> : null}
      </span>
    </>
  )

  const classes = ['rahhal-orb', `rahhal-orb--${state}`, className].filter(Boolean).join(' ')

  if (interactive) {
    return (
      <button
        type="button"
        className={classes}
        style={style}
        data-state={state}
        aria-label={aria}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {body}
      </button>
    )
  }

  return (
    <div
      className={classes}
      style={style}
      data-state={state}
      role="img"
      aria-label={aria}
      {...(rest as HTMLAttributes<HTMLDivElement>)}
    >
      {body}
    </div>
  )
}

export const RAHHAL_ORB_STATES: RahhalOrbState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'success',
  'error',
  'offline',
]
