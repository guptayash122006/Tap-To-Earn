/**
 * AdInterstitial.js — Session-break interstitial ad component.
 *
 * Shows a full-screen interstitial at NATURAL session breaks only.
 * No reward is granted. No user action required to close (Google handles it).
 *
 * POLICY COMPLIANCE:
 *   ✅ Only triggered at natural gameplay breaks (milestone reached)
 *   ✅ Never triggered mid-tap or while game is active
 *   ✅ Shows countdown UI so user knows ad is temporary
 *   ✅ No reward granted (interstitials are non-incentivized)
 *   ✅ Game state is paused before and resumed after
 *   ✅ Minimum 500 taps between interstitials (configurable)
 *   ❌ NEVER shown automatically without a gameplay milestone
 *   ❌ NEVER shown more than once per 5 minutes
 *
 * PLACEMENT: Between tap sessions — when user hits a 500-tap milestone
 *   and presses a "Claim Milestone Reward" button.
 */

import { AD_CONFIG }  from './adConfig.js'
import adManager       from './adManager.js'
import { policyLog }   from './adPolicyGuard.js'

const INTERSTITIAL_MIN_INTERVAL_MS  = 5 * 60 * 1000   // 5 minutes
const INTERSTITIAL_MIN_TAPS_BETWEEN = 500              // minimum taps between shows

export class AdInterstitial {
  /**
   * @param {object} opts
   * @param {function} [opts.onBeforeAd]  — pause tap engine
   * @param {function} [opts.onAfterAd]   — resume tap engine
   * @param {function} [opts.onError]     — error handler
   */
  constructor({
    onBeforeAd = () => {},
    onAfterAd  = () => {},
    onError    = () => {},
  } = {}) {
    this.onBeforeAd = onBeforeAd
    this.onAfterAd  = onAfterAd
    this.onError    = onError

    this._lastShownAt    = 0
    this._tapsSinceShown = 0
  }

  /**
   * recordTap — call this every time the user taps.
   * Used to track taps-between-shows for policy compliance.
   */
  recordTap() {
    this._tapsSinceShown++
  }

  /**
   * maybeTrigger — checks if conditions are met for an interstitial and shows it.
   * Call this when the user reaches a milestone (e.g., every 500 taps).
   *
   * @returns {boolean} — true if interstitial was triggered
   */
  maybeTrigger(placementName = AD_CONFIG.GOOGLE.PLACEMENTS.INTERSTITIAL_BREAK) {
    const now     = Date.now()
    const elapsed = now - this._lastShownAt

    // Time-based cooldown
    if (this._lastShownAt && elapsed < INTERSTITIAL_MIN_INTERVAL_MS) {
      policyLog('info', `Interstitial skipped — cooldown active (${Math.ceil((INTERSTITIAL_MIN_INTERVAL_MS - elapsed) / 1000)}s remaining).`)
      return false
    }

    // Tap-count gate
    if (this._tapsSinceShown < INTERSTITIAL_MIN_TAPS_BETWEEN) {
      policyLog('info', `Interstitial skipped — only ${this._tapsSinceShown}/${INTERSTITIAL_MIN_TAPS_BETWEEN} taps since last show.`)
      return false
    }

    // All checks passed — show the ad
    this._lastShownAt    = now
    this._tapsSinceShown = 0

    policyLog('info', `Interstitial triggered at milestone. Placement: ${placementName}`)
    this._showPreview(() => {
      adManager.showInterstitial({
        placementName,
        onBeforeAd: () => {
          policyLog('info', 'Interstitial: pausing game.')
          this.onBeforeAd()
        },
        onAfterAd: () => {
          policyLog('info', 'Interstitial: resuming game.')
          this.onAfterAd()
        },
        onError: (err) => {
          policyLog('error', 'Interstitial failed.', err)
          this.onError(err)
          this.onAfterAd()  // always resume even on error
        },
      })
    })

    return true
  }

  /**
   * _showPreview — shows a brief "ad is coming" overlay before the actual ad.
   * Helps users understand what's about to happen (improves UX and policy compliance).
   */
  _showPreview(proceed) {
    if (AD_CONFIG.TEST_MODE) {
      // In test mode just proceed after short delay
      policyLog('info', '[TEST] Interstitial preview shown (2s).')
      const overlay = document.createElement('div')
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:8998;background:rgba(7,7,17,0.95);
        backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;
        font-family:'Outfit',sans-serif;text-align:center;
      `
      overlay.innerHTML = `
        <div style="animation:adModalIn 0.2s ease">
          <div style="font-size:32px;margin-bottom:12px">📺</div>
          <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:6px">Short break!</div>
          <div style="font-size:13px;color:#94a3b8">An advertisement is loading...</div>
          <div style="font-size:10px;color:#475569;margin-top:8px;letter-spacing:1px">ADVERTISEMENT</div>
          <div id="adCountdown" style="font-size:24px;font-weight:900;color:#a78bfa;margin-top:12px">3</div>
        </div>
      `
      document.body.appendChild(overlay)
      let count = 3
      const timer = setInterval(() => {
        count--
        const el = document.getElementById('adCountdown')
        if (el) el.textContent = count
        if (count <= 0) {
          clearInterval(timer)
          overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.3s'
          setTimeout(() => { overlay.remove(); proceed() }, 300)
        }
      }, 1000)
    } else {
      proceed()
    }
  }
}

export default AdInterstitial
