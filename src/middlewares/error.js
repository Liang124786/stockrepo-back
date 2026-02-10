/**
 * Global Error Handler (Express)
 *
 * 職責：
 * - 統一處理全站錯誤回應格式
 * - 支援 httpError.js（err.status）
 * - 也支援一般 Error（fallback 500）
 *
 * 使用方式（放在 routes 後面）：
 * app.use(errorHandler)
 */

export default function errorHandler(err, req, res, next) {
  // 如果 headers 已經送出，就交給 Express 預設處理
  if (res.headersSent) return next(err)

  const status = err?.status || 500

  // production 下避免把內部錯誤細節暴露給前端
  const isProd = process.env.NODE_ENV === 'production'

  // 一致化訊息：如果是 500，在 prod 統一回「伺服器錯誤」
  const message =
    status >= 500
      ? isProd
        ? '伺服器錯誤'
        : err?.message || '伺服器錯誤'
      : err?.message || '請求錯誤'

  const body = { message }

  // dev 模式可附帶一些 debug 資訊（不建議 prod 開）
  if (!isProd) {
    body.status = status
    body.name = err?.name
    // axios interceptor 你之前有 err.raw，這裡可選擇性保留（避免太吵可拿掉）
    if (err?.raw?.response?.data) body.upstream = err.raw.response.data
  }
  console.error('[ERROR]', err?.stack || err)

  return res.status(status).json(body)
}
