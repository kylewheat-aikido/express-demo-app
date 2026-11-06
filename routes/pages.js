// Server-rendered HTML pages for the Acme storefront.
const { escapeHtml: e, layout } = require('../lib/html');

module.exports = function registerPages(app, store) {
  const page = (title, body) => (req, res) => res.send(layout(title, typeof body === 'function' ? body(req) : body, req.user));
  const needLogin = (handler) => (req, res) => (req.user ? handler(req, res) : res.redirect('/signin'));

  app.get('/home', page('Home', `<h1>Welcome to Acme Supply Co.</h1>
    <p>Tools, safety gear and supplies for the job site.</p>
    <p><a href="/products">Browse products</a> &middot; <a href="/support">Contact support</a></p>`));

  app.get('/products', (req, res) => {
    const rows = store.all('SELECT id, name, category, price, stock FROM shop_products ORDER BY name');
    const body = `<h1>Products</h1><table><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th></tr>
      ${rows.map((p) => `<tr><td><a href="/products/${p.id}">${e(p.name)}</a></td><td>${e(p.category)}</td><td>$${p.price.toFixed(2)}</td><td>${p.stock}</td></tr>`).join('')}</table>`;
    res.send(layout('Products', body, req.user));
  });

  app.get('/products/:id', (req, res) => {
    const p = store.get('SELECT * FROM shop_products WHERE id = ?', [Number(req.params.id)]);
    if (!p) return res.status(404).send(layout('Not found', '<h1>Product not found</h1>', req.user));
    res.send(layout(p.name, `<div class="card"><h1>${e(p.name)}</h1><p>${e(p.description)}</p>
      <p><b>$${p.price.toFixed(2)}</b> &middot; ${p.stock} in stock &middot; SKU ${e(p.sku)}</p>
      <label>Qty <input id="qty" type="number" value="1" min="1" max="50"></label>
      <button id="buy">Place order</button> <span id="msg"></span></div>
      <script>
      document.getElementById('buy').addEventListener('click', async () => {
        const msg = document.getElementById('msg');
        try {
          const o = await api('POST', '/api/shop/orders', { productId: ${p.id}, quantity: Number(document.getElementById('qty').value) });
          msg.textContent = 'Order #' + o.id + ' placed, total $' + o.total;
        } catch (err) { msg.textContent = err.message; }
      });
      </script>`, req.user));
  });

  app.get('/signin', page('Sign in', `<h1>Sign in</h1><div class="card">
    <input id="email" placeholder="email"><br><input id="password" type="password" placeholder="password"><br>
    <button id="login">Sign in</button> <span id="msg"></span></div>
    <p>No account? Use <code>POST /api/auth/register</code> or the form below.</p>
    <div class="card"><input id="rname" placeholder="name"><br><input id="remail" placeholder="email"><br>
    <input id="rpassword" type="password" placeholder="password (8+ chars)"><br><button id="register">Register</button></div>
    <script>
    const show = (t) => (document.getElementById('msg').textContent = t);
    document.getElementById('login').addEventListener('click', async () => {
      try { await api('POST', '/api/auth/login', { email: email.value, password: password.value }); location.href = '/account'; }
      catch (err) { show(err.message); }
    });
    document.getElementById('register').addEventListener('click', async () => {
      try { await api('POST', '/api/auth/register', { name: rname.value, email: remail.value, password: rpassword.value }); location.href = '/account'; }
      catch (err) { show(err.message); }
    });
    </script>`));

  app.get('/account', needLogin((req, res) => res.send(layout('Account', `<h1>Your account</h1>
    <div class="card"><p><b>Name:</b> ${e(req.user.name)}</p><p><b>Email:</b> ${e(req.user.email)}</p>
    <p><b>Role:</b> ${e(req.user.role)}</p></div>`, req.user))));

  app.get('/orders', needLogin((req, res) => res.send(layout('Orders', `<h1>Your orders</h1>
    <table id="orders"><tr><th>#</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th></tr></table>
    <script>
    api('GET', '/api/shop/orders').then((rows) => {
      const t = document.getElementById('orders');
      rows.forEach((o) => {
        const tr = t.insertRow();
        [o.id, o.product, o.quantity, '$' + o.total.toFixed(2), o.status].forEach((v) => (tr.insertCell().textContent = v));
      });
    });
    </script>`, req.user))));

  app.get('/support', needLogin((req, res) => res.send(layout('Support', `<h1>Support</h1>
    <div class="card"><input id="subject" placeholder="Subject" maxlength="120" style="width:100%"><br>
    <textarea id="body" placeholder="How can we help?" rows="4" style="width:100%"></textarea><br>
    <button id="send">Open ticket</button> <span id="msg"></span></div>
    <h2>Your tickets</h2><div id="list"></div>
    <script>
    async function load() {
      const list = document.getElementById('list'); list.textContent = '';
      (await api('GET', '/api/support/tickets')).forEach((t) => {
        const d = document.createElement('div'); d.className = 'card';
        const h = document.createElement('b'); h.textContent = '#' + t.id + ' ' + t.subject + ' [' + t.status + ']';
        const p = document.createElement('p'); p.textContent = t.body;
        d.append(h, p); list.append(d);
      });
    }
    document.getElementById('send').addEventListener('click', async () => {
      try { await api('POST', '/api/support/tickets', { subject: subject.value, body: body.value }); load(); }
      catch (err) { document.getElementById('msg').textContent = err.message; }
    });
    load();
    </script>`, req.user))));

  app.get('/admin', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.status(403).send(layout('Forbidden', '<h1>Admins only</h1>', req.user));
    res.send(layout('Admin', `<h1>Admin dashboard</h1><pre id="stats" class="card"></pre>
      <h2>Accounts</h2><pre id="accounts" class="card"></pre>
      <script>
      api('GET', '/api/admin/stats').then((s) => (stats.textContent = JSON.stringify(s, null, 2)));
      api('GET', '/api/admin/accounts').then((a) => (accounts.textContent = JSON.stringify(a, null, 2)));
      </script>`, req.user));
  });
};
