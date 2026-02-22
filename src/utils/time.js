// 目的：把所有日期/時間處理集中（以 dayjs 為核心）

import dayjs from 'dayjs'

/**
 * time util
 * - 封裝 dayjs
 * - 專案內禁止直接使用 new Date() / dayjs()
 * - 所有日期格式一律從這裡產生
 */

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
 * 取得最近 N 天的起始日（YYYY-MM-DD）
 * @param {number} days
 */
export function daysAgo(days = 30) {
  const d = dayjs().subtract(Number(days), 'day')
  return d.format('YYYY-MM-DD')
}
