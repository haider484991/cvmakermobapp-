# Setting up FreeResume Pro in Play Console

This is the one-time manual setup you need to do in Play Console before v1.8.0 can actually charge users. The app code already references these exact product IDs — just create them in the console.

## 1. Sign tax + payment forms (if not already done)

Play Console → Setup → Payments profile → fill in your bank/tax details. **Without this, you cannot create paid products.** Allow 1-2 business days for verification.

## 2. Create the two subscription products

Play Console → **Monetize → Subscriptions → Create subscription**

### Subscription #1 — Monthly

| Field | Value |
|---|---|
| Product ID | `freeresume_premium_monthly` (must match this exactly) |
| Name | `FreeResume Pro (Monthly)` |
| Description | `Unlock all premium templates, remove watermark, no ads, full AI Resume Score.` |
| Benefits (3-5 bullets) | • All 22 templates<br>• No watermark<br>• No ads<br>• Full AI score & coaching<br>• Priority support |

Then **Add a base plan**:
- Plan ID: `monthly`
- Billing period: `Monthly`
- Auto-renewing: ✅ Yes
- Price: `$2.99` (Google will localize automatically)

Then **Add an offer**:
- Offer ID: `monthly-trial`
- Type: `Free trial`
- Duration: `3 days`

Save → Activate (top-right).

### Subscription #2 — Annual

| Field | Value |
|---|---|
| Product ID | `freeresume_premium_annual` |
| Name | `FreeResume Pro (Annual)` |
| Description | Same as monthly |
| Benefits | Same as monthly |

Base plan:
- Plan ID: `annual`
- Billing period: `Yearly`
- Auto-renewing: ✅ Yes
- Price: `$19.99`

Offer:
- Offer ID: `annual-trial`
- Type: `Free trial`
- Duration: `7 days`

Save → Activate.

## 3. Create the lifetime in-app product

Play Console → **Monetize → In-app products → Create product**

| Field | Value |
|---|---|
| Product ID | `freeresume_premium_lifetime` |
| Name | `FreeResume Pro (Lifetime)` |
| Description | `Pay once, own forever. All premium features unlocked permanently.` |
| Default price | `$29.99` |

Save → Activate.

## 4. Add test accounts (for internal testing)

You can't test real billing in Expo Go — and you don't want to actually pay yourself for testing. Play Console has a license-test system:

1. Play Console → **Setup → License testing**
2. Add the Gmail account on your test phone
3. Set "License response" to `RESPOND_NORMALLY`

Now when that account installs v1.8.0 from the Internal Testing track, purchases:
- Show "Test Card, Always Approves" as a payment option
- Don't actually charge real money
- Otherwise behave identically to real purchases

## 5. Push v1.8.0 to Internal Testing first

Don't ship to Production until you've completed a full purchase + restore cycle on a test device. Use the existing `eas submit` pipeline but switch the profile temporarily:

```bash
# Edit eas.json — change submit.production.android.track to "internal"
npx eas-cli build --platform android --profile production --non-interactive
npx eas-cli submit --platform android --profile production --latest --non-interactive
```

Or just use the existing internal submit profile we already configured.

## 6. Test purchase flow checklist

On your test device (signed into the licensed Gmail), install the Internal Testing build and verify:

- [ ] Open Templates → tap a 🔒 premium template → paywall shows
- [ ] Tap Annual → purchase flow opens → "Test Card, Always Approves" listed
- [ ] Complete purchase → modal closes automatically → premium template now selectable
- [ ] Open Export → watermark notice is GONE
- [ ] Kill app + reopen → still premium (entitlement persisted)
- [ ] Settings → Tap **Restore Purchases** → "Purchases restored" alert
- [ ] Play Store → Subscriptions → cancel test subscription
- [ ] Kill + reopen app → still premium until billing period ends
- [ ] Wait until period ends → entitlement auto-downgrades

## 7. Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Paywall opens but no products show | Products not activated, or activated <1h ago | Wait ~1h after activating; verify "Active" status |
| "Item not found" error on purchase | Product ID typo OR product not active | Compare exactly to `src/services/purchases/productIds.ts` |
| Test card not offered | Gmail not added to License testers | Re-check Setup → License testing |
| Trial period not respected | Offer not saved correctly | Edit subscription → Offers → ensure `Free trial` type exists |
| "You can't make purchases" message | App not on a real track (Internal/Closed/Production) | Push to Internal track at minimum; can't test from local sideload |

## 8. After v1.8.0 ships to Production

Watch these in Play Console:
- **Monetize → Subscriptions → Performance** — daily active subs, conversion rate, refund rate
- **Monetize → Subscriptions → Revenue** — gross revenue, after Google's 15% (or 30% for users in their first year)

And in your Supabase analytics (`scripts/analytics-kpis.mjs`):
- `paywall_shown` → `purchase_initiated` → `purchase_completed` funnel
- Per-trigger conversion (template gate vs watermark gate vs profile)
- Refund signal: if `activeTier` clears unexpectedly for a device, they refunded

Healthy benchmarks for utility-app paywalls:
- Paywall view → purchase initiate: 8-15%
- Purchase initiate → completed (excluding trial cancellations): 50-70%
- Trial → paid conversion: 35-50%
- Overall paying user / install: 1-3%
