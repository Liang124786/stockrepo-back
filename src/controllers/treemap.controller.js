import { ok } from '../utils/response.js'
import { BadRequestError } from '../utils/httpError.js'
import * as treemapService from '../services/treemap.service.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'
import symbols0050 from '../data/0050.js'

// 限制回傳數量
const TREEMAP_LIMIT = 50

export const list = async (req, res, next) => {
  try {
    const { market } = req.params
    if (!market) throw new Error('market 必填')

    const m = normalizeMarket(market)
    if (!m) throw new Error('market 不合法')

    // 固定只用 0050 成分；市場摘要不納入 ETF（代號 00 開頭）
    const symbols = symbols0050.filter((symbol) => !String(symbol || '').startsWith('00'))


    const result = await treemapService.getTreemapItems({
      market: m,
      symbols,
      limit: TREEMAP_LIMIT,
    })

    return ok(res, { result })
  } catch (err) {
    return next(new BadRequestError(err?.message || 'treemap failed'))
  }
}
