import * as closePriceService from './closePrice.service.js'

export const runEod = async ({ market, days }) => {
  if (!market) throw new Error('market is required')

  const n = Math.min(Math.max(Number(days) || 1, 1), 30)

  // 將 days 轉成日期區間（今天往回 n 天）
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - n)

  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  // 呼叫既有 closePrice service（你之前已完成的邏輯）
  await closePriceService.refreshByMarket({
    market,
    startDate,
    endDate,
  })

  return { ok: true, market, startDate, endDate }
}