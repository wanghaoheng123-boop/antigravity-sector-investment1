import { yahooSymbolFromParam } from '@/lib/quant/yahooSymbol'
import { YahooProvider } from '@/lib/data/providers/yahoo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POLL_MS = 15_000
const yahoo = new YahooProvider()

/**
 * Server-Sent Events: periodic Yahoo quote while the client stays connected.
 * Client: `new EventSource('/api/stream/AAPL')`
 */
export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const symbol = yahooSymbolFromParam(params.ticker)
  const encoder = new TextEncoder()
  const signal = req.signal

  const stream = new ReadableStream({
    start(controller) {
      let intervalId: ReturnType<typeof setInterval> | undefined

      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      const tick = async () => {
        try {
          const q = await yahoo.fetchQuote(symbol)
          if (q) {
            send({
              type: 'quote',
              symbol: q.symbol,
              price: q.price,
              t: (q.regularMarketTime ?? new Date()).toISOString(),
            })
          } else {
            send({ type: 'quote', symbol, price: null, t: new Date().toISOString() })
          }
        } catch (e) {
          send({ type: 'error', message: String(e) })
        }
      }

      void tick()
      intervalId = setInterval(() => void tick(), POLL_MS)

      const cleanup = () => {
        if (intervalId !== undefined) clearInterval(intervalId)
        try {
          controller.close()
        } catch {
          /* closed */
        }
      }

      signal.addEventListener('abort', cleanup, { once: true })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
