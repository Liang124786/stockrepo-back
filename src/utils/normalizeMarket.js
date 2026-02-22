/**
 * 對「service 層邏輯」用：
 * - 強制把外部 market 正規化成單一值
 * - 目前策略：台股一律回傳 'TW'
 */
export const normalizeMarket = (input) => {
  const m = String(input || '')
    .toUpperCase()
    .trim()
  if (!m) throw new Error('market 必填')

  if (m === 'TW' || m === 'TWSE' || m === 'TSE' || m === 'TPEX') {
    return 'TW'
  }

  if (m === 'US') return 'US'

  throw new Error(`unsupported market: ${m}`)
}

/* 以下只給 response 使用（回前端前統一 market 顯示）                   */

const FRONTEND_TW_MARKETS = new Set(['TWSE', 'TSE', 'TPEX'])

const normalizeMarketValueForFrontend = (input) => {
  if (typeof input !== 'string') return input
  const m = input.toUpperCase()
  if (FRONTEND_TW_MARKETS.has(m)) return 'TW'
  return input
}

/**
 * 遞迴掃描 response payload：
 * - 只要 key === 'market'，就統一轉成前端用值
 * - 安全：會跳過 Date / primitive
 */
export const normalizeMarketInResponse = (input) => {
  if (input === null || input === undefined) return input
  if (typeof input !== 'object') return input
  if (input instanceof Date) return input

  if (Array.isArray(input)) {
    for (const item of input) normalizeMarketInResponse(item)
    return input
  }

  for (const [key, value] of Object.entries(input)) {
    if (key === 'market') {
      input[key] = normalizeMarketValueForFrontend(value)
      continue
    }
    if (value && typeof value === 'object') {
      normalizeMarketInResponse(value)
    }
  }

  return input
}
