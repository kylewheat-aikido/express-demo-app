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
const logout = document.getElementById('logout');
if (logout) logout.addEventListener('click', async (e) => {
  e.preventDefault();
  await api('POST', '/api/auth/logout');
  location.href = '/';
});
