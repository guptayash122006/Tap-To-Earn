/** Centralised game + system constants. Override at runtime via SystemSettings. */
export const GAME = {
  DEFAULT_TAP_POWER:           1,
  DEFAULT_MAX_ENERGY:          100,
  ENERGY_REFILL_RATE:          1,      // units per tick
  ENERGY_REFILL_INTERVAL_SEC:  30,     // seconds per tick
  MAX_ADS_PER_DAY:             10,
  AD_COOLDOWN_MINUTES:         60,
}

export const REFERRAL = {
  REFERRER_BONUS:              50,    // coins to referrer once referee activates
  REFEREE_BONUS:               20,    // welcome coins to new user on join
  COMMISSION_RATE:             0,     // % of referee earnings forwarded to referrer
  ACTIVITY_THRESHOLD_TAPS:    100,   // referee must reach this tap count to unlock referrer bonus
  MAX_REFERRALS_PER_IP:         5,    // max sign-ups from same IP that can all count
  CODE_LENGTH:                  8,    // characters in referral code
  LINK_BASE:                   'https://tapearn.app/r', // production referral link
  MIN_ACCOUNT_AGE_HOURS:        1,    // referee account must be >1hr old before bonus triggers
}

export const DAILY_REWARDS = {
  1: 50,
  2: 75,
  3: 100,
  4: 150,
  5: 200,
  6: 250,
  7: 500,
}

export const WITHDRAWAL = {
  MINIMUM_COINS:    1000,
  CONVERSION_RATE:  0.001,   // 1 coin = $0.001
  CURRENCY:         'USD',
  PROCESSING_DAYS:  3,
}

export const ROLES = {
  USER:  'user',
  ADMIN: 'admin',
}

export const STATUS = {
  ACTIVE:    'active',
  BANNED:    'banned',
  SUSPENDED: 'suspended',
}

export const BCRYPT_ROUNDS = 12

export const TAP = {
  LIFETIME_MAX:               50000,
  MAX_PER_BATCH:              10,
  ENERGY_COST_PER_TAP:        1,
  MIN_HUMAN_INTERVAL_MS:      80,
  BOT_STD_DEV_THRESHOLD_MS:   15,
  VELOCITY_WINDOW_MS:         5000,
  VELOCITY_MAX_TAPS:          60,
  TIMESTAMP_DRIFT_TOLERANCE_MS: 30000,
  SUSPICIOUS_SCORE_FLAG:      60,
  SUSPICIOUS_SCORE_BLOCK:     90,
  REDUCED_REWARD_MULTIPLIER:  0.5,
}
