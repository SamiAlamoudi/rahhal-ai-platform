/**
 * Rahhal Design System — outlined iconography.
 * Consistent stroke · no decorative fill icons.
 */

import type { SVGProps } from 'react'

export type DsIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
  title?: string
}

function baseProps({ size = 'var(--ds-icon-size-md)', title, ...rest }: DsIconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 'var(--ds-icon-stroke)' as unknown as number,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    role: title ? ('img' as const) : ('presentation' as const),
    'aria-hidden': title ? undefined : true,
    'aria-label': title,
    ...rest,
  }
}

export function IconMic(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

export function IconPlane(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M10 14 3.5 11.5 2 13l7 3.5L14 21l1.5-1.5L13 14l7-2.5L21.5 10 10 14Z" />
    </svg>
  )
}

export function IconHotel(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M3 21V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13" />
      <path d="M15 10h4a2 2 0 0 1 2 2v9" />
      <path d="M7 11h2M7 15h2M3 21h18" />
    </svg>
  )
}

export function IconPackage(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3.5 8.5 12 13l8.5-4.5M12 13v10" />
    </svg>
  )
}

export function IconCar(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M3 13h18l-1.5-4.5A2 2 0 0 0 17.6 7H6.4a2 2 0 0 0-1.9 1.5L3 13Z" />
      <path d="M5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM19 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path d="M6.5 17H17.5" />
    </svg>
  )
}

export function IconCompass(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 6-6 2 2-6 6-2Z" />
    </svg>
  )
}

export function IconSearch(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export function IconHome(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10.5V20h12v-9.5" />
    </svg>
  )
}

export function IconBell(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function IconUser(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

export function IconSettings(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function IconHeart(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" />
    </svg>
  )
}

export function IconChevron(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function IconCheck(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  )
}

export function IconClose(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  )
}

export function IconWifiOff(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M2 8.5c3.5-3 8-3.5 12-1.5M5.5 12c2.2-1.6 4.8-2.2 7.4-1.6M9 15.5c.9-.5 1.9-.7 2.9-.6" />
      <path d="m3 3 18 18" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSpark(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M12 3v4M12 17v4M4.5 7.5l2.8 2.8M16.7 13.7l2.8 2.8M3 12h4M17 12h4M4.5 16.5l2.8-2.8M16.7 10.3l2.8-2.8" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function IconMap(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}

export function IconClock(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5L15 15" />
    </svg>
  )
}

export function IconWallet(props: DsIconProps) {
  return (
    <svg {...baseProps(props)}>
      {props.title ? <title>{props.title}</title> : null}
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1" />
      <path d="M3 8.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5" />
      <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
