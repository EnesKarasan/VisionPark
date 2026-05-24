import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminPricing,
  getAdminSpots,
  listAdminUsers,
  redirectIfUnauthorized,
  type AdminPricing,
  type AdminSessionRow,
  type AdminUserRow,
  type SpotWithSection,
} from '../api'
import type { AdminRole } from '../App'

interface Props {
  role: AdminRole
  totalSpots: number
  availableSpots: number
  todayRevenue: number
  activeSessions: number
  recentSessions: AdminSessionRow[]
}

/**
 * Genel Bakış sayfasındaki "Hızlı erişim" kartları.
 * Her kart bir alt sayfayı temsil eder, ilgili sayfanın en son 5 kaydını/özetini gösterir,
 * tıklanınca o sayfaya yönlendirir.
 * Operatör rolünde yalnızca staff-erişimli kartlar (Kılavuz, Ayarlar) görünür.
 */
export default function DashboardQuickNav({
  role,
  totalSpots,
  availableSpots,
  todayRevenue,
  activeSessions,
  recentSessions,
}: Props) {
  const [pricing, setPricing] = useState<AdminPricing | null>(null)
  const [spots, setSpots] = useState<SpotWithSection[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])

  useEffect(() => {
    if (role !== 'admin') return
    const t = localStorage.getItem('token')
    if (!t) return
    getAdminPricing(t)
      .then(setPricing)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) console.error(e)
      })
    getAdminSpots(t)
      .then(setSpots)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) console.error(e)
      })
    listAdminUsers(t)
      .then(setUsers)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) console.error(e)
      })
  }, [role])

  // Bölüm bazlı spot sayısı (ilk 5)
  const sectionStats = (() => {
    const map = new Map<string, { total: number; occupied: number }>()
    for (const s of spots) {
      const key = s.section ?? '—'
      const m = map.get(key) ?? { total: 0, occupied: 0 }
      m.total += 1
      if (s.is_occupied) m.occupied += 1
      map.set(key, m)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 5)
  })()

  const last5Sessions = recentSessions.slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {role === 'admin' && (
        <SessionsCard sessions={last5Sessions} todayRevenue={todayRevenue} activeSessions={activeSessions} />
      )}

      {role === 'admin' && (
        <SpotsCard
          totalSpots={totalSpots}
          availableSpots={availableSpots}
          sectionStats={sectionStats}
        />
      )}

      {role === 'admin' && <UsersCard users={users} />}

      {role === 'admin' && <SystemCard pricing={pricing} />}

      <GuideCard />
    </div>
  )
}

/* ── Şablon: kart başlığı + altta liste/içerik + footer linki ───────────── */

interface CardShellProps {
  to: string
  title: string
  subtitle?: string
  badge?: string
  accent: 'emerald' | 'indigo' | 'amber' | 'sky' | 'slate'
  icon: React.ReactNode
  children: React.ReactNode
}

