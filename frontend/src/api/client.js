import { isDemo } from './config';
import { demoRequest } from './demo';
const tokenKey = isDemo ? 'iot-demo-token' : 'iot-token';
export const API = import.meta.env.VITE_API_URL || '/api/v1';
let token = sessionStorage.getItem(tokenKey);
export function getToken() {
  return token;
}
export function setToken(value) {
  token = value;
  if (value) sessionStorage.setItem(tokenKey, value);
  else sessionStorage.removeItem(tokenKey);
}
export async function request(path, { method = 'GET', body, signal, raw = false } = {}) {
  if (isDemo) return demoRequest(path, { method, body, signal, raw }, token);
  const response = await fetch(API + path, {
    method,
    signal,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401 && path !== '/auth/login') {
    setToken(null);
    window.dispatchEvent(new Event('auth-expired'));
  }
  if (!response.ok) {
    let message;
    try {
      message = (await response.json()).error?.message;
    } catch {}
    throw new Error(message || `Request failed (${response.status})`);
  }
  return raw ? response : response.json();
}
export async function download(path) {
  const response = await request(path, { raw: true });
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'iot-logs.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function queryString(values) {
  return new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ).toString();
}
