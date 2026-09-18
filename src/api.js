export async function apiRequest(apiUrl, token, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Sikertelen kérés (${response.status}).`);
    error.status = response.status;
    error.details = data.details || data.errors;
    throw error;
  }
  return data;
}
