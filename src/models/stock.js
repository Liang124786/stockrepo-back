import { Schema, model } from 'mongoose'

const stockSchema = new Schema(
  {
    symbol: {
      type: String,
      required: [true, '請輸入代號'],
      trim: true,
      uppercase: true,
    },

    /**
     * 市場（DB 層權威）
     * - 台股只存 TWSE / TPEX
     * - 前端傳 TW，後端 normalize → 對應查詢
     * - DB 永遠不存 TW
     */
    market: {
      type: String,
      required: [true, '請輸入市場別'],
      enum: {
        values: ['TWSE', 'TPEX'],
        message: 'market 只能是 TWSE / TPEX',
      },
      set: (v) =>
        String(v ?? '')
          .trim()
          .toUpperCase(),
      index: true,
    },

    name: {
      type: String,
      required: [true, '請輸入名稱'],
      trim: true,
    },

    // 產業 / 分類（來自證交所或你後續整理）
    sector: {
      type: String,
      trim: true,
      default: '',
    },

    // 是否啟用（下架時不給一般 user 看）
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

// 同市場同代號唯一
stockSchema.index({ market: 1, symbol: 1 }, { unique: true })

export default model('stocks', stockSchema)
