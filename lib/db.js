// Small helpers around sql.js for parameterized queries.
module.exports = function makeDb(db) {
  const all = (sql, params = []) => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const out = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      return out;
    } finally {
      stmt.free();
    }
  };
  const get = (sql, params = []) => all(sql, params)[0];
  const run = (sql, params = []) => {
    db.run(sql, params);
    return { lastId: db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
  };
  return { all, get, run };
};
