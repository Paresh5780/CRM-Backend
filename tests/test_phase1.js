/**
 * Phase 1 Route Verification Script
 * Tests every endpoint for Auth & User Management
 */

import { ROLES } from "../src/utils/usedConstants.js";

const BASE_URL = "http://localhost:5000/api/v1";

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("=== STARTING PHASE 1 ENDPOINT TESTS ===");
  let failed = 0;
  let passed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health check
  const health = await request("/health");
  assert(health.status === 200 && health.data.success, "GET /health responds 200 OK");

  // 2. Admin Login
  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "admin@crm.com",
      password: "AdminPassword123!"
    })
  });
  assert(adminLogin.status === 200 && adminLogin.data.data.accessToken, "POST /auth/login (Admin login successful)");
  const adminToken = adminLogin.data.data.accessToken;
  const adminRefreshToken = adminLogin.data.data.refreshToken;

  // 3. GET /auth/me with Admin Token
  const me = await request("/auth/me", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(me.status === 200 && me.data.data.user.role === ROLES.ADMIN, "GET /auth/me returns Admin profile");

  // 4. POST /auth/refresh-token
  const refresh = await request("/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({ refreshToken: adminRefreshToken })
  });
  assert(refresh.status === 200 && refresh.data.data.accessToken, "POST /auth/refresh-token returns new access token");

  // 5. POST /auth/register (Sales Executive)
  const execEmail = `rahul_${Date.now()}@crm.com`;
  const register = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Rahul Sharma",
      email: execEmail,
      password: "Password123!",
      phone: "+919876543210"
    })
  });
  assert(register.status === 201 && register.data.data.user.role === ROLES.SALES_EXECUTIVE, "POST /auth/register creates user with role ROLES.SALES_EXECUTIVE (3)");
  const execToken = register.data.data.accessToken;

  // 6. POST /auth/logout
  const logout = await request("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${execToken}` }
  });
  assert(logout.status === 200 && logout.data.success, "POST /auth/logout succeeds");

  // 7. RBAC Test: Sales Executive tries to access Admin user management
  const forbiddenAccess = await request("/users", {
    headers: { Authorization: `Bearer ${execToken}` }
  });
  assert(forbiddenAccess.status === 403, "RBAC Guard: Sales Executive gets 403 Forbidden on GET /users");

  // 8. Admin creates a Manager
  const managerEmail = `priya_${Date.now()}@crm.com`;
  const createManager = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Priya Patel",
      email: managerEmail,
      password: "Password123!",
      phone: "+919876543211",
      role: ROLES.SALES_MANAGER
    })
  });
  assert(createManager.status === 201 && createManager.data.data.user.role === ROLES.SALES_MANAGER, "POST /users (Admin creates sales_manager)");
  const managerId = createManager.data.data.user._id;

  // 9. Admin lists all users with pagination and search
  const listUsers = await request(`/users?search=Priya&role=${ROLES.SALES_MANAGER}&page=1&limit=10`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(listUsers.status === 200 && listUsers.data.data.users.length >= 1, "GET /users (Admin lists users with search & filters)");

  // 10. Admin gets user by ID
  const getUser = await request(`/users/${managerId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(getUser.status === 200 && getUser.data.data.user._id === managerId, "GET /users/:id retrieves user by ID");

  // 11. Admin updates user
  const updateUser = await request(`/users/${managerId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "Priya Patel (Senior Manager)" })
  });
  assert(updateUser.status === 200 && updateUser.data.data.user.name === "Priya Patel (Senior Manager)", "PATCH /users/:id updates user details");

  // 12. Admin deactivates user
  const deactivate = await request(`/users/${managerId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ isActive: false })
  });
  assert(deactivate.status === 200 && deactivate.data.data.user.isActive === false, "PATCH /users/:id/status deactivates user");

  // 13. Admin reactivates user
  const reactivate = await request(`/users/${managerId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ isActive: true })
  });
  assert(reactivate.status === 200 && reactivate.data.data.user.isActive === true, "PATCH /users/:id/status reactivates user");

  // 14. Admin deletes temporary user
  const tempUser = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Temporary User",
      email: `temp_${Date.now()}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_EXECUTIVE
    })
  });
  const tempId = tempUser.data.data.user._id;
  const deleteRes = await request(`/users/${tempId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(deleteRes.status === 200 && deleteRes.data.success, "DELETE /users/:id removes user");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