const accentMap: Record<CardShellProps['accent'], { iconBg: string; iconFg: string; cta: string; badge: string }> = {
  emerald: { iconBg: 'bg-emerald-50', iconFg: 'text-emerald-600', cta: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  indigo: { iconBg: 'bg-indigo-50', iconFg: 'text-indigo-600', cta: 'text-indigo-700', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  amber: { iconBg: 'bg-amber-50', iconFg: 'text-amber-600', cta: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  sky: { iconBg: 'bg-sky-50', iconFg: 'text-sky-600', cta: 'text-sky-700', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  slate: { iconBg: 'bg-slate-100', iconFg: 'text-slate-700', cta: 'text-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
}

function CardShell({ to, title, subtitle, badge, accent, icon, children }: CardShellProps) {
  const a = accentMap[accent]
  return (
    <Link
      to={to}
      className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${a.iconBg} ${a.iconFg}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
              {badge && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${a.badge}`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-3">{children}</div>

      <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-end">
        <span className={`text-xs font-medium ${a.cta} inline-flex items-center gap-1`}>
          Sayfaya git
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

/* ── 1) Raporlar: son 5 oturum (kompakt liste) ─────────────────────────── */

function SessionsCard({
  sessions,
  todayRevenue,
  activeSessions,
}: {
  sessions: AdminSessionRow[]
  todayRevenue: number
  activeSessions: number
}) {
  return (
    <CardShell
      to="/oturumlar"
      title="Raporlar ve İstatistikler"
      subtitle={`Bugün ₺${todayRevenue.toLocaleString('tr')} · ${activeSessions} aktif`}
      badge="Son 5"
      accent="emerald"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v7.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 20.25v-7.125ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      }
    >
      {sessions.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Henüz oturum yok</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sessions.map((s) => (
            <li key={s.id} className="py-2 flex items-center gap-2 text-xs">
              <span className="inline-block min-w-[3.5rem] font-mono font-semibold text-slate-700">
                {s.spot_number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-slate-700 truncate">{s.customer_name || s.customer_email || 'Misafir'}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {s.plate_number || '—'} · {new Date(s.started_at).toLocaleString('tr', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
              <span className="shrink-0 font-medium text-slate-700">
                {s.total_fee != null ? `₺${s.total_fee}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  )
}

/* ── 2) Park Alanları: ilk 5 bölüm + doluluk ───────────────────────────── */

function SpotsCard({
  totalSpots,
  availableSpots,
  sectionStats,
}: {
  totalSpots: number
  availableSpots: number
  sectionStats: Array<[string, { total: number; occupied: number }]>
}) {
  return (
    <CardShell
      to="/park-alanlari"
      title="Park Alanlarını Düzenle"
      subtitle={`${totalSpots} tanımlı alan · ${availableSpots} boş`}
      badge={`${sectionStats.length} bölüm`}
      accent="indigo"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      }
    >
      {sectionStats.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Henüz park alanı yok</p>
      ) : (
        <ul className="space-y-1.5">
          {sectionStats.map(([section, stats]) => {
            const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
            return (
              <li key={section} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">Bölüm {section}</span>
                  <span className="text-slate-500">
                    <span className="font-medium text-slate-700">{stats.total - stats.occupied}</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span>{stats.total} boş</span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </CardShell>
  )
}

/* ── 3) Kullanıcılar: son eklenen 5 kullanıcı ──────────────────────────── */

function UsersCard({ users }: { users: AdminUserRow[] }) {
  const top5 = users.slice(0, 5)
  const counts = {
    admin: users.filter((u) => u.role === 'admin').length,
    operator: users.filter((u) => u.role === 'operator').length,
    customer: users.filter((u) => u.role === 'customer').length,
  }
  const roleLabel: Record<string, string> = {
    admin: 'Yönetici',
    operator: 'Operatör',
    customer: 'Müşteri',
  }
  const roleStyle: Record<string, string> = {
    admin: 'bg-blue-100 text-blue-700',
    operator: 'bg-amber-100 text-amber-700',
    customer: 'bg-slate-100 text-slate-700',
  }
  return (
    <CardShell
      to="/kullanicilar"
      title="Kullanıcılar"
      subtitle={`${users.length} kayıtlı (${counts.admin} yönetici, ${counts.operator} operatör, ${counts.customer} müşteri)`}
      badge="Son 5"
      accent="emerald"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      }
    >
      {top5.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Kullanıcı yükleniyor…</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {top5.map((u) => (
            <li key={u.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-700 truncate">{u.full_name || u.email.split('@')[0]}</div>
                <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
              </div>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${roleStyle[u.role]}`}>
                {roleLabel[u.role]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  )
}

/* ── 4) Sistem: Fiyat + Ayarlar + Sağlık özeti ─────────────────────────── */

function SystemCard({ pricing }: { pricing: AdminPricing | null }) {
  const items = [
    {
      label: 'Fiyatlandırma',
      desc: pricing ? `${pricing.free_minutes} dk ücretsiz · ${pricing.brackets.length} dilim` : 'Tarife yükleniyor…',
    },
    { label: 'Veritabanı yedeği', desc: 'Sistem çalışırken indirin' },
    { label: 'Bildirimler', desc: 'E-posta, doluluk, gelir' },
    { label: 'Sistem sağlığı', desc: 'Backend, DB, YOLO durumu' },
    { label: 'Oturum yönetimi', desc: 'Çıkış + hesap durumu' },
  ]
  return (
    <CardShell
      to="/sistem"
      title="Sistem"
      subtitle="Fiyatlandırma · Ayarlar · Sağlık"
      badge="3 sekme"
      accent="amber"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122" />
        </svg>
      }
    >
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-700">{it.label}</div>
              <div className="text-[11px] text-slate-400 truncate">{it.desc}</div>
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  )
}

/* ── 4) Kullanıcı Kılavuzu ─────────────────────────────────────────────── */

function GuideCard() {
  const guides = [
    { title: 'Genel Bakış', desc: 'Canlı durum + hızlı erişim' },
    { title: 'Park Alanları', desc: 'Çizim editörü ve YOLO eşleştirmesi' },
    { title: 'Raporlar', desc: 'Z raporu, CSV, grafikler' },
    { title: 'Fiyatlandırma', desc: 'Kademeli tarife yapılandırması' },
    { title: 'Ayarlar', desc: 'Yedekleme, oturum, bildirim' },
  ]
  return (
    <CardShell
      to="/kilavuz"
      title="Kullanıcı Kılavuzu"
      subtitle="Adım adım rehber + F1 kısayolu"
      badge="6 bölüm"
      accent="sky"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      }
    >
      <ul className="space-y-1">
        {guides.map((g, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-5 h-5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-700">{g.title}</div>
              <div className="text-[11px] text-slate-400 truncate">{g.desc}</div>
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  )
}

