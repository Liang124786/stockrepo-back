import Stock from '../models/stock.js'
import { ok, created } from '../utils/response.js'
import * as stockService from '../services/stock.service.js'
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
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
    return new ConflictError('此市場與代號已存在')
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

// POST /stocks
export const create = async (req, res, next) => {
  try {
    // 對外統一市場：TW
    const market = normalizeMarket(req.body?.market)
    const symbol = normalizeSymbol(req.body?.symbol)
    const name = normalizeText(req.body?.name)
    const sector = normalizeText(req.body?.sector)

    if (!market) throw new BadRequestError('market is required')
    if (!symbol) throw new BadRequestError('symbol is required')
    if (!name) throw new BadRequestError('name is required')

    // ✅ 寫入 DB：台股統一存 TWSE（避免混亂）
    const marketToStore = market === 'TW' ? 'TWSE' : market

    const stock = await Stock.create({ market: marketToStore, symbol, name, sector })

    return created(res, { result: { ...stock.toObject(), market } })
  } catch (error) {
    return next(mapMongoErrorToHttpError(error))
  }
}

// PATCH /stocks/:market/:symbol
export const update = async (req, res, next) => {
  try {
    const market = normalizeMarket(req.params?.market)
    const symbol = normalizeSymbol(req.params?.symbol)

    if (!market) throw new BadRequestError('market is required')
    if (!symbol) throw new BadRequestError('symbol is required')

    const patch = {}
    if (req.body?.name !== undefined) patch.name = normalizeText(req.body.name)
    if (req.body?.sector !== undefined) patch.sector = normalizeText(req.body.sector)
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive)

    const filter = { symbol }
    if (market === 'TW') filter.market = { $in: ['TW', 'TWSE', 'TSE'] }
    else filter.market = market

    const stock = await Stock.findOneAndUpdate(filter, patch, {
      new: true,
      runValidators: true,
    })
      .select('market symbol name sector isActive')
      .lean()

    if (!stock) throw new NotFoundError('找不到股票')

    return ok(res, { result: { ...stock, market: normalizeMarket(stock.market) } })
  } catch (error) {
    return next(error?.status ? error : mapMongoErrorToHttpError(error))
  }
}

// DELETE /stocks/:market/:symbol
export const remove = async (req, res, next) => {
  try {
    const market = normalizeMarket(req.params?.market)
    const symbol = normalizeSymbol(req.params?.symbol)

    if (!market) throw new BadRequestError('market is required')
    if (!symbol) throw new BadRequestError('symbol is required')

    const filter = { symbol }
    if (market === 'TW') filter.market = { $in: ['TW', 'TWSE', 'TSE'] }
    else filter.market = market

    const stock = await Stock.findOneAndUpdate(filter, { isActive: false }, { new: true })
      .select('market symbol name sector isActive')
      .lean()

    if (!stock) throw new NotFoundError('找不到股票')

    return ok(res, { result: { ...stock, market: normalizeMarket(stock.market) } })
  } catch (error) {
    return next(error?.status ? error : mapMongoErrorToHttpError(error))
  }
}

// 給 Treemap 用：拿某市場/某產業的 symbols（可選擇只拿 isActive）
export const listForTreemap = async (req, res, next) => {
  try {
    const { market, sector, isActive } = req.query

    const result = await stockService.listStocksForTreemap({
      market: market ? normalizeMarket(market) : market,
      sector,
      isActive,
    })

    return ok(res, { result })
  } catch (error) {
    return next(new BadRequestError(error?.message || '查詢 Treemap 股票清單失敗'))
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
