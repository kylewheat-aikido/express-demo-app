const test = require('node:test');
const assert = require('node:assert');
const initSqlJs = require('sql.js');
const makeDb = require('../lib/db');
const { escapeHtml, layout } = require('../lib/html');

test('escapeHtml escapes special characters and nullish values', () => {
  assert.strictEqual(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(42), '42');
});

test('layout shows sign-in for anonymous users and admin link for admins', () => {
  assert.match(layout('T', '<p>x</p>'), /Sign in/);
  assert.match(layout('T', '', { name: 'A', role: 'customer' }), /Log out/);
  assert.doesNotMatch(layout('T', '', { name: 'A', role: 'customer' }), /\/admin/);
  assert.match(layout('T', '', { name: 'A', role: 'admin' }), /\/admin/);
  assert.match(layout('<b>', ''), /&lt;b&gt; \| Acme/);
});

test('db helpers run, get and all with parameters', async () => {
  const SQL = await initSqlJs();
  const store = makeDb(new SQL.Database());
  store.run('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  assert.strictEqual(store.run('INSERT INTO t (v) VALUES (?)', ['a']).lastId, 1);
  assert.strictEqual(store.run('INSERT INTO t (v) VALUES (?)', ['b']).lastId, 2);
  assert.deepStrictEqual(store.get('SELECT v FROM t WHERE id = ?', [2]), { v: 'b' });
  assert.strictEqual(store.all('SELECT * FROM t').length, 2);
  assert.strictEqual(store.get('SELECT * FROM t WHERE id = ?', [99]), undefined);
});
