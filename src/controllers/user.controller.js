import User from '../models/user.js'
import Stock from '../models/stock.js'
import cloudinary from '../cloudinary/cloudinary.js'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import { ok, created } from '../utils/response.js'
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  InternalServerError,
} from '../utils/httpError.js'
import { normalizeMarket } from '../utils/normalizeMarket.js'

// post /
export const create = async (req, res, next) => {
  try {
    const result = new User(req.body)
    await result.save()
    return created(res, {
      result: {
        _id: result._id,
        account: result.account,
      },
    })
  } catch (error) {
    console.log(error)
    if (error?.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      const message = error.errors[key]?.message || '資料驗證失敗'
      return next(new BadRequestError(message))
    }

    if (error?.name === 'MongoServerError' && error?.code === 11000) {
      return next(new ConflictError('帳號重複'))
    }

    return next(new InternalServerError('伺服器錯誤'))
  }
}

// post /login
export const login = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new InternalServerError('JWT_SECRET not set')
    }

    const payload = {
      _id: req.user._id,
      account: req.user.account,
      role: req.user.role,
    }

    console.log('[login] jwt payload:', payload)

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7 days' })

    req.user.tokens.push(token)
    await req.user.save()

    return ok(res, {
      result: {
        account: req.user.account,
        role: req.user.role,
        watchlist: req.user.watchlist?.length ?? 0,
        token,
      },
    })
  } catch (error) {
    console.log(error)
    return next(error?.status ? error : new InternalServerError('伺服器錯誤'))
  }
}

// get /profile
export const profile = async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id).select('account role watchlist avatarUrl').lean()

    return ok(res, {
      result: {
        account: u?.account ?? req.user.account,
        role: u?.role ?? req.user.role,
        watchlist: Array.isArray(u?.watchlist)
          ? u.watchlist.length
          : (req.user.watchlist?.length ?? 0),
        avatar: u?.avatarUrl || null,
      },
    })
  } catch (error) {
    return next(error?.status ? error : new InternalServerError('伺服器錯誤'))
  }
}

// patch /refresh
export const refresh = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new InternalServerError('JWT_SECRET not set')
    }
    const i = req.user.tokens.indexOf(req.token)
    if (i === -1) {
      throw new UnauthorizedError('token 無效')
    }
    const token = jwt.sign({ _id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    req.user.tokens[i] = token
    await req.user.save({ validateModifiedOnly: true })
    return ok(res, { result: { token } })
  } catch (error) {
    console.log(error)
    return next(error?.status ? error : new InternalServerError('伺服器錯誤'))
  }
}

// delete /logout
export const logout = async (req, res, next) => {
  try {
    const i = req.user.tokens.indexOf(req.token)
    if (i !== -1) {
      req.user.tokens.splice(i, 1)
      await req.user.save({ validateModifiedOnly: true })
    }

    return ok(res, { result: {} })
  } catch (error) {
    console.log(error)
    return next(new InternalServerError('伺服器錯誤'))
  }
}

// get /watchlist
export const getWatchlist = async (req, res, next) => {
  try {
    // 1. 取使用者 watchlist（純資料）
    const user = await User.findById(req.user._id).select('watchlist').lean()

    const list = Array.isArray(user?.watchlist) ? user.watchlist : []
    if (list.length === 0) {
      return ok(res, { result: [] })
    }

    // 2. 組查詢條件（避免一次打很多次 DB）
    const symbolList = list.map((it) => it.symbol)

    // 3. 一次查 stock 主資料
    const stocks = await Stock.find({
      symbol: { $in: symbolList },
    })
      .select('symbol name sector market')
      .lean()
    // 4. merge：以 market+symbol 為 key
    const stockMap = new Map(stocks.map((s) => [s.symbol, s]))

    const result = list.map((it) => {
      const stock = stockMap.get(it.symbol)

      return {
        market: it.market, // 對外統一 TW
        symbol: it.symbol,
        name: stock?.name ?? '--',
        sector: stock?.sector ?? '--',
      }
    })

    return ok(res, { result })
  } catch (error) {
    console.log(error)
    return next(error)
  }
}

