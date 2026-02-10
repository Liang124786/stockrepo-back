import { Router } from 'express'
import * as closePriceController from '../controllers/closePrice.controller.js'

const router = Router()

/**
 * 收盤價（歷史資料）
 * base: /close-prices
 */

// 同步收盤價（寫入 DB）
router.post('/:market/:symbol/sync', closePriceController.sync)

// 查最新一筆
router.get('/:market/:symbol/latest', closePriceController.latest)

// 查指定日期
router.get('/:market/:symbol/date/:date', closePriceController.byDate)

// 查列表（分頁）
router.get('/:market/:symbol', closePriceController.list)

// ✅ 給前端畫圖用（OHLCV 連續序列）
router.get('/:market/:symbol/ohlcv', closePriceController.ohlcv)

export default router
