// 檢查env資料是否缺失
import dotenv from 'dotenv'
// 只在這裡載入 .env
dotenv.config()

// 少任何一個，都無法提供核心功能，直接中止啟動

const requiredEnvs = [
  'DB_URL', // MongoDB 連線
  'JWT_SECRET', // 之後登入 / 自選股一定會用到
  'FINMIND_TOKEN', // 收盤資料的唯一資料來源
]

// fail-fast：缺一就直接噴錯
requiredEnvs.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`❌ 缺少必要的環境變數：${key}`)
  }
})

const optionalEnvs = [
  // 圖片上傳
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',

  // 未來即時資料（Phase 2）
  'TWSE_API_BASE_URL',
]

// 提醒用，不中斷啟動
optionalEnvs.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️  尚未設定 ${key}，相關功能目前不可用`)
  }
})

// 統一輸出「已驗證過」的環境設定
// 之後全專案一律從這裡拿，不直接用 process.env

const env = {
  // 基本環境
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,

  // 資料庫
  DB_URL: process.env.DB_URL,

  // 認證（Phase 1 先放著，Phase 2 會用）
  JWT_SECRET: process.env.JWT_SECRET,

  // 收盤資料（Phase 1 核心）
  FINMIND_TOKEN: process.env.FINMIND_TOKEN,

  // 圖片服務（選填）
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET,
  },

  // 即時資料（Phase 2 預留）

  TWSE_API_BASE_URL: process.env.TWSE_API_BASE_URL || 'https://mis.twse.com.tw',
}

export default env
