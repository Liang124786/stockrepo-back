import { ok } from '../utils/response.js'
import { BadRequestError, NotFoundError } from '../utils/httpError.js'
import * as closePriceService from '../services/closePrice.service.js'

/**
 * ClosePrice Controller
 * 規範：
 * - 成功：交給 response.ok
 * - 失敗：丟 httpError 給全域 error handler
 * - controller 不 import StatusCodes
 */

export const list = async (req, res, next) => {
  try {
    const { market, symbol } = req.params
    const { startDate, endDate, page, limit, sort } = req.query

    const result = await closePriceService.listClosePrices({
      market,
      symbol,
      startDate,
      endDate,
      page,
      limit,
      sort,
    })

    return ok(res, { result })
  } catch (error) {
    return next(new BadRequestError(error?.message || '查詢收盤價失敗'))
  }
}

export const latest = async (req, res, next) => {
  try {
    const { market, symbol } = req.params

    const result = await closePriceService.getLatestClosePrice({ market, symbol })
    if (!result) return next(new NotFoundError('找不到最新收盤價資料'))

    return ok(res, { result })
  } catch (error) {
    return next(new BadRequestError(error?.message || '查詢最新收盤價失敗'))
  }
}

export const byDate = async (req, res, next) => {
  try {
    const { market, symbol, date } = req.params

    const result = await closePriceService.getClosePriceByDate({
      market,
      symbol,
      date,
    })
    if (!result) return next(new NotFoundError('找不到指定日期收盤價資料'))

    return ok(res, { result })
  } catch (error) {
    return next(new BadRequestError(error?.message || '查詢指定日期收盤價失敗'))
  }
}

export const sync = async (req, res, next) => {
  try {
    const { market, symbol } = req.params
    const { startDate, endDate } = req.body ?? {}

    const result = await closePriceService.syncClosePrices({
      market,
      symbol,
      startDate,
      endDate,
    })

    return ok(res, { result, message: 'sync success' })
  } catch (error) {
    return next(new BadRequestError(error?.message || '同步收盤價失敗'))
  }
}

/**
 * OHLCV series（給前端畫圖用）
 * - 不分頁
 * - 預設近一年
 * - 回傳 array
 */
export const ohlcv = async (req, res, next) => {
  try {
    const { market, symbol } = req.params
    const { startDate, endDate, sort, limit } = req.query

    const result = await closePriceService.getOHLCVSeries({
      market,
      symbol,
      startDate,
      endDate,
      sort,
      limit,
    })

    return ok(res, { result })
  } catch (error) {
    return next(new BadRequestError(error?.message || '查詢 OHLCV 資料失敗'))
  }
}
