// Accounts, sessions and the requireAuth/requireAdmin middleware.
const crypto = require('crypto');

module.exports = function registerAuth(app, store) {
  store.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT, salt TEXT, hash TEXT)`);

  const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
  const createAccount = (email, name, pw, role = 'customer') => {
    const salt = crypto.randomBytes(16).toString('hex');
    return store.run('INSERT INTO accounts (email, name, role, salt, hash) VALUES (?,?,?,?,?)',
      [email, name, role, salt, hashPw(pw, salt)]).lastId;
  };
  createAccount('admin@acme.test', 'Ada Admin', 'admin-demo-pw', 'admin');
  createAccount('casey@acme.test', 'Casey Customer', 'casey-demo-pw');

  const sessions = new Map(); // sid -> account id

  app.use((req, res, next) => {
    const id = sessions.get(req.cookies.sid);
    req.user = id ? store.get('SELECT id, email, name, role FROM accounts WHERE id = ?', [id]) : null;
    next();
  });

  const startSession = (res, accountId) => {
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, accountId);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax' });
  };

  app.post('/api/auth/register', (req, res) => {
    const { email, name, password } = req.body || {};
    if (!email || !name || !password || password.length < 8) {
      return res.status(400).json({ error: 'email, name and a password of 8+ characters are required' });
    }
    if (store.get('SELECT id FROM accounts WHERE email = ?', [email])) {
      return res.status(409).json({ error: 'email already registered' });
    }
    const id = createAccount(email, name, password);
    startSession(res, id);
    res.status(201).json({ id, email, name });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const a = store.get('SELECT * FROM accounts WHERE email = ?', [email || '']);
    const ok = a && crypto.timingSafeEqual(Buffer.from(hashPw(password || '', a.salt), 'hex'), Buffer.from(a.hash, 'hex'));
    if (!ok) return res.status(401).json({ error: 'invalid email or password' });
    startSession(res, a.id);
    res.json({ id: a.id, email: a.email, name: a.name, role: a.role });
  });

  app.post('/api/auth/logout', (req, res) => {
    sessions.delete(req.cookies.sid);
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    req.user ? res.json(req.user) : res.status(401).json({ error: 'not signed in' });
  });

  app.requireAuth = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: 'authentication required' });
  app.requireAdmin = (req, res, next) =>
    req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'admin only' });
};
