// Route-level tests with an in-memory fake of the Prisma client (no database needed).
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// ---- fake @prisma/client ----
const users = new Map();
const resets = [];
let seq = 0;
const applyData = (target, data) => {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'increment' in v) target[k] = (target[k] || 0) + v.increment;
    else target[k] = v;
  }
  target.updatedAt = new Date();
};
class FakePrisma {
  constructor() {
    this.user = {
      findUnique: async ({ where }) => [...users.values()].find((u) => (where.id ? u.id === where.id : u.email === where.email)) || null,
      create: async ({ data }) => { const u = { id: `u${++seq}`, stateVersion: 0, tokenVersion: 0, createdAt: new Date(), ...data }; users.set(u.id, u); return { ...u }; },
      update: async ({ where, data }) => { const u = users.get(where.id); applyData(u, data); return { ...u }; },
      delete: async ({ where }) => { users.delete(where.id); for (let i = resets.length - 1; i >= 0; i -= 1) if (resets[i].userId === where.id) resets.splice(i, 1); },
    };
    this.passwordReset = {
      deleteMany: async ({ where }) => { for (let i = resets.length - 1; i >= 0; i -= 1) if (resets[i].userId === where.userId) resets.splice(i, 1); },
      create: async ({ data }) => { resets.push({ id: `r${++seq}`, attempts: 0, createdAt: new Date(), ...data }); },
      findFirst: async ({ where }) => resets.filter((r) => r.userId === where.userId).pop() || null,
      update: async ({ where, data }) => { const r = resets.find((x) => x.id === where.id); applyData(r, data); },
    };
    this.$queryRaw = async () => [{ '?column?': 1 }];
    this.$transaction = async (ops) => Promise.all(ops);
    this.$disconnect = async () => {};
  }
}
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@prisma/client') return { PrismaClient: FakePrisma };
  return origLoad.call(this, request, ...rest);
};

const { app } = require('../src/server');
let base;
let httpServer;
test.before(async () => {
  await new Promise((resolve) => { httpServer = app.listen(0, resolve); });
  base = `http://127.0.0.1:${httpServer.address().port}`;
});
test.after(() => httpServer.close());

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})), res };
};

let token;
test('health + legal pages', async () => {
  assert.equal((await call('GET', '/health')).status, 200);
  for (const path of ['/privacy', '/terms', '/delete-account']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Sugar Detox/);
  }
});

test('register rejects weak passwords and accepts strong ones', async () => {
  assert.equal((await call('POST', '/api/auth/register', { email: 'a@b.com', password: 'short', name: 'A' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { email: 'a@b.com', password: 'onlyletters', name: 'A' })).status, 400);
  const ok = await call('POST', '/api/auth/register', { email: 'A@B.com', password: 'sugar1234', name: 'Asha', goals: ['x'] });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.token);
  assert.equal(ok.body.state.email, 'a@b.com');
  assert.equal(ok.body.state.password, '');
  token = ok.body.token;
  assert.equal((await call('POST', '/api/auth/register', { email: 'a@b.com', password: 'sugar1234', name: 'Dup' })).status, 409);
});

test('login works, wrong password fails', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: 'a@b.com', password: 'wrongpass1' })).status, 401);
  const ok = await call('POST', '/api/auth/login', { email: 'A@b.com', password: 'sugar1234' });
  assert.equal(ok.status, 200);
  token = ok.body.token;
});

test('state requires auth and syncs with versioning + merge', async () => {
  assert.equal((await call('GET', '/api/me/state')).status, 401);
  const first = await call('GET', '/api/me/state', null, token);
  const v0 = first.body.state._version;
  // device A writes with the current version -> accepted as-is
  const a = await call('PUT', '/api/me/state', { state: { ...first.body.state, logs: [{ id: '1', food: 'cola', sugar: 39, date: '2026-09-30' }] }, baseVersion: v0 }, token);
  assert.equal(a.status, 200);
  assert.equal(a.body.merged, false);
  // device B still on the old version writes a different log -> merged, nothing lost
  const b = await call('PUT', '/api/me/state', { state: { ...first.body.state, logs: [{ id: '2', food: 'cookie', sugar: 12, date: '2026-09-30' }] }, baseVersion: v0 }, token);
  assert.equal(b.body.merged, true);
  assert.deepEqual(b.body.state.logs.map((l) => l.id).sort(), ['1', '2']);
  // missing baseVersion is never allowed to overwrite blindly
  const c = await call('PUT', '/api/me/state', { state: { ...first.body.state, logs: [] } }, token);
  assert.equal(c.body.merged, true);
  assert.equal(c.body.state.logs.length, 2);
});

test('reset data keeps the account but clears tracking', async () => {
  const res = await call('DELETE', '/api/me/state', null, token);
  assert.equal(res.status, 200);
  assert.equal(res.body.state.logs.length, 0);
  assert.equal(res.body.state.email, 'a@b.com');
});

test('forgot/reset password flow', async () => {
  const lib = require('../src/lib');
  const unknown = await call('POST', '/api/auth/forgot', { email: 'nobody@x.com' });
  assert.equal(unknown.status, 200); // no account enumeration
  assert.equal(resets.length, 0);
  assert.equal((await call('POST', '/api/auth/forgot', { email: 'a@b.com' })).status, 200);
  assert.equal(resets.length, 1);
  // wrong code
  assert.equal((await call('POST', '/api/auth/reset', { email: 'a@b.com', code: '000000', password: 'newpass123' })).status, 400);
  // forge a known code by replacing the stored hash
  resets[0].codeHash = lib.hashCode('123456', process.env.JWT_SECRET);
  assert.equal((await call('POST', '/api/auth/reset', { email: 'a@b.com', code: '123456', password: 'weak' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { email: 'a@b.com', code: '123456', password: 'newpass123' })).status, 200);
  // code is single-use
  assert.equal((await call('POST', '/api/auth/reset', { email: 'a@b.com', code: '123456', password: 'another123' })).status, 400);
  // old sessions are invalidated, new password works
  assert.equal((await call('GET', '/api/me/state', null, token)).status, 401);
  const login = await call('POST', '/api/auth/login', { email: 'a@b.com', password: 'newpass123' });
  assert.equal(login.status, 200);
  token = login.body.token;
});

test('reset code locks after too many wrong attempts', async () => {
  const lib = require('../src/lib');
  await call('POST', '/api/auth/forgot', { email: 'a@b.com' });
  resets[0].codeHash = lib.hashCode('654321', process.env.JWT_SECRET);
  for (let i = 0; i < 5; i += 1) await call('POST', '/api/auth/reset', { email: 'a@b.com', code: '111111', password: 'newpass123' });
  assert.equal((await call('POST', '/api/auth/reset', { email: 'a@b.com', code: '654321', password: 'newpass123' })).status, 400);
});

test('account deletion requires the right password and removes the user', async () => {
  assert.equal((await call('DELETE', '/api/me', { password: 'wrongwrong1' }, token)).status, 403);
  assert.equal((await call('DELETE', '/api/me', {}, token)).status, 400);
  assert.equal((await call('DELETE', '/api/me', { password: 'newpass123' }, token)).status, 200);
  assert.equal(users.size, 0);
  assert.equal((await call('POST', '/api/auth/login', { email: 'a@b.com', password: 'newpass123' })).status, 401);
});
