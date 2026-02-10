// 目的：把所有日期/時間處理集中（以 dayjs 為核心）

import dayjs from 'dayjs'

/**
 * time util
 * - 封裝 dayjs
 * - 專案內禁止直接使用 new Date() / dayjs()
 * - 所有日期格式一律從這裡產生
 */

/**
 * 補 0（保留，避免破壞既有語意）
 */
export function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * 轉成 YYYY-MM-DD
 * @param {string|number|Date|dayjs.Dayjs} input
 */
export function toDateString(input) {
  const d = input ? dayjs(input) : dayjs()
  if (!d.isValid()) return null
  return d.format('YYYY-MM-DD')
}

/**
 * 轉成 YYYY-MM-DD HH:mm:ss
 * @param {string|number|Date|dayjs.Dayjs} input
 */
export function toDateTimeString(input) {
  const d = input ? dayjs(input) : dayjs()
  if (!d.isValid()) return null
  return d.format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 確保日期字串為 YYYY-MM-DD
 * - 等同於你之前的 slice(0,10)
 */
export function normalizeYMD(input) {
  if (!input) return null
  const d = dayjs(input)
  if (!d.isValid()) return null
  return d.format('YYYY-MM-DD')
}

/**
 * 比較兩個 YYYY-MM-DD
 * @returns {number} a-b：<0 表示 a<b
 */
export function compareYMD(a, b) {
  if (!a || !b) return 0
  const da = dayjs(a)
  const db = dayjs(b)
  if (!da.isValid() || !db.isValid()) return 0
  if (da.isSame(db, 'day')) return 0
  return da.isBefore(db) ? -1 : 1
}

/**
 * 取得最近 N 天的起始日（YYYY-MM-DD）
 * @param {number} days
 */
export function daysAgo(days = 30) {
  const d = dayjs().subtract(Number(days), 'day')
  return d.format('YYYY-MM-DD')
}
