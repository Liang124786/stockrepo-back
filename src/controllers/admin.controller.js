import { ok, created } from '../utils/response.js'
import { BadRequestError } from '../utils/httpError.js'
import * as adminService from '../services/admin.service.js'

export const createEod = async (req, res, next) => {
  try {
    const market = String(req.body?.market || '')
      .trim()
      .toUpperCase()
    // align with front-end market values
    const marketNorm = market === 'TW' || market === 'TSE' ? 'TWSE' : market
    const days = Number(req.body?.days ?? 3)

    if (!market) throw new BadRequestError('market is required')
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      throw new BadRequestError('days must be 1~30')
    }

    const job = await adminService.createEod({
      market: marketNorm,
      days,
      user: req.user,
    })

    return created(res, { result: { jobId: String(job._id) } })
  } catch (err) {
    return next(err?.status ? err : new BadRequestError(err?.message || '建立任務失敗'))
  }
}

export const list = async (req, res, next) => {
  try {
    const limit = Number(req.query?.limit ?? 10)
    const items = await adminService.list({ limit })
    return ok(res, { result: { items } })
  } catch (err) {
    return next(new BadRequestError(err?.message || '查詢任務失敗'))
  }
}

export const createSectorSync = async (req, res, next) => {
  try {
    const job = await adminService.createSectorSync({ user: req.user })
    return created(res, { result: { jobId: String(job._id) } })
  } catch (err) {
    return next(err?.status ? err : new BadRequestError(err?.message || '建立任務失敗'))
  }
}

export const listUsers = async (req, res, next) => {
  try {
    const limit = Number(req.query?.limit ?? 50)
    const items = await adminService.listUsers({ limit })
    return ok(res, { result: { items } })
  } catch (err) {
    return next(new BadRequestError(err?.message || '查詢使用者失敗'))
  }
}
