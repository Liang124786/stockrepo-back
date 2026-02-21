// 用途：
// - per-symbol 補齊指定股票的 ClosePrice（FinMind 免費層可用）
// - 可指定日期區間
// - 補完後輸出 completeness 報告（安心用）
//
// 執行：
// node src/scripts/backfillClosePriceByDate.job.js --from=2025-07-30 --to=2026-01-27
// node src/scripts/backfillClosePriceByDate.job.js --from=2025-07-30 --to=2026-01-27 --dry
//
// 只需要改：
// import 的 symbols 檔案
//
// env:
//   MONGODB_URI
//   FINMIND_TOKEN

import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env', import.meta.url) })

import mongoose from 'mongoose'
import ClosePrice from '../models/closePrice.js'
import { getStockHistory } from '../clients/finmind.client.js'

// =========================
// ⭐ 只需要改這個 import ⭐
// =========================
// import symbols from '../data/symbolsToBackfill.js'
const symbols = ['009816','006208','0052']
// =========================

/* ------------------ utils ------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const formatYMD = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const isWeekday = (d) => {
  const day = d.getDay() // 0 Sun ... 6 Sat
  return day !== 0 && day !== 6
}

const countWeekdaysInclusive = (startYMD, endYMD) => {
  let n = 0
  let d = new Date(startYMD)
  const end = new Date(endYMD)
  while (d <= end) {
    if (isWeekday(d)) n++
    d = addDays(d, 1)
  }
  return n
}

const findFirstAvailableDate = async ({ symbol, startYMD, endYMD, stepDays = 30 }) => {
  let cursor = new Date(startYMD)
  const end = new Date(endYMD)

  while (cursor <= end) {
    const wStart = formatYMD(cursor)
    const wEnd = formatYMD(addDays(cursor, stepDays - 1))
    const wEndClamped = String(wEnd) > String(endYMD) ? endYMD : wEnd

    const rows = await getStockHistory({
      market: 'TW',
      code: symbol,
      start_date: wStart,
      end_date: wEndClamped,
    })

    if (Array.isArray(rows) && rows.length) {
      const first = rows.reduce((a, b) => (String(b.date) < String(a.date) ? b : a))
      return String(first.date).slice(0, 10)
    }

    cursor = addDays(cursor, stepDays)
  }

  return null
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const get = (k) => {
    const idx = args.findIndex((x) => x === k || x.startsWith(`${k}=`))
    if (idx === -1) return null
    const v = args[idx].includes('=') ? args[idx].split('=')[1] : args[idx + 1]
    return v || null
  }
  return {
    from: get('--from'),
    to: get('--to'),
    dry: args.includes('--dry'),
    force: args.includes('--force'),
  }
}

const safeNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* ------------------ db helpers ------------------ */

const mapRowToDoc = ({ symbol, row }) => ({
  market: 'TW',
  symbol,
  date: String(row.date).slice(0, 10),
  open: safeNum(row.open),
  high: safeNum(row.max ?? row.high),
  low: safeNum(row.min ?? row.low),
  close: safeNum(row.close),
  volume: safeNum(row.Trading_Volume),
})

const upsertMany = async (docs) => {
  const ops = docs
    .filter((d) => d.date && d.symbol && d.close != null)
    .map((d) => ({
      updateOne: {
        filter: { market: d.market, symbol: d.symbol, date: d.date },
        update: { $set: d },
        upsert: true,
      },
    }))

  if (!ops.length) return 0
  const res = await ClosePrice.bulkWrite(ops, { ordered: false })
  return (res.upsertedCount || 0) + (res.modifiedCount || 0)
}

/**
 * 找出某股票在區間內缺的日期區間
 */
const findMissingRangesForSymbol = async ({ symbol, startYMD, endYMD }) => {
  const rows = await ClosePrice.find(
    {
      market: 'TW',
      symbol,
      date: { $gte: startYMD, $lte: endYMD },
    },
    { date: 1, _id: 0 },
  ).lean()

  const have = new Set(rows.map((r) => r.date))

  const ranges = []
  let curStart = null
  let d = new Date(startYMD)
  const end = new Date(endYMD)

  while (d <= end) {
    // 只補齊平日（週六/週日 FinMind 通常無資料，避免產生大量 no data）
    if (!isWeekday(d)) {
      // 若剛好在缺口區間內，週末直接跳過並持續缺口
      d = addDays(d, 1)
      continue
    }
    const ymd = formatYMD(d)
    const has = have.has(ymd)

    if (!has && !curStart) curStart = ymd
    if (has && curStart) {
      ranges.push({ start: curStart, end: formatYMD(addDays(d, -1)) })
      curStart = null
    }

    d = addDays(d, 1)
  }

  if (curStart) ranges.push({ start: curStart, end: endYMD })
  return ranges
}

/**
 * 計算 completeness（實際有幾天）
 */
const countDaysForSymbol = async ({ symbol, startYMD, endYMD }) => {
  return ClosePrice.countDocuments({
    market: 'TW',
    symbol,
    date: { $gte: startYMD, $lte: endYMD },
  })
}

