# Delivery checklist

## Done in code
- [x] iOS/Android Expo app, all 6 goals, register/login, **forgot password**
- [x] Sugar log (yes/no), food list/manual entry, **barcode scan with live Open Food Facts lookup**, quantity + estimate
- [x] Calendar, daily/weekly/monthly progress, mandatory daily check-in, streaks (timezone-correct)
- [x] Reminders (morning / after-meal / evening) scheduled for enabled toggles, incl. after login on a new device
- [x] Craving help, Sugar Swap + recipes, 3/7/30-day challenges, points, reward requests
- [x] Account deletion (in-app + `/delete-account` page), reset tracking data
- [x] Privacy Policy, Terms, health disclaimer, sign-up consent
- [x] JWT in secure storage; bcrypt; password rules; reset codes hashed, single-use, attempt-limited; sessions revoked on reset
- [x] Offline-safe sync (never logs out when offline), multi-device merge, retry on foreground
- [x] API URL guard (production builds fail without https URL), ErrorBoundary, request timeouts
- [x] Render blueprint, hardened Dockerfile, health check with DB ping
- [x] Backend tests (14) + lint of the client (0 errors)

## Needs the client / you (see STORE_SUBMISSION.md)
- Apple + Google accounts, signing, store listings and forms
- Final branding assets, final bundle ID
- Deployed API URL, email provider key
- Legal review of the policy templates
- Real-device testing (not possible from this environment)
- Reward fulfilment decision; other languages; email verification; crash reporting (optional)
