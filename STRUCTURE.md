# Back 資料夾說明

此文件說明 `back/` 內各資料夾與檔案用途。


## `back/src/`
- `app.js`: Express app 組裝層，集中註冊 middleware、routes 與全域錯誤處理。
- `index.js`: 伺服器入口，負責 MongoDB 連線並啟動 HTTP 服務。

### `back/src/clients/`
- `finmind.client.js`: FinMind API client，封裝歷史股價資料請求與資料整形。

### `back/src/cloudinary/`
- `cloudinary.js`: Cloudinary SDK 初始化與設定，供大頭貼上傳流程使用。

### `back/src/config/`
- `axios.js`: 共用 axios 設定與實例，統一外部 API 請求行為。
- `env.js`: 讀取並整理環境變數（DB、JWT、外部 API）。

### `back/src/controllers/`
- `admin.controller.js`: 管理員任務控制器，建立 EOD/產業同步 job、查詢 job 與使用者清單。
- `closePrice.controller.js`: 收盤價 API 控制器（列表、最新、指定日期、同步、OHLCV）。
- `health.controller.js`: 健康檢查控制器，檢查 DB 與外部服務狀態。
- `stock.controller.js`: 股票 CRUD 與查詢控制器（含 treemap 相關清單）。
- `treemap.controller.js`: Treemap API 控制器，整理固定清單（0050）輸出。
- `user.controller.js`: 使用者/登入/登出/refresh/watchlist/大頭貼上傳控制器。

### `back/src/data/`
- `data/0050.js`: 台灣 0050 成分股代號清單。
- `symbolsToBackfill.js`: 回補 ClosePrice 用的特定代號清單。

### `back/src/middlewares/`
- `bmiddlewares/auth.js`: 驗證與授權 middleware（JWT/Passport）。
- `middlewares/error.js`: 全域錯誤處理 middleware，統一錯誤回應格式。
- `middlewares/upload.js`: 上傳處理 middleware（multer/Cloudinary），供大頭貼上傳使用。

### `back/src/models/`
- `admin.js`: 後台 job 狀態與執行結果紀錄 schema/model。
- `closePrice.js`: 收盤價資料 schema/model。
- `user.js`: 使用者資料 schema/model（帳號、角色、tokens、watchlist、avatar）。
- `stock.js`: 股票主檔 schema/model（市場、代號、名稱、產業、啟用狀態）。

### `back/src/passport/`
- `passport.js`: Passport 策略設定與初始化。

### `back/src/routes/`
- `admin.routes.js`: 管理員 API routes（jobs、sector sync、user list）。
- `closePrice.routes.js`: 收盤價 API routes（列表、最新、指定日期、同步、OHLCV）。
- `health.routes.js`: 健康檢查 API routes。
- `stock.routes.js`: 股票 API routes（CRUD、treemap 清單）。
- `treemap.routes.js`: Treemap API routes。
- `user.routes.js`: 使用者 API routes（登入、watchlist、大頭貼）。

### `back/src/scripts/`
- `backfillClosePriceByDate.job.js`: 指定日期區間回補 ClosePrice 的 CLI job。
- `eodClosePrice.job.js`: 盤後收盤價同步 job（批次更新資料）。
- `purgeClosePriceKeepLastN.js`: ClosePrice 清理 job（保留最近 N 筆）。
- `syncStockUniverse.job.js`: 股票主檔/元資料同步 job。

### `back/src/services/`
- `admin.service.js`: 管理員 job 的建立與狀態更新邏輯（EOD、sector sync）。
- `auth.service.js`: 註冊/登入/取得個人資料的商業邏輯與 token 產生。
- `closePrice.service.js`: 收盤價抓取、正規化、入庫與查詢邏輯。
- `eod.service.js`: EOD 任務入口（將 days 轉換日期區間並觸發收盤價刷新）。
- `sector.service.js`: 產業清單彙整邏輯（統計 sector 與 symbols）。
- `stock.service.js`: 股票 EOD 歷史資料整理與 treemap 清單查詢。
- `treemap.service.js`: Treemap 資料彙整邏輯（價格變化計算與排序）。

### `back/src/utils/`
- `httpError.js`: 自訂 HTTP 錯誤類別，統一錯誤語意。
- `normalizeMarket.js`: 市場代碼正規化工具（TW/TWSE/TSE）。
- `response.js`: API 回應格式工具，集中成功/失敗回應。
- `symbols0050.js`: 0050 成分股清單的正規化工具。
- `time.js`: 日期時間工具（格式化與區間計算）。
