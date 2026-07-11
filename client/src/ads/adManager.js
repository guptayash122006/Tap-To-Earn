/**
 * adManager.js — Singleton that loads ad network SDKs and exposes
 * a unified interface used by all ad components.
 *
 * Usage:
 *   import adManager from './adManager.js'
 *   await adManager.init()
 *   adManager.showRewarded({ onGranted, onDismissed, onError })
 *
 * POLICY: This manager enforces all placement and reward checks through
 * adPolicyGuard.js before delegating to any network adapter.
 */

import { AD_CONFIG }        from './adConfig.js'
import { policyLog }         from './adPolicyGuard.js'

// ── State ─────────────────────────────────────────────────────
let _initialized = false
let _adBreakReady = false   // H5 Games Ads API ready
let _initPromise  = null

// ── Google H5 Games Ads bootstrap ────────────────────────────
function bootstrapGoogleH5() {
  return new Promise((resolve) => {
    // Inject adsbygoogle.js with correct pub ID
    const existing = document.getElementById('adsense-script')
    if (!existing) {
      const script    = document.createElement('script')
      script.id       = 'adsense-script'
      script.async    = true
      script.src      = AD_CONFIG.GOOGLE.SCRIPT_SRC
      script.crossOrigin = 'anonymous'

      script.onload = () => {
        policyLog('info', 'AdSense script loaded.')
        // Define H5 Games Ads API shim
        window.adsbygoogle = window.adsbygoogle || []
        window.adBreak     = window.adConfig = function (o) {
          window.adsbygoogle.push(o)
        }

        // Configure ad environment
        window.adConfig({
          preloadAdBreaks: 'on',   // preload ads for faster display
          onReady: () => {
            _adBreakReady = true
            policyLog('info', 'H5 Games Ads API ready.')
            resolve(true)
          },
        })
      }

      script.onerror = (e) => {
        policyLog('error', 'AdSense script failed to load.', e)
        // Non-fatal: degrade gracefully, resolve false
        resolve(false)
      }

      document.head.appendChild(script)
    } else {
      // Script already injected (e.g., SPA re-init)
      _adBreakReady = !!window.adBreak
      resolve(_adBreakReady)
    }
  })
}

// ── Google AdSense display banner bootstrap ───────────────────
function setupDisplayBanners() {
  // Push all .adsbygoogle divs that haven't been initialized yet
  try {
    const slots = document.querySelectorAll('.adsbygoogle[data-ad-status="unfilled"], .adsbygoogle:not([data-ad-status])')
    slots.forEach(() => {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    })
    if (slots.length > 0) policyLog('info', `Pushed ${slots.length} display banner slot(s).`)
  } catch (err) {
    policyLog('error', 'Display banner push failed.', err)
  }
}

// ── Test mode stubs ───────────────────────────────────────────
/**
 * In test mode we simulate ad callbacks so you can develop & style
 * the UI without a real AdSense account.
 */
