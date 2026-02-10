import { Schema, model } from 'mongoose'

const closePriceSchema = new Schema(
  {
    // 股票市場（對外一律 TW；內部舊資料若有 TWSE/TSE 也允許）
    market: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['TW', 'TWSE', 'TSE'],
      index: true,
    },

    // 股票代號（2330）
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },

    // 交易日（YYYY-MM-DD）
    date: {
      type: String,
      required: true,
      index: true,
    },

    // 開高低收量（允許 null，避免外部資料缺值導致整筆失敗）
    open: { type: Number, default: null },
    high: { type: Number, default: null },
    low: { type: Number, default: null },
    close: { type: Number, default: null },
    volume: { type: Number, default: null },

    // 資料來源（僅保留 EOD / FinMind）
    source: {
      type: String,
      default: 'finmind',
      enum: ['finmind', 'manual'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

/**
 * 複合唯一索引
 * - 保證同一市場 + 同一股票 + 同一天 只有一筆資料
 */
closePriceSchema.index({ market: 1, symbol: 1, date: 1 }, { unique: true })

// 排序/查詢優化
closePriceSchema.index({ market: 1, symbol: 1, date: -1 })

export default model('ClosePrice', closePriceSchema)
