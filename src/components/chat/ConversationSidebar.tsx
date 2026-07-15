import type { ChatConversation } from '../../lib/chat/chatTypes'

interface ConversationSidebarProps {
  conversations: ChatConversation[]
  activeId: string | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  loading?: boolean
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function ConversationSidebar({
  conversations,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  loading = false,
  mobileOpen = false,
  onCloseMobile,
}: ConversationSidebarProps) {
  const panel = (
    <div className="flex h-full flex-col border-slate-100 bg-white lg:border-e">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">المحادثات</h2>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-700"
        >
          جديدة
        </button>
      </div>

      <div className="border-b border-slate-100 px-3 py-2">
        <label className="sr-only" htmlFor="chat-search">بحث في المحادثات</label>
        <input
          id="chat-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="بحث..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">جاري التحميل...</p>
        )}
        {!loading && conversations.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center">
            <p className="text-xs text-slate-500">لا توجد محادثات بعد</p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 text-xs font-medium text-primary-600 underline"
            >
              ابدأ محادثة
            </button>
          </div>
        )}
        <ul className="space-y-1">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId
            return (
              <li key={conversation.id}>
                <div
                  className={`group rounded-xl px-2 py-2 transition-colors ${
                    active ? 'bg-primary-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(conversation.id)
                      onCloseMobile?.()
                    }}
                    className="w-full text-start"
                  >
                    <p className={`truncate text-sm font-medium ${active ? 'text-primary-800' : 'text-slate-800'}`}>
                      {conversation.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {new Date(conversation.updatedAt).toLocaleDateString('ar-SA')}
                    </p>
                  </button>
                  <div className="mt-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onRename(conversation.id)}
                      className="rounded px-2 py-0.5 text-[10px] text-slate-500 hover:bg-white hover:text-slate-800"
                    >
                      إعادة تسمية
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      className="rounded px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden h-full w-72 shrink-0 lg:block">{panel}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-slate-900/30"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 start-0 w-[85%] max-w-xs shadow-xl">
            {panel}
          </div>
        </div>
      )}
    </>
  )
}
