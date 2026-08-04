import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, MessageCircle, Plane, Settings } from 'lucide-react'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

export interface BottomNavItem {
  to: string
  label: string
  icon: 'home' | 'chat' | 'trips' | 'settings'
  end?: boolean
}

const ICONS = {
  home: Home,
  chat: MessageCircle,
  trips: Plane,
  settings: Settings,
} as const

const DEFAULT_ITEMS: BottomNavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/chat', label: 'Talk', icon: 'chat' },
  { to: '/my-trips', label: 'Trips', icon: 'trips' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export interface BottomNavigationProps {
  items?: BottomNavItem[]
  className?: string
}

export function BottomNavigation({ items = DEFAULT_ITEMS, className }: BottomNavigationProps) {
  return (
    <nav
      className={cn(
        'bilamo-glass fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-around rounded-full px-2 py-2',
        className,
      )}
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-medium tracking-tight transition-colors',
                isActive ? 'text-[var(--bilamo-text)]' : 'text-[var(--bilamo-muted)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <motion.span
                    layoutId="bilamo-nav-pill"
                    className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--bilamo-primary)_22%,transparent)]"
                    transition={springs.soft}
                  />
                ) : null}
                <Icon className="relative z-10 h-5 w-5" strokeWidth={isActive ? 2.2 : 1.75} />
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
