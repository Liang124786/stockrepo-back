// 目的：統一成功回應（ok）與失敗回應（fail）。
import { normalizeMarketInResponse } from './normalizeMarket.js'

/**
 * response util
 * - 統一 API 回應格式
 * - 成功：{ result, message, meta }
 * - 失敗：{ message, ...(dev 時可選擇帶 details) }
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

/**
 * 過渡期工具：直接回錯誤（若你採用全域 error handler，通常不需要用它）
 * - 建議：controller 裡優先 next(err)
 */
export function fail(res, err, fallbackMessage = '伺服器錯誤') {
  const status = err?.status || 500
  const message = err?.message || fallbackMessage
  return res.status(status).json({ message })
}
