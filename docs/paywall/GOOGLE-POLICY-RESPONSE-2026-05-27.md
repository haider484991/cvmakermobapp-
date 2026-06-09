# Response to Google Play Subscriptions Policy violation (2026-05-27)

**Violation cited:** Currency differences with prominent display price

**Reviewer screenshots show:** Paywall displaying `$2.99/mo`, `$19.99/yr`,
`$29.99 lifetime` in USD, while the Google Play checkout sheet (next step
in the flow) shows localized currency for the reviewer's country.

## Root cause (internal)

The paywall's `getOfferings()` call to `expo-iap`'s `fetchProducts()`
silently returns `[]` on every device we've tested, because
`initConnection()` to Google Play Billing never resolves (no
`init_success` or `init_failed` analytics event has fired across 3
devices and 3 app versions). When the fetch returns empty, our UI fell
back to a hardcoded USD `MOCK_OFFERINGS` array — which the reviewer saw.

We have already:
- Confirmed all 3 products (`freeresume_premium_monthly`, `_annual`,
  `_lifetime`) are ACTIVE worldwide in Play Console
- Confirmed the AAB carries the `com.android.vending.BILLING` permission
  via expo-iap's config plugin
- Verified the upload key SHA-1 and Play App Signing SHA-256 match
- Ruled out region, account, device, and propagation as causes

The remaining suspect is a silent hang in the native Play Billing
connection. v1.8.3 (already written, awaiting build) adds 8 new
diagnostic analytics events plus a 15s timeout to surface exactly where
the connection dies.

## Fix shipped in v1.8.3

Two code changes, both already committed in our working tree, awaiting
the next build window:

1. **`src/services/purchases/purchases.ts` — removed USD mock-price
   fallback in production.** The hardcoded `MOCK_OFFERINGS` array is now
   returned only in development builds (Expo Go preview). In a real
   production build, `getOfferings()` returns `[]` when Play Billing
   doesn't return real localized prices.

2. **`src/components/features/paywall/PaywallModal.tsx` — added
   "Pricing temporarily unavailable" empty state.** When `getOfferings()`
   returns `[]`, the paywall now shows a neutral message asking the user
   to check their connection — no currency symbols, no fake numbers, no
   purchase button enabled. The native Play checkout sheet is therefore
   never reached with mismatched currency, since the user can't proceed
   without real localized prices loaded.

## Build / submission timeline

Our EAS Build (Expo Application Services) Free plan monthly Android
build quota resets on 2026-06-01. v1.8.3 will be uploaded to the
production track via the standard `eas build … --auto-submit` flow on
that day, with the policy fix in effect for all new users immediately
after Google review approves.

We respectfully request a brief grace period (until 2026-06-04 to allow
for the Google review window) to ship v1.8.3 without escalation. We are
also evaluating an immediate EAS plan upgrade to ship earlier if needed.

## Going forward

To prevent this class of issue:
- Production builds will never display fallback prices in any currency
- An analytics alert is being added for `paywall_offerings_loaded`
  events with `count: 0` so we catch a fetch-product regression within
  hours, not days
- Pre-release smoke test will include opening the paywall on a real
  device and confirming localized prices match the Play checkout sheet
  before promoting any build to production

Thank you for the review and for flagging this clearly.
