import crypto from 'crypto'
import { User, Coin } from '../models/index.js'
import Transaction from '../models/Transaction.js'

export const processAdGemPostback = async (req) => {
  const {
    request_id,
    verifier,
    player_id,
    amount,
    conversion_id,
    goal_id,
    offer_id,
    payout,
  } = req.query

  // 1. Required parameters
  if (!request_id || !verifier || !player_id || amount === undefined) {
    const error = new Error('Missing required AdGem parameters')
    error.statusCode = 400
    throw error
  }

  // 2. Verify AdGem postback
  const url = new URL(
    `${req.protocol}://${req.get('host')}${req.originalUrl}`
  )

  url.searchParams.delete('verifier')

  const expectedVerifier = crypto
    .createHmac(
      'sha256',
      process.env.ADGEM_POSTBACK_KEY
    )
    .update(url.href)
    .digest('hex')

  if (
    expectedVerifier.length !== verifier.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expectedVerifier),
      Buffer.from(verifier)
    )
  ) {
    const error = new Error('Invalid AdGem verifier')
    error.statusCode = 401
    throw error
  }

  // 3. Prevent duplicate conversion
  const existingTransaction = await Transaction.findOne({
    'metadata.adgemRequestId': request_id,
  })

  if (existingTransaction) {
    return {
      duplicate: true,
      message: 'AdGem postback already processed.',
    }
  }

  // 4. Find user
  const user = await User.findById(player_id)

  if (!user) {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }

  if (user.status !== 'active') {
    const error = new Error('User account is not active')
    error.statusCode = 403
    throw error
  }

  // 5. Validate reward
  const reward = Number(amount)

  if (!Number.isFinite(reward) || reward <= 0) {
    const error = new Error('Invalid AdGem reward amount')
    error.statusCode = 400
    throw error
  }

  // 6. Get current wallet
  const currentWallet = await Coin.getWallet(user._id)

  const balanceBefore =
    currentWallet?.availableBalance || 0

  // 7. Credit coins
  const wallet = await Coin.creditCoins(
    user._id,
    reward,
    'ads'
  )

  // 8. Record transaction
  await Transaction.create({
    userId: user._id,
    type: 'ad_reward',
    category: 'credit',
    amount: reward,
    balanceBefore,
    balanceAfter: wallet.availableBalance,
    description: `AdGem offer reward${offer_id ? ` - ${offer_id}` : ''}`,
    metadata: {
      adgemRequestId: request_id,
      adgemConversionId: conversion_id || null,
      adgemGoalId: goal_id || null,
      adgemPayout:
        payout !== undefined ? Number(payout) : null,
    },
    status: 'completed',
  })

  return {
    duplicate: false,
    message: 'AdGem reward credited successfully.',
    reward,
    playerId: player_id,
    newBalance: wallet.availableBalance,
  }
}