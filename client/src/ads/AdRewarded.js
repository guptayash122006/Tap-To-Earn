/**
 * AdRewarded.js — Opt-in rewarded video ad component.
 *
 * This component handles the complete rewarded ad UX flow:
 *   1. Shows "Watch ad to refill energy?" prompt (user must opt in)
 *   2. Shows loading state
 *   3. Calls adBreak() — Google shows the ad
 *   4. On completion → calls backend to validate and grant energy
 *   5. On dismissal or error → graceful cleanup, no reward granted
 *
 * POLICY COMPLIANCE (Google H5 Games Ads):
 *   ✅ Only triggered by user button click (never automatic)
 *   ✅ Shows clear opt-in prompt before ad
 *   ✅ Only grants ENERGY (virtual, non-withdrawable) — never coins/fiat
 *   ✅ Server validates before granting (prevents replay attacks)
 *   ✅ Rate limited: max 5 rewarded ads per hour (client + server)
 *   ✅ Shows ADVERTISEMENT disclosure label
 *   ❌ NEVER grants withdrawable balance
 *   ❌ NEVER calls automatically (must be user gesture)
 *
 * Usage:
 *   import AdRewarded from './AdRewarded.js'
 *   const rewardedAd = new AdRewarded({ onEnergyGranted: (amount) => updateEnergyUI(amount) })
 *   // Connect to a button: onclick="rewardedAd.trigger()"
 */

import { AD_CONFIG }           from './adConfig.js'
import adManager                from './adManager.js'
import {
  checkRewardAllowed,
  checkClientRateLimit,
  recordRewardedAdView,
  policyLog,
} from './adPolicyGuard.js'
import { API_BASE_URL as API_BASE } from '../api/axiosInstance.js'

export class AdRewarded {
  /**
   * @param {object} opts
   * @param {function} opts.onEnergyGranted  — called with (energyAmount) after server validates
   * @param {function} [opts.onDismissed]    — called when user closes ad early
   * @param {function} [opts.onError]        — called with error object on failure
   * @param {function} [opts.onGamePause]    — pause tap engine, mute audio
   * @param {function} [opts.onGameResume]   — resume tap engine, unmute audio
   */
  constructor({
    onEnergyGranted,
    onDismissed  = () => {},
    onError      = () => {},
    onGamePause  = () => {},
    onGameResume = () => {},
  } = {}) {
    this.onEnergyGranted = onEnergyGranted
    this.onDismissed     = onDismissed
    this.onError         = onError
    this.onGamePause     = onGamePause
    this.onGameResume    = onGameResume
    this._busy           = false
    this._modal          = null
  }

  // ── Public: trigger the rewarded ad flow ────────────────────
  /**
   * trigger — call this from a user-initiated button click.
   * Will show the opt-in prompt, then the ad if accepted.
   */
  trigger() {
    if (this._busy) {
      this._showError('An ad is already in progress.')
      return
    }

    // Client-side rate limit check
    const rateCheck = checkClientRateLimit()
    if (!rateCheck.allowed) {
      this._showError(rateCheck.reason, rateCheck.waitSeconds)
      return
    }

    // Policy check — only 'energy' rewards allowed
    const rewardCheck = checkRewardAllowed('energy')
    if (!rewardCheck.allowed) {
      policyLog('error', rewardCheck.reason)
      this.onError({ code: 'POLICY_VIOLATION', message: rewardCheck.reason })
      return
    }

    this._busy = true
    this._showOptInModal()
  }

