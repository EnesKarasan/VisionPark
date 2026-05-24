import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { helpContent, helpFallback } from '../lib/helpContent'

interface HelpDrawerProps {
  open: boolean
  onClose: () => void
  pathname: string
}

export default function HelpDrawer({ open, onClose, pathname }: HelpDrawerProps) {
  const entry = helpContent[pathname] ?? helpFallback

  // Escape ile kapat
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[1px] transition-opacity duration-300 print:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 h-screen w-full max-w-[420px] bg-white shadow-2xl border-l border-slate-200 z-40 flex flex-col transition-transform duration-300 ease-out print:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Yardım"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className="w-5 h-5 text-blue-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-slate-800 truncate">Yardım — {entry.title}</h2>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{entry.intro}</p>

          {entry.sections.map((s, i) => (
            <section key={i} className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                {s.heading}
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 bg-slate-50 flex items-center justify-between">
          <Link
            to="/kilavuz"
            onClick={onClose}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Tüm kılavuzu aç
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <span className="text-xs text-slate-400">F1 ile aç/kapat</span>
        </div>
      </aside>
    </>
  )
}
