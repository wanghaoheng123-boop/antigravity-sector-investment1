'use client'

interface NewsItem {
  title: string
  source: string
  url: string
  summary: string
}

interface NewsFeedProps {
  news: NewsItem[]
  color: string
}

export default function NewsFeed({ news, color }: NewsFeedProps) {
  return (
    <div className="space-y-3">
      {news.map((item, i) => (
        <a
          key={i}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-slate-900/60 rounded-xl p-4 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/40 transition-all group"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="text-sm font-semibold text-white group-hover:text-slate-200 leading-snug flex-1">
              {item.title}
            </h4>
            <span
              className="text-xs px-2 py-0.5 rounded font-mono shrink-0 mt-0.5"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {item.source}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{item.summary}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-slate-600 group-hover:text-slate-500 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Read full story →
          </div>
        </a>
      ))}
    </div>
  )
}
