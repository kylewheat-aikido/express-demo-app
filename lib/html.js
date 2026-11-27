// Tiny HTML templating helpers shared by all pages (storefront and security lab).
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LINKS = [
  ['/products', 'Products'],
  ['/orders', 'Orders', 'auth'],
  ['/support', 'Support', 'auth'],
  ['/lab', 'Security Lab', 'lab'],
];

// opts.path marks the active nav link. Page bodies are inserted as-is: callers
// escape their own data (the security-lab pages deliberately do not).
function layout(title, body, user, opts = {}) {
  const cur = (href) => (opts.path === href || (href !== '/' && String(opts.path || '').startsWith(href + '/')) ? ' aria-current="page"' : '');
  const links = LINKS.filter(([, , kind]) => kind !== 'auth' || user)
    .map(([href, label, kind]) => `<a href="${href}"${kind === 'lab' ? ' class="lab"' : ''}${cur(href)}>${label}</a>`).join('');
  const account = user
    ? `${user.role === 'admin' ? `<a href="/admin"${cur('/admin')}>Admin</a>` : ''}<a href="/account"${cur('/account')}>${escapeHtml(user.name)}</a><a href="#" id="logout">Log out</a>`
    : `<a href="/signin"${cur('/signin')}>Sign in</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | Acme Supply Co.</title>
<link rel="stylesheet" href="/static/style.css">
</head><body>
<header class="site"><nav class="bar" aria-label="Main"><a class="brand" href="/">Acme <span>Supply Co.</span></a>${links}<span class="spacer"></span>${account}</nav></header>
<main>${body}</main>
<footer class="site">Demo application &middot; fake data only &middot; the <a href="/lab">Security Lab</a> is intentionally vulnerable.</footer>
<script src="/static/app.js"></script>
</body></html>`;
}

module.exports = { escapeHtml, layout };
