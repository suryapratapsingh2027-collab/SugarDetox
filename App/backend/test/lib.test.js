const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, hashCode, safeEqual, mergeStates, passwordProblem } = require('../src/lib');

test('generateCode returns 6 digits', () => {
  for (let i = 0; i < 200; i += 1) assert.match(generateCode(), /^\d{6}$/);
});

test('hashCode is deterministic and secret-dependent', () => {
  assert.equal(hashCode('123456', 's1'), hashCode('123456', 's1'));
  assert.notEqual(hashCode('123456', 's1'), hashCode('123456', 's2'));
  assert.ok(safeEqual(hashCode('1', 's'), hashCode('1', 's')));
  assert.ok(!safeEqual('a', 'ab'));
});

test('passwordProblem enforces length and letter+number', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletters'));
  assert.ok(passwordProblem('12345678'));
  assert.equal(passwordProblem('sugar1234'), null);
});

test('mergeStates unions logs by id and keeps offline entries from both devices', () => {
  const server = { logs: [{ id: '1', sugar: 5 }], points: 10, checkins: { '2026-09-01': { consumedSugar: false } } };
  const client = { logs: [{ id: '2', sugar: 7 }], points: 20, checkins: { '2026-09-02': { consumedSugar: true } } };
  const merged = mergeStates(server, client);
  assert.deepEqual(merged.logs.map((l) => l.id).sort(), ['1', '2']);
  assert.equal(merged.points, 20);
  assert.equal(Object.keys(merged.checkins).length, 2);
});

test('mergeStates: consumed sugar wins over sugar-free for the same day', () => {
  const merged = mergeStates(
    { checkins: { d: { consumedSugar: false } } },
    { checkins: { d: { consumedSugar: true } } },
  );
  assert.equal(merged.checkins.d.consumedSugar, true);
  const merged2 = mergeStates(
    { checkins: { d: { consumedSugar: true } } },
    { checkins: { d: { consumedSugar: false } } },
  );
  assert.equal(merged2.checkins.d.consumedSugar, true);
});

test('mergeStates keeps furthest challenge progress and completion', () => {
  const merged = mergeStates(
    { challenges: { a: { progress: 5, completed: false } } },
    { challenges: { a: { progress: 2, completed: false } } },
  );
  assert.equal(merged.challenges.a.progress, 5);
  const merged2 = mergeStates(
    { challenges: { a: { progress: 3, completed: true } } },
    { challenges: { a: { progress: 1, completed: false } } },
  );
  assert.equal(merged2.challenges.a.completed, true);
});
