// 用途：收盤後把「台股（TW）」盤末 ClosePrice 寫入 MongoDB（FinMind）
// 執行：node scripts/eodClosePrice.job.js
// 依賴：clients/finmind.client.js
//
// env:
//   MONGODB_URI
//   FINMIND_TOKEN

import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env', import.meta.url) })

import mongoose from 'mongoose'
import Stock from '../models/stock.js'
import ClosePrice from '../models/closePrice.js'
import { getStockHistory } from '../clients/finmind.client.js'
import symbols0050 from '../data/0050.js'

/* ------------------ utils ------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const formatYMD = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const daysAgoYMD = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatYMD(d)
}

const safeNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* ------------------ db helpers ------------------ */
/**
 * 僅保留必要欄位：
 * - market, symbol, date, close
 * - 可選：open/high/low/volume（目前保留，後續可再裁）
 */
const mapRowToClosePrice = ({ symbol, row }) => ({
  market: 'TW', // 對外與 ClosePrice 內部統一 TW
  symbol,
  date: String(row.date).slice(0, 10),
  open: safeNum(row.open),
  high: safeNum(row.max ?? row.high),
  low: safeNum(row.min ?? row.low),
  close: safeNum(row.close),
  volume: safeNum(row.Trading_Volume),
})

const upsertClosePrice = async (doc) => {
  if (!doc.date || doc.close == null) return false
  await ClosePrice.updateOne(
    { market: doc.market, symbol: doc.symbol, date: doc.date },
    { $set: doc },
    { upsert: true },
  )
  return true
}

/* ------------------ main ------------------ */

const main = async () => {
  const daysBack = 7 // 只看近 N 天
  const sleepMs = 800 // 控速，避免打爆 API

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set')
  await mongoose.connect(process.env.MONGODB_URI)

  const start_date = daysAgoYMD(daysBack)
  const end_date = daysAgoYMD(0)

  const stocks = symbols0050.map((s) => ({ symbol: s }))


  console.log('[EOD] market=TW')
  console.log('[EOD] targets=', stocks.length)
  console.log('[EOD] range', start_date, '~', end_date)

  let okCount = 0
  const failed = []

  for (const s of stocks) {
    const symbol = String(s.symbol).toUpperCase()

    try {
      const rows = await getStockHistory({
        market: 'TW',
        code: symbol,
        start_date,
        end_date,
      })

      if (!rows.length) {
        failed.push({ symbol, reason: 'no data' })
        continue
      }

      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)))
      const last2 = rows.slice(-2)

      for (const r of last2) {
        const doc = mapRowToClosePrice({ symbol, row: r })
        if (await upsertClosePrice(doc)) okCount++
      }
    } catch (e) {
      failed.push({ symbol, reason: e?.message || 'unknown error' })
    } finally {
      if (sleepMs) await sleep(sleepMs)
    }
  }

  // 統計 failed 原因（前 10 名）
  const reasonCount = failed.reduce((acc, x) => {
    const k = x.reason || 'unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  console.log(
    '[EOD] fail reasons top',
    Object.entries(reasonCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  )

  console.log(`[EOD] upsert ok=${okCount}, failed=${failed.length}`)
  if (failed.length) {
    console.log('[EOD] failed samples:', failed.slice(0, 20))
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('[EOD] fatal:', e?.message || e)
  process.exit(1)
})
