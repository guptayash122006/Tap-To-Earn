import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../src/app.js'
import { User, Coin } from '../../src/models/index.js'

// ── Test DB ───────────────────────────────────────────────
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/tap-to-earn-test')
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
})

afterEach(async () => {
  await User.deleteMany({})
  await Coin.deleteMany({})
})

// ─────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  const validBody = {
    username:        'testuser',
    email:           'test@example.com',
    password:        'Test@1234',
    confirmPassword: 'Test@1234',
  }

  it('should register a new user and return 201', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody)
    expect(res.statusCode).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('accessToken')
    expect(res.body.data.user.email).toBe(validBody.email)
    expect(res.body.data.user).not.toHaveProperty('passwordHash')
  })

  it('should create a coin wallet for new user', async () => {
    await request(app).post('/api/auth/register').send(validBody)
    const user   = await User.findOne({ email: validBody.email })
    const wallet = await Coin.findOne({ userId: user._id })
    expect(wallet).not.toBeNull()
    expect(wallet.availableBalance).toBe(0)
  })

  it('should return 409 on duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validBody)
    const res = await request(app).post('/api/auth/register').send(validBody)
    expect(res.statusCode).toBe(409)
  })

  it('should return 422 on weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, password: 'weak', confirmPassword: 'weak' })
    expect(res.statusCode).toBe(422)
    expect(res.body.errors).toBeDefined()
  })

  it('should return 422 when passwords do not match', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, confirmPassword: 'Different@99' })
    expect(res.statusCode).toBe(422)
  })

  it('should accept referral code and credit bonus', async () => {
    // Register referrer first
    await request(app).post('/api/auth/register').send(validBody)
    const referrer = await User.findOne({ email: validBody.email })

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username:        'referee',
        email:           'referee@example.com',
        password:        'Test@1234',
        confirmPassword: 'Test@1234',
        referralCode:    referrer.referralCode,
      })

    expect(res.statusCode).toBe(201)
    const wallet = await Coin.findOne({ userId: res.body.data.user._id })
    expect(wallet.availableBalance).toBe(20) // REFEREE_BONUS
  })

  it('should return 400 on invalid referral code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, referralCode: 'INVALID1' })
    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      username: 'loginuser', email: 'login@example.com',
      password: 'Test@1234', confirmPassword: 'Test@1234',
    })
  })

  it('should login with correct credentials and return 200', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Test@1234' })
    expect(res.statusCode).toBe(200)
    expect(res.body.data).toHaveProperty('accessToken')
    expect(res.headers['set-cookie']).toBeDefined()  // refresh cookie
  })

  it('should return 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPass@1' })
    expect(res.statusCode).toBe(401)
  })

  it('should return 401 on non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Test@1234' })
    expect(res.statusCode).toBe(401)
    // Same error message for both cases (enumeration protection)
    expect(res.body.message).toBe('Invalid email or password.')
  })
})

// ─────────────────────────────────────────────────────────
// GET /ME (Protected Route)
// ─────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let accessToken

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'meuser', email: 'me@example.com',
      password: 'Test@1234', confirmPassword: 'Test@1234',
    })
    accessToken = res.body.data.accessToken
  })

  it('should return profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.user.email).toBe('me@example.com')
    expect(res.body.data.user).not.toHaveProperty('passwordHash')
    expect(res.body.data).toHaveProperty('wallet')
  })

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.statusCode).toBe(401)
  })

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.statusCode).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('should clear refresh token on logout', async () => {
    const loginRes = await request(app).post('/api/auth/register').send({
      username: 'logoutuser', email: 'logout@example.com',
      password: 'Test@1234', confirmPassword: 'Test@1234',
    })
    const { accessToken } = loginRes.body.data

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(logoutRes.statusCode).toBe(200)

    const user = await User.findOne({ email: 'logout@example.com' }).select('+refreshToken')
    expect(user.refreshToken).toBeNull()
  })
})
