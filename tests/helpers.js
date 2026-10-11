/**
 * Shared test helper utilities.
 * Provides an authenticated HTTP request helper and common constants.
 */

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;
const ADMIN_EMAIL = "admin@crm.com";
const ADMIN_PASSWORD = "AdminPassword123!";

async function request(method, path, body, token) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const json = await res.json();
  return { status: res.status, body: json };
}

async function loginAs(email, password) {
  const res = await request("POST", "/auth/login", { email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.body.message}`);
  }
  return res.body.data.accessToken;
}

async function loginAsAdmin() {
  return loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
}

export { request, loginAs, loginAsAdmin, BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD };
