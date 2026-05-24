import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import HelpDrawer from './HelpDrawer'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { AdminRole } from '../App'

const pageTitles: Record<string, string> = {
  '/': 'Genel Bakış',
  '/park-alanlari': 'Park Alanlarını Düzenle',
  '/oturumlar': 'Raporlar ve İstatistikler',
  '/kullanicilar': 'Kullanıcılar',
  '/sistem': 'Sistem',
  '/kilavuz': 'Kullanıcı Kılavuzu',
}

export default function Layout({ onLogout, role }: { onLogout: () => void; role: AdminRole }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] || ''

  // Sayfa başlığını tarayıcı sekmesine yaz
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · VisionPark` : 'VisionPark Yönetim Paneli'
  }, [pageTitle])

  // Sidebar açık/kapalı durumunu kalıcı tut
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (isDesktop) setMobileMenuOpen(false)
  }, [isDesktop])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // F1 → yardım çekmecesini aç/kapat
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault()
        setHelpOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const mainOffset = isDesktop ? (collapsed ? 'md:ml-[68px]' : 'md:ml-64') : ''

  return (
    <div className="min-h-screen bg-slate-50">
      {!isDesktop && mobileMenuOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        isDesktop={isDesktop}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        onNavigate={() => {
          if (!isDesktop) setMobileMenuOpen(false)
        }}
        role={role}
      />

      <div className={`transition-[margin] duration-300 ml-0 print:ml-0 ${mainOffset}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Menüyü aç"
              className="md:hidden flex-shrink-0 p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-slate-800 truncate">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                role === 'admin'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
              title={role === 'admin' ? 'Yönetici' : 'Operatör'}
            >
              {role === 'admin' ? 'Yönetici' : 'Operatör'}
            </span>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Canlı</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              title="Yardım (F1)"
              aria-label="Yardımı aç"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                />
              </svg>
              <span className="hidden sm:inline">Yardım</span>
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              Çıkış
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      <HelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        pathname={location.pathname}
      />
    </div>
  )
}
