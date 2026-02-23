import Stock from '../models/stock.js'
import * as closePriceService from './closePrice.service.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'

export const getTreemapItems = async ({ market, symbols, limit = 50 }) => {
  const m = normalizeMarket(market)
  const list = Array.isArray(symbols) ? symbols : []

  if (!m) throw new Error('market 必填')
  if (list.length === 0) return []

  const uniq = [...new Set(list.map((s) => String(s).toUpperCase().trim()).filter(Boolean))]

  // meta：拿 name（可選）
  const stocks = await Stock.find({
    market: { $in: ['TWSE', 'TPEX', 'TSE', 'TW'] },
    symbol: { $in: uniq },
  })
    .select('symbol name')
    .lean()

  const metaMap = new Map(stocks.map((x) => [String(x.symbol).toUpperCase().trim(), x]))

  const settled = await Promise.allSettled(
    uniq.map(async (symbol) => {
      const { latest, prev } = await closePriceService.getLatestWithPrevClosePrice({
        market: m,
        symbol,
      })

      const close = Number(latest?.close)
      if (!Number.isFinite(close)) return null

      const prevClose = Number(prev?.close)
      const hasPrev = Number.isFinite(prevClose) && prevClose !== 0
      const changePct = hasPrev ? ((close - prevClose) / prevClose) * 100 : null

      const meta = metaMap.get(symbol)
      const label = meta?.name ? `${meta.name} (${symbol})` : symbol

      const amount = Number(latest?.amount ?? latest?.turnover ?? 0) || 0

      const score = Math.abs((changePct ?? 0) * amount)

      const closeDate = latest?.date ? String(latest.date).slice(0, 10) : null

      const prevCloseSafe = Number.isFinite(prevClose) ? prevClose : null

      return {
        name: label,
        value: close,
        changePct,
        symbol,
        market: m,
        CloseDate: closeDate,
        PrevClose: prevCloseSafe,
        // 排序用，不給前端
        _score: score,
      }
    }),
  )

  const items = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) items.push(r.value)
  }

  // 排序：用漲跌幅絕對值（波動最大優先）
  items.sort((a, b) => (b._score ?? 0) - (a._score ?? 0))

  const n = Number(limit)
  const safeLimit = Number.isFinite(n) && n > 0 ? Math.min(n, items.length) : items.length

  return items.slice(0, safeLimit)
}
