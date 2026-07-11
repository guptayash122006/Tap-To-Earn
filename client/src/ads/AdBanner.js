/**
 * AdBanner.js — Reusable Google AdSense display banner component.
 *
 * ALLOWED PLACEMENTS (per AdSense policy):
 *   ✅ Below the leaderboard section
 *   ✅ Below the withdrawal history section
 *   ✅ Desktop sidebar (never mobile sidebar)
 *   ✅ Between transaction history rows (native-style)
 *
 * PROHIBITED PLACEMENTS (policy violations):
 *   ❌ Inside or near the tap button (within 150px)
 *   ❌ Inside the energy bar area
 *   ❌ Overlapping game controls
 *   ❌ Auto-expanding over game content
 *   ❌ Placed to encourage accidental clicks
 *
 * Usage:
 *   import { AdBanner } from './AdBanner.js'
 *
 *   // In dashboard.html, call after DOM ready:
 *   new AdBanner({
 *     containerId:  'adBannerLeaderboard',
 *     slot:          AD_CONFIG.GOOGLE.SLOTS.LEADERBOARD_BANNER,
 *     format:        'auto',
 *     label:         true,
 *   })
 */

import { AD_CONFIG }          from './adConfig.js'
import { checkPlacementAllowed, policyLog } from './adPolicyGuard.js'
import adManager               from './adManager.js'

export class AdBanner {
  /**
   * @param {object} opts
   * @param {string} opts.containerId     — ID of the <div> to inject the banner into
   * @param {string} opts.slot            — AdSense slot ID (from AD_CONFIG.GOOGLE.SLOTS)
   * @param {string} [opts.format]        — 'auto' | 'rectangle' | 'horizontal' | 'vertical'
   * @param {boolean}[opts.fullWidthResponsive] — enable full-width on mobile
   * @param {boolean}[opts.label]         — show "Advertisement" label above (recommended)
   * @param {string} [opts.width]         — explicit width, e.g. '300px' (or leave blank for responsive)
   * @param {string} [opts.height]        — explicit height, e.g. '250px'
   */
  constructor({
    containerId,
    slot             = AD_CONFIG.GOOGLE.SLOTS.LEADERBOARD_BANNER,
    format           = 'auto',
    fullWidthResponsive = true,
    label            = true,
    width            = null,
    height           = null,
  }) {
    this.containerId = containerId
    this.slot        = slot
    this.format      = format
    this.fwResponsive = fullWidthResponsive
    this.label       = label
    this.width       = width
    this.height      = height
    this._rendered   = false

    this._render()
  }

  _render() {
    // Policy check — ensure placement is not near game controls
    const { allowed, reason } = checkPlacementAllowed(this.containerId)
    if (!allowed) {
      policyLog('error', reason)
      return
    }

    const container = document.getElementById(this.containerId)
    if (!container || this._rendered) return
    this._rendered = true

    // Don't render in test mode — show placeholder instead
    if (AD_CONFIG.TEST_MODE) {
      container.innerHTML = this._testPlaceholder()
      return
    }

    // Build the ins element
    const ins = document.createElement('ins')
    ins.className      = 'adsbygoogle'
    ins.style.display  = 'block'
    ins.style.textAlign = 'center'
    if (this.width)  ins.style.width  = this.width
    if (this.height) ins.style.height = this.height
    ins.dataset.adClient      = AD_CONFIG.GOOGLE.PUBLISHER_ID
    ins.dataset.adSlot        = this.slot
    ins.dataset.adFormat      = this.format
    if (this.fwResponsive) ins.dataset.fullWidthResponsive = 'true'

    let html = ''
    if (this.label) {
      html += `<div style="font-size:10px;color:#475569;text-align:center;margin-bottom:4px;font-family:sans-serif;letter-spacing:0.5px">ADVERTISEMENT</div>`
    }
    container.innerHTML = html
    container.appendChild(ins)

    // Push to adsbygoogle queue (deferred to allow DOM settle)
    requestAnimationFrame(() => adManager.pushDisplayBanner())

    policyLog('info', `AdBanner rendered in #${this.containerId} (slot: ${this.slot}).`)
  }

  _testPlaceholder() {
    const w = this.width  || '100%'
    const h = this.height || '90px'
    return `
      <div style="
        width:${w}; height:${h}; background:rgba(124,58,237,0.08);
        border:2px dashed rgba(124,58,237,0.25); border-radius:8px;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:4px; font-family:sans-serif;
      ">
        <div style="font-size:9px;color:#475569;letter-spacing:1px">ADVERTISEMENT</div>
        <div style="font-size:12px;color:#a78bfa;font-weight:700">📢 Ad Placeholder</div>
        <div style="font-size:10px;color:#475569">Slot: ${this.slot || 'N/A'} (Test Mode)</div>
      </div>
    `
  }

  /** destroy — removes the ad element from the container */
  destroy() {
    const el = document.getElementById(this.containerId)
    if (el) el.innerHTML = ''
    this._rendered = false
  }
}

export default AdBanner
