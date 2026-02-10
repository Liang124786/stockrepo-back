import { Router } from 'express'
import * as adminController from '../controllers/admin.controller.js'
import * as auth from '../middlewares/auth.js'

const router = Router()

// admin only
router.get('/jobs', auth.token, auth.admin, adminController.list)
router.post('/jobs/eod', auth.token, auth.admin, adminController.createEod)
router.post('/jobs/sector-sync', auth.token, auth.admin, adminController.createSectorSync)
router.get('/users', auth.token, auth.admin, adminController.listUsers)

export default router
