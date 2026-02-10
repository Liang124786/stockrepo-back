// 用途：同步「台股」股票清單到 Stock collection（DB 內存 TWSE/TPEX；對外一律 TW）
// 執行：node scripts/syncStockUniverse.job.js
// env：MONGODB_URI, FINMIND_TOKEN（從專案根目錄 .env 載入）

// ================== 使用方式說明 ==================
// 1) 全市場同步（只抓一次 TaiwanStockInfo）：
//    node src/scripts/syncStockUniverse.job.js
//
// 2) 只同步指定股票代號（推薦）：
//    node src/scripts/syncStockUniverse.job.js --symbols=2330,006208,009816
//
// 3) 若你要「寫死」固定股票清單（不走 CLI）：
//    請修改下面 `HARDCODE_SYMBOLS`，並將其設為陣列即可。
// ==================================================

import dotenv from 'dotenv'
// 從專案根目錄載入 .env（node src/scripts/... 會以 repo root 為 cwd）
dotenv.config()
// 若你希望固定用路徑（不靠 cwd），改成：
// dotenv.config({ path: new URL('../../.env', import.meta.url) })

import mongoose from 'mongoose'
import axios from 'axios'
import Stock from '../models/stock.js'

// - 設為 null：不啟用,抓全市場
// - 設為陣列：只會同步這些股票代號
//   例如：['2330','006208','009816']
// 或透過這檔案，將代號打入裡面
// import symbols from '../data/symbolsToBackfill.js'
const HARDCODE_SYMBOLS = ['009816', '006208', '0052']

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data'

/* ------------------ utils ------------------ */

const normStr = (v) => {
  const s = String(v ?? '').trim()
  return s || null
}

const fetchFinMindDataset = async (dataset) => {
  const { data } = await axios.get(FINMIND_URL, {
    params: { dataset, token: process.env.FINMIND_TOKEN },
    timeout: 30000,
  })

  if (!data || (data.status !== 200 && data.status !== '200' && data.status !== 0)) {
    throw new Error(data?.msg || 'FinMind request failed')
  }

  return Array.isArray(data.data) ? data.data : []
}

// 依 FinMind stock_type 判斷市場：上市/上櫃
const inferMarket = (r) => {
  const t = String(r?.stock_type ?? '').trim()
  // 常見：'twse' / 'tpex'（若遇到不同值就先預設 TWSE）
  if (t.toLowerCase() === 'tpex') return 'TPEX'
  if (t.toLowerCase() === 'twse') return 'TWSE'
  return 'TWSE'
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const symArg = args.find((a) => a.startsWith('--symbols='))
  if (!symArg) return { symbols: null }

  const raw = symArg.split('=')[1] || ''
  const list = raw
    .split(',')
    .map((s) => String(s).trim())
    .filter(Boolean)
  return { symbols: list.length ? new Set(list) : null }
}

/* ------------------ main ------------------ */

const main = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set')
  if (!process.env.FINMIND_TOKEN) throw new Error('FINMIND_TOKEN not set')

  const { symbols: cliSymbols } = parseArgs()
  const symbols =
    Array.isArray(HARDCODE_SYMBOLS) && HARDCODE_SYMBOLS.length
      ? new Set(HARDCODE_SYMBOLS)
      : cliSymbols

  if (symbols) {
    console.log('[SYNC] symbols filter =', Array.from(symbols).join(','))
  } else {
    console.log('[SYNC] symbols filter = ALL')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  // 只抓台股清單
  const rows = await fetchFinMindDataset('TaiwanStockInfo')

  const ops = []

  for (const r of rows) {
    const symbol = normStr(r.stock_id)
    if (!symbol) continue

    // 👉 這一行就是「實際過濾股票代號」的地方
    if (symbols && !symbols.has(symbol)) continue

    const name = normStr(r.stock_name) ?? normStr(r.name)
    const sector = normStr(r.industry_category) ?? normStr(r.industry) ?? 'UNKNOWN'

    // ✅ DB 內市場：TWSE / TPEX（不要存 TW）
    const market = inferMarket(r)

    ops.push({
      updateOne: {
        filter: { market, symbol },
        update: {
          $set: {
            market,
            symbol,
            name,
            sector,
            isActive: true,
          },
        },
        upsert: true,
      },
    })
  }

  console.log('[SYNC] TW ops=', ops.length)

  if (ops.length) {
    const res = await Stock.bulkWrite(ops, { ordered: false })
    console.log('[SYNC] bulkWrite:', {
      inserted: res.insertedCount,
      upserted: res.upsertedCount,
      modified: res.modifiedCount,
      matched: res.matchedCount,
    })
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('[SYNC] fatal:', e?.message || e)
  process.exit(1)
})
