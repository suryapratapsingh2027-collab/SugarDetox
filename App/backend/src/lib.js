const crypto = require('crypto');

/** 6-digit numeric code using a CSPRNG. */
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/** Codes are short-lived and single-use; a keyed hash is enough (never store plain codes). */
function hashCode(code, secret) {
  return crypto.createHmac('sha256', secret).update(String(code)).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function byId(list) {
  const map = new Map();
  for (const item of Array.isArray(list) ? list : []) if (item && item.id != null) map.set(String(item.id), item);
  return map;
}

/**
 * Merge two app states when two devices edited the same account.
 * Sugar logs and rewards are append-only, so they are unioned by id.
 * Check-ins are merged per day (an entry that says sugar was consumed wins over "sugar-free").
 * Challenges keep the furthest progress. Everything else (points, reminders, goals, name)
 * comes from the client that is currently saving.
 */
function mergeStates(server = {}, client = {}) {
  const logs = byId(server.logs);
  for (const [id, item] of byId(client.logs)) logs.set(id, item);
  const rewards = byId(server.rewards);
  for (const [id, item] of byId(client.rewards)) rewards.set(id, item);

  const checkins = { ...(server.checkins || {}) };
  for (const [day, entry] of Object.entries(client.checkins || {})) {
    const existing = checkins[day];
    if (!existing) checkins[day] = entry;
    else if (existing.consumedSugar === false && entry.consumedSugar !== false) checkins[day] = entry;
    else if (entry.consumedSugar === false && existing.consumedSugar !== false) checkins[day] = existing;
    else checkins[day] = entry;
  }

  const challenges = { ...(server.challenges || {}) };
  for (const [id, entry] of Object.entries(client.challenges || {})) {
    const existing = challenges[id];
    if (!existing) { challenges[id] = entry; continue; }
    const winner = (entry.completed && !existing.completed) || (entry.progress || 0) >= (existing.progress || 0) ? entry : existing;
    challenges[id] = { ...existing, ...winner, completed: !!(existing.completed || entry.completed) };
  }

  return {
    ...server,
    ...client,
    logs: [...logs.values()],
    rewards: [...rewards.values()],
    checkins,
    challenges,
  };
}

const PASSWORD_MIN = 8;
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > 128) return 'Password is too long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}

module.exports = { generateCode, hashCode, safeEqual, mergeStates, passwordProblem, PASSWORD_MIN };
