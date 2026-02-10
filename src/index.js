import mongoose from 'mongoose'
import env from './config/env.js'
import app from './app.js'

const start = async () => {
  try {
    await mongoose.connect(env.DB_URL)
    console.log('✅ 資料庫連線成功')

    app.listen(env.PORT || 4000, () => {
      console.log(`✅ 伺服器啟動 http://localhost:${env.PORT}`)
    })
  } catch (err) {
    console.error('❌ 啟動失敗(DB 連線或初始化錯誤）')
    console.error(err)
    // process.exit(0) 成功
    // process.exit(1) 失敗
    // process.exit(2) 設定錯誤
    // process.exit(3) DB 連線錯誤

    // 1（或任何非 0）→ 異常結束（failure)
    process.exit(1)
  }
}

start()
