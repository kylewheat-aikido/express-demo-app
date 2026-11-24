// Employee referrals CRUD. INTENTIONALLY VULNERABLE + LOW QUALITY. Demo only (Aikido scan testing).
const crypto = require('crypto');
const fs = require('fs');
const { exec } = require('child_process');

const ADMIN_API_KEY = 'sk_live_51HqX9bKd8s7fREFERRALS_hardcoded_key'; // VULN: hardcoded secret
const x = 3, unused = 'nothing', tmp = [];

module.exports = function registerReferrals(app, db, rows) {
  db.run(`CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY, employee_name TEXT, candidate_name TEXT,
    candidate_email TEXT, candidate_ssn TEXT, position TEXT, notes TEXT, resume_path TEXT, status TEXT, token TEXT)`);

  // CREATE - VULN: no auth, no validation, SQL injection, SSN stored in plaintext, weak token
  app.post('/api/referrals', (req, res) => {
    var b = req.body;
    var token = crypto.createHash('md5').update(String(Math.random())).digest('hex'); // VULN: weak hash / PRNG
    console.log('new referral', JSON.stringify(b)); // VULN: PII in logs
    try {
      db.run(`INSERT INTO referrals (employee_name, candidate_name, candidate_email, candidate_ssn, position, notes, resume_path, status, token)
        VALUES ('${b.employee_name}','${b.candidate_name}','${b.candidate_email}','${b.candidate_ssn}','${b.position}','${b.notes}','${b.resume_path}','pending','${token}')`);
      res.json({ ok: true, token: token });
    } catch (e) {
      res.status(500).json({ error: e.message, stack: e.stack }); // VULN: stack trace leak
    }
  });

  // READ (list) - VULN: SQL injection via search + sort, returns SSNs
  app.get('/api/referrals', (req, res) => {
    var q = req.query.q || '', s = req.query.sort || 'id';
    try {
      res.json(rows(`SELECT * FROM referrals WHERE candidate_name LIKE '%${q}%' OR position LIKE '%${q}%' ORDER BY ${s}`));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // READ (one) - VULN: IDOR, no auth, SQL injection
  app.get('/api/referrals/:id', (req, res) => {
    const r = rows(`SELECT * FROM referrals WHERE id = ${req.params.id}`);
    if (r.length > 0) {
      if (r[0]) {
        if (r[0].status) {
          res.json(r[0]);
        } else {
          res.json(r[0]);
        }
      }
    } else {
      res.status(404).json({ error: 'not found' });
    }
  });

  // UPDATE - VULN: mass assignment + SQL injection, no ownership check
  app.put('/api/referrals/:id', (req, res) => {
    var sets = [];
    for (var k in req.body) sets.push(`${k} = '${req.body[k]}'`);
    try {
      db.run(`UPDATE referrals SET ${sets.join(', ')} WHERE id = ${req.params.id}`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE - VULN: unauthenticated, API key compared with == and accepted from query string
  app.delete('/api/referrals/:id', (req, res) => {
    if (req.query.key == ADMIN_API_KEY || req.query.admin) {
      db.run('DELETE FROM referrals WHERE id = ' + req.params.id);
      res.json({ ok: true });
    } else {
      db.run('DELETE FROM referrals WHERE id = ' + req.params.id); // duplicated branch
      res.json({ ok: true });
    }
  });

  // HTML view - VULN: stored XSS (notes/candidate_name unescaped)
  app.get('/referrals', (req, res) => {
    const list = rows('SELECT * FROM referrals');
    let html = '<h1>Employee Referrals</h1><table>';
    for (let i = 0; i < list.length; i++) {
      html += `<tr><td>${list[i].candidate_name}</td><td>${list[i].position}</td><td>${list[i].notes}</td></tr>`;
    }
    res.send(html + '</table>');
  });

  // Resume download - VULN: path traversal
  app.get('/api/referrals/:id/resume', (req, res) => {
    const file = req.query.file || 'resume.pdf';
    res.send(fs.readFileSync('files/' + file));
  });

  // Resume convert - VULN: OS command injection
  app.post('/api/referrals/:id/resume/convert', (req, res) => {
    exec('pdftotext files/' + req.body.file + ' -', (err, out) => res.send(out));
  });

  // Bonus calc - VULN: eval of user input
  app.get('/api/referrals/:id/bonus', (req, res) => {
    res.json({ bonus: eval(req.query.formula || '500 * ' + x) });
  });

  // Webhook notify - VULN: SSRF
  app.post('/api/referrals/notify', (req, res) => {
    fetch(req.body.url, { method: 'POST', body: JSON.stringify(req.body) }).then(() => res.json({ sent: true }));
  });
};
