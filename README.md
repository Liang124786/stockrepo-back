前端預覽網址：https://liang124786.github.io/stockrepo-front/

個人專案的後端

各個檔案功能在STRUCTURE.md

```md
# CatStocks – Backend

台股資料服務後端，負責 API、使用者驗證與每日股價資料更新。

## Tech Stack
- Node.js (ESM)
- Express
- MongoDB / Mongoose
- JWT Authentication
- Multer + Cloudinary
- GitHub Actions (Cron Job)

## Features
- RESTful API
- 使用者登入 / 權限管理
- 個股 / 產業資料查詢
- 自選股 API
- Admin 任務紀錄
- 每日 EOD 收盤價自動寫入 DB

## Data Source
- FinMind API

## Jobs
- `eodClosePrice.job.js`
- 每日由 GitHub Actions 自動執行，更新收盤價資料

## Environment


API Base

https://stockrepo-back.onrender.com