/* ------------------ main ------------------ */

const main = async () => {
  const { dry, from, to, force } = parseArgs()

  // ✅ connect mongo (一定要在任何 ClosePrice 查詢前)
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')

  mongoose.set('bufferTimeoutMS', 60000) // 避免慢連線 10s 就死
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
  })
  console.log('[BACKFILL] mongo connected')

  // ======================
  // ⭐ 日期範圍寫在 code ⭐
  // ======================
  const START_YMD = from || '2026-02-05'
  const END_YMD = to || '2026-02-10' // 或用今天：formatYMD(new Date())
  // ======================

  const startYMD = START_YMD
  const endYMD = END_YMD

  // 600/hr → 6s；保守給 6.5s
  const sleepMs = 6500

  const list = symbols.map((s) => String(s).toUpperCase())

  console.log('[BACKFILL] symbols=', list.length)
  console.log('[BACKFILL] range=', startYMD, '~', endYMD)
  console.log('[BACKFILL] mode=', dry ? 'DRY' : 'WRITE', force ? '(force)' : '')
  console.log('[BACKFILL] sleepMs=', sleepMs)

  let totalReq = 0
  let totalUpserts = 0
  const report = []

  for (const symbol of list) {
    // ✅ Strategy B: auto-start at the first available trading day within the requested range
    // - If the symbol has no data in the entire range, skip it (and avoid spamming no data requests)
    let effectiveStartYMD = startYMD

    try {
      totalReq++
      const firstYMD = await findFirstAvailableDate({ symbol, startYMD, endYMD })
      if (!firstYMD) {
        const expectedDaysForRange = 0
        report.push({ symbol, haveDays: 0, expectedDays: expectedDaysForRange })
        console.log(`[${symbol}] no data in range ${startYMD}~${endYMD}, skip`)
        await sleep(sleepMs)
        continue
      }

      if (String(firstYMD) > String(effectiveStartYMD)) {
        effectiveStartYMD = firstYMD
        console.log(`[${symbol}] auto-start => ${effectiveStartYMD}`)
      }
    } catch (e) {
      console.error(`[${symbol}] probe failed:`, e?.message || e)
      // probe failed: fall back to original start
    } finally {
      await sleep(sleepMs)
    }

    const symbolExpectedDays = countWeekdaysInclusive(effectiveStartYMD, endYMD)

    let ranges = await findMissingRangesForSymbol({ symbol, startYMD: effectiveStartYMD, endYMD })

    if (!ranges.length && !force) {
      report.push({ symbol, haveDays: symbolExpectedDays, expectedDays: symbolExpectedDays })
      console.log(`[${symbol}] already complete`)
      continue
    }

    // --force：即使 DB 已有資料也照樣打一遍（用來驗證外部 API 是否回資料）
    if (!ranges.length && force) {
      ranges = [{ start: effectiveStartYMD, end: endYMD }]
      console.log(`[${symbol}] force fetch ${effectiveStartYMD}~${endYMD}`)
    }

    console.log(`[${symbol}] missing ranges=`, ranges)

    for (const r of ranges) {
      try {
        totalReq++
        const rows = await getStockHistory({
          market: 'TW',
          code: symbol,
          start_date: r.start,
          end_date: r.end,
        })

        if (!rows.length) {
          console.log(`[${symbol}] ${r.start}~${r.end} no data`)
        } else if (dry) {
          console.log(`[${symbol}] ${r.start}~${r.end} rows=${rows.length} (dry)`)
        } else {
          const docs = rows.map((row) => mapRowToDoc({ symbol, row }))
          const n = await upsertMany(docs)
          totalUpserts += n
          console.log(`[${symbol}] ${r.start}~${r.end} rows=${rows.length}, upsert=${n}`)
        }
      } catch (e) {
        console.error(`[${symbol}] ${r.start}~${r.end} failed:`, e?.message || e)
      } finally {
        await sleep(sleepMs)
      }
    }

    const haveDays = await countDaysForSymbol({ symbol, startYMD: effectiveStartYMD, endYMD })
    report.push({ symbol, haveDays, expectedDays: symbolExpectedDays })
  }

  // ===== completeness report =====
  console.log('\n===== COMPLETENESS REPORT =====')
  // expectedDays is per-symbol (auto-start) and stored in report items

  for (const r of report) {
    if (Number(r.haveDays || 0) === Number(r.expectedDays || 0)) {
      console.log(`${r.symbol}  OK (${r.haveDays} days)`)
    } else {
      console.log(
        `${r.symbol}  MISSING ${Math.max(0, Number(r.expectedDays || 0) - Number(r.haveDays || 0))} days (${Number(r.haveDays || 0)})`,
      )
    }
  }

  console.log('\n[BACKFILL] requests=', totalReq)
  console.log('[BACKFILL] upserts=', totalUpserts)

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('[BACKFILL] fatal:', e?.message || e)
  process.exit(1)
})
