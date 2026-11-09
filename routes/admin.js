// Admin-only API.
module.exports = function registerAdmin(app, store) {
  app.get('/api/admin/stats', app.requireAuth, app.requireAdmin, (req, res) => {
    res.json({
      accounts: store.get('SELECT COUNT(*) AS n FROM accounts').n,
      orders: store.get('SELECT COUNT(*) AS n FROM orders').n,
      openTickets: store.get("SELECT COUNT(*) AS n FROM tickets WHERE status = 'open'").n,
      revenue: store.get('SELECT COALESCE(SUM(total), 0) AS t FROM orders').t,
    });
  });

  app.get('/api/admin/accounts', app.requireAuth, app.requireAdmin, (req, res) => {
    res.json(store.all('SELECT id, email, name, role FROM accounts ORDER BY id'));
  });

  app.get('/api/admin/tickets', app.requireAuth, app.requireAdmin, (req, res) => {
    res.json(store.all('SELECT * FROM tickets ORDER BY id DESC'));
  });

  app.post('/api/admin/tickets/:id/close', app.requireAuth, app.requireAdmin, (req, res) => {
    store.run("UPDATE tickets SET status = 'closed' WHERE id = ?", [Number(req.params.id)]);
    res.json({ ok: true });
  });
};
