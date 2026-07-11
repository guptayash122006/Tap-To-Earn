/**
 * adPolicyGuard.js — Runtime policy enforcement layer.
 *
 * This module acts as a safety gate that prevents any ad-related code from
 * accidentally granting invalid rewards or placing ads in prohibited locations.
 *
 * POLICY SOURCES:
 *   - Google H5 Games Ads: https://developers.google.com/ad-placement/docs/policy
 *   - Google AdSense Program Policies: https://support.google.com/adsense/answer/48182
 *   - PropellerAds ToS: https://propellerads.com/terms-of-service/
 */

import { AD_CONFIG } from './adConfig.js'

// ── Prohibited placement zones ────────────────────────────────
/**
 * IDs of DOM elements that are considered "game controls."
 * AdSense policy prohibits placing ads within 150px of these.
 */
const PROHIBITED_ZONES = [
  'tapBtn',          // the main tap button
  'energyBar',       // energy bar (game mechanic)
  'tapCounter',      // live tap counter
  'coinDisplay',     // coin display
]

// ── Prohibited reward types ───────────────────────────────────
/**
 * These reward types must NEVER be granted from ad callbacks.
 * Granting withdrawable coins for ad views violates all network policies.
 */
const PROHIBITED_REWARD_TYPES = [
  'withdrawable_coins',
  'coins',
  'balance',
  'fiat',
  'usd',
  'money',
]

// ── Rate limiting (client side, server is authoritative) ──────
const rewardedAdLog = []   // { ts: timestamp }

/**
 * checkPlacementAllowed — ensures an ad won't render in a prohibited zone.
 * @param {string} containerId — the DOM ID of the target container
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkPlacementAllowed(containerId) {
  if (PROHIBITED_ZONES.includes(containerId)) {
    return {
      allowed: false,
      reason: `POLICY VIOLATION: Cannot place ad inside or adjacent to game control "${containerId}".`,
    }
  }

  const el = document.getElementById(containerId)
  if (!el) {
    return { allowed: false, reason: `Container "${containerId}" not found in DOM.` }
  }

  // Check proximity to game controls (within 150px bounding box)
  const adRect = el.getBoundingClientRect()
  for (const zoneId of PROHIBITED_ZONES) {
    const zone = document.getElementById(zoneId)
    if (!zone) continue
    const zoneRect = zone.getBoundingClientRect()
    const distance = Math.max(
      0,
      Math.max(zoneRect.left - adRect.right, adRect.left - zoneRect.right,
               zoneRect.top  - adRect.bottom, adRect.top  - zoneRect.bottom)
    )
    if (distance < 150) {
      return {
        allowed: false,
        reason: `POLICY VIOLATION: Ad container "${containerId}" is within 150px of game control "${zoneId}" (distance: ${Math.round(distance)}px). Move the ad further from game controls.`,
      }
    }
  }

  return { allowed: true }
}

/**
 * checkRewardAllowed — validates that a reward type is policy-compliant.
 * ONLY 'energy' rewards are permitted from ad callbacks.
 *
 * @param {string} rewardType — the type of reward to grant
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkRewardAllowed(rewardType) {
  const lower = (rewardType || '').toLowerCase()

  for (const prohibited of PROHIBITED_REWARD_TYPES) {
    if (lower.includes(prohibited)) {
      return {
        allowed: false,
        reason: `POLICY VIOLATION: Cannot grant "${rewardType}" as an ad reward. Only virtual in-game energy is permitted. Granting withdrawable coins for ad views violates Google AdSense Program Policies §2 and all major network ToS.`,
      }
    }
  }

  if (lower !== 'energy' && lower !== 'energy_refill') {
    return {
      allowed: false,
      reason: `Reward type "${rewardType}" is not in the approved list. Only "energy" rewards are allowed.`,
    }
  }

  return { allowed: true }
}

/**
 * checkClientRateLimit — client-side rate limit check (server is authoritative).
 * Prevents the UI from even trying to show a rewarded ad if limits are hit.
 *
 * @returns {{ allowed: boolean, reason?: string, waitSeconds?: number }}
 */
export function checkClientRateLimit() {
  const now      = Date.now()
  const hourAgo  = now - 3_600_000
  const cooldown = AD_CONFIG.REWARDS.COOLDOWN_SEC * 1000

  // Clean old entries
  while (rewardedAdLog.length && rewardedAdLog[0].ts < hourAgo) rewardedAdLog.shift()

  // Hourly cap
  if (rewardedAdLog.length >= AD_CONFIG.REWARDS.MAX_PER_HOUR) {
    return {
      allowed: false,
      reason: `Hourly rewarded ad limit reached (${AD_CONFIG.REWARDS.MAX_PER_HOUR}/hr). Try again next hour.`,
    }
  }

  // Per-ad cooldown
  const last = rewardedAdLog[rewardedAdLog.length - 1]
  if (last) {
    const elapsed   = now - last.ts
    const remaining = Math.ceil((cooldown - elapsed) / 1000)
    if (elapsed < cooldown) {
      return {
        allowed: false,
        reason: `Please wait ${remaining}s before watching another ad.`,
        waitSeconds: remaining,
      }
    }
  }

  return { allowed: true }
}

/**
 * recordRewardedAdView — records that a rewarded ad was shown (client log).
 * Call this only from within the `adViewed` callback.
 */
export function recordRewardedAdView() {
  rewardedAdLog.push({ ts: Date.now() })
}

/**
 * policyLog — uniform logger for policy events.
 */
export function policyLog(level, message, meta = {}) {
  const prefix = { warn: '⚠️ [AdPolicy]', error: '🚫 [AdPolicy]', info: 'ℹ️ [AdPolicy]' }[level] || '[AdPolicy]'
  if (AD_CONFIG.DEBUG || level === 'error') {
    console[level === 'error' ? 'error' : 'warn'](`${prefix} ${message}`, meta)
  }
}
