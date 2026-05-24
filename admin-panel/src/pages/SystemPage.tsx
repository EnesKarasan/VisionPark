import { useState } from 'react'
import AdminPricingPanel from '../components/AdminPricingPanel'
import SettingsPanel from '../components/SettingsPanel'
import SystemHealthPanel from '../components/SystemHealthPanel'

type Tab = 'pricing' | 'general' | 'health'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'pricing',
    label: 'Fiyatlandırma',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    id: 'general',
    label: 'Genel Ayarlar',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    id: 'health',
    label: 'Sistem Sağlığı',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM8.25 6.75h11.25M8.25 12h11.25M8.25 17.25h11.25" />
      </svg>
    ),
  },
]

interface SystemPageProps {
  onLogout: () => void
}

export default function SystemPage({ onLogout }: SystemPageProps) {
  const [tab, setTab] = useState<Tab>(() => {
    // Hash'ten gel — örn /sistem#health
    const h = window.location.hash.replace('#', '') as Tab
    return h === 'pricing' || h === 'general' || h === 'health' ? h : 'pricing'
  })

  function selectTab(id: Tab) {
    setTab(id)
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 pt-4 pb-0">
          <h2 className="text-lg font-semibold text-slate-800">Sistem</h2>
          <p className="text-sm text-slate-500 mt-1">
            Fiyatlandırma, ayarlar ve sistem sağlığı kontrolleri tek sayfada.
          </p>
        </div>

        {/* Tab bar */}
        <div className="mt-4 px-2 sm:px-4 border-b border-slate-200">
          <nav className="flex flex-wrap gap-1" role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(t.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                    active
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'pricing' && (
        <div className="mx-auto max-w-3xl">
          <AdminPricingPanel />
        </div>
      )}
      {tab === 'general' && <SettingsPanel onLogout={onLogout} />}
      {tab === 'health' && <SystemHealthPanel />}
    </div>
  )
}