function createTestAdBreak() {
  window.adBreak = function (opts = {}) {
    policyLog('info', `[TEST] adBreak called — type: ${opts.type || 'unknown'}, name: ${opts.name || '?'}`)

    if (opts.type === 'rewarded') {
      // Simulate user prompt flow
      opts.beforeReward?.(() => {
        // Simulate the user choosing to watch the ad
        setTimeout(() => {
          opts.beforeAd?.()
          policyLog('info', '[TEST] Rewarded ad started (simulated, 3s).')
          setTimeout(() => {
            opts.afterAd?.()
            // Randomly simulate viewed vs dismissed (80% viewed)
            if (Math.random() < 0.8) {
              policyLog('info', '[TEST] adViewed fired — reward should be granted.')
              opts.adViewed?.()
            } else {
              policyLog('info', '[TEST] adDismissed fired — no reward.')
              opts.adDismissed?.()
            }
          }, 3000)
        }, 500)
      })
    } else if (opts.type === 'interstitial' || opts.type === 'start' || opts.type === 'next') {
      opts.beforeAd?.()
      setTimeout(() => {
        opts.afterAd?.()
        policyLog('info', '[TEST] Interstitial ad closed (simulated).')
      }, 2000)
    }
  }

  window.adConfig = function (opts = {}) {
    policyLog('info', '[TEST] adConfig called.', opts)
    opts.onReady?.()
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * init — loads all enabled ad networks.
 * Call once on page load. Subsequent calls are no-ops (singleton).
 *
 * @returns {Promise<boolean>} — true if at least one network loaded
 */
async function init() {
  if (_initialized) return true
  if (_initPromise)  return _initPromise

  _initPromise = (async () => {
    policyLog('info', `AdManager init — TEST_MODE: ${AD_CONFIG.TEST_MODE}`)

    if (AD_CONFIG.TEST_MODE) {
      createTestAdBreak()
      _adBreakReady = true
      _initialized  = true
      policyLog('info', 'AdManager ready (test mode — no real ads will show).')
      return true
    }

    const googleOk = await bootstrapGoogleH5()
    setupDisplayBanners()
    _initialized = true
    policyLog('info', `AdManager ready. Google H5: ${googleOk ? '✅' : '❌'}`)
    return googleOk
  })()

  return _initPromise
}

/**
 * showRewarded — triggers a user-initiated rewarded ad.
 *
 * POLICY:
 *   - Must ONLY be called in response to an explicit user gesture (button click).
 *   - The reward (energy refill) is granted ONLY in the `onGranted` callback
 *     and only after server-side validation.
 *   - Do NOT call this automatically or on a timer.
 *
 * @param {object} opts
 * @param {string} opts.placementName — must match AD_CONFIG.GOOGLE.PLACEMENTS.*
 * @param {function} opts.onReady      — called when ad is ready, receives showAdFn
 * @param {function} opts.onGranted    — called when user watched the full ad
 * @param {function} opts.onDismissed  — called when user closed ad early (no reward)
 * @param {function} opts.onError      — called on failure (no ad fill, network error)
 * @param {function} opts.onBeforeAd   — pause game, mute audio, etc.
 * @param {function} opts.onAfterAd    — resume game, unmute audio, etc.
 */
function showRewarded({
  placementName = AD_CONFIG.GOOGLE.PLACEMENTS.REWARDED_ENERGY,
  onReady       = null,
  onGranted,
  onDismissed,
  onError,
  onBeforeAd    = () => {},
  onAfterAd     = () => {},
} = {}) {
  if (!_adBreakReady || !window.adBreak) {
    policyLog('error', 'adBreak not ready — AdManager not initialized.')
    onError?.({ code: 'NOT_INITIALIZED', message: 'Ad system not ready. Please try again.' })
    return
  }

  try {
    window.adBreak({
      type: 'rewarded',
      name: placementName,

      // Pause game state BEFORE ad appears (required by Google policy)
      beforeAd: () => {
        policyLog('info', 'Rewarded ad starting — pausing game state.')
        onBeforeAd()
      },

      // Resume game state AFTER ad closes (both viewed and dismissed)
      afterAd: () => {
        policyLog('info', 'Rewarded ad closed — resuming game state.')
        onAfterAd()
      },

      // Called with a `showAdFn`. You MUST call showAdFn() to display the ad.
      // This is where you show the "Watch ad to refill energy?" UI prompt.
      beforeReward: (showAdFn) => {
        policyLog('info', 'Rewarded ad ready — showing user prompt.')
        if (onReady) {
          onReady(showAdFn)
        } else {
          // Default: show ad immediately if no prompt handler provided
          showAdFn()
        }
      },

      // User watched the full ad → grant reward (server-validated)
      adViewed: () => {
        policyLog('info', 'adViewed — reward eligible. Calling onGranted.')
        onGranted?.()
      },

      // User closed the ad early → no reward
      adDismissed: () => {
        policyLog('warn', 'adDismissed — no reward granted.')
        onDismissed?.()
      },
    })
  } catch (err) {
    policyLog('error', 'adBreak() threw an error.', err)
    onError?.({ code: 'AD_BREAK_ERROR', message: err.message || 'Unknown ad error.', raw: err })
  }
}

/**
 * showInterstitial — shows a non-rewarded session-break interstitial.
 *
 * POLICY:
 *   - Must only appear at natural session breaks (every N taps milestone).
 *   - NEVER shown automatically mid-tap or without a pause in gameplay.
 *   - No reward is granted for viewing interstitials.
 *
 * @param {object} opts
 * @param {string} opts.placementName
 * @param {function} opts.onBeforeAd — pause audio, freeze UI
 * @param {function} opts.onAfterAd  — resume everything
 * @param {function} opts.onError
 */
function showInterstitial({
  placementName = AD_CONFIG.GOOGLE.PLACEMENTS.INTERSTITIAL_BREAK,
  onBeforeAd    = () => {},
  onAfterAd     = () => {},
  onError,
} = {}) {
  if (!_adBreakReady || !window.adBreak) {
    onError?.({ code: 'NOT_INITIALIZED', message: 'Ad system not ready.' })
    return
  }

  try {
    window.adBreak({
      type:     'interstitial',
      name:     placementName,
      beforeAd: () => { policyLog('info', 'Interstitial starting.'); onBeforeAd() },
      afterAd:  () => { policyLog('info', 'Interstitial closed.');   onAfterAd()  },
    })
  } catch (err) {
    policyLog('error', 'Interstitial adBreak() failed.', err)
    onError?.({ code: 'AD_BREAK_ERROR', message: err.message })
  }
}

/**
 * pushDisplayBanner — calls adsbygoogle.push({}) for a specific slot container.
 * Use after dynamically injecting an .adsbygoogle div into the DOM.
 */
function pushDisplayBanner() {
  if (AD_CONFIG.TEST_MODE) {
    policyLog('info', '[TEST] Display banner push skipped in test mode.')
    return
  }
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch (err) {
    policyLog('error', 'Display banner push failed.', err)
  }
}

/** isReady — returns true when AdManager has been successfully initialized. */
const isReady = () => _initialized && _adBreakReady

export const adManager = { init, isReady, showRewarded, showInterstitial, pushDisplayBanner }
export default adManager