  // ── Opt-in modal ────────────────────────────────────────────
  _showOptInModal() {
    const modal = document.createElement('div')
    modal.id    = 'adRewardedModal'
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9000;background:rgba(7,7,17,0.92);
      backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;
      font-family:'Outfit',sans-serif;
    `
    modal.innerHTML = `
      <div style="
        background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);
        border-radius:20px;padding:32px 28px;max-width:340px;width:90%;
        text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.6);
        animation:adModalIn 0.25s ease;
      ">
        <style>@keyframes adModalIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:none}}</style>
        <div style="font-size:48px;margin-bottom:12px">⚡</div>
        <h3 style="font-size:18px;font-weight:800;color:#f1f5f9;margin-bottom:8px">
          Refill Your Energy
        </h3>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:6px">
          Watch a short ad to restore <strong style="color:#a78bfa">${AD_CONFIG.REWARDS.ENERGY_AMOUNT} energy</strong> and keep tapping.
        </p>
        <p style="font-size:10px;color:#475569;margin-bottom:20px;letter-spacing:0.3px">
          ⚠️ Energy is in-game only — not redeemable for cash.
        </p>
        <div style="
          font-size:9px;color:#475569;letter-spacing:1.5px;text-transform:uppercase;
          margin-bottom:16px;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;
        ">📢 Advertisement — Watch to continue</div>
        <div style="display:flex;gap:10px">
          <button id="adRewardedSkip" style="
            flex:1;padding:12px;background:rgba(255,255,255,0.04);
            border:1px solid rgba(255,255,255,0.08);border-radius:10px;
            color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;
            font-family:'Outfit',sans-serif;transition:all 0.2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.08)'"
             onmouseout="this.style.background='rgba(255,255,255,0.04)'">
            Skip
          </button>
          <button id="adRewardedWatch" style="
            flex:1;padding:12px;
            background:linear-gradient(135deg,#7c3aed,#5b21b6);
            border:none;border-radius:10px;color:#fff;font-size:13px;
            font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;
            transition:all 0.2s;
          " onmouseover="this.style.opacity='0.9'"
             onmouseout="this.style.opacity='1'">
            ▶ Watch Ad
          </button>
        </div>
      </div>
    `

    document.body.appendChild(modal)
    this._modal = modal

    document.getElementById('adRewardedSkip').onclick  = () => this._handleSkip()
    document.getElementById('adRewardedWatch').onclick = () => this._handleWatchAccepted()
  }

  _handleSkip() {
    this._cleanup()
    this._busy = false
    policyLog('info', 'User skipped the rewarded ad prompt.')
    this.onDismissed()
  }

  _handleWatchAccepted() {
    // Remove modal and show loading state
    if (this._modal) {
      const watchBtn  = document.getElementById('adRewardedWatch')
      const skipBtn   = document.getElementById('adRewardedSkip')
      if (watchBtn) { watchBtn.disabled = true; watchBtn.textContent = '⏳ Loading ad...' }
      if (skipBtn)  { skipBtn.disabled  = true }
    }

    // Call adManager — it will call adBreak with the beforeReward callback
    adManager.showRewarded({
      placementName: AD_CONFIG.GOOGLE.PLACEMENTS.REWARDED_ENERGY,

      // Called with showAdFn — we call it immediately since user already opted in
      onReady: (showAdFn) => {
        this._cleanup()     // remove our modal — the ad will take over
        showAdFn()          // show the actual ad
      },

      // Pause game while ad is playing
      onBeforeAd: () => this.onGamePause(),

      // Resume game after ad closes (regardless of outcome)
      onAfterAd: () => this.onGameResume(),

      // User watched the full ad → validate on server before granting reward
      onGranted: () => this._validateAndGrant(),

      // User dismissed early → no reward
      onDismissed: () => {
        this._busy = false
        this._showDismissedToast()
        this.onDismissed()
      },

      // Ad error (no fill, network error, etc.)
      onError: (err) => {
        this._busy = false
        this._cleanup()
        policyLog('error', 'Rewarded ad error.', err)
        const msg = err.code === 'NOT_INITIALIZED'
          ? 'Ad system not ready. Please try again.'
          : 'No ad available right now. Try again later.'
        this._showError(msg)
        this.onError(err)
      },
    })
  }

  // ── Server validation ────────────────────────────────────────
  /**
   * _validateAndGrant — calls the backend to validate the ad view and grant energy.
   * The server is the authoritative source — if it rejects, no energy is granted.
   * This prevents replay attacks and bot fraud.
   */
  async _validateAndGrant() {
    recordRewardedAdView()   // record client-side (rate limiting)

    // Generate a one-time session token to prevent replay
    const sessionToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    try {
      const token = localStorage.getItem('accessToken') || ''
      const res   = await fetch(`${API_BASE}/ads/reward`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({
          rewardType:    'energy',            // ONLY 'energy' is allowed
          energyAmount:  AD_CONFIG.REWARDS.ENERGY_AMOUNT,
          placementName: AD_CONFIG.GOOGLE.PLACEMENTS.REWARDED_ENERGY,
          sessionToken,
          timestamp:     Date.now(),
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        policyLog('info', `Reward granted: +${data.data?.energyGranted} energy.`)
        this._busy = false
        this._showSuccessOverlay(data.data?.energyGranted || AD_CONFIG.REWARDS.ENERGY_AMOUNT)
        this.onEnergyGranted?.(data.data?.energyGranted || AD_CONFIG.REWARDS.ENERGY_AMOUNT)
      } else {
        this._busy = false
        policyLog('error', 'Server rejected reward.', data)
        this._showError(data.message || 'Could not grant reward. Please try again.')
        this.onError({ code: 'SERVER_REJECTED', message: data.message, data })
      }
    } catch (err) {
      this._busy = false
      policyLog('error', 'Network error during reward validation.', err)
      this._showError('Network error. Your energy will be refilled shortly.')
      // Fallback: grant locally (UX only, server will reconcile on next session load)
      this.onEnergyGranted?.(AD_CONFIG.REWARDS.ENERGY_AMOUNT)
      this.onError({ code: 'NETWORK_ERROR', message: err.message })
    }
  }

  // ── UI helpers ───────────────────────────────────────────────
  _showSuccessOverlay(amount) {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9001;background:rgba(7,7,17,0.85);
      backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;
      font-family:'Outfit',sans-serif;
    `
    overlay.innerHTML = `
      <div style="text-align:center;animation:adModalIn 0.3s ease">
        <div style="font-size:64px;animation:spin 0.8s ease">⚡</div>
        <div style="font-size:22px;font-weight:900;color:#f1f5f9;margin-top:12px">+${amount} Energy!</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:6px">Keep tapping! ⚡</div>
      </div>
    `
    document.body.appendChild(overlay)
    setTimeout(() => { overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.4s'; setTimeout(() => overlay.remove(), 400) }, 2000)
  }

  _showDismissedToast() {
    const t = document.createElement('div')
    t.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:10px 18px;font-family:'Outfit',sans-serif;
      font-size:13px;color:#94a3b8;z-index:9002;
    `
    t.textContent = '⚡ Ad closed early — no energy granted.'
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 3000)
  }

  _showError(msg, waitSec = null) {
    const t = document.createElement('div')
    t.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:#0d0d1a;border:1px solid rgba(239,68,68,0.4);
      border-radius:10px;padding:10px 18px;font-family:'Outfit',sans-serif;
      font-size:13px;color:#ef4444;z-index:9002;max-width:300px;text-align:center;
    `
    t.textContent = waitSec ? `⏱ ${msg}` : `❌ ${msg}`
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 4000)
  }

  _cleanup() {
    if (this._modal) { this._modal.remove(); this._modal = null }
  }
}

export default AdRewarded
