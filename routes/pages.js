// Server-rendered HTML pages for the Acme storefront.
const { escapeHtml: e, layout } = require('../lib/html');

module.exports = function registerPages(app, store) {
  const send = (req, res, title, body, status = 200) =>
    res.status(status).send(layout(title, body, req.user, { path: req.path }));
  const needLogin = (handler) => (req, res) => (req.user ? handler(req, res) : res.redirect('/signin'));
  const stockBadge = (n) => (n === 0 ? '<span class="badge danger">Out of stock</span>'
    : n < 20 ? `<span class="badge warn">Only ${n} left</span>` : '<span class="badge ok">In stock</span>');

  const homeBody = `<section class="hero"><h1>Tools and safety gear for the job site</h1>
    <p>Acme Supply Co. ships hammers, drills, hard hats and everything in between.</p>
    <div class="row"><a class="btn accent" href="/products">Browse products</a><a class="btn secondary" style="color:#fff;border-color:rgba(255,255,255,.5)" href="/support">Contact support</a></div></section>
    <div class="grid">
      <div class="card"><h3>Shop</h3><p class="muted">Six categories of everyday site essentials.</p><span class="spacer"></span><a href="/products">View catalog &rarr;</a></div>
      <div class="card"><h3>Your orders</h3><p class="muted">Track what you have ordered and its status.</p><span class="spacer"></span><a href="/orders">View orders &rarr;</a></div>
      <div class="card"><h3>Security Lab</h3><p class="muted">Intentionally vulnerable endpoints for DAST and pentest practice.</p><span class="spacer"></span><a href="/lab">Open the lab &rarr;</a></div>
    </div>`;
  app.get('/home', (req, res) => send(req, res, 'Home', homeBody));
  app.get('/', (req, res) => send(req, res, 'Home', homeBody));

  app.get('/products', (req, res) => {
    const cat = typeof req.query.category === 'string' ? req.query.category : '';
    const cats = store.all('SELECT DISTINCT category FROM shop_products ORDER BY category').map((r) => r.category);
    const rows = cat
      ? store.all('SELECT id, name, category, price, stock FROM shop_products WHERE category = ? ORDER BY name', [cat])
      : store.all('SELECT id, name, category, price, stock FROM shop_products ORDER BY name');
    const chips = [['', 'All'], ...cats.map((c) => [c, c[0].toUpperCase() + c.slice(1)])]
      .map(([c, label]) => `<a class="chip" href="${c ? `/products?category=${encodeURIComponent(c)}` : '/products'}"${c === cat ? ' aria-current="true"' : ''}>${e(label)}</a>`).join('');
    const body = `<h1>Products</h1><div class="chips">${chips}</div>` + (rows.length
      ? `<div class="table-wrap"><table><tr><th>Name</th><th>Category</th><th>Price</th><th>Availability</th></tr>
      ${rows.map((p) => `<tr><td><a href="/products/${p.id}">${e(p.name)}</a></td><td>${e(p.category)}</td><td>$${p.price.toFixed(2)}</td><td>${stockBadge(p.stock)}</td></tr>`).join('')}</table></div>`
      : '<div class="card empty">No products in this category.</div>');
    send(req, res, 'Products', body);
  });

  app.get('/products/:id', (req, res) => {
    const p = store.get('SELECT * FROM shop_products WHERE id = ?', [Number(req.params.id)]);
    if (!p) return send(req, res, 'Not found', '<h1>Product not found</h1><p><a href="/products">&larr; Back to products</a></p>', 404);
    send(req, res, p.name, `<p><a href="/products">&larr; All products</a></p>
      <div class="card"><h1>${e(p.name)}</h1><p>${e(p.description)}</p>
      <p><span class="price">$${p.price.toFixed(2)}</span> &nbsp; ${stockBadge(p.stock)} &nbsp; <span class="muted small">SKU ${e(p.sku)}</span></p>
      <div class="row"><label for="qty" style="margin:0">Qty</label><input id="qty" type="number" value="1" min="1" max="50">
      <button id="buy"${p.stock === 0 ? ' disabled' : ''}>Place order</button></div>
      <div id="msg" class="alert" role="status"></div></div>
      <script>
      document.getElementById('buy').addEventListener('click', (ev) => withButton(ev.target, document.getElementById('msg'), async () => {
        const o = await api('POST', '/api/shop/orders', { productId: ${p.id}, quantity: Number(document.getElementById('qty').value) });
        notify(document.getElementById('msg'), 'Order #' + o.id + ' placed, total ' + money(o.total) + '. ', 'success');
        const a = document.createElement('a'); a.href = '/orders'; a.textContent = 'View your orders'; document.getElementById('msg').append(a);
      }));
      </script>`);
  });

  app.get('/signin', (req, res) => send(req, res, 'Sign in', `<div class="narrow"><h1>Sign in</h1>
    <form class="card" id="loginForm"><label for="email">Email</label><input id="email" type="email" autocomplete="username" required>
    <label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required>
    <div class="form-actions"><button>Sign in</button></div><div id="msg" class="alert" role="alert"></div></form>
    <p class="muted small">Demo accounts: <code>casey@acme.test</code> / <code>casey-demo-pw</code> &middot; admin: <code>admin@acme.test</code> / <code>admin-demo-pw</code></p>
    <h2>New here?</h2>
    <form class="card" id="registerForm"><label for="rname">Name</label><input id="rname" autocomplete="name" required>
    <label for="remail">Email</label><input id="remail" type="email" autocomplete="email" required>
    <label for="rpassword">Password (8+ characters)</label><input id="rpassword" type="password" autocomplete="new-password" minlength="8" required>
    <div class="form-actions"><button class="secondary">Create account</button></div><div id="rmsg" class="alert" role="alert"></div></form></div>
    <script>
    const handle = (formId, msgId, call) => document.getElementById(formId).addEventListener('submit', (ev) => {
      ev.preventDefault();
      withButton(ev.target.querySelector('button'), document.getElementById(msgId), async () => { await call(); location.href = '/account'; });
    });
    handle('loginForm', 'msg', () => api('POST', '/api/auth/login', { email: email.value, password: password.value }));
    handle('registerForm', 'rmsg', () => api('POST', '/api/auth/register', { name: rname.value, email: remail.value, password: rpassword.value }));
    </script>`));

  app.get('/account', needLogin((req, res) => send(req, res, 'Account', `<h1>Your account</h1>
    <div class="card"><p><b>Name:</b> ${e(req.user.name)}</p><p><b>Email:</b> ${e(req.user.email)}</p>
    <p><b>Role:</b> <span class="badge">${e(req.user.role)}</span></p></div>
    <p><a class="btn" href="/orders">My orders</a> <a class="btn secondary" href="/support">Support</a></p>`)));

  app.get('/orders', needLogin((req, res) => send(req, res, 'Orders', `<h1>Your orders</h1>
    <div id="state" class="card empty">Loading&hellip;</div>
    <div class="table-wrap" id="wrap" hidden><table id="orders"><tr><th>#</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th></tr></table></div>
    <script>
    api('GET', '/api/shop/orders').then((rows) => {
      const state = document.getElementById('state');
      if (!rows.length) { state.innerHTML = 'No orders yet. <a href="/products">Browse products</a>.'; return; }
      state.hidden = true; document.getElementById('wrap').hidden = false;
      const t = document.getElementById('orders');
      rows.forEach((o) => {
        const tr = t.insertRow();
        [o.id, o.product, o.quantity, money(o.total), o.status].forEach((v) => (tr.insertCell().textContent = v));
      });
    }).catch((err) => { document.getElementById('state').textContent = err.message; });
    </script>`)));

  app.get('/support', needLogin((req, res) => send(req, res, 'Support', `<h1>Support</h1>
    <form class="card" id="ticketForm"><label for="subject">Subject</label><input id="subject" maxlength="120" required>
    <label for="body">How can we help?</label><textarea id="body" rows="4" required></textarea>
    <div class="form-actions"><button>Open ticket</button></div><div id="msg" class="alert" role="alert"></div></form>
    <h2>Your tickets</h2><div id="list"></div>
    <script>
    async function load() {
      const list = document.getElementById('list'); list.textContent = '';
      const tickets = await api('GET', '/api/support/tickets');
      if (!tickets.length) { list.innerHTML = '<div class="card empty">No tickets yet.</div>'; return; }
      tickets.forEach((t) => {
        const d = document.createElement('div'); d.className = 'card';
        const h = document.createElement('h3'); h.textContent = '#' + t.id + ' ' + t.subject + ' ';
        const s = document.createElement('span'); s.className = 'badge ' + (t.status === 'open' ? 'warn' : 'ok'); s.textContent = t.status; h.append(s);
        const p = document.createElement('p'); p.textContent = t.body;
        d.append(h, p); list.append(d);
      });
    }
    document.getElementById('ticketForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      withButton(ev.target.querySelector('button'), document.getElementById('msg'), async () => {
        await api('POST', '/api/support/tickets', { subject: subject.value, body: body.value });
        subject.value = ''; body.value = ''; notify(document.getElementById('msg'), 'Ticket opened.', 'success'); await load();
      });
    });
    load();
    </script>`)));

  app.get('/admin', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return send(req, res, 'Forbidden', '<h1>Admins only</h1><p>You need an administrator account to view this page.</p>', 403);
    send(req, res, 'Admin', `<h1>Admin dashboard</h1>
      <div class="stats" id="stats"></div>
      <h2>Accounts</h2><div class="table-wrap"><table id="accounts"><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></table></div>
      <h2>Support tickets</h2><div class="table-wrap"><table id="tickets"><tr><th>#</th><th>Subject</th><th>Status</th><th></th></tr></table></div>
      <script>
      const fill = (table, rows, cells) => rows.forEach((r) => { const tr = table.insertRow(); cells(r).forEach((v) => (tr.insertCell().append(v))); });
      function stat(label, value) { const d = document.createElement('div'); d.className = 'stat'; const b = document.createElement('b'); b.textContent = value; const s = document.createElement('span'); s.textContent = label; d.append(b, s); return d; }
      api('GET', '/api/admin/stats').then((s) => document.getElementById('stats').append(
        stat('Accounts', s.accounts), stat('Orders', s.orders), stat('Open tickets', s.openTickets), stat('Revenue', money(s.revenue))));
      api('GET', '/api/admin/accounts').then((a) => fill(document.getElementById('accounts'), a, (r) => [r.id, r.name, r.email, r.role]));
      function loadTickets() {
        const t = document.getElementById('tickets'); while (t.rows.length > 1) t.deleteRow(1);
        api('GET', '/api/admin/tickets').then((rows) => fill(t, rows, (r) => {
          const act = document.createElement('span');
          if (r.status === 'open') {
            const b = document.createElement('button'); b.className = 'secondary'; b.textContent = 'Close';
            b.addEventListener('click', async () => { await api('POST', '/api/admin/tickets/' + r.id + '/close'); loadTickets(); });
            act.append(b);
          }
          return [r.id, r.subject, r.status, act];
        }));
      }
      loadTickets();
      </script>`);
  });
};
