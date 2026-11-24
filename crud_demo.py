"""Intentionally vulnerable CRUD demo (Flask + SQLite). Do not use in production."""
import sqlite3

import yaml
from flask import Flask, jsonify, request

app = Flask(__name__)

DB_PATH = "crud_demo.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "title TEXT NOT NULL, "
        "body TEXT, "
        "owner TEXT)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS store_items ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "name TEXT NOT NULL, "
        "price REAL NOT NULL, "
        "stock INTEGER NOT NULL)"
    )
    if conn.execute("SELECT COUNT(*) FROM store_items").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO store_items (name, price, stock) VALUES (?, ?, ?)",
            [("Notebook", 4.99, 100), ("Pen", 1.49, 250), ("Backpack", 39.0, 12)],
        )
        conn.commit()
    return conn


@app.route("/store/items/<item_id>", methods=["GET"])
def get_store_item(item_id):
    conn = get_db()
    # VULNERABLE: SQL injection via f-string.
    # Try: /store/items/1 OR 1=1
    row = conn.execute(f"SELECT * FROM store_items WHERE id = {item_id}").fetchone()
    if row is None:
        return jsonify({"error": "item not found"}), 404
    return jsonify(dict(row))


@app.route("/notes", methods=["POST"])
def create_note():
    data = request.get_json(force=True)
    conn = get_db()
    # VULNERABLE: SQL injection via string formatting.
    query = "INSERT INTO notes (title, body, owner) VALUES ('%s', '%s', '%s')" % (
        data.get("title", ""),
        data.get("body", ""),
        data.get("owner", ""),
    )
    cur = conn.execute(query)
    conn.commit()
    return jsonify({"id": cur.lastrowid}), 201


@app.route("/notes", methods=["GET"])
def list_notes():
    search = request.args.get("search", "")
    conn = get_db()
    # VULNERABLE: SQL injection via string concatenation.
    # Try: /notes?search=' OR '1'='1
    query = "SELECT * FROM notes WHERE title LIKE '%" + search + "%'"
    rows = conn.execute(query).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/notes/<note_id>", methods=["GET"])
def get_note(note_id):
    conn = get_db()
    # VULNERABLE: SQL injection via f-string.
    row = conn.execute(f"SELECT * FROM notes WHERE id = {note_id}").fetchone()
    if row is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(row))


@app.route("/notes/<note_id>", methods=["PUT"])
def update_note(note_id):
    data = request.get_json(force=True)
    conn = get_db()
    # VULNERABLE: SQL injection via string concatenation.
    query = (
        "UPDATE notes SET title = '" + data.get("title", "")
        + "', body = '" + data.get("body", "")
        + "' WHERE id = " + note_id
    )
    conn.execute(query)
    conn.commit()
    return jsonify({"updated": note_id})


@app.route("/notes/<note_id>", methods=["DELETE"])
def delete_note(note_id):
    conn = get_db()
    # VULNERABLE: SQL injection via string concatenation.
    conn.execute("DELETE FROM notes WHERE id = " + note_id)
    conn.commit()
    return jsonify({"deleted": note_id})


@app.route("/notes/import", methods=["POST"])
def import_notes():
    # VULNERABLE: yaml.load without a safe loader allows arbitrary object construction.
    notes = yaml.load(request.data, Loader=yaml.Loader)
    conn = get_db()
    for n in notes:
        conn.execute("INSERT INTO notes (title, body) VALUES (?, ?)", (n["title"], n["body"]))
    conn.commit()
    return jsonify({"imported": len(notes)}), 201


if __name__ == "__main__":
    # VULNERABLE: debug mode exposes the Werkzeug debugger (remote code execution).
    app.run(debug=True)
