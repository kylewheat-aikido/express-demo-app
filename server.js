// INTENTIONALLY VULNERABLE demo app for DAST testing. Never deploy with real data.
// Two halves share one process: the Acme storefront (routes/*, written carefully) and
// the "Security Lab" endpoints below (deliberately vulnerable, marked VULN).
const express = require('express');
const cookieParser = require('cookie-parser');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const makeDb = require('./lib/db');
const { layout } = require('./lib/html');

const app = express();
const PORT = process.env.PORT || 8080;

app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// VULN: wide-open CORS, no security headers (CSP, X-Frame-Options, etc.)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.set('Access-Control-Allow-Origin', origin); // VULN: reflects any origin
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('X-Powered-By', 'Express');
  next();
});

let db;
async function setupDb() {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT);
          CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
          INSERT INTO users VALUES (1,'admin','s3cr3t-admin-pw','admin'),(2,'alice','alicepw','user'),(3,'bob','bobpw','user');
          INSERT INTO products VALUES (1,'Widget',9.99),(2,'Gadget',19.99),(3,'Gizmo',29.99);`);
}
const rows = (sql) => {
  const r = db.exec(sql);
  if (!r.length) return [];
  const { columns, values } = r[0];
  return values.map((v) => Object.fromEntries(v.map((x, i) => [columns[i], x])));
};

// Security Lab page helper (renders inside the shared layout).
const lab = (req, res, title, body, status = 200) =>
  res.status(status).send(layout(title, body, req.user, { path: req.path }));

const LAB = [
  ['Reflected XSS', 'GET /search?q=', '/search?q=widget', 'Try <code>&lt;script&gt;alert(1)&lt;/script&gt;</code>', 'danger'],
  ['SQL injection', 'GET /api/products?name=', '/api/products?name=Widget', 'Try <code>\' OR \'1\'=\'1</code> or a lone <code>\'</code>', 'danger'],
  ['SQLi auth bypass, weak cookie', 'POST /login', '/login', 'User <code>admin\' --</code>; cookie is base64 and not HttpOnly', 'danger'],
  ['Path traversal', 'GET /download?file=', '/download?file=readme.txt', 'Try <code>../server.js</code>', 'danger'],
  ['Path traversal (URL path)', 'GET /files/:name', '/files/readme.txt', 'Try <code>..%2fserver.js</code>', 'danger'],
  ['Open redirect', 'GET /redirect?url=', '/redirect?url=/', 'Try <code>https://example.com</code>', 'warn'],
  ['IDOR, leaks passwords, SQLi', 'GET /api/users/:id', '/api/users/1', 'No auth; also injectable', 'danger'],
  ['Stack trace disclosure', 'GET /error', '/error', 'Verbose 500 page', 'warn'],
  ['Authenticated SQLi / IDOR / traversal', '/api/private/*', '/openapi.json', 'Basic auth <code>demo</code> / <code>demo-password</code>; see the OpenAPI spec', 'danger'],
  ['Webhook echo', 'ANY /webhook', '/webhook', 'Logs and echoes whatever you send', 'warn'],
  ['Headers and cookies', 'all routes', '/api/health', 'No CSP/HSTS/X-Frame-Options, reflected CORS origin, X-Powered-By', 'warn'],
  ['Clean control', 'GET /api/health', '/api/health', 'Should produce no findings', 'ok'],
];

async function start() {
  await setupDb();
  const store = makeDb(db);

  // Storefront (sessions, shop, support, admin, pages). Registers the req.user middleware first.
  require('./routes/auth')(app, store);
  require('./routes/shop')(app, store);
  require('./routes/support')(app, store);
  require('./routes/admin')(app, store);
  require('./routes/pages')(app, store);

  // ---- Security Lab ----
  app.get('/lab', (req, res) => lab(req, res, 'Security Lab', `<h1>Security Lab</h1>
    <div class="lab-banner"><b>Intentionally vulnerable.</b> These endpoints exist for DAST and pentest practice. Never deploy with real data or secrets.</div>
    <div class="table-wrap"><table><tr><th>Issue</th><th>Endpoint</th><th>Notes</th><th></th></tr>
    ${LAB.map(([name, ep, href, note, kind]) => `<tr><td><span class="badge ${kind}">${name}</span></td><td><code>${ep}</code></td><td>${note}</td><td><a href="${href}">Open</a></td></tr>`).join('')}
    </table></div>
    <h2>Quick search (reflected XSS)</h2>
    <form class="card" action="/search" method="GET"><div class="row"><input name="q" placeholder="Search the catalog" style="flex:1"><button>Search</button></div></form>`));

  // Safe endpoint
  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // VULN: Reflected XSS - unescaped input in HTML
  app.get('/search', (req, res) => lab(req, res, 'Search',
    `<h1>Search</h1><form action="/search" method="GET" class="row" style="margin-bottom:16px"><input name="q" placeholder="Search" style="flex:1"><button>Search</button></form>
     <div class="card"><h2 style="margin-top:0">Results for: ${req.query.q || ''}</h2><p class="muted">No results found.</p></div>`));

  // VULN: SQL injection (string concatenation), error messages returned
  app.get('/api/products', (req, res) => {
    const name = req.query.name || '';
    try {
      res.json(rows(`SELECT id, name, price FROM products WHERE name LIKE '%${name}%'`));
    } catch (e) {
      res.status(500).json({ error: e.message, query: `name=${name}` });
    }
  });

  // VULN: SQLi auth bypass + insecure cookie (no HttpOnly/Secure/SameSite)
  app.get('/login', (req, res) => lab(req, res, 'Lab login', `<div class="narrow"><h1>Lab login</h1>
    <form class="card" method="POST" action="/login"><label for="u">Username</label><input id="u" name="username" placeholder="admin">
    <label for="p">Password</label><input id="p" name="password" type="password">
    <div class="form-actions"><button>Login</button></div></form>
    <p class="muted small">This form is injectable by design. For the real storefront use <a href="/signin">Sign in</a>.</p></div>`));
  app.post('/login', (req, res) => {
    const { username = '', password = '' } = req.body;
    try {
      const u = rows(`SELECT * FROM users WHERE username='${username}' AND password='${password}'`)[0];
      if (!u) return lab(req, res, 'Lab login', '<div class="narrow"><h1>Invalid credentials</h1><p><a href="/login">Try again</a></p></div>', 401);
      res.cookie('session', Buffer.from(`${u.id}:${u.role}`).toString('base64'));
      lab(req, res, 'Welcome', `<div class="narrow"><div class="card"><h1>Welcome ${u.username}!</h1><p class="muted">Role: ${u.role}</p></div></div>`); // VULN: also XSS-able via stored username
    } catch (e) {
      res.status(500).send(e.stack);
    }
  });

  // VULN: Path traversal
  app.get('/download', (req, res) => {
    const file = req.query.file || 'readme.txt';
    const p = path.join(__dirname, 'files', file);
    fs.readFile(p, 'utf8', (err, data) => {
      if (err) return res.status(404).send(`Cannot read ${p}`);
      res.type('text/plain').send(data);
    });
  });

  // VULN: Open redirect
  app.get('/redirect', (req, res) => res.redirect(req.query.url || '/'));

  // VULN: IDOR / missing auth, exposes password field
  app.get('/api/users/:id', (req, res) => {
    const id = req.params.id;
    try {
      const u = rows(`SELECT * FROM users WHERE id=${id}`)[0];
      u ? res.json(u) : res.status(404).json({ error: 'not found' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Webhook test endpoint: logs whatever it receives
  app.all('/webhook', (req, res) => {
    console.log(`[webhook] ${req.method} ${req.originalUrl}`);
    console.log('[webhook] headers:', JSON.stringify(req.headers, null, 2));
    console.log('[webhook] body:', JSON.stringify(req.body, null, 2));
    res.status(200).json(req.body);
  });

  // VULN: Verbose error / stack trace disclosure
  app.get('/error', (req, res, next) => next(new Error('Simulated failure in /error handler')));

  require('./private-api')(app, db, rows);

  // Not-found (after every route) and the error handler.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
    lab(req, res, 'Not found', '<div class="narrow card"><h1>Page not found</h1><p class="muted">That page does not exist.</p><a class="btn" href="/">Go home</a></div>', 404);
  });
  // VULN: stack trace disclosure
  app.use((err, req, res, next) => lab(req, res, 'Server error', `<h1>Server error</h1><pre>${err.stack}</pre>`, 500));

  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
}

start();
