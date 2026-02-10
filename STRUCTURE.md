# Back 資料夾說明

此文件說明 `back/` 內各資料夾與檔案用途（不展開 `node_modules/`、`tmp/`、`.env`、`.DS_Store` 等自動產生或機密檔）。


## `back/src/`
- `back/src/app.js`: Express app 組裝層，集中註冊 middleware、routes 與全域錯誤處理。
- `back/src/index.js`: 伺服器入口，負責 MongoDB 連線並啟動 HTTP 服務。

### `back/src/clients/`
- `back/src/clients/finmind.client.js`: FinMind API client，封裝歷史股價資料請求與資料整形。

### `back/src/cloudinary/`
- `back/src/cloudinary/cloudinary.js`: Cloudinary SDK 初始化與設定，供大頭貼上傳流程使用。

### `back/src/config/`
- `back/src/config/axios.js`: 共用 axios 設定與實例，統一外部 API 請求行為。
- `back/src/config/env.js`: 讀取並整理環境變數（DB、JWT、外部 API）。

### `back/src/controllers/`
- `back/src/controllers/admin.controller.js`: 管理員任務控制器，建立 EOD/產業同步 job、查詢 job 與使用者清單。
- `back/src/controllers/closePrice.controller.js`: 收盤價 API 控制器（列表、最新、指定日期、同步、OHLCV）。
- `back/src/controllers/health.controller.js`: 健康檢查控制器，檢查 DB 與外部服務狀態。
- `back/src/controllers/stock.controller.js`: 股票 CRUD 與查詢控制器（含 treemap 相關清單）。
- `back/src/controllers/treemap.controller.js`: Treemap API 控制器，整理固定清單（0050）輸出。
- `back/src/controllers/user.controller.js`: 使用者/登入/登出/refresh/watchlist/大頭貼上傳控制器。

### `back/src/data/`
- `back/src/data/0050.js`: 台灣 0050 成分股代號清單。
- `back/src/data/symbolsToBackfill.js`: 回補 ClosePrice 用的特定代號清單。

### `back/src/middlewares/`
- `back/src/middlewares/auth.js`: 驗證與授權 middleware（JWT/Passport）。
- `back/src/middlewares/error.js`: 全域錯誤處理 middleware，統一錯誤回應格式。
- `back/src/middlewares/upload.js`: 上傳處理 middleware（multer/Cloudinary），供大頭貼上傳使用。

### `back/src/models/`
- `back/src/models/admin.js`: 後台 job 狀態與執行結果紀錄 schema/model。
- `back/src/models/closePrice.js`: 收盤價資料 schema/model。
- `back/src/models/User.js`: 使用者資料 schema/model（帳號、角色、tokens、watchlist、avatar）。
- `back/src/models/stock.js`: 股票主檔 schema/model（市場、代號、名稱、產業、啟用狀態）。

### `back/src/passport/`
- `back/src/passport/passport.js`: Passport 策略設定與初始化。

### `back/src/routes/`
- `back/src/routes/admin.routes.js`: 管理員 API routes（jobs、sector sync、user list）。
- `back/src/routes/closePrice.routes.js`: 收盤價 API routes（列表、最新、指定日期、同步、OHLCV）。
- `back/src/routes/health.routes.js`: 健康檢查 API routes。
- `back/src/routes/stock.routes.js`: 股票 API routes（CRUD、treemap 清單）。
- `back/src/routes/treemap.routes.js`: Treemap API routes。
- `back/src/routes/user.routes.js`: 使用者 API routes（登入、watchlist、大頭貼）。

### `back/src/scripts/`
- `back/src/scripts/backfillClosePriceByDate.job.js`: 指定日期區間回補 ClosePrice 的 CLI job。
- `back/src/scripts/eodClosePrice.job.js`: 盤後收盤價同步 job（批次更新資料）。
- `back/src/scripts/purgeClosePriceKeepLastN.js`: ClosePrice 清理 job（保留最近 N 筆）。
- `back/src/scripts/syncStockUniverse.job.js`: 股票主檔/元資料同步 job。

### `back/src/services/`
- `back/src/services/admin.service.js`: 管理員 job 的建立與狀態更新邏輯（EOD、sector sync）。
- `back/src/services/auth.service.js`: 註冊/登入/取得個人資料的商業邏輯與 token 產生。
- `back/src/services/closePrice.service.js`: 收盤價抓取、正規化、入庫與查詢邏輯。
- `back/src/services/eod.service.js`: EOD 任務入口（將 days 轉換日期區間並觸發收盤價刷新）。
- `back/src/services/sector.service.js`: 產業清單彙整邏輯（統計 sector 與 symbols）。
- `back/src/services/stock.service.js`: 股票 EOD 歷史資料整理與 treemap 清單查詢。
- `back/src/services/treemap.service.js`: Treemap 資料彙整邏輯（價格變化計算與排序）。

### `back/src/utils/`
- `back/src/utils/httpError.js`: 自訂 HTTP 錯誤類別，統一錯誤語意。
- `back/src/utils/normalizeMarket.js`: 市場代碼正規化工具（TW/TWSE/TSE）。
- `back/src/utils/response.js`: API 回應格式工具，集中成功/失敗回應。
- `back/src/utils/symbols0050.js`: 0050 成分股清單的正規化工具。
- `back/src/utils/time.js`: 日期時間工具（格式化與區間計算）。
