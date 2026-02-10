import { Router } from 'express'
import * as treemapController from '../controllers/treemap.controller.js'

const router = Router()

// POST /treemap/:market
router.post('/:market', treemapController.list)

export default router
