import Stock from '../models/stock.js'
import { getStockHistory } from '../clients/finmind.client.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'
import { BadRequestError } from '../utils/httpError.js'

/**
 * Stock Service（EOD only）
 *
 * 核心責任：
 * - 僅使用 FinMind 收盤 / 歷史資料
 * - 不再提供即時報價（已移除 TWSE）
 * - 統一資料格式給 controller / 前端（OHLCV）
 */

const normalizeCode = (code) => {
  const c = String(code || '').trim()
  if (!c) throw new BadRequestError('code is required')
  return c
}

/**
 * 將 FinMind 歷史資料 rows 標準化成 OHLCV
 * - date: YYYY-MM-DD
 * - open/high/low/close/volume: number | null
 */
const mapFinMindRowsToOHLCV = (rows) => {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => ({
      date: r.date,
      open: numberOrNull(r.open),
      high: numberOrNull(r.max),
      low: numberOrNull(r.min),
      close: numberOrNull(r.close),
      volume: numberOrNull(r.Trading_Volume),
    }))
    .filter((x) => x.date)
}

/**
 * 取得歷史日線（台股，EOD only）
 */
export const getHistoryOHLCV = async ({ market, code, start_date, end_date }) => {
  const m = normalizeMarket(market) // 只允許 TW
  const c = normalizeCode(code)

  const rows = await getStockHistory({
    market: m,
    code: c,
    start_date,
    end_date,
  })

  return mapFinMindRowsToOHLCV(rows)
}

/* ---------------- helpers ---------------- */

const numberOrNull = (v) => {
  if (v === undefined || v === null) return null
  if (v === '-' || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const listSectors = async ({ market }) => {
  const q = { isActive: true }
  if (market === 'TW') {
    q.market = { $in: ['TW', 'TWSE', 'TSE'] }
  } else if (market) {
    q.market = market
  }

  // 1️⃣ 排除 ETF / ETN 類商品（用代號最可靠）
  q.symbol = { $not: /^00/ }

  // 2️⃣ 排除商品型 sector（文字黑名單，雙保險）
  q.sector = {
    $nin: [
      'ETF',
      '上櫃指數股票型基金(ETF)',
      '指數投資證券(ETN)',
      'ETN',
      'Index',
      '存託憑證',
      '受益證券',
      '所有證券',
      '認購(售)權證',
      '認購權證',
      '認售權證',
      '受益憑證',
      '受益權證',
      '創新版股票',
      '大盤',
      '創新板股票',
    ],
  }

  let sectors = await Stock.distinct('sector', q)

  // 先清洗：只保留「非空字串」
  sectors = (sectors || []).filter((s) => typeof s === 'string' && s.trim().length > 0)
  // 排序：其他永遠最後，其餘正常排序
  sectors = sectors.sort((a, b) => {
    const ax = String(a).trim()
    const bx = String(b).trim()

    const aIsOtherFamily = ax === '其他' || ax.startsWith('其他')
    const bIsOtherFamily = bx === '其他' || bx.startsWith('其他')

    if (aIsOtherFamily && !bIsOtherFamily) return 1
    if (!aIsOtherFamily && bIsOtherFamily) return -1

    // 同屬 other 家族：讓「其他」本尊最後
    if (ax === '其他' && bx !== '其他') return 1
    if (ax !== '其他' && bx === '其他') return -1

    return ax.localeCompare(bx, 'zh-Hant')
  })
  return sectors
}
