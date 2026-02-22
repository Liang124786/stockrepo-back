import { Router } from 'express'
import * as stockController from '../controllers/stock.controller.js'

const router = Router()

// Public（需要登入就加 auth.token，不需要登入就拿掉）
router.get('/', stockController.list)
router.get('/sectors', stockController.sectors)
router.get('/:market/:symbol', stockController.getOne)

export default router
