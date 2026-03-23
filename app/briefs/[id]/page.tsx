import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BRIEFS } from '@/lib/mockData'
import { SECTORS } from '@/lib/sectors'

export function generateStaticParams() {
  return BRIEFS.map(b => ({ id: String(b.id) }))
}

export default function BriefDetailPage({ params }: { params: { id: string } }) {
  const brief = BRIEFS.find(b => b.id === Number(params.id))
  if (!brief) notFound()

  const sector = SECTORS.find(s => s.slug === brief.sector)

  const impactColor = (impact: string) =>
    impact === 'positive' ? '#00d084' : impact === 'negative' ? '#ff4757' : '#94a3b8'

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      {/* Back */}
      <Link href="/briefs" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
        ← All Briefs
      </Link>

      {/* Header */}
      <div className="mt-6 mb-8">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1.5"
            style={{ backgroundColor: `${sector?.color}20`, color: sector?.color }}
          >
            {sector?.icon} {sector?.name}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(brief.timestamp).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
            })} UTC
          </span>
          <span className="text-xs text-slate-600">{brief.readTime} min read</span>
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight mb-3">{brief.title}</h1>
        <p className="text-slate-400 text-base leading-relaxed border-l-2 pl-4" style={{ borderColor: sector?.color }}>
          {brief.summary}
        </p>
      </div>

      {/* Key Signals Callout */}
      <div className="rounded-xl border border-slate-800 p-5 mb-8 bg-slate-900/40">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Key Data Points</h3>
        <div className="space-y-2.5">
          {brief.signals.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <span className="text-sm text-slate-400">{s.key}</span>
              <span className="text-sm font-mono font-medium text-right shrink-0" style={{ color: impactColor(s.impact) }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Article Content */}
      <div className="prose-invert text-slate-300 leading-relaxed space-y-4">
        {brief.content.split('\n\n').map((para, i) => {
          // Bold text rendering
          const parts = para.split(/\*\*(.*?)\*\*/g)
          return (
            <p key={i} className="text-[15px] leading-7">
              {parts.map((part, j) =>
                j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part
              )}
            </p>
          )
        })}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-slate-800">
        {brief.tags.map(tag => (
          <span key={tag} className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-400">{tag}</span>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-10 pt-6 border-t border-slate-800">
        {brief.id > 1 && (
          <Link href={`/briefs/${brief.id - 1}`} className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Previous brief
          </Link>
        )}
        {brief.id < BRIEFS.length && (
          <Link href={`/briefs/${brief.id + 1}`} className="text-sm text-slate-400 hover:text-white transition-colors ml-auto">
            Next brief →
          </Link>
        )}
      </div>
    </article>
  )
}
