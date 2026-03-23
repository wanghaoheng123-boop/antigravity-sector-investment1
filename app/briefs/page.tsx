import Link from 'next/link'
import { BRIEFS } from '@/lib/mockData'
import { SECTORS } from '@/lib/sectors'

export default function BriefsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-10">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
          ← Markets
        </Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Intelligence Briefs</h1>
        <p className="text-slate-500">
          In-depth sector analysis with embedded signals, dark pool intel, and curated news.
          Every brief synthesized from institutional-grade sources.
        </p>
      </div>

      <div className="space-y-4">
        {BRIEFS.map(brief => {
          const sector = SECTORS.find(s => s.slug === brief.sector)
          return (
            <Link key={brief.id} href={`/briefs/${brief.id}`}>
              <div className="group rounded-xl border border-slate-800 p-5 hover:border-slate-600 hover:bg-slate-900/40 transition-all">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${sector?.color}15`, border: `1px solid ${sector?.color}30` }}
                    >
                      {sector?.icon}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${sector?.color}20`, color: sector?.color }}
                      >
                        {sector?.name}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(brief.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC
                      </span>
                      <span className="text-xs text-slate-600">· {brief.readTime} min read</span>
                    </div>
                    <h2 className="font-semibold text-white group-hover:text-slate-200 mb-1.5 leading-snug">{brief.title}</h2>
                    <p className="text-sm text-slate-500 line-clamp-2">{brief.summary}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {brief.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-slate-600 group-hover:text-slate-400 transition-colors text-lg shrink-0 self-center">→</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
