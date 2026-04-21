const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('broadcast_token');
}

function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: authHeaders()
    });
    return handleResponse(res);
  },

  async post(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async put(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async patch(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async delete(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return handleResponse(res);
  }
};

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return handleResponse(res);
}

export async function getMe() {
  return api.get('/auth/me');
}

export default api;
