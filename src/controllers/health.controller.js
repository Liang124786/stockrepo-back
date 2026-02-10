const withTimeout = async (promiseFactory, ms) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await promiseFactory(controller.signal)
  } finally {
    clearTimeout(id)
  }
}

const checkDb = async () => {
  try {
    const mod = await import('mongoose')
    const mongoose = mod.default || mod
    // 1 = connected
    const state = mongoose?.connection?.readyState
    if (state === 1) return 'ok'
    if (state === 0 || state === 2 || state === 3) return 'down'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

const checkTwse = async () => {
  try {
    const r = await withTimeout(
      (signal) => fetch('https://openapi.twse.com.tw/', { method: 'GET', signal }),
      2500,
    )
    return r.ok ? 'ok' : 'down'
  } catch {
    return 'down'
  }
}

const checkFinmind = async () => {
  const token = process.env.FINMIND_TOKEN
  if (!token) return 'unknown'
  try {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&token=${encodeURIComponent(
      token,
    )}`
    const r = await withTimeout((signal) => fetch(url, { method: 'GET', signal }), 3500)
    if (!r.ok) return 'down'
    const j = await r.json().catch(() => null)
    if (j && (j.status === 200 || j.status === '200')) return 'ok'
    return 'down'
  } catch {
    return 'down'
  }
}

const taipeiIsoNow = () => {
  // Produce an ISO-like timestamp in Asia/Taipei with +08:00 suffix, independent of server timezone.
  const d = new Date()
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  // sv-SE gives YYYY-MM-DD and HH:mm:ss parts; build ISO-like string
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`
}

export const health = async (req, res) => {
  const [db, twse, finmind] = await Promise.all([checkDb(), checkTwse(), checkFinmind()])

  const hasFinmindToken = Boolean(process.env.FINMIND_TOKEN)
  let external = 'unknown'
  if (twse === 'down') external = 'down'
  else if (hasFinmindToken) external = twse === 'ok' && finmind === 'ok' ? 'ok' : 'down'
  else external = twse === 'ok' ? 'unknown' : 'down'

  res.json({
    ok: true,
    result: {
      serverTime: taipeiIsoNow(),
      db,
      external,
      twse,
      finmind,
    },
  })
}
