import { Schema, model } from 'mongoose'

const adminSchema = new Schema(
  {
    type: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['queued', 'running', 'success', 'failed'],
      default: 'queued',
    },

    createdBy: {
      _id: { type: Schema.Types.ObjectId, ref: 'User' },
      account: { type: String, default: '' },
    },

    payload: { type: Schema.Types.Mixed, default: {} },
    summary: { type: String, default: '' },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    errorMessage: { type: String, default: '' },
  },
  { timestamps: true },
)

export default model('Admin', adminSchema)
