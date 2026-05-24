import { useState } from 'react'
import { helpContent, helpOrder } from '../lib/helpContent'

function slugify(path: string): string {
  return path === '/' ? 'genel-bakis' : path.replace(/^\//, '').replace(/\//g, '-')
}

export default function UserGuidePage() {
  const entries = helpOrder
    .map((path) => ({ path, entry: helpContent[path] }))
    .filter((x) => x.entry)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: içerik */}
        <div className="lg:col-span-2 space-y-6">
          {/* Başlık kartı */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 print:border-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  VisionPark Yönetim Paneli Kullanıcı Kılavuzu
                </h2>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed max-w-2xl">
                  Panelin tüm bölümlerine ilişkin kapsamlı rehber. Her sayfada{' '}
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-slate-100 border border-slate-300 rounded">
                    F1
                  </kbd>{' '}
                  tuşuna basarak veya üst bardaki <strong>Yardım</strong> düğmesini kullanarak o
                  sayfaya özel kısa yardım görüntüleyebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 print:hidden"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
                  />
                </svg>
                Yazdır
              </button>
            </div>
          </div>

          {/* Her bölüm için bir kart */}
          {entries.map(({ path, entry }, idx) => (
            <GuideSection
              key={path}
              id={slugify(path)}
              index={idx + 1}
              title={entry.title}
              path={path}
              intro={entry.intro}
              sections={entry.sections}
            />
          ))}

          <footer className="text-xs text-slate-400 pt-2 border-t border-slate-200 print:text-slate-600">
            © {new Date().getFullYear()} VisionPark — Yönetim Paneli Kullanıcı Kılavuzu
          </footer>
        </div>

        {/* Sağ: İçindekiler (sticky) */}
        <aside className="space-y-6 print:hidden">
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-20">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">İçindekiler</h3>
            <ol className="space-y-1.5">
              {entries.map(({ path, entry }, i) => (
                <li key={path}>
                  <a
                    href={`#${slugify(path)}`}
                    className="group flex items-start gap-2 text-sm text-slate-600 hover:text-blue-700"
                  >
                    <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold group-hover:bg-blue-100 group-hover:text-blue-700">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{entry.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-blue-900 mb-1.5">Kısayollar</h3>
            <ul className="space-y-2 text-xs text-blue-900">
              <li className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded font-semibold">F1</kbd>
                <span>Sayfa yardımı aç/kapat</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded font-semibold">Esc</kbd>
                <span>Açık yardımı kapat</span>
              </li>
              <li className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded font-semibold">Ctrl + P</kbd>
                <span>Kılavuzu yazdır</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

interface SectionProps {
  id: string
  index: number
  title: string
  path: string
  intro: string
  sections: { heading: string; body: string }[]
}

function GuideSection({ id, index, title, path, intro, sections }: SectionProps) {
  const [collapsedOnPrint] = useState(false)

  return (
    <section
      id={id}
      className={`bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-20 print:break-inside-avoid print:border-0 ${
        collapsedOnPrint ? '' : ''
      }`}
    >
      <header className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white text-sm font-semibold">
            {index}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400 font-mono">{path}</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{intro}</p>

        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={i} className="pl-3 border-l-2 border-blue-100">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
                {s.heading}
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
