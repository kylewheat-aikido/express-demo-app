// Shared client helpers for the Acme demo pages.
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Show a message in an .alert element; kind is 'error' | 'success' | ''.
function notify(el, text, kind) {
  el.textContent = text || '';
  el.className = 'alert' + (kind ? ' ' + kind : '');
}

// Run an async action with a button disabled meanwhile, reporting errors to an alert element.
async function withButton(btn, alertEl, fn) {
  btn.disabled = true;
  notify(alertEl, '');
  try { await fn(); } catch (err) { notify(alertEl, err.message, 'error'); } finally { btn.disabled = false; }
}

const money = (n) => '$' + Number(n).toFixed(2);

const logout = document.getElementById('logout');
if (logout) logout.addEventListener('click', async (e) => {
  e.preventDefault();
  await api('POST', '/api/auth/logout');
  location.href = '/';
});
