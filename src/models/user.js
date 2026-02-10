import mongoose from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcryptjs'

const { Schema, Error, model, models } = mongoose
// 自選股子文件（存在 User.watchlist 裡）
const watchlistSchema = new Schema(
  {
    symbol: {
      type: String,
      required: [true, '請輸入代號'],
      set: (v) =>
        String(v ?? '')
          .trim()
          .toUpperCase(),
    },

    /**
     * market（對外一律 TW；DB 內存 TW）
     * - 已廢除 US
     * - 避免把 TWSE/TPEX 混進 user.watchlist（那是 stocks collection 的責任）
     */
    market: {
      type: String,
      required: [true, '請輸入市場別'],
      enum: {
        values: ['TW'],
        message: 'market 只能是 TW',
      },
      set: (v) =>
        String(v ?? '')
          .trim()
          .toUpperCase(),
    },
  },
  {
    _id: false,
    timestamps: true,
  },
)

const schema = new Schema(
  {
    account: {
      type: String,
      required: [true, '帳號必填'],
      minlength: [4, '帳號最少 4 個字'],
      maxlength: [20, '帳號最多 20 個字'],
      unique: true,
      trim: true,
      validate: {
        validator: (value) => validator.isAlphanumeric(value, 'en-US'),
        message: '帳號只能是英數字',
      },
    },

    password: {
      type: String,
      required: [true, '密碼必填'],
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    tokens: {
      type: [String],
      default: [],
    },

    watchlist: {
      type: [watchlistSchema],
      default: [],
    },

    avatarUrl: {
      type: String,
      default: '',
    },

    avatarPublicId: {
      type: String,
      default: '',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
)

// 存進 DB 前：密碼有改才加密 + tokens 保留最新 10 筆
schema.pre('save', async function () {
  if (this.isModified('password')) {
    let message = ''

    if (this.password.length < 4) message = '密碼最少 4 個字'
    else if (this.password.length > 20) message = '密碼最多 20 個字'
    else if (!validator.isAlphanumeric(this.password, 'en-US')) message = '密碼只能是英數字'

    if (message) {
      const error = new Error.ValidationError()
      error.addError('password', new Error.ValidatorError({ message }))
      throw error
    }

    this.password = await bcrypt.hash(this.password, 10)
  }

  if (this.isModified('tokens') && this.tokens.length > 10) {
    this.tokens = this.tokens.slice(-10)
  }
})

export default models.User || model('User', schema)
