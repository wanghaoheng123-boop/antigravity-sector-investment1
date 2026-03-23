'use client'

interface TickerItem {
  ticker: string
  name: string
  price: number
  changePct: number
}

interface PriceTickerProps {
  items: TickerItem[]
}

export default function PriceTicker({ items }: PriceTickerProps) {
  // Duplicate items for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="relative w-full bg-slate-900/80 border-b border-slate-800 overflow-hidden py-2">
      {/* Fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-900/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-900/80 to-transparent z-10 pointer-events-none" />

      <div className="flex animate-ticker gap-8" style={{ width: 'max-content' }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold font-mono text-white">{item.ticker}</span>
            <span className="text-xs font-mono text-white">${item.price.toFixed(2)}</span>
            <span className={`text-xs font-mono ${item.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.changePct >= 0 ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
            </span>
            {i < doubled.length - 1 && (
              <span className="text-slate-700 ml-2">|</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
