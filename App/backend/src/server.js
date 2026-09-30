require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { generateCode, hashCode, safeEqual, mergeStates, passwordProblem } = require('./lib');
const pages = require('./pages');

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 4000);
const IS_PROD = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
if (IS_PROD && (JWT_SECRET.length < 32 || /replace-with/i.test(JWT_SECRET))) {
  throw new Error('JWT_SECRET must be a random string of at least 32 characters in production');
}
const RESET_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

// Render/Heroku/etc. sit behind a proxy; needed for correct client IPs in rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
// Native mobile apps do not use CORS. Only allow browser origins that are explicitly listed.
const allowed = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.includes('*') ? true : allowed }));
app.use(express.json({ limit: '512kb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/health') console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

const limiter = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });
app.use('/api/auth', limiter(15 * 60 * 1000, 40));
app.use('/api/auth/forgot', limiter(60 * 60 * 1000, 5));
app.use('/api/auth/reset', limiter(60 * 60 * 1000, 15));

const emailField = z.string().trim().toLowerCase().email().max(254);
const registerSchema = z.object({
  email: emailField,
  password: z.string().max(128),
  name: z.string().trim().min(1).max(80).optional(),
  goals: z.array(z.string().max(150)).max(10).optional(),
});
const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(128) });
const forgotSchema = z.object({ email: emailField });
const resetSchema = z.object({ email: emailField, code: z.string().regex(/^\d{6}$/), password: z.string().max(128) });
const deleteSchema = z.object({ password: z.string().min(1).max(128) });
const stateSchema = z.object({ state: z.object({}).passthrough(), baseVersion: z.number().int().nonnegative().optional() });

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, tv: user.tokenVersion }, JWT_SECRET, { expiresIn: '30d' });
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    req.user = user;
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function publicState(user) {
  const state = user.appState && typeof user.appState === 'object' ? user.appState : {};
  return {
    ...state,
    onboarded: true,
    authed: true,
    name: user.name,
    email: user.email,
    password: '',
    goals: user.goals || state.goals || [],
    _version: user.stateVersion,
  };
}

async function sendResetEmail(to, code) {
  const subject = 'Your Sugar Detox password reset code';
  const text = `Your password reset code is ${code}. It expires in 15 minutes. If you did not request this, you can ignore this email.`;
  if (!process.env.RESEND_API_KEY) {
    // Development fallback so the flow can be tested without an email provider.
    if (!IS_PROD) console.log(`[dev] password reset code for ${to}: ${code}`);
    else console.error('RESEND_API_KEY is not set: password reset emails cannot be delivered.');
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Sugar Detox <onboarding@resend.dev>', to: [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Email provider error ${response.status}`);
}

app.get('/', (_req, res) => res.json({ ok: true, service: 'sugar-detox-api' }));
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'sugar-detox-api', db: 'up', time: new Date().toISOString() });
  } catch (_) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});
app.get('/privacy', (_req, res) => res.type('html').send(pages.privacy()));
app.get('/terms', (_req, res) => res.type('html').send(pages.terms()));
app.get('/delete-account', (_req, res) => res.type('html').send(pages.deleteAccount()));

app.post('/api/auth/register', async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);
    const problem = passwordProblem(input.password);
    if (problem) return res.status(400).json({ error: problem });
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    const passwordHash = await bcrypt.hash(input.password, 12);
    const initial = {
      reminders: { morning: true, meal: true, evening: true },
      logs: [], checkins: {}, challenges: {}, points: 0, rewards: [],
      goals: input.goals || [], onboarded: true, authed: true,
    };
    const user = await prisma.user.create({ data: { email: input.email, passwordHash, name: input.name || 'User', goals: input.goals || [], appState: initial } });
    return res.status(201).json({ token: signToken(user), state: publicState(user) });
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Please provide a valid name, email and password.' });
    console.error(error);
    return res.status(500).json({ error: 'Unable to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Incorrect email or password' });
    return res.json({ token: signToken(user), state: publicState(user) });
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Please provide a valid email and password.' });
    console.error(error);
    return res.status(500).json({ error: 'Unable to sign in' });
  }
});

