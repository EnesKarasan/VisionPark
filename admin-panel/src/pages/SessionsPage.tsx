import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getAdminSessions,
  getAdminReportsTimeseries,
  redirectIfUnauthorized,
  type AdminSessionRow,
  type TimeseriesGranularity,
  type TimeseriesResponse,
} from '../api'
import { TableSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

/* ── Yardımcılar ───────────────────────────────────────────────────────── */

function isCompletedStatus(status: string) {
  return status === 'ended' || status === 'cancelled' || status === 'completed'
}

function localDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE')
}

function formatCardSummary(p: AdminSessionRow['payment']): string {
  if (!p?.card_last_four && !p?.card_brand) return '—'
  const bits: string[] = []
  if (p.card_brand) bits.push(p.card_brand.toUpperCase())
  if (p.card_last_four) bits.push(`•••• ${p.card_last_four}`)
  return bits.join(' ')
}

function sessionMatchesSearch(s: AdminSessionRow, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const hay = [
    String(s.id),
    s.spot_number,
    s.customer_name,
    s.customer_email,
    s.plate_number ?? '',
    s.status,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(needle)
}

function escapeCsvCell(v: string): string {
  if (/[",;\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const diff = end - start
  if (!Number.isFinite(diff) || diff < 0) return '—'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}sa ${m}dk`
  return `${m}dk`
}

/* ── Sayfa ─────────────────────────────────────────────────────────────── */

export default function SessionsPage() {
  const toast = useToast()
  const [sessions, setSessions] = useState<AdminSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [zReportDate, setZReportDate] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [chartGranularity, setChartGranularity] = useState<TimeseriesGranularity>('daily')
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [pdfHint, setPdfHint] = useState(false)
  // Özel tarih aralığı (boş = tüm zamanlar)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    function handleErr(e: unknown) {
      if (redirectIfUnauthorized(e)) return
      const msg = e instanceof Error ? e.message : 'Veriler alınamadı'
      setLoadError(msg)
      console.error(e)
    }
    function load() {
      const token = localStorage.getItem('token')
      if (!token) return
      getAdminSessions(token, { limit: 500 })
        .then((data) => {
          setSessions(data)
          setLoadError(null)
        })
        .catch(handleErr)
        .finally(() => setLoading(false))
    }
    load()
    const id = setInterval(load, 8000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    setChartError(null)
    getAdminReportsTimeseries(token, {
      granularity: chartGranularity,
      days:
        chartGranularity === 'daily' ? 30
        : chartGranularity === 'weekly' ? 84
        : chartGranularity === 'monthly' ? 365
        : 1825,
    })
      .then(setTimeseries)
      .catch((e) => {
        if (redirectIfUnauthorized(e)) return
        setChartError(e instanceof Error ? e.message : 'Grafik verisi alınamadı')
      })
  }, [chartGranularity])

  const overviewStats = useMemo(() => {
    const active = sessions.filter((s) => s.status === 'active').length
    const cancelled = sessions.filter((s) => s.status === 'cancelled').length
    const completed = sessions.filter((s) => isCompletedStatus(s.status) && s.status !== 'cancelled').length
    const withFee = sessions.filter((s) => s.total_fee != null && s.total_fee > 0)
    const sumFees = withFee.reduce((sum, s) => sum + (s.total_fee ?? 0), 0)
    const avgFee = withFee.length > 0 ? sumFees / withFee.length : 0
    return {
      total: sessions.length,
      active,
      completed,
      cancelled,
      sumFees,
      avgFee,
      feeCount: withFee.length,
    }
  }, [sessions])

  const zMetrics = useMemo(() => {
    let revenue = 0
    let paymentsCount = 0
    let endedCount = 0
    let cancelledCount = 0
    for (const s of sessions) {
      if (s.payment?.status === 'completed' && s.payment.created_at) {
        if (localDateKey(s.payment.created_at) === zReportDate) {
          revenue += s.payment.amount
          paymentsCount += 1
        }
      }
      if (s.status === 'ended' && s.ended_at && localDateKey(s.ended_at) === zReportDate) endedCount += 1
      if (s.status === 'cancelled' && s.ended_at && localDateKey(s.ended_at) === zReportDate) cancelledCount += 1
    }
    return { revenue, paymentsCount, endedCount, cancelledCount }
  }, [sessions, zReportDate])

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    return sessions.filter((s) => {
      if (statusFilter === 'active' && s.status !== 'active') return false
      if (statusFilter === 'completed' && !(isCompletedStatus(s.status) && s.status !== 'cancelled')) return false
      if (statusFilter === 'cancelled' && s.status !== 'cancelled') return false
      if (!sessionMatchesSearch(s, search)) return false
      if (fromTs != null || toTs != null) {
        const ts = new Date(s.started_at).getTime()
        if (fromTs != null && ts < fromTs) return false
        if (toTs != null && ts > toTs) return false
      }
      return true
    })
  }, [sessions, statusFilter, search, dateFrom, dateTo])

  // Tarih aralığına göre özet (aralık özet kartı için)
  const rangeStats = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    if (fromTs == null && toTs == null) return null
    let count = 0, revenue = 0, durationMin = 0, durationCount = 0
    for (const s of sessions) {
      const ts = new Date(s.started_at).getTime()
      if (fromTs != null && ts < fromTs) continue
      if (toTs != null && ts > toTs) continue
      count += 1
      if (s.payment?.status === 'completed') revenue += s.payment.amount
      if (s.ended_at) {
        const d = new Date(s.ended_at).getTime() - ts
        if (d > 0) {
          durationMin += d / 60000
          durationCount += 1
        }
      }
    }
    return {
      count,
      revenue,
      avgDuration: durationCount > 0 ? durationMin / durationCount : 0,
    }
  }, [sessions, dateFrom, dateTo])

  function clearDateRange() {
    setDateFrom('')
    setDateTo('')
  }

  function setQuickRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateFrom(start.toLocaleDateString('sv-SE'))
    setDateTo(end.toLocaleDateString('sv-SE'))
  }

  function downloadCsv() {
    if (filtered.length === 0) {
      toast.warning('Filtreye uygun kayıt yok, CSV oluşturulamadı.')
      return
    }
    const sep = ';'
    const headers = [
      'Oturum ID', 'Kullanıcı ID', 'Alan', 'Müşteri', 'E-posta', 'Plaka',
      'Başlangıç', 'Bitiş', 'Süre', 'Ücret', 'Ödeme tutarı', 'Ödeme durumu', 'Kart', 'Durum',
    ]
    const rows = filtered.map((s) => {
      const p = s.payment
      return [
        String(s.id),
        String(s.user_id),
        s.spot_number,
        s.customer_name,
        s.customer_email,
        s.plate_number ?? '',
        s.started_at,
        s.ended_at ?? '',
        formatDuration(s.started_at, s.ended_at),
        s.total_fee != null ? String(s.total_fee) : '',
        p ? String(p.amount) : '',
        p?.status ?? '',
        formatCardSummary(p),
        s.status,
      ]
    })
    const lines = [headers, ...rows].map((r) => r.map(escapeCsvCell).join(sep)).join('\r\n')
    const blob = new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `visionpark-raporlar-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`${filtered.length} kayıtlı CSV indirildi.`, 'CSV hazır')
  }

  function handlePrint() {
    window.print()
  }

  function handlePdf() {
    setPdfHint(true)
    setTimeout(() => {
      setPdfHint(false)
      window.print()
    }, 1500)
  }

  const chartData = timeseries?.buckets ?? []
  const dateLabel = new Date(zReportDate + 'T00:00:00').toLocaleDateString('tr', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="sessions-report space-y-6">
      {/* Print-only başlık */}
      <header className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-slate-900">VisionPark Otopark Raporu</h1>
        <p className="text-sm text-slate-600 mt-1">
          {dateLabel} · Yazdırma tarihi: {new Date().toLocaleString('tr')}
        </p>
      </header>

      {loadError && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      {/* Üst eylem barı */}
      <div className="no-print bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Raporlar ve İstatistikler</h2>
            <p className="text-xs text-slate-500 mt-0.5">Son 500 oturum üzerinden özet · Otomatik yenileme açık (8 sn)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              <CsvIcon /> CSV
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              title='Yazdırma diyaloğunda "PDF olarak kaydet" seçin'
            >
              <PdfIcon /> PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
            >
              <PrintIcon /> Yazdır
            </button>
          </div>
        </div>

        {/* Tarih aralığı satırı */}
        <div className="px-4 py-3 bg-slate-50/60 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Tarih Aralığı</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none"
            />
            <span className="text-slate-400 text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1 ml-auto">
            <QuickRangeBtn onClick={() => setQuickRange(0)} label="Bugün" />
            <QuickRangeBtn onClick={() => setQuickRange(7)} label="Son 7 gün" />
            <QuickRangeBtn onClick={() => setQuickRange(30)} label="Son 30 gün" />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={clearDateRange}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Aralık özet kartı (yalnızca aralık seçili ise) */}
        {rangeStats && (
          <div className="px-4 py-3 bg-blue-50/40 border-t border-blue-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <RangeStat label="Aralıktaki Oturum" value={rangeStats.count.toString()} />
            <RangeStat label="Aralık Geliri" value={`₺${rangeStats.revenue.toFixed(2)}`} accent="emerald" />
            <RangeStat
              label="Ortalama Süre"
              value={
                rangeStats.avgDuration > 0
                  ? `${Math.floor(rangeStats.avgDuration / 60)}sa ${Math.round(rangeStats.avgDuration % 60)}dk`
                  : '—'
              }
            />
            <RangeStat
              label="Aralık"
              value={`${dateFrom || '—'} → ${dateTo || '—'}`}
              mono
            />
          </div>
        )}
      </div>

      {/* KPI strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Toplam Oturum" value={overviewStats.total} accent="indigo" />
        <KpiCard label="Aktif" value={overviewStats.active} accent="emerald" pulse />
        <KpiCard label="Tamamlanan" value={overviewStats.completed} accent="sky" />
        <KpiCard label="İptal" value={overviewStats.cancelled} accent="amber" />
        <KpiCard
          label="Toplam Ciro"
          valueStr={`₺${overviewStats.sumFees.toLocaleString('tr', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="rose"
          subtitle={`Ortalama: ₺${overviewStats.avgFee.toFixed(2)} (${overviewStats.feeCount} kayıt)`}
        />
      </section>

      {/* Grafikler */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden chart-break">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Gelir ve Oturum Trendi</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tamamlanan ödemeler ve biten oturumlar (sunucu UTC)</p>
          </div>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg no-print">
            {([
              ['daily', 'Günlük'],
              ['weekly', 'Haftalık'],
              ['monthly', 'Aylık'],
              ['yearly', 'Yıllık'],
            ] as const).map(([g, label]) => (
              <button
                key={g}
                type="button"
                onClick={() => setChartGranularity(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  chartGranularity === g
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="hidden print:inline text-xs text-slate-500">
            Dönem: {chartGranularity === 'daily' ? 'Günlük' : chartGranularity === 'weekly' ? 'Haftalık' : chartGranularity === 'monthly' ? 'Aylık' : 'Yıllık'}
          </span>
        </div>

        {chartError && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">{chartError}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <ChartCard title="Gelir (₺)" data={chartData} dataKey="revenue" color="blue" />
          <ChartCard title="Biten Oturum" data={chartData} dataKey="sessions" color="green" />
        </div>
      </section>

      {/* Z Raporu */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden chart-break">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Günlük Z Raporu</h3>
            <p className="text-xs text-slate-500 mt-0.5">{dateLabel}</p>
          </div>
          <div className="no-print">
            <label className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-600">Tarih:</span>
              <input
                type="date"
                value={zReportDate}
                onChange={(e) => setZReportDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
          <ZTile label="Gün Geliri" value={`₺${zMetrics.revenue.toFixed(2)}`} highlight />
          <ZTile label="Tamamlanan Ödeme" value={zMetrics.paymentsCount.toString()} />
          <ZTile label="Biten Oturum" value={zMetrics.endedCount.toString()} />
          <ZTile label="İptal" value={zMetrics.cancelledCount.toString()} />
        </div>
      </section>

      {/* Kayıt tablosu */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden chart-break">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Oturum Kayıtları</h3>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} kayıt gösteriliyor (filtrelenmiş)</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 no-print">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="ID, alan, müşteri, plaka ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none"
              />
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {([
                ['all', 'Tümü', overviewStats.total],
                ['active', 'Aktif', overviewStats.active],
                ['completed', 'Tamamlandı', overviewStats.completed],
                ['cancelled', 'İptal', overviewStats.cancelled],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center gap-1.5 ${
                    statusFilter === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusFilter === id ? 'bg-slate-100' : 'bg-white/60'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Alan</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Müşteri</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plaka</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Başlangıç</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Süre</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ücret</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kart</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <TableSkeleton rows={5} cols={7} />
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">#{s.id}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{s.spot_number}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-800 truncate max-w-[180px]" title={s.customer_name || s.customer_email}>
                      {s.customer_name || '—'}
                    </div>
                    {s.customer_email && (
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{s.customer_email}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{s.plate_number || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                    {new Date(s.started_at).toLocaleString('tr', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{formatDuration(s.started_at, s.ended_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {s.total_fee == null ? (
                      <span className="text-slate-400">—</span>
                    ) : Number(s.total_fee) === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                        Ücretsiz
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800">₺{Number(s.total_fee).toLocaleString('tr', { minimumFractionDigits: 2 })}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{formatCardSummary(s.payment)}</td>
                  <td className="px-3 py-2.5"><SessionStatusPill status={s.status} /></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title={
                        search || statusFilter !== 'all' || dateFrom || dateTo
                          ? 'Filtreye uygun kayıt yok'
                          : 'Henüz oturum kaydı yok'
                      }
                      description={
                        search || statusFilter !== 'all' || dateFrom || dateTo
                          ? 'Filtreleri temizleyip tüm kayıtları görüntülemek için "Tümü" butonunu kullanın.'
                          : 'İlk park oturumu açıldığında burada listelenecektir.'
                      }
                      icon={
                        <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v7.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 20.25v-7.125ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                        </svg>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PDF hint overlay */}
      {pdfHint && (
        <div className="no-print fixed inset-x-0 top-20 z-50 flex justify-center">
          <div className="bg-slate-900 text-white text-sm rounded-lg shadow-xl px-4 py-2 flex items-center gap-2">
            <PdfIcon className="w-4 h-4" /> Açılan diyalogda "Hedef" olarak <strong>"PDF olarak kaydet"</strong> seçin
          </div>
        </div>
      )}

      {/* Print-friendly CSS */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .chart-break { page-break-inside: avoid; break-inside: avoid; }
          .sessions-report { font-size: 11px; }
          .sessions-report h1, .sessions-report h2, .sessions-report h3 { color: #0f172a !important; }
          .sessions-report .bg-white { box-shadow: none !important; border-color: #cbd5e1 !important; }
          .sessions-report table thead { background: #f1f5f9 !important; }
        }
      `}</style>
    </div>
  )
}

/* ── Mini bileşenler ───────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string
  value?: number
  valueStr?: string
  accent: 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose'
  subtitle?: string
  pulse?: boolean
}

const kpiAccent: Record<KpiCardProps['accent'], { bg: string; icon: string; ring: string }> = {
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', ring: 'border-l-indigo-500' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'border-l-emerald-500' },
  sky: { bg: 'bg-sky-50', icon: 'text-sky-600', ring: 'border-l-sky-500' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'border-l-amber-500' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', ring: 'border-l-rose-500' },
}

function KpiCard({ label, value, valueStr, accent, subtitle, pulse }: KpiCardProps) {
  const a = kpiAccent[accent]
  const display = valueStr ?? (value !== undefined ? value.toLocaleString('tr') : '—')
  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${a.ring} rounded-lg p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-1 tabular-nums truncate">{display}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-1 truncate">{subtitle}</p>}
        </div>
        {pulse && value !== undefined && value > 0 && (
          <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1" />
        )}
      </div>
    </div>
  )
}

function ZTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 ${highlight ? 'bg-emerald-50/30' : ''}`}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

interface ChartCardProps {
  title: string
  data: TimeseriesResponse['buckets']
  dataKey: 'revenue' | 'sessions'
  color: 'blue' | 'green'
}

function ChartCard({ title, data, dataKey, color }: ChartCardProps) {
  const palette = color === 'blue'
    ? { stroke: '#1d4ed8', fill1: '#2563eb', fill2: '#60a5fa', dot: '#2563eb', activeDot: '#1e40af' }
    : { stroke: '#047857', fill1: '#059669', fill2: '#34d399', dot: '#059669', activeDot: '#065f46' }
  const fillId = `fill-${dataKey}-${color}`

  return (
    <div className="p-5">
      <p className="text-sm font-medium text-slate-700 mb-3">{title}</p>
      <div className="h-[260px] w-full min-w-0">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.fill1} stopOpacity={0.45} />
                  <stop offset="55%" stopColor={palette.fill2} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={palette.fill2} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={dataKey !== 'sessions'} />
              <Tooltip
                formatter={(v) => [
                  dataKey === 'revenue' ? `₺${Number(v ?? 0).toFixed(2)}` : v,
                  dataKey === 'revenue' ? 'Gelir' : 'Oturum',
                ]}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)' }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={palette.stroke}
                strokeWidth={2.5}
                fill={`url(#${fillId})`}
                animationDuration={900}
                dot={{ r: 4, fill: palette.dot, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: palette.activeDot, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">Veri yok</p>
        )}
      </div>
    </div>
  )
}

function QuickRangeBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
    >
      {label}
    </button>
  )
}

function RangeStat({ label, value, accent, mono }: { label: string; value: string; accent?: 'emerald'; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className={`text-base font-semibold mt-0.5 ${accent === 'emerald' ? 'text-emerald-700' : 'text-slate-800'} ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function SessionStatusPill({ status }: { status: string }) {
  if (status === 'active')
    return <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Aktif</span>
  if (status === 'cancelled')
    return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">İptal</span>
  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">Tamamlandı</span>
}

function CsvIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>)
}
function PdfIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>)
}
function PrintIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>)
}

// ReactNode kullanımı için (unused import fix)
export type _SessionsReactNode = ReactNode
