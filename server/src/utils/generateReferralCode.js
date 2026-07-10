import { nanoid } from 'nanoid'

/**
 * Generates a unique referral code.
 * Format: 8 uppercase alphanumeric characters.
 * Collision probability is astronomically low at scale.
 */
const generateReferralCode = () => {
  return nanoid(8).toUpperCase()
}

export default generateReferralCode
