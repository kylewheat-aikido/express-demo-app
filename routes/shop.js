// Product catalog + orders API.
module.exports = function registerShop(app, store) {
  store.run(`CREATE TABLE IF NOT EXISTS shop_products (
    id INTEGER PRIMARY KEY, sku TEXT, name TEXT, category TEXT, price REAL, stock INTEGER, description TEXT)`);
  store.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY, account_id INTEGER, product_id INTEGER, quantity INTEGER, total REAL, status TEXT, created_at TEXT)`);

  const seed = [
    ['HM-100', 'Claw Hammer', 'tools', 18.5, 120, 'Forged steel head with a fiberglass handle.'],
    ['DR-220', 'Cordless Drill', 'tools', 89.0, 35, '18V drill with two batteries and a charger.'],
    ['GL-010', 'Work Gloves', 'safety', 12.25, 300, 'Cut-resistant gloves, sizes S to XL.'],
    ['HT-500', 'Hard Hat', 'safety', 24.0, 80, 'Class E, adjustable suspension.'],
    ['TP-007', 'Duct Tape', 'supplies', 6.75, 500, 'Heavy-duty 48mm x 50m roll.'],
    ['LD-300', 'Step Ladder', 'equipment', 74.99, 12, 'Aluminium, 6 step, 150kg rated.'],
  ];
  seed.forEach((p) => store.run(
    'INSERT INTO shop_products (sku, name, category, price, stock, description) VALUES (?,?,?,?,?,?)', p));
  store.run("INSERT INTO orders (account_id, product_id, quantity, total, status, created_at) VALUES (2, 1, 2, 37.0, 'shipped', '2026-10-01T10:00:00Z')");

  app.get('/api/shop/products', (req, res) => {
    const { category, q } = req.query;
    let sql = 'SELECT id, sku, name, category, price, stock FROM shop_products WHERE 1=1';
    const params = [];
    if (category) { sql += ' AND category = ?'; params.push(String(category)); }
    if (q) { sql += ' AND name LIKE ?'; params.push(`%${q}%`); }
    res.json(store.all(sql + ' ORDER BY name', params));
  });

  app.get('/api/shop/products/:id', (req, res) => {
    const p = store.get('SELECT * FROM shop_products WHERE id = ?', [Number(req.params.id)]);
    p ? res.json(p) : res.status(404).json({ error: 'product not found' });
  });

  app.post('/api/shop/orders', app.requireAuth, (req, res) => {
    const productId = Number(req.body.productId);
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return res.status(400).json({ error: 'quantity must be an integer between 1 and 50' });
    }
    const p = store.get('SELECT * FROM shop_products WHERE id = ?', [productId]);
    if (!p) return res.status(404).json({ error: 'product not found' });
    if (p.stock < quantity) return res.status(409).json({ error: 'insufficient stock' });
    store.run('UPDATE shop_products SET stock = stock - ? WHERE id = ?', [quantity, productId]);
    const { lastId } = store.run(
      'INSERT INTO orders (account_id, product_id, quantity, total, status, created_at) VALUES (?,?,?,?,?,?)',
      [req.user.id, productId, quantity, +(p.price * quantity).toFixed(2), 'processing', new Date().toISOString()]);
    res.status(201).json({ id: lastId, total: +(p.price * quantity).toFixed(2), status: 'processing' });
  });

  app.get('/api/shop/orders', app.requireAuth, (req, res) => {
    res.json(store.all(
      `SELECT o.id, p.name AS product, o.quantity, o.total, o.status, o.created_at
       FROM orders o JOIN shop_products p ON p.id = o.product_id WHERE o.account_id = ? ORDER BY o.id DESC`,
      [req.user.id]));
  });

  app.get('/api/shop/orders/:id', app.requireAuth, (req, res) => {
    const o = store.get('SELECT * FROM orders WHERE id = ? AND account_id = ?', [Number(req.params.id), req.user.id]);
    o ? res.json(o) : res.status(404).json({ error: 'order not found' });
  });
};
