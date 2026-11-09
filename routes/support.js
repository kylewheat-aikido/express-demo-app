// Support tickets API.
module.exports = function registerSupport(app, store) {
  store.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY, account_id INTEGER, subject TEXT, body TEXT, status TEXT, created_at TEXT)`);
  store.run("INSERT INTO tickets (account_id, subject, body, status, created_at) VALUES (2, 'Where is my order?', 'Order 1 has not arrived yet.', 'open', '2026-10-03T09:00:00Z')");

  app.get('/api/support/tickets', app.requireAuth, (req, res) => {
    res.json(store.all('SELECT id, subject, body, status, created_at FROM tickets WHERE account_id = ? ORDER BY id DESC', [req.user.id]));
  });

  app.post('/api/support/tickets', app.requireAuth, (req, res) => {
    const { subject, body } = req.body || {};
    if (!subject || !body || String(subject).length > 120) {
      return res.status(400).json({ error: 'subject (max 120 chars) and body are required' });
    }
    const { lastId } = store.run(
      'INSERT INTO tickets (account_id, subject, body, status, created_at) VALUES (?,?,?,?,?)',
      [req.user.id, String(subject), String(body), 'open', new Date().toISOString()]);
    res.status(201).json({ id: lastId, status: 'open' });
  });
};