// POST /watchlist
export const addWatchlist = async (req, res, next) => {
  try {
    const symbol = String(req.body?.symbol ?? '')
      .trim()
      .toUpperCase()

    // ✅ 對外一律用 TW；normalizeMarket 可把 TWSE/TSE/TW 轉成 TW
    const marketRaw = String(req.body?.market ?? '').trim()
    if (!symbol) throw new BadRequestError('請輸入代號')
    if (!marketRaw) throw new BadRequestError('請輸入市場別')

    const market = normalizeMarket(marketRaw)

    // ✅ 寫入 user.watchlist：台股統一存 TW（不要存 TWSE）
    const item = { symbol, market }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { watchlist: item } },
      { new: true, runValidators: true },
    ).select('watchlist')

    const items = Array.isArray(user?.watchlist)
      ? user.watchlist.map((it) => ({ market: it.market, symbol: it.symbol }))
      : []
    return ok(res, { result: items })
  } catch (error) {
    console.log(error)
    if (error?.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      const message = error.errors[key]?.message || '資料驗證失敗'
      return next(new BadRequestError(message))
    }
    return next(error?.status ? error : new InternalServerError('伺服器錯誤'))
  }
}

// DELETE /watchlist/:market/:symbol
export const removeWatchlist = async (req, res, next) => {
  try {
    const symbol = String(req.params?.symbol ?? '')
      .trim()
      .toUpperCase()

    const marketRaw = String(req.params?.market ?? '').trim()
    if (!symbol) throw new BadRequestError('請輸入代號')
    if (!marketRaw) throw new BadRequestError('請輸入市場別')

    const market = normalizeMarket(marketRaw)

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { watchlist: { symbol, market } } },
      { new: true },
    ).select('watchlist')

    const items = Array.isArray(user?.watchlist)
      ? user.watchlist.map((it) => ({ market: it.market, symbol: it.symbol }))
      : []
    return ok(res, { result: items })
  } catch (error) {
    console.log(error)
    if (error?.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      const message = error.errors[key]?.message || '資料驗證失敗'
      return next(new BadRequestError(message))
    }
    return next(error?.status ? error : new InternalServerError('伺服器錯誤'))
  }
}

// post /avatar
export const uploadAvatar = async (req, res, next) => {
  try {
    console.log('[uploadAvatar] hasFile=', !!req.file, 'fieldname=', req.file?.fieldname)
    console.log('[uploadAvatar] path=', req.file?.path)
    console.log('[uploadAvatar] size=', req.file?.size, 'mimetype=', req.file?.mimetype)
    try {
      if (req.file?.path) {
        console.log('[uploadAvatar] exists=', fs.existsSync(req.file.path))
      }
    } catch (e) {
      console.log('[uploadAvatar] exists check failed:', e?.message || e)
    }
    if (!req.file) throw new BadRequestError('沒有上傳檔案')

    // 先從 DB 取舊的 publicId（不要依賴 req.user 是否有帶到欄位）
    const current = await User.findById(req.user._id).select('avatarPublicId').lean()

    if (current?.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(current.avatarPublicId)
      } catch (e) {
        console.log('[avatar] destroy old failed:', e?.message || e)
      }
    }

    console.log('[uploadAvatar] uploading to cloudinary...')

    let result
    try {
      result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'stockrepo/avatar',
        resource_type: 'image',
      })
    } catch (e) {
      console.log('[uploadAvatar] cloudinary upload failed:', {
        name: e?.name,
        message: e?.message,
        http_code: e?.http_code,
        error: e?.error,
      })
      throw e
    }

    console.log('[uploadAvatar] cloudinary ok:', {
      secure_url: result?.secure_url,
      public_id: result?.public_id,
    })

    // 刪除本地暫存檔（tmp）
    fs.unlink(req.file.path, () => {})

    // ✅ 直接寫回 DB（關鍵）
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          avatarUrl: result.secure_url,
          avatarPublicId: result.public_id,
        },
      },
      { runValidators: false },
    )

    return created(res, { result: { avatar: result.secure_url } })
  } catch (error) {
    console.log('[uploadAvatar] error:', error)
    return next(error?.status ? error : new InternalServerError('伺服器錯誤'))
  }
}
