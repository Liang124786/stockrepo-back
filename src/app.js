// 把原本 index.js 裡面所有的 app.use()... 等放這裡
import express from 'express'
import cors from 'cors'
import passport from 'passport'

import userRoutes from './routes/user.routes.js'
import stockRoutes from './routes/stock.routes.js'
import closePriceRoutes from './routes/closePrice.routes.js'
import treemapRoutes from './routes/treemap.routes.js'
import adminRoutes from './routes/admin.routes.js'
import healthRoutes from './routes/health.routes.js'

import errorHandler from './middlewares/error.js'
import { BadRequestError } from './utils/httpError.js'
import './passport/passport.js'

const app = express()

// Global middlewares
app.use(cors())
app.use(express.json())

/**
 * 只處理「JSON 格式解析失敗」
 */
app.use((err, req, res, next) => {
  const isJsonParseError = err instanceof SyntaxError && err.status === 400 && 'body' in err
  if (!isJsonParseError) return next(err)
  return next(new BadRequestError('資料格式錯誤'))
})

app.use(passport.initialize())

// Routes
app.use('/user', userRoutes)
app.use('/stocks', stockRoutes)
app.use('/close-prices', closePriceRoutes)
app.use('/treemap', treemapRoutes)
app.use('/admin', adminRoutes)
app.use('/health', healthRoutes)
app.use('/api/health', healthRoutes)
// Global error handler
app.use(errorHandler)

export default app
