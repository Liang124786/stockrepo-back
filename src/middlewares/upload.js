import multer from 'multer'
import fs from 'fs'
import path from 'path'

const TMP_DIR = path.resolve(process.cwd(), 'tmp')

try {
  fs.mkdirSync(TMP_DIR, { recursive: true })
} catch (_) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || ''
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

export default upload
