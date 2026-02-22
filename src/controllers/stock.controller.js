import Stock from '../models/stock.js'
import { ok } from '../utils/response.js'
import * as stockService from '../services/stock.service.js'
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from '../utils/httpError.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'

/**
 * 將股票代號正規化（例：' 2330 ' → '2330'）
 * - 統一轉大寫，避免 DB 查詢不一致
 */
const normalizeSymbol = (v) =>
  String(v ?? '')
    .trim()
    .toUpperCase()

/**
 * 將一般文字欄位正規化（例：名稱、關鍵字）
 * - 不強制轉大寫，保留語意
 */
const normalizeText = (v) => String(v ?? '').trim()

/**
 * 目的：
 * - 將資料庫錯誤「翻譯」成 HTTP 語意錯誤
 * - 避免 controller 到處寫 if (error.name === ...)
 * - 集中維護，未來調整只改這裡
 *
 * 原則：
 * - ValidationError → 400 BadRequest
 * - unique index 衝突 → 409 Conflict
 * - 其他未知錯誤 → 500 InternalServerError
 */
const mapMongoErrorToHttpError = (error) => {
  console.error('[Unhandled error]', error?.stack || error)

  if (error?.name === 'ValidationError') {
    const key = Object.keys(error.errors ?? {})[0]
    const message = error?.errors?.[key]?.message || '資料驗證失敗'
    return new BadRequestError(message)
  }

  if (error?.name === 'MongoServerError' && error?.code === 11000) {
    return new InternalServerError('伺服器錯誤')
  }

  return new InternalServerError('伺服器錯誤')
}

// GET /stocks
export const list = async (req, res, next) => {
  try {
    const keyword = normalizeText(req.query?.keyword)

    // 前端永遠用 TW；後端這裡統一正規化
    // normalizeMarket 會把 TWSE/TSE/TW 統一成 TW
    const marketRaw = normalizeText(req.query?.market)
    const market = marketRaw ? normalizeMarket(marketRaw) : ''

    const limitRaw = Number(req.query?.limit ?? 20)
    const pageRaw = Number(req.query?.page ?? 1)

    const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : 20, 100)
    const page = Math.max(Number.isFinite(pageRaw) ? pageRaw : 1, 1)
    const skip = (page - 1) * limit

    const filter = { isActive: true }

    // DB 仍可能存 TWSE，但對外統一為 TW
    // 這裡用 $in 兼容歷史資料（TW / TWSE / TSE）
    if (market) {
      if (market === 'TW') filter.market = { $in: ['TW', 'TWSE', 'TSE'] }
      else filter.market = market
    }

    if (keyword) {
      const kw = keyword.toUpperCase()
      filter.$or = [
        { symbol: { $regex: kw, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      Stock.find(filter)
        .select('market symbol name sector isActive')
        .sort({ market: 1, symbol: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Stock.countDocuments(filter),
    ])

    // ✅ 對外回應：market 統一回 TW
    const normalizedItems = items.map((x) => ({
      ...x,
      market: normalizeMarket(x.market),
    }))

    return ok(res, {
      result: {
        items: normalizedItems,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    return next(mapMongoErrorToHttpError(error))
  }
}

// GET /stocks/:market/:symbol
export const getOne = async (req, res, next) => {
  try {
    const market = normalizeMarket(req.params?.market)
    const symbol = normalizeSymbol(req.params?.symbol)

    if (!market) throw new BadRequestError('market is required')
    if (!symbol) throw new BadRequestError('symbol is required')

    const filter = { symbol, isActive: true }
    if (market === 'TW') filter.market = { $in: ['TW', 'TWSE', 'TSE'] }
    else filter.market = market

    const stock = await Stock.findOne(filter).select('market symbol name sector isActive').lean()

    if (!stock) throw new NotFoundError('找不到股票')

    return ok(res, { result: { ...stock, market: normalizeMarket(stock.market) } })
  } catch (error) {
    return next(error?.status ? error : mapMongoErrorToHttpError(error))
  }
}

export const sectors = async (req, res, next) => {
  try {
    const { market } = req.query
    const result = await stockService.listSectors({
      market: market ? normalizeMarket(market) : market,
    })

    return ok(res, { result, meta: { pid: process.pid } })
  } catch (error) {
    return next(new BadRequestError(error?.message || '查詢產業清單失敗'))
  }
}
