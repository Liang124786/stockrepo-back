import axios from '../config/axios.js'
import env from '../config/env.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'

/**
 * FinMind Client（歷史資料來源）
 *
 * 定位：
 * - 僅提供台股「歷史型資料」（EOD / 日線 / 收盤）
 * - 不處理即時報價
 * - 不關心 Express / Controller
 *
 * 備註：
 * - 已廢除美股（US）相關支援
 * - market 允許傳入 TW / TWSE / TSE（normalizeMarket 會統一成 TW）
 */

const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4'

const ensureToken = () => {
  if (!env.FINMIND_TOKEN) {
    throw new Error('FINMIND_TOKEN not set')
  }
}

/**
 * 共用底層呼叫
 */
const fetchFinMindData = async ({ dataset, data_id, start_date, end_date }) => {
  ensureToken()

  if (!dataset) throw new Error('finmind: dataset is required')
  if (!data_id) throw new Error('finmind: data_id is required')

  const { data } = await axios.get(`${FINMIND_BASE_URL}/data`, {
    params: {
      dataset,
      data_id,
      start_date,
      end_date,
      token: env.FINMIND_TOKEN,
    },
  })

  if (!data) throw new Error('finmind: empty response')
  if (data?.status !== 200 && data?.status !== 0 && data?.status !== '200') {
    throw new Error(data?.msg || 'finmind: request failed')
  }

  return data
}

/**
 * 取得股票歷史資料（日線）
 * - 僅支援 TW（包含 TWSE/TSE 會被 normalize 成 TW）
 */
export const getStockHistory = async ({ market, code, start_date, end_date }) => {
  const m = normalizeMarket(market) // => 'TW'（或丟錯）
  if (!code) throw new Error('finmind: code is required')

  if (m !== 'TW') {
    throw new Error(`finmind: unsupported market ${m}`)
  }

  const res = await fetchFinMindData({
    dataset: 'TaiwanStockPrice',
    data_id: String(code).trim(),
    start_date,
    end_date,
  })

  if (!Array.isArray(res.data)) {
    throw new Error('finmind: invalid data format')
  }

  return res.data
}

/**
 * 取得最近一筆收盤資料（台股）
 */
export const getLatestStockClose = async ({ market, code }) => {
  const rows = await getStockHistory({ market, code })
  if (rows.length === 0) return null

  const latest = rows.reduce((a, b) => (String(b.date) > String(a.date) ? b : a))

  return {
    date: latest.date,
    close: latest.close,
    open: latest.open,
    high: latest.max,
    low: latest.min,
    volume: latest.Trading_Volume ?? latest.trading_volume ?? latest.Volume ?? null,
  }
}

/**
 * 【內部用】依日期抓台股全市場（日線）
 * - 僅給 backfill / job 用
 * - 不影響既有 getStockHistory 行為
 */
export const getMarketByDate = async ({ date }) => {
  ensureToken()

  if (!date) throw new Error('finmind: date is required')

  const { data } = await axios.get(`${FINMIND_BASE_URL}/data`, {
    params: {
      dataset: 'TaiwanStockPrice',
      // ⚠️ 關鍵：不帶 data_id = 全市場
      start_date: date,
      end_date: date,
      token: env.FINMIND_TOKEN,
    },
  })

  if (!data) throw new Error('finmind: empty response')
  if (data?.status !== 200 && data?.status !== 0 && data?.status !== '200') {
    throw new Error(data?.msg || 'finmind: request failed')
  }

  if (!Array.isArray(data.data)) {
    throw new Error('finmind: invalid data format')
  }

  return data.data
}
