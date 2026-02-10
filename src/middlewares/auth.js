import passport from 'passport'
import jwt from 'jsonwebtoken'
import { UnauthorizedError, ForbiddenError, InternalServerError } from '../utils/httpError.js'

// 使用 passport 的 login 驗證方法
// passport.authenticate(驗證方法,設定,驗證方法執行後處理)
// session: false = 停用 cookie
// 處理 function 的參數對應done 的參數
/**
 * login middleware
 * - 成功：把 user 塞進 req.user，next()
 * - 失敗：next(HttpError) 交給全域 errorHandler
 */
export const login = (req, res, next) => {
  passport.authenticate('login', { session: false }, (error, user, info) => {
    // Passport 驗證失敗：帳密錯誤、缺欄位等
    if (error || !user) {
      if (error?.message === 'USER' || info?.message === 'Missing credentials') {
        return next(new UnauthorizedError('帳號或密碼錯誤'))
      } else {
        return next(new InternalServerError('伺服器錯誤'))
      }
    }
    // 將查詢到的使用者放入 req 內給後面的 controller 或 middleware 使用
    req.user = user
    // 繼續 express 的下一個動作
    return next()
  })(req, res, next)
}

/**
 * token middleware
 * - 成功：把 data 塞進 req.user，next()
 * - 失敗：next(HttpError)
 */
export const token = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (error, data, info) => {
    // Passport JWT 驗證失敗：絕大多數情況都應該回 401（未授權），不是 500
    if (error || !data) {
      const infoName = info?.name
      const infoMsg = info?.message

      // 常見 JWT 驗證失敗：token 遺失 / 格式錯誤 / 過期 / 簽章不符
      if (
        infoName === 'JsonWebTokenError' ||
        infoName === 'TokenExpiredError' ||
        infoName === 'NotBeforeError' ||
        error?.name === 'JsonWebTokenError' ||
        error?.name === 'TokenExpiredError' ||
        error?.name === 'NotBeforeError' ||
        error?.message === 'EXP' ||
        error?.message === 'USER'
      ) {
        return next(new UnauthorizedError(infoMsg || '身份驗證失敗'))
      }

      // 沒拿到 user（包含未帶 token、token 無效、找不到使用者）一律視為未授權
      if (!data) {
        return next(new UnauthorizedError(infoMsg || '未授權，請先登入'))
      }

      // 其他非預期錯誤才回 500
      return next(new InternalServerError(error?.message || '伺服器錯誤'))
    }
    // 驗證成功
    // 將查詢到的使用者放入 req 內給後面的 controller 或 middleware 使用
    req.user = data
    // 繼續 express 的下一個動作
    next()
  })(req, res, next)
}

/**
 * admin middleware
 * - 成功：next()
 * - 失敗：next(ForbiddenError)
 */
export const admin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('無權限'))
  }
  return next()
}
