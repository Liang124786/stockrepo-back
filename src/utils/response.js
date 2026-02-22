// 目的：統一成功回應（ok / created）。
import { normalizeMarketInResponse } from './normalizeMarket.js'

/**
 * response util
 * - 統一 API 回應格式
 * - 成功：{ result, message, meta }
 * - 失敗：交給全域 error middleware
 */

export function ok(res, { result = null, message = 'success', status = 200, meta } = {}) {
  normalizeMarketInResponse(result)
  normalizeMarketInResponse(meta)
  const body = { result, message }
  if (meta !== undefined) body.meta = meta
  return res.status(status).json(body)
}

export function created(res, { result = null, message = 'created', meta } = {}) {
  return ok(res, { result, message, status: 201, meta })
}
