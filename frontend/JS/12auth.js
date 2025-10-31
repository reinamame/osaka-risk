// 開発(ローカル)だけ127.0.0.1、その他は同一オリジンの /api
const isLocal = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE = isLocal ? 'http://127.0.0.1:8000' : '/api';



// export const API_BASE =
  // (typeof window !== "undefined" && window.__API_BASE) ||
  // "http://127.0.0.1:8000"; // ローカル開発用フォールバック

const TOKEN_KEY = "accessToken";
const DEVICE_ID_KEY = "deviceId";

export function getDeviceId() {
  return localStorage.getItem("deviceId");
}

export function setToken(t) {
  localStorage.setItem("accessToken", t);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem("accessToken");
}


export function buildHeaders({ auth = false, json = true } = {}) {
  const h = {};
  const dev = getDeviceId();
  if (dev) h["X-Device-ID"] = dev;
  if (auth && getToken()) h["Authorization"] = "Bearer " + getToken();
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function register(email, password, nickname) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: buildHeaders({ auth: false, json: true }),
    body: JSON.stringify({
      email, password, nickname, device_id: getDeviceId() // あれば引き取りが楽
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || res.statusText);
  setToken(data.access_token);
  return data;
}


export async function login(email, password) {
  const params = new URLSearchParams();
  params.set("username", email);
  params.set("password", password);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded",
               "X-Device-ID": getDeviceId() },
    body: params.toString()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || res.statusText);
  setToken(data.access_token);
  return data;
}


export async function claimDevice() {
  const res = await fetch(`${API_BASE}/auth/claim_device`, {
    method: "POST",
    headers: buildHeaders({ auth: true, json: false }) // body不要
  });
  if (!res.ok) throw new Error("claim_device failed");
  return res.json();
}

export async function me() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: buildHeaders({ auth: true, json: false })
  });
  return res.json();
}

export async function addFavoriteOne(lat, lon, title) {
  const res = await fetch(`${API_BASE}/favorites`, {
    method: "POST",
    headers: buildHeaders({ auth: !!getToken(), json: true }),
    body: JSON.stringify({ lat, lon, title })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || res.statusText);
  return data;
}
export async function listFavorites() {
  const res = await fetch(`${API_BASE}/favorites`, {
    headers: buildHeaders({ auth: !!getToken(), json: false })
  });
  return res.json();
}

export function logout() { clearToken(); }