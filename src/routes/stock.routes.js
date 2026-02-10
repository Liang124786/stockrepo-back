import { Router } from 'express'
import * as stockController from '../controllers/stock.controller.js'
import * as auth from '../middlewares/auth.js'

const router = Router()

// Public（需要登入就加 auth.token，不需要登入就拿掉）
router.get('/', stockController.list)
router.get('/sectors', stockController.sectors)
// 例：GET /stocks/treemap?market=TW&sector=半導體&isActive=true
router.get('/treemap', stockController.listForTreemap)
router.get('/:market/:symbol', stockController.getOne)


export default router
