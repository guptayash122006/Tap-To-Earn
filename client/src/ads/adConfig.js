/**
 * adConfig.js — Central configuration for all ad networks.
 *
 * HOW TO USE:
 *   1. Copy your Publisher IDs from your ad network dashboards.
 *   2. Replace every placeholder (ca-pub-XXXX, etc.) with your real IDs.
 *   3. Set AD_TEST_MODE = false before going live.
 *
 * POLICY NOTE (Google):
 *   H5 Games Ads rewarded placements may only grant VIRTUAL in-game benefits
 *   (e.g., energy refills). NEVER grant withdrawable coins for ad views.
 *   Source: https://developers.google.com/ad-placement/docs/rewarded
 */

export const AD_CONFIG = {
  // ── Global ───────────────────────────────────────────────────
  /**
   * Set to true during development — loads test/placeholder ads only.
   * MUST be false in production.
   */
  TEST_MODE: true,

  /**
   * Debug logs in console when true.
   */
  DEBUG: false,

  // ── Google AdSense / H5 Games Ads ─────────────────────────────
  GOOGLE: {
    /** Your AdSense publisher ID from adsense.google.com → Account → Account information */
    PUBLISHER_ID: 'ca-pub-XXXXXXXXXXXXXXXX',

    /** Google H5 Games Ads script src (auto-generated with your pub ID) */
    get SCRIPT_SRC() {
      return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.PUBLISHER_ID}`
    },

    /**
     * Banner slot IDs — from AdSense → Ads → By ad unit.
     * Policy: must NOT be placed near the tap button or game controls.
     */
    SLOTS: {
      /** Leaderboard banner (728×90 or responsive) — appears below leaderboard card */
      LEADERBOARD_BANNER: 'XXXXXXXXXX',
      /** Rectangle (300×250) — appears below withdrawal history section */
      WITHDRAWAL_BANNER:  'XXXXXXXXXX',
      /** Sidebar rectangle (300×250) — desktop sidebar only */
      SIDEBAR_BANNER:     'XXXXXXXXXX',
    },

    /**
     * H5 Games Ad Placement names — must match names registered in AdSense.
     * adBreak() uses these string identifiers.
     */
    PLACEMENTS: {
      /** Shown when user's energy is depleted and they tap "Refill Energy" */
      REWARDED_ENERGY:    'energy_refill',
      /** Shown at natural session break (every 500 taps milestone) */
      INTERSTITIAL_BREAK: 'session_break',
      /** Shown between daily check-in and leaderboard sections */
      INTERSTITIAL_MILESTONE: 'milestone_break',
    },
  },

  // ── PropellerAds ──────────────────────────────────────────────
  PROPELLER: {
    /**
     * Your PropellerAds Zone ID for Native/Push ads.
     * From PropellerAds dashboard → Sites → Your site → Zones.
     * Policy: no incentivized clicks; standard display only.
     */
    ZONE_ID: 'XXXXXXX',
    SCRIPT_SRC: 'https://a.magsrv.com/ad-provider.js',
    ENABLED: false,   // set true when you have a PropellerAds account approved
  },

  // ── AdsTerra ─────────────────────────────────────────────────
  ADSTERRA: {
    /**
     * AdsTerra Publisher Key from your AdsTerra account.
     * Policy: no "earn by clicking" framing; standard banners only.
     */
    KEY: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    BANNER_SCRIPT: 'https://www.effectiveratecpm.com/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/invoke.js',
    ENABLED: false,   // set true when approved
  },

  // ── Reward Rules (POLICY-CRITICAL) ───────────────────────────
  REWARDS: {
    /**
     * What a user receives after completing a rewarded ad.
     * POLICY: Must be purely virtual in-game benefit.
     *         NEVER add to Coin.availableBalance (withdrawable).
     *         ONLY refill energy (non-transferable, non-withdrawable).
     */
    TYPE:           'energy',   // 'energy' only — never 'coins'
    ENERGY_AMOUNT:  25,         // energy points restored per rewarded ad
    MAX_PER_HOUR:   5,          // maximum rewarded ads per user per hour (server-enforced)
    MIN_WATCH_SEC:  15,         // minimum seconds a user must watch to qualify
    COOLDOWN_SEC:   60,         // seconds between rewarded ad requests
  },
}

export default AD_CONFIG
