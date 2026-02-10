import passport from 'passport'
import passportLocal from 'passport-local'
import passportJWT from 'passport-jwt'
import bcrypt from 'bcryptjs'
import User from '../models/user.js'

// passport.use(驗證方式,驗證策略(策略設定,策略執行後處理))
// passportLocal 帳號密碼驗證策略，檢查帳號密碼欄位有沒有值

passport.use(
  'login',
  new passportLocal.Strategy(
    // 設定檢查欄位名稱，預設是 username 和 passport
    {
      usernameField: 'account',
      passwordField: 'password',
    },
    // 檢查完後的處理
    // account = 帳號欄位值
    // password = 密碼欄位值
    // done = 驗證方法執行完成，把結果帶到下一步
    // done(錯誤，驗證結果，info)
    async (account, password, done) => {
      try {
        // 檢查帳號是否存在
        const user = await User.findOne({ account }).select('+password').orFail(new Error('USER'))

        // 檢查密碼是否正確
        const match = await bcrypt.compare(password, user.password)
        if (!match) {
          throw new Error('USER')
          // 驗證成功，下一步
        }
        done(null, user)
      } catch (error) {
        // 驗證失敗，錯誤帶到下一步
        done(error)
      }
    },
  ),
)

passport.use(
  'jwt',
  new passportJWT.Strategy(
    {
      jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
      // 將 req 傳入下面的 funcion
      passReqToCallback: true,
      // 忽略過期檢查，因為舊換新可以允許過期的 jwt
      ignoreExpiration: true,
    },
    // req 必須要設定 passReqToCallBack 才能用
    // 因為套件只給解編後的內容，不會給原本的 jwt，所以要自己從 req 拿
    // payload = jwt 內容
    async (req, payload, done) => {
      try {
        // 從 req 取 token
        const token = passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken()(req)
        // 手動檢查過期
        // 只有舊換新和登出允許過期
        // payload.exp 是過期時間，單位是秒
        // Date.now 是現在時間，單位是毫秒
        const expired = payload.exp * 1000 < Date.now()
        // 請求路徑
        // http://localhost:4000/user/abcd?aaa=111&bbb=222
        // req.originUrl=/user/abcd?aaa=111&bbb=222
        // req.baseUrl = /user
        // req.path = /abcd
        // req.query={aaa:'111',bbb:'222'}
        const url = req.baseUrl + req.path
        if (expired && url !== '/user/refresh' && url !== '/user/logout') {
          throw new Error('EXP')
        }

        // 檢查使用者是否存在，且有這個token
        const user = await User.findOne({ _id: payload._id, tokens: token }).orFail(
          new Error('USER'),
        )

        // 驗證成功，下一步
        req.token = token
        done(null, user)
      } catch (error) {
        // 驗證失敗，錯誤帶到下一步
        done(error)
      }
    },
  ),
)
