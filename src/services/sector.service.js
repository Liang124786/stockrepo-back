import Stock from '../models/stock.js'

/**
 * 刷新產業快取/清單（最小版）
 * - 先不寫入快取 collection，改回傳統計（可用於 job summary/payload）
 */
export const refreshSectorCache = async () => {
  const docs = await Stock.find({ isActive: true })
    .select('sector symbol -_id')
    .lean()

  const sectorSet = new Set()
  for (const d of docs) {
    if (d?.sector) sectorSet.add(String(d.sector))
  }

  return {
    sectors: sectorSet.size,
    symbols: docs.length,
  }
}