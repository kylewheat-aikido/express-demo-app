// Builds an in-memory Express app wired with the real route modules.
const express = require('express');
const cookieParser = require('cookie-parser');
const initSqlJs = require('sql.js');
const makeDb = require('../lib/db');

async function buildApp() {
  const SQL = await initSqlJs();
  const store = makeDb(new SQL.Database());
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  require('../routes/auth')(app, store);
  require('../routes/shop')(app, store);
  require('../routes/support')(app, store);
  require('../routes/admin')(app, store);
  require('../routes/pages')(app, store);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { app, store, server, base, close: () => new Promise((r) => server.close(r)) };
}

// fetch wrapper that keeps a cookie jar per client.
function client(base) {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, text, json, headers: res.headers };
  };
}

module.exports = { buildApp, client };
