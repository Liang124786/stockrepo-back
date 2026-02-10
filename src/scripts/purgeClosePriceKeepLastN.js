import 'dotenv/config'
import mongoose from 'mongoose'
import ClosePrice from '../models/closePrice.js'

const {
  MONGODB_URI,
  CLOSEPRICE_KEEP_LAST_N = '1500',
  DRY_RUN = 'true',
  BULK_CHUNK = '500',
} = process.env

const main = async () => {
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set')

  const keepN = Number(CLOSEPRICE_KEEP_LAST_N)
  if (!Number.isFinite(keepN) || keepN <= 0) {
    throw new Error('CLOSEPRICE_KEEP_LAST_N must be a positive number')
  }

  const bulkChunk = Number(BULK_CHUNK)
  if (!Number.isFinite(bulkChunk) || bulkChunk <= 0) {
    throw new Error('BULK_CHUNK must be a positive number')
  }

  await mongoose.connect(MONGODB_URI)

  // 取得所有 (market, symbol)
  const pairs = await ClosePrice.aggregate([
    { $group: { _id: { market: '$market', symbol: '$symbol' } } },
  ])

  let ops = []
  let totalWouldDelete = 0
  let totalDeleted = 0

  for (const p of pairs) {
    const { market, symbol } = p._id

    // 找「第 N 新」那一筆的 date
    const nth = await ClosePrice.findOne({ market, symbol })
      .sort({ date: -1 })
      .skip(keepN - 1)
      .select({ date: 1 })
      .lean()

    // 不足 N 筆就跳過
    if (!nth?.date) continue

    const filter = { market, symbol, date: { $lt: nth.date } }

    const matched = await ClosePrice.countDocuments(filter)
    if (matched === 0) continue

    totalWouldDelete += matched

    if (DRY_RUN === 'true') {
      continue
    }

    ops.push({ deleteMany: { filter } })

    // 分批送 bulkWrite，避免一次塞太多 op
    if (ops.length >= bulkChunk) {
      const res = await ClosePrice.bulkWrite(ops, { ordered: false })
      totalDeleted += res.deletedCount ?? 0
      ops = []
    }
  }

  if (DRY_RUN !== 'true' && ops.length > 0) {
    const res = await ClosePrice.bulkWrite(ops, { ordered: false })
    totalDeleted += res.deletedCount ?? 0
  }

  if (DRY_RUN !== 'true') console.log(`[keepLastN] totalDeleted=${totalDeleted}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
