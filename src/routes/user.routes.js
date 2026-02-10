import { Router } from 'express'
import * as userController from '../controllers/user.controller.js'
import * as auth from '../middlewares/auth.js'
import upload from '../middlewares/upload.js'

const router = Router()

router.post('/', userController.create)
router.post('/login', auth.login, userController.login)
router.get('/profile', auth.token, userController.profile)
router.patch('/refresh', auth.token, userController.refresh)
router.delete('/logout', auth.token, userController.logout)
// 自選股
router.get('/watchlist', auth.token, userController.getWatchlist)
router.post('/watchlist', auth.token, userController.addWatchlist)
// :market/:symbol 是為了避免同 symbol 但不同市場的衝突
router.delete('/watchlist/:market/:symbol', auth.token, userController.removeWatchlist)
// 大頭貼
router.post('/avatar', auth.token, upload.single('image'), userController.uploadAvatar)

export default router