// Always answers 200 so it cannot be used to discover which emails have accounts.
app.post('/api/auth/forgot', async (req, res) => {
  const generic = { ok: true, message: 'If an account exists for that email, a reset code has been sent.' };
  try {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const code = generateCode();
      await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      await prisma.passwordReset.create({ data: { userId: user.id, codeHash: hashCode(code, JWT_SECRET), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
      await sendResetEmail(user.email, code);
    }
    return res.json(generic);
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Please enter a valid email.' });
    console.error(error);
    return res.json(generic);
  }
});

app.post('/api/auth/reset', async (req, res) => {
  const invalid = { error: 'Invalid or expired code.' };
  try {
    const input = resetSchema.parse(req.body);
    const problem = passwordProblem(input.password);
    if (problem) return res.status(400).json({ error: problem });
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return res.status(400).json(invalid);
    const record = await prisma.passwordReset.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (!record || record.expiresAt < new Date() || record.attempts >= RESET_MAX_ATTEMPTS) return res.status(400).json(invalid);
    if (!safeEqual(record.codeHash, hashCode(input.code, JWT_SECRET))) {
      await prisma.passwordReset.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return res.status(400).json(invalid);
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } }),
      prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
    ]);
    return res.json({ ok: true });
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Enter the 6-digit code, your email and a new password.' });
    console.error(error);
    return res.status(500).json({ error: 'Unable to reset password' });
  }
});

app.get('/api/me', auth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, goals: req.user.goals } }));
app.get('/api/me/state', auth, (req, res) => res.json({ state: publicState(req.user) }));

app.put('/api/me/state', auth, async (req, res) => {
  try {
    const { state, baseVersion } = stateSchema.parse(req.body);
    const stored = req.user.appState && typeof req.user.appState === 'object' ? req.user.appState : {};
    const incoming = { ...state, password: '', authed: true, onboarded: true };
    delete incoming._version;
    // Client edited the latest version -> take it as is. Otherwise (unknown/stale version, e.g. after
    // working offline while another device wrote) merge instead of overwriting.
    const isCurrent = baseVersion !== undefined && baseVersion === req.user.stateVersion;
    const next = isCurrent ? incoming : mergeStates(stored, incoming);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: String(next.name || req.user.name).slice(0, 80),
        goals: Array.isArray(next.goals) ? next.goals.slice(0, 10) : req.user.goals,
        appState: next,
        stateVersion: { increment: 1 },
      },
    });
    return res.json({ state: publicState(user), merged: !isCurrent });
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Invalid app state' });
    console.error(error);
    return res.status(500).json({ error: 'Unable to sync app data' });
  }
});

// Clears tracking data but keeps the account (name, email, password).
app.delete('/api/me/state', auth, async (req, res) => {
  try {
    const fresh = { reminders: { morning: true, meal: true, evening: true }, logs: [], checkins: {}, challenges: {}, points: 0, rewards: [], goals: [], onboarded: true, authed: true };
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { goals: [], appState: fresh, stateVersion: { increment: 1 } } });
    res.json({ ok: true, state: publicState(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to reset data' });
  }
});

// Permanent account deletion (required by Apple App Store and Google Play).
app.delete('/api/me', auth, async (req, res) => {
  try {
    const { password } = deleteSchema.parse(req.body);
    if (!(await bcrypt.compare(password, req.user.passwordHash))) return res.status(403).json({ error: 'Incorrect password' });
    await prisma.user.delete({ where: { id: req.user.id } });
    return res.json({ ok: true });
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Password is required to delete your account.' });
    console.error(error);
    return res.status(500).json({ error: 'Unable to delete account' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

process.on('unhandledRejection', (reason) => console.error('unhandledRejection', reason));

if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`Sugar Detox API listening on :${PORT}`));
  const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { app, prisma };
