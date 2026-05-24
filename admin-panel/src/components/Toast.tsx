import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id'>) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { ...t, id }])
    const dur = t.duration ?? 4000
    if (dur > 0) {
      setTimeout(() => dismiss(id), dur)
    }
  }, [dismiss])

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message, title) => push({ kind: 'success', message, title }),
      error: (message, title) => push({ kind: 'error', message, title, duration: 6000 }),
      info: (message, title) => push({ kind: 'info', message, title }),
      warning: (message, title) => push({ kind: 'warning', message, title, duration: 6000 }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

interface ToastViewportProps {
  toasts: ToastItem[]
  dismiss: (id: number) => void
}

function ToastViewport({ toasts, dismiss }: ToastViewportProps) {
  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm pointer-events-none print:hidden">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

const KIND_STYLES: Record<ToastKind, { bg: string; border: string; icon: React.ReactNode; iconBg: string }> = {
  success: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-emerald-500 border border-slate-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-red-500 border border-slate-200',
    iconBg: 'bg-red-50 text-red-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-amber-500 border border-slate-200',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-blue-500 border border-slate-200',
    iconBg: 'bg-blue-50 text-blue-600',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  },
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])
  const s = KIND_STYLES[toast.kind]
  return (
    <div
      className={`pointer-events-auto ${s.bg} ${s.border} rounded-lg shadow-lg p-3 flex items-start gap-3 transition-all duration-200 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
      role="status"
    >
      <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${s.iconBg}`}>
        {s.icon}
      </div>
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold text-slate-800">{toast.title}</p>}
        <p className="text-sm text-slate-600 leading-snug">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
        aria-label="Kapat"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
