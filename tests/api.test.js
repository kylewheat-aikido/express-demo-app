const test = require('node:test');
const assert = require('node:assert');
const { buildApp, client } = require('./helpers');

let ctx;
test.before(async () => { ctx = await buildApp(); });
test.after(async () => { await ctx.close(); });

const login = async (email, password) => {
  const c = client(ctx.base);
  const r = await c('POST', '/api/auth/login', { email, password });
  assert.strictEqual(r.status, 200);
  return c;
};

test('auth: register validation, duplicates, login, me, logout', async () => {
  const c = client(ctx.base);
  assert.strictEqual((await c('GET', '/api/auth/me')).status, 401);
  assert.strictEqual((await c('POST', '/api/auth/register', { email: 'a@b.c' })).status, 400);
  const ok = await c('POST', '/api/auth/register', { email: 'new@acme.test', name: 'New', password: 'longenough' });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual((await c('GET', '/api/auth/me')).json.email, 'new@acme.test');
  assert.strictEqual((await c('POST', '/api/auth/register', { email: 'new@acme.test', name: 'N', password: 'longenough' })).status, 409);
  await c('POST', '/api/auth/logout');
  assert.strictEqual((await c('GET', '/api/auth/me')).status, 401);
  assert.strictEqual((await client(ctx.base)('POST', '/api/auth/login', { email: 'new@acme.test', password: 'wrong-pass' })).status, 401);
  assert.strictEqual((await client(ctx.base)('POST', '/api/auth/login', { email: 'nobody@acme.test' })).status, 401);
});

test('shop: product listing, filtering and detail', async () => {
  const c = client(ctx.base);
  assert.strictEqual((await c('GET', '/api/shop/products')).json.length, 6);
  assert.strictEqual((await c('GET', '/api/shop/products?category=safety')).json.length, 2);
  assert.strictEqual((await c('GET', '/api/shop/products?q=hammer')).json[0].name, 'Claw Hammer');
  assert.strictEqual((await c('GET', '/api/shop/products/1')).json.sku, 'HM-100');
  assert.strictEqual((await c('GET', '/api/shop/products/999')).status, 404);
});

test('shop: ordering requires auth, validates input and decrements stock', async () => {
  assert.strictEqual((await client(ctx.base)('POST', '/api/shop/orders', { productId: 1, quantity: 1 })).status, 401);
  const c = await login('casey@acme.test', 'casey-demo-pw');
  assert.strictEqual((await c('POST', '/api/shop/orders', { productId: 1, quantity: 0 })).status, 400);
  assert.strictEqual((await c('POST', '/api/shop/orders', { productId: 999, quantity: 1 })).status, 404);
  assert.strictEqual((await c('POST', '/api/shop/orders', { productId: 6, quantity: 13 })).status, 409);
  const o = await c('POST', '/api/shop/orders', { productId: 5, quantity: 2 });
  assert.strictEqual(o.status, 201);
  assert.strictEqual(o.json.total, 13.5);
  assert.strictEqual((await c('GET', '/api/shop/products/5')).json.stock, 498);
  assert.ok((await c('GET', '/api/shop/orders')).json.some((x) => x.id === o.json.id));
  assert.strictEqual((await c('GET', `/api/shop/orders/${o.json.id}`)).status, 200);
  assert.strictEqual((await c('GET', '/api/shop/orders/9999')).status, 404);
});

test('support: tickets are created and listed per account', async () => {
  const c = await login('casey@acme.test', 'casey-demo-pw');
  assert.strictEqual((await c('POST', '/api/support/tickets', { subject: '' })).status, 400);
  assert.strictEqual((await c('POST', '/api/support/tickets', { subject: 'Help', body: 'Please' })).status, 201);
  assert.ok((await c('GET', '/api/support/tickets')).json.some((t) => t.subject === 'Help'));
  assert.strictEqual((await client(ctx.base)('GET', '/api/support/tickets')).status, 401);
});

test('admin: endpoints reject anonymous and non-admin users', async () => {
  assert.strictEqual((await client(ctx.base)('GET', '/api/admin/stats')).status, 401);
  const casey = await login('casey@acme.test', 'casey-demo-pw');
  assert.strictEqual((await casey('GET', '/api/admin/stats')).status, 403);
});

test('admin: stats, accounts, tickets and closing a ticket', async () => {
  const c = await login('admin@acme.test', 'admin-demo-pw');
  assert.ok((await c('GET', '/api/admin/stats')).json.accounts >= 2);
  assert.ok((await c('GET', '/api/admin/accounts')).json.length >= 2);
  const tickets = (await c('GET', '/api/admin/tickets')).json;
  assert.ok(tickets.length >= 1);
  assert.strictEqual((await c('POST', `/api/admin/tickets/${tickets[0].id}/close`)).json.ok, true);
  const after = (await c('GET', '/api/admin/tickets')).json.find((t) => t.id === tickets[0].id);
  assert.strictEqual(after.status, 'closed');
});

test('pages: public pages render, protected pages redirect to sign-in', async () => {
  const c = client(ctx.base);
  for (const p of ['/home', '/products', '/products/1', '/signin']) {
    assert.strictEqual((await c('GET', p)).status, 200, p);
  }
  assert.strictEqual((await c('GET', '/products/999')).status, 404);
  assert.strictEqual((await c('GET', '/account')).status, 302);
  const authed = await login('casey@acme.test', 'casey-demo-pw');
  const acct = await authed('GET', '/account');
  assert.strictEqual(acct.status, 200);
  assert.match(acct.text, /Casey Customer/);
});
