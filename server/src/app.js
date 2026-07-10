import express       from 'express'
import cors          from 'cors'
import helmet        from 'helmet'
import morgan        from 'morgan'
import cookieParser  from 'cookie-parser'
import env           from './config/env.js'
import { globalLimiter } from './middleware/rateLimiter.js'
import errorHandler  from './middleware/errorHandler.js'
import apiRoutes     from './routes/index.js'

const app = express()

// ── Security Headers (Helmet) ─────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.isProd
      ? undefined
      : false, // disable CSP in dev for easier debugging
  })
)

// ── CORS ──────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [env.CLIENT_ORIGIN]
      // Allow Postman / server-to-server in dev (no origin header)
      if (!origin && env.isDev) return callback(null, true)
      if (allowed.includes(origin)) return callback(null, true)
      callback(new Error(`CORS policy: origin '${origin}' not allowed.`))
    },
    credentials:  true,               // needed for cookies
    methods:      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
  })
)

// ── Request Parsing ───────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())               // for HttpOnly refresh token cookies

// ── Request Logging ───────────────────────────────────────
if (env.isDev) {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// ── Global Rate Limiter ────────────────────────────────────
app.use('/api', globalLimiter)

// ── API Routes ────────────────────────────────────────────
app.use('/api', apiRoutes)

// ── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.method} ${req.originalUrl}' not found.`,
  })
})

// ── Global Error Handler (must be last middleware) ────────
app.use(errorHandler)

export default app
