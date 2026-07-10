import dotenv from 'dotenv'
dotenv.config()

const _required = (key) => {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

const env = {
  NODE_ENV:                process.env.NODE_ENV || 'development',
  PORT:                    parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI:             _required('MONGODB_URI'),
  JWT_SECRET:              _required('JWT_SECRET'),
  JWT_REFRESH_SECRET:      _required('JWT_REFRESH_SECRET'),
  JWT_EXPIRES_IN:          process.env.JWT_EXPIRES_IN          || '15m',
  JWT_REFRESH_EXPIRES_IN:  process.env.JWT_REFRESH_EXPIRES_IN  || '7d',
  CLIENT_ORIGIN:           process.env.CLIENT_ORIGIN           || 'http://localhost:5173',
  isDev:                   (process.env.NODE_ENV || 'development') === 'development',
  isProd:                  process.env.NODE_ENV === 'production',
}

export default env
