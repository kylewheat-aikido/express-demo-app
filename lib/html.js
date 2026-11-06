// Tiny HTML templating helpers shared by all pages.
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, body, user) {
  const nav = user
    ? `<a href="/account">${escapeHtml(user.name)}</a>${user.role === 'admin' ? '<a href="/admin">Admin</a>' : ''}<a href="#" id="logout">Log out</a>`
    : '<a href="/signin">Sign in</a>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | Acme Supply Co.</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;color:#222;background:#fafafa}
header{background:#1d3557;color:#fff;padding:12px 24px;display:flex;gap:20px;align-items:center}
header a{color:#fff;text-decoration:none} header .brand{font-weight:700;margin-right:auto}
main{max-width:860px;margin:24px auto;padding:0 16px}
table{border-collapse:collapse;width:100%} td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}
input,textarea,button,select{font:inherit;padding:6px;margin:4px 0} .card{background:#fff;border:1px solid #ddd;padding:16px;border-radius:6px;margin-bottom:12px}
footer{text-align:center;color:#888;padding:24px;font-size:.85em}
</style></head><body>
<header><a class="brand" href="/">Acme Supply Co.</a><a href="/products">Products</a><a href="/orders">Orders</a><a href="/support">Support</a>${nav}</header>
<main>${body}</main>
<footer>Demo application. Fake data only.</footer>
<script src="/static/app.js"></script>
</body></html>`;
}

module.exports = { escapeHtml, layout };
