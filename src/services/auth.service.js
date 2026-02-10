import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import env from '../config/env.js'

import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  InternalServerError,
  ConflictError,
} from '../utils/httpError.js'

/**
 * Auth Service（業務規則 / 決策層）
 * - 不碰 req/res
 * - 所有錯誤一律 throw HttpError 子類
 */

/**
 * 統一回傳給前端的 user 形狀
 * - 你的 User schema 使用 avatarUrl / avatarPublicId（不是 avatar）
 */
function sanitizeUser(userDoc) {
  return {
    _id: userDoc._id,
    account: userDoc.account,
    role: userDoc.role,
    avatar: userDoc.avatarUrl || null,
    watchlist: userDoc.watchlist?.length ?? 0,
  }
}

function signAccessToken(userDoc) {
  if (!env.JWT_SECRET) throw new InternalServerError('JWT_SECRET not set')

  const payload = {
    _id: String(userDoc._id),
    account: userDoc.account,
    role: userDoc.role,
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN || '7d',
  })
}

/**
 * 註冊
 * @returns {Promise<Object>} sanitizeUser()
 */
export async function register({ account, password, role = 'user' }) {
  const acc = String(account || '').trim()
  const pwd = String(password || '')

  if (!acc) throw new BadRequestError('account is required')
  if (!pwd) throw new BadRequestError('password is required')

  // 依你 schema 規範可調整（長度、複雜度）
  if (pwd.length < 4) throw new BadRequestError('password is too short')

  const exists = await User.findOne({ account: acc })
  if (exists) throw new ConflictError('account already exists')

  const hash = await bcrypt.hash(pwd, 10)

  const user = await User.create({
    account: acc,
    password: hash,
    role,
  })

  return sanitizeUser(user)
}

/**
 * 登入：驗證帳密 + 發 token
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function login({ account, password }) {
  const acc = String(account || '').trim()
  const pwd = String(password || '')

  if (!acc) throw new BadRequestError('account is required')
  if (!pwd) throw new BadRequestError('password is required')

  const user = await User.findOne({ account: acc })
  if (!user) throw new UnauthorizedError('account or password incorrect')

  const ok = await bcrypt.compare(pwd, user.password)
  if (!ok) throw new UnauthorizedError('account or password incorrect')

  const token = signAccessToken(user)

  return {
    user: sanitizeUser(user),
    token,
  }
}

/**
 * 取得個人資料（用 userId 查 DB）
 * @returns {Promise<Object>} sanitizeUser()
 */
export async function getProfile(userId) {
  if (!userId) throw new BadRequestError('userId is required')

  const user = await User.findById(userId)
  if (!user) throw new NotFoundError('user not found')

  return sanitizeUser(user)
}
