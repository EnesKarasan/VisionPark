import { NavLink } from 'react-router-dom'
import { useMobileDrawerWidth } from '../hooks/useMobileDrawerWidth'
import { SidebarLogo } from './SidebarLogo'
import type { AdminRole } from '../App'

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  /** Operatör de görebilir mi? false = sadece admin */
  staff?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Genel Bakış',
    staff: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    to: '/park-alanlari',
    label: 'Park Alanlarını Düzenle',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
  {
    to: '/oturumlar',
    label: 'Raporlar ve İstatistikler',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v7.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 20.25v-7.125ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
  },
  {
    to: '/kullanicilar',
    label: 'Kullanıcılar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
    ),
  },
  {
    to: '/sistem',
    label: 'Sistem',
    staff: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122"
        />
      </svg>
    ),
  },
  {
    to: '/kilavuz',
    label: 'Kullanıcı Kılavuzu',
    staff: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  /** Masaüstü (md+) */
  isDesktop: boolean
  /** Mobil menü açık mı */
  mobileOpen: boolean
  onMobileClose: () => void
  onNavigate: () => void
  role: AdminRole
}

export default function Sidebar({
  collapsed,
  onToggle,
  isDesktop,
  mobileOpen,
  onMobileClose,
  onNavigate,
  role,
}: SidebarProps) {
  const visibleNavItems =
    role === 'admin' ? navItems : navItems.filter((item) => item.staff === true)
  const narrow = collapsed && isDesktop
  const mobileDrawerPx = useMobileDrawerWidth(isDesktop)

  const mobileDrawerStyle =
    !isDesktop && mobileDrawerPx != null
      ? ({
          width: mobileDrawerPx,
          boxSizing: 'border-box' as const,
        } as const)
      : undefined

  return (
    <aside
      style={mobileDrawerStyle}
      className={[
        'fixed top-0 left-0 h-screen bg-slate-900 text-white flex flex-col z-30',
        'box-border overflow-x-hidden',
        'transition-[transform,width] duration-300 ease-out md:transition-[width]',
        narrow ? 'md:w-[68px]' : 'md:w-64',
        isDesktop ? 'translate-x-0' : mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0',
        'print:hidden',
      ].join(' ')}
      aria-hidden={!isDesktop && !mobileOpen}
    >
      {/* Logo — tamamı SVG */}
      <div className="flex items-center justify-center px-2 md:px-3 h-[52px] md:h-[60px] border-b border-slate-800 min-w-0">
        <SidebarLogo className="h-11 md:h-12 w-full max-h-11 md:max-h-12 object-contain object-center" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 md:py-4 px-2 md:px-3 space-y-0.5 md:space-y-1 overflow-y-auto max-md:[&_svg]:h-4 max-md:[&_svg]:w-4">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="flex-shrink-0 [&>svg]:block">{item.icon}</span>
            {!narrow && <span className="min-w-0 leading-snug line-clamp-2 md:line-clamp-none md:truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle (masaüstü) / Kapat (mobil) */}
      <div className="p-3 border-t border-slate-800">
        {isDesktop ? (
          <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform shrink-0 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            {!narrow && <span>Daralt</span>}
          </button>
        ) : (
          <button
            type="button"
            onClick={onMobileClose}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span>Kapat</span>
          </button>
        )}
      </div>
    </aside>
  )
}
