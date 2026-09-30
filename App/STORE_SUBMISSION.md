# Store submission checklist (things code cannot do for you)

## Accounts (client's name/company)
- [ ] Apple Developer Program (~US$99/year) — needed for TestFlight + App Store
- [ ] Google Play Console (~US$25 once) — new personal accounts may need a closed test with testers for some days before production; check current Play rules
- [ ] Expo account (free) for EAS Build
- [ ] Resend (or other) email account + verified sending domain
- [ ] Render account (paid web service + paid Postgres)

## Before the first build
- [ ] Choose final bundle/package ID and replace `com.sugardetox.app` in `app.json`
- [ ] Final logo/branding into `assets/` (the in-app wordmark currently says "sugarcut" but the app is named "Sugar Detox" — pick one)
- [ ] Set `COMPANY_NAME`, `SUPPORT_EMAIL` on the API; have the legal pages reviewed
- [ ] Put the production API URL in `eas.json`
- [ ] Decide reward fulfilment (or word the rewards clearly as "points only")

## Test on real devices (I could not run the app on a phone)
- [ ] Register → log out → log in; wrong password message
- [ ] Forgot password: code email arrives, new password works, old session ends
- [ ] Log sugar, check-in, challenge, redeem reward; kill and reopen app; data persists
- [ ] Airplane mode: app opens, can log entries, syncs after reconnect
- [ ] Two devices, same account: edits appear on both
- [ ] Barcode scan on a packaged food; camera permission deny/allow/"don't ask again"
- [ ] Reminders (development or production build only): they fire at 8:00 / 14:00 / 20:00 local time
- [ ] Delete account works and the same email can register again
- [ ] Late-night test (after midnight local time): "today" and streak are correct

## App Store Connect (iOS)
- [ ] Privacy Policy URL: `https://YOUR-API/privacy`
- [ ] App Privacy "nutrition label": data collected = Email, Name, Health & Fitness (sugar/habit logs), User ID; linked to user; **not** used for tracking
- [ ] Screenshots (6.9" and 6.5" iPhone at minimum), description, keywords, category (Health & Fitness), age rating
- [ ] Review notes: provide a demo account, mention account deletion is in Settings → Delete account
- [ ] Export compliance: already answered "No non-exempt encryption" in `app.json`

## Google Play Console (Android)
- [ ] Privacy Policy URL: `https://YOUR-API/privacy`
- [ ] Account deletion URL: `https://YOUR-API/delete-account`
- [ ] Data safety form (same data as above; encrypted in transit: yes; users can request deletion: yes)
- [ ] Health apps declaration (Play requires it) — answer honestly: wellness tracker, not a medical device
- [ ] Content rating questionnaire, target audience (13+), screenshots, feature graphic (1024×500), short/full description
- [ ] Upload the `.aab` from EAS (first upload can also be done via `eas submit` after creating the app in the console)
