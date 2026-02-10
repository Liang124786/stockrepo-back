import axios from 'axios'

/**
 * axios instance（對外 API 共用出口）
 *
 * 職責說明：
 * - 所有「呼叫外部 API」的請求都必須先經過這個 instance
 * - 統一設定 timeout、headers 等基礎 HTTP 行為
 * - 在 response 階段攔截錯誤，轉換成後端可讀的 Error 物件
 *
 * 設計原則：
 * - 不處理任何業務邏輯
 * - 不關心是呼叫哪一個外部 API
 * - 只負責「HTTP 層」的狀態與錯誤整理
 *
 * 目的：
 * - 讓 client / controller 不需要理解各家外部 API 的錯誤格式
 * - 集中管理錯誤處理，避免重複 try/catch
 */

const instance = axios.create({
  timeout: 10000, // 10 秒，外部 API 合理上限
})

instance.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // 優先拿外部 API 回來的錯誤訊息
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.msg ||
      error?.message ||
      '外部 API 發生未知錯誤'

    // 保留原始錯誤，避免吃掉 stack
    const err = new Error(message)
    err.status = error?.response?.status || 500
    err.raw = error

    return Promise.reject(err)
  },
)

export default instance
