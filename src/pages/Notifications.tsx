import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { notificationRepository } from '../lib/repositories'
import type { NotificationRow } from '../lib/types'

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationRepository.listByUser(showArchived)
      setNotifications(data)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleMarkAsRead = async (id: string) => {
    await notificationRepository.markAsRead(id)
    loadNotifications()
  }

  const handleMarkAllAsRead = async () => {
    await notificationRepository.markAllAsRead()
    loadNotifications()
  }

  const handleArchive = async (id: string) => {
    await notificationRepository.archive(id)
    loadNotifications()
  }

  const typeColors: Record<string, string> = {
    info: 'bg-sky-100 text-sky-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-rose-100 text-rose-700',
  }

  const typeLabels: Record<string, string> = {
    info: 'معلومات',
    success: 'نجاح',
    warning: 'تنبيه',
    error: 'خطأ',
  }

  const unreadCount = notifications.filter(n => !n.is_read && !n.is_archived).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
            <h1 className="text-base font-bold text-slate-900">الإشعارات</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                {unreadCount} غير مقروء
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              {showArchived ? 'إخفاء المؤرشفة' : 'عرض المؤرشفة'}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100"
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-12 text-center">
            <p className="text-sm text-slate-500">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                  notif.is_read ? 'border-slate-100' : 'border-primary-200 bg-primary-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[notif.type] ?? typeColors.info}`}>
                        {typeLabels[notif.type] ?? typeLabels.info}
                      </span>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary-500" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{notif.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{notif.body}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(notif.created_at).toLocaleString('ar-SA')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="rounded-lg px-2 py-1 text-xs text-primary-600 hover:bg-primary-50"
                      >
                        تعليم كمقروء
                      </button>
                    )}
                    {!notif.is_archived && (
                      <button
                        onClick={() => handleArchive(notif.id)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                      >
                        أرشفة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
