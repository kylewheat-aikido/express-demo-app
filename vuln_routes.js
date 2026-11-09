// DEMO ONLY: intentionally vulnerable code to trigger SAST PR checks.
const express = require('express');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3');

const router = express.Router();
const db = new sqlite3.Database(':memory:');

// SQL injection: user input concatenated into query
router.get('/user', (req, res) => {
  const query = "SELECT * FROM users WHERE name = '" + req.query.name + "'";
  db.all(query, (err, rows) => res.json(rows));
});

// OS command injection: user input passed to a shell
router.get('/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.host, (err, stdout) => res.send(stdout));
});

// Code injection: eval on user input
router.post('/calc', (req, res) => {
  res.send(String(eval(req.body.expression)));
});

module.exports = router;
