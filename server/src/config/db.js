import mongoose from 'mongoose'
import env from './env.js'

const MONGO_OPTIONS = {
  maxPoolSize:       10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:   45000,
}

let isConnected = false

const connectDB = async () => {
  if (isConnected) return

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, MONGO_OPTIONS)
    isConnected = true
    console.log(`✅  MongoDB connected: ${conn.connection.host}`)

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      console.log('🔴  MongoDB connection closed (SIGINT)')
      process.exit(0)
    })
  } catch (err) {
    console.error(`❌  MongoDB connection failed: ${err.message}`)
    process.exit(1)
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false
  console.warn('⚠️   MongoDB disconnected')
})

mongoose.connection.on('reconnected', () => {
  isConnected = true
  console.log('🔄  MongoDB reconnected')
})

export default connectDB
