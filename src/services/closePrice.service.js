import axios from '../config/axios.js'
import ClosePrice from '../models/closePrice.js'
import { toDateString, normalizeYMD, daysAgo } from '../utils/time.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'
import Stock from '../models/stock.js'

/**
 * ClosePrice Service
 * - 專責外部收盤價資料的抓取、正規化、入庫與查詢
 * - 日期處理一律走 utils/time.js（不直接使用 dayjs）
 * - 對外 market 一律 TW；內部查詢需兼容舊資料（TW / TWSE / TSE）
 * - 僅使用 FinMind（已移除 TWSE snapshot/即時）
 * - 已移除 US 支援
 */

const FINMIND_TOKEN = process.env.FINMIND_TOKEN || ''
const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data'

const SOURCE = {
  FINMIND: 'finmind',
}

/**
 * 內部統一的 ClosePrice 格式（DB upsert 前）
 * date: 'YYYY-MM-DD'
 */
function normalizeClosePrice({ market, symbol, date, open, high, low, close, volume, source }) {
  // ✅ 對外/入庫一律用 TW（ClosePrice schema 允許 TW/TWSE/TSE，但我們新資料統一存 TW）
  const m = normalizeMarket(market)

  return {
    market: m,
    symbol: String(symbol).toUpperCase(),
    date: normalizeYMD(date),
    open: open ?? null,
    high: high ?? null,
    low: low ?? null,
    close: close ?? null,
    volume: volume ?? null,
    source: source ?? null,
  }
}

/**
 * FinMind：抓台股日 OHLCV
 */
async function fetchTWCloseFromFinMind({ symbol, startDate, endDate }) {
  if (!FINMIND_TOKEN) throw new Error('FINMIND_TOKEN not set')

  const params = {
    dataset: 'TaiwanStockPrice',
    data_id: symbol,
    start_date: startDate,
    end_date: endDate,
    token: FINMIND_TOKEN,
  }

  const { data } = await axios.get(FINMIND_BASE_URL, { params })

  // FinMind status 可能是 200 / '200' / 0
  const status = data?.status
  if (!data || (status !== 200 && status !== '200' && status !== 0)) {
    throw new Error(data?.msg || 'FinMind TW fetch failed')
  }

  const rows = Array.isArray(data.data) ? data.data : []
  return rows
    .map((r) =>
      normalizeClosePrice({
        market: 'TW',
        symbol,
        date: r.date,
        open: r.open,
        high: r.max ?? r.high,
        low: r.min ?? r.low,
        close: r.close,
        volume: r.Trading_Volume ?? r.volume,
        source: SOURCE.FINMIND,
      }),
    )
    .filter((x) => x.date)
}

async function fetchClosePricesFromProvider({ market, symbol, startDate, endDate }) {
  const m = normalizeMarket(market) // ✅ 只允許 TW
  if (m !== 'TW') throw new Error(`Unsupported market: ${market}`)

  return fetchTWCloseFromFinMind({ symbol, startDate, endDate })
}

/**
 * DB 查詢用：market filter
 * - 對外 market=TW
 * - DB 可能存在 TW / TWSE / TSE（歷史遺留）
 */
const buildMarketFilter = (market) => {
  const m = normalizeMarket(market)
  if (m === 'TW') return { $in: ['TW', 'TWSE', 'TSE'] }
  return m
}

/**
 * Upsert 多筆 close prices
 * 唯一鍵：market + symbol + date
 */
export async function upsertManyClosePrices(items) {
  if (!Array.isArray(items) || items.length === 0) return { upserted: 0 }

  const ops = items.map((it) => ({
    updateOne: {
      filter: { market: it.market, symbol: it.symbol, date: it.date },
      update: { $set: it },
      upsert: true,
    },
  }))

  const result = await ClosePrice.bulkWrite(ops, { ordered: false })
  const upserted =
    (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0) + (result.matchedCount ?? 0)

  return { upserted }
}

/**
 * 同步某檔股票的收盤價到 DB（可給日期區間）
 * - 預設：近 365 天
 */
export async function syncClosePrices({ market, symbol, startDate, endDate }) {
  const m = normalizeMarket(market)
  const s = String(symbol).toUpperCase()

  const endStr = endDate ? toDateString(endDate) : toDateString()
  const startStr = startDate ? toDateString(startDate) : daysAgo(365)

  if (!startStr || !endStr) throw new Error('Invalid startDate/endDate')

  const fetched = await fetchClosePricesFromProvider({
    market: m,
    symbol: s,
    startDate: startStr,
    endDate: endStr,
  })

  const { upserted } = await upsertManyClosePrices(fetched)

  return {
    market: m,
    symbol: s,
    range: { start: startStr, end: endStr },
    fetched: fetched.length,
    upserted,
  }
}

/**
 * 查詢：某檔股票的歷史 close prices（分頁 + 日期區間）
 */
export async function listClosePrices({
  market,
  symbol,
  startDate,
  endDate,
  page = 1,
  limit = 60,
  sort = 'desc',
}) {
  const m = normalizeMarket(market)
  const s = String(symbol).toUpperCase()

  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(500, Math.max(1, Number(limit) || 60))
  const order = sort === 'asc' ? 1 : -1

  const query = { market: buildMarketFilter(m), symbol: s }

  const startStr = startDate ? normalizeYMD(startDate) : null
  const endStr = endDate ? normalizeYMD(endDate) : null

  if (startStr || endStr) {
    query.date = {}
    if (startStr) query.date.$gte = startStr
    if (endStr) query.date.$lte = endStr
  }

  const [items, total] = await Promise.all([
    ClosePrice.find(query)
      .sort({ date: order })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    ClosePrice.countDocuments(query),
  ])

  // ✅ 對外 market 統一回 TW
  const normalizedItems = items.map((x) => ({ ...x, market: 'TW' }))

  return {
    items: normalizedItems,
    pagination: {
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l),
    },
  }
}

