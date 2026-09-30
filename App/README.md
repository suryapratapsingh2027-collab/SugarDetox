# Sugar Detox — Source Package

Expo SDK 57 / React Native 0.86 client + Node/Express/PostgreSQL (Prisma) API.

## What's in the box
- **Mobile app** (iOS + Android): splash/intro, 6 goals, register/login/forgot-password, sugar log with **real barcode lookup (Open Food Facts)**, quantity + sugar estimate, calendar, daily/weekly/monthly progress, mandatory daily check-in, local reminders, craving help, Sugar Swap + recipes, 3/7/30-day challenges, streaks, points + reward requests.
- **Store-compliance features**: in-app **account deletion**, reset-my-data, Privacy Policy + Terms + health disclaimer (hosted by the API at `/privacy`, `/terms`, `/delete-account`), consent checkbox on sign-up, secure token storage (Keychain/Keystore), camera permission text, no audio permission.
- **API**: JWT auth (30 days, revocable), bcrypt, password reset by emailed 6-digit code, rate limiting, Helmet, zod validation, DB health check, multi-device sync with conflict merge, request logging.
- **Tests**: `cd backend && npm test` (14 tests: auth, reset flow, account deletion, sync merge).
- **Deploy config**: `render.yaml` (Render blueprint), `Dockerfile`, `docker-compose.yml`, `eas.json`.

## 1. Backend
```bash
cd backend
cp .env.example .env        # set JWT_SECRET, DATABASE_URL, SUPPORT_EMAIL, COMPANY_NAME, RESEND_API_KEY
npm install
npx prisma generate
npx prisma migrate deploy
npm test                    # optional
npm start                   # http://localhost:4000/health
```
Local stack with Postgres: `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build`.

### Deploy on Render
1. Push this repo to GitHub. In Render: **New → Blueprint** → select the repo (uses `render.yaml`; creates the API + Postgres).
2. Fill the prompted env vars: `RESEND_API_KEY`, `MAIL_FROM`, `COMPANY_NAME`, `SUPPORT_EMAIL`. (`JWT_SECRET` and `DATABASE_URL` are set automatically.)
3. Use **paid** plans for production (free web services sleep; free Postgres expires).
4. Open `https://YOUR-API.onrender.com/health` → should return `{"ok":true,"db":"up"}`. Open `/privacy` to see your public policy URL.
5. Password-reset emails: create a free account at resend.com, verify your sending domain, put the API key in `RESEND_API_KEY`.

## 2. Mobile app
```bash
npm install
npx expo install --check    # make sure versions match SDK 57
npx expo-doctor
```
Local testing on a phone: create `.env` with `EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:4000` then `npx expo start -c`.

> **Expo Go limits:** reminders (notifications) do not work in Expo Go (SDK 53+). Test them with a development build: `eas build --profile development --platform android`.

### Release builds
1. Edit `eas.json` → put your real `https://` API URL under `build.production.env` (production builds **fail on purpose** if it's missing or not https).
2. Replace placeholder assets in `assets/` with the client's branding (icon 1024×1024 no transparency, adaptive-icon foreground, splash-icon, notification-icon 96×96 white on transparent).
3. Change `com.sugardetox.app` (in `app.json`, iOS + Android) to the client's own reverse-domain ID **before the first store upload** (it can't be changed later).
4. `npm i -g eas-cli && eas login && eas init` (writes the EAS project ID) then:
```bash
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```
See `STORE_SUBMISSION.md` for the account/listing/testing checklist.

## Known limits (be upfront with the client)
- Legal pages are **templates**; have a lawyer review them (health-related app).
- Rewards are redemption *requests* stored in the account; no real gift fulfilment exists.
- App text is English only.
- Barcode data quality depends on the community Open Food Facts database; unknown products fall back to manual entry.
- No email verification at sign-up (password reset is verified by emailed code).
- No crash reporting service is wired in (add Sentry/Crashlytics if wanted).
