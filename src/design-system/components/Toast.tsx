import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  tone?: ToastTone
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastSeq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `toast-${++toastSeq}`
    setItems((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={springs.soft}
              className={cn(
                'bilamo-glass pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm text-[var(--bilamo-text)]',
              )}
              role="status"
            >
              {item.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--bilamo-success)]" />
              ) : item.tone === 'error' ? (
                <XCircle className="h-4 w-4 text-[var(--bilamo-danger)]" />
              ) : (
                <Info className="h-4 w-4 text-[var(--bilamo-secondary)]" />
              )}
              <span>{item.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