/**
 * 查詢：OHLCV array（給前端畫圖用）
 */
export async function getOHLCVSeries({
  market,
  symbol,
  startDate,
  endDate,
  sort = 'asc',
  limit = 2000,
}) {
  const m = normalizeMarket(market)
  const s = String(symbol).toUpperCase()

  const order = sort === 'desc' ? -1 : 1
  const l = Math.min(5000, Math.max(1, Number(limit) || 2000))

  const endStr = endDate ? normalizeYMD(endDate) : toDateString()
  const startStr = startDate ? normalizeYMD(startDate) : daysAgo(365)

  if (!startStr || !endStr) throw new Error('Invalid startDate/endDate')

  const query = {
    market: buildMarketFilter(m),
    symbol: s,
    date: { $gte: startStr, $lte: endStr },
  }

  const items = await ClosePrice.find(query)
    .sort({ date: order })
    .limit(l)
    .select('date open high low close volume -_id market')
    .lean()

  // ✅ 對外 market 統一回 TW（且 series 不需要 market 欄位，可保留或拿掉）
  return items.map(({ market: _mk, ...rest }) => rest)
}

/**
 * 查詢：最新一筆 close price
 */
export async function getLatestClosePrice({ market, symbol }) {
  const m = normalizeMarket(market)
  const s = String(symbol).toUpperCase()

  const doc = await ClosePrice.findOne({ market: buildMarketFilter(m), symbol: s })
    .sort({ date: -1 })
    .lean()

  return doc ? { ...doc, market: 'TW' } : null
}

/**
 * 查詢：最新一筆 close price + 前一筆（prev）close price
 */
export async function getLatestWithPrevClosePrice({ market, symbol }) {
  const m = normalizeMarket(market)
  const s = String(symbol).toUpperCase()

  const latest = await ClosePrice.findOne({ market: buildMarketFilter(m), symbol: s })
    .sort({ date: -1 })
    .lean()

  if (!latest) return { latest: null, prev: null }

  const prev = await ClosePrice.findOne({
    market: buildMarketFilter(m),
    symbol: s,
    date: { $lt: latest.date },
  })
    .sort({ date: -1 })
    .lean()

  return {
    latest: { ...latest, market: 'TW' },
    prev: prev ? { ...prev, market: 'TW' } : null,
  }
}

/**
 * 查詢：指定日期的 close price
 */
export async function getClosePriceByDate({ market, symbol, date }) {
  const m = normalizeMarket(market)
  const s = String(symbol).toUpperCase()
  const d = normalizeYMD(date)

  if (!d) throw new Error('Invalid date')

  const doc = await ClosePrice.findOne({ market: buildMarketFilter(m), symbol: s, date: d }).lean()

  return doc ? { ...doc, market: 'TW' } : null
}

/**
 * 批次同步：依 market 把 DB 內 active stocks 的收盤價同步到 ClosePrice
 * - 供 admin/eod job 使用
 * - 目前僅支援 TW（會兼容 DB 內 TW/TWSE/TSE）
 *
 * 回傳統計：symbols / fetched / upserted / failed
 */
export async function refreshByMarket({ market, startDate, endDate, limit = 300 }) {
  const m = normalizeMarket(market)
  if (m !== 'TW') throw new Error(`Unsupported market: ${market}`)

  // 從 Stock collection 取出 active symbol（兼容舊資料 market）
  const docs = await Stock.find({
    market: { $in: ['TW', 'TWSE', 'TSE'] },
    isActive: true,
  })
    .select('symbol -_id')
    .limit(Math.min(2000, Math.max(1, Number(limit) || 300)))
    .lean()

  const symbols = docs.map((d) => String(d.symbol || '').toUpperCase()).filter(Boolean)
  if (symbols.length === 0) {
    return {
      market: 'TW',
      startDate: startDate ? normalizeYMD(startDate) : null,
      endDate: endDate ? normalizeYMD(endDate) : null,
      symbols: 0,
      fetched: 0,
      upserted: 0,
      failed: 0,
    }
  }

  // 簡單併發池，避免一次打爆外部 API
  const concurrency = 3
  let idx = 0
  const results = []

  const worker = async () => {
    while (idx < symbols.length) {
      const i = idx++
      const symbol = symbols[i]
      try {
        const r = await syncClosePrices({ market: 'TW', symbol, startDate, endDate })
        results.push({ ok: true, ...r })
      } catch (err) {
        results.push({ ok: false, symbol, error: err?.message || String(err) })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker()))

  const fetched = results.reduce((sum, r) => sum + (r.ok ? Number(r.fetched || 0) : 0), 0)
  const upserted = results.reduce((sum, r) => sum + (r.ok ? Number(r.upserted || 0) : 0), 0)
  const failed = results.reduce((sum, r) => sum + (r.ok ? 0 : 1), 0)

  return {
    market: 'TW',
    startDate: startDate ? normalizeYMD(startDate) : null,
    endDate: endDate ? normalizeYMD(endDate) : null,
    symbols: symbols.length,
    fetched,
    upserted,
    failed,
    failedSamples: results.filter((r) => !r.ok).slice(0, 5),
  }
}
