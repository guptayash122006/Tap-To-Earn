import 'dotenv/config'
import app       from './src/app.js'
import connectDB from './src/config/db.js'
import env       from './src/config/env.js'
// import { startJobs } from './src/jobs/index.js'  // uncomment when cron jobs are ready

const PORT = env.PORT

const startServer = async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDB()

    // 2. Start Express server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀  Server running in [${env.NODE_ENV}] mode`)
      console.log(`📡  Listening on http://localhost:${PORT}`)
      console.log(`🔗  API base: http://localhost:${PORT}/api\n`)
    })

    // 3. Start background cron jobs
    // startJobs()

    // ── Graceful Shutdown ─────────────────────────────────
    const shutdown = (signal) => {
      console.log(`\n🔴  ${signal} received — shutting down gracefully...`)
      server.close(async () => {
        console.log('✅  HTTP server closed.')
        process.exit(0)
      })

      // Force kill after 10s if connections don't drain
      setTimeout(() => {
        console.error('❌  Forced shutdown (timeout)')
        process.exit(1)
      }, 10_000)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT',  () => shutdown('SIGINT'))

    // ── Unhandled Rejection Guard ─────────────────────────
    process.on('unhandledRejection', (reason, promise) => {
      console.error('⚠️  Unhandled Promise Rejection:', reason)
      // Don't exit in dev — crash in prod to let process manager restart
      if (env.isProd) {
        server.close(() => process.exit(1))
      }
    })

    process.on('uncaughtException', (err) => {
      console.error('💥  Uncaught Exception:', err)
      server.close(() => process.exit(1))
    })

  } catch (err) {
    console.error('❌  Failed to start server:', err.message)
    process.exit(1)
  }
}

startServer()
