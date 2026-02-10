import Admin from '../models/admin.js'
import * as eod from './eod.service.js'
import * as sectorService from './sector.service.js'
import User from '../models/user.js'

export const createEod = async ({ market, days, user }) => {
  const payload = { market, days }
  const summary = `EOD ${market} (last ${days} days)`

  const job = await Admin.create({
    type: 'eod',
    status: 'queued',
    createdBy: { _id: user?._id, account: user?.account || '' },
    payload,
    summary,
  })

  // 非同步執行（任務制）
  setImmediate(async () => {
    try {
      await Admin.updateOne(
        { _id: job._id },
        { $set: { status: 'running', startedAt: new Date(), errorMessage: '' } },
      )

      // 真正的 EOD 工作（先用最小版 stub，之後再換成你的實作）
      const result = await eod.runEod({ market, days })

      const finishedSummary =
        result?.startDate && result?.endDate
          ? `EOD ${market} ${result.startDate}~${result.endDate} ok`
          : `EOD ${market} (last ${days} days) ok`

      await Admin.updateOne(
        { _id: job._id },
        { $set: { status: 'success', finishedAt: new Date(), summary: finishedSummary } },
      )
    } catch (err) {
      await Admin.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            finishedAt: new Date(),
            errorMessage: err?.message || 'job failed',
            summary: `EOD ${market} failed`,
          },
        },
      )
    }
  })

  return job
}

export const list = async ({ limit = 10 }) => {
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50)

  const items = await Admin.find({})
    .sort({ createdAt: -1 })
    .limit(n)
    .select('type status createdAt startedAt finishedAt summary errorMessage')
    .lean()

  return items
}

export const createSectorSync = async ({ user }) => {
  const job = await Admin.create({
    type: 'sector-sync',
    status: 'queued',
    summary: 'Sector sync (queued)',
    createdBy: user?._id,
    createdByAccount: user?.account,
  })

  ;(async () => {
    try {
      await Admin.updateOne(
        { _id: job._id },
        { $set: { status: 'running', startedAt: new Date() } },
      )

      const result = await sectorService.refreshSectorCache()

      const summary = `Sector sync ok (sectors=${result.sectors}, symbols=${result.symbols})`

      await Admin.updateOne(
        { _id: job._id },
        { $set: { status: 'success', finishedAt: new Date(), summary, payload: result } },
      )
    } catch (err) {
      await Admin.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            finishedAt: new Date(),
            errorMessage: err?.message || 'job failed',
            summary: 'Sector sync failed',
          },
        },
      )
    }
  })()

  return job
}

export const listUsers = async ({ limit = 50 }) => {
  const n = Math.min(Math.max(Number(limit) || 50, 1), 200)

  const items = await User.find({})
    .select('account role createdAt avatarUrl -_id')
    .sort({ createdAt: -1 })
    .limit(n)
    .lean()

  return items.map((u) => ({
    account: u.account,
    role: u.role,
    createdAt: u.createdAt,
    avatar: u.avatarUrl || null,
  }))
}
