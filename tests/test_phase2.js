/**
 * Phase 2 Route Verification Script
 * Tests every endpoint for Lead Management, Filtering, and Assignment
 */

import {
  ROLES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_PRIORITIES
} from "../src/utils/usedConstants.js";

const BASE_URL = "http://localhost:5000/api/v1";

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("=== STARTING PHASE 2 LEAD MANAGEMENT TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Admin Login
  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@crm.com", password: "AdminPassword123!" })
  });
  assert(adminLogin.status === 200, "Admin login successful");
  const adminToken = adminLogin.data.data.accessToken;

  // 2. Admin creates a Manager (Priya)
  const ts = Date.now();
  const managerRes = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Manager Priya",
      email: `manager_${ts}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_MANAGER
    })
  });
  assert(managerRes.status === 201, "Admin creates Sales Manager Priya");
  const managerId = managerRes.data.data.user._id;

  // Login as Priya
  const managerLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `manager_${ts}@crm.com`, password: "Password123!" })
  });
  const managerToken = managerLogin.data.data.accessToken;

  // 3. Admin creates Executive 1 (Rahul) reporting to Priya
  const exec1Res = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Rahul Sharma",
      email: `rahul_${ts}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_EXECUTIVE,
      managerId: managerId
    })
  });
  assert(exec1Res.status === 201, "Admin creates Sales Executive Rahul reporting to Priya");
  const rahulId = exec1Res.data.data.user._id;

  // Login as Rahul
  const rahulLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `rahul_${ts}@crm.com`, password: "Password123!" })
  });
  const rahulToken = rahulLogin.data.data.accessToken;

  // 4. Admin creates Executive 2 (Sneha) reporting to Priya
  const exec2Res = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Sneha Roy",
      email: `sneha_${ts}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_EXECUTIVE,
      managerId: managerId
    })
  });
  assert(exec2Res.status === 201, "Admin creates Sales Executive Sneha reporting to Priya");
  const snehaId = exec2Res.data.data.user._id;

  // Login as Sneha
  const snehaLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `sneha_${ts}@crm.com`, password: "Password123!" })
  });
  const snehaToken = snehaLogin.data.data.accessToken;

  // 5. Rahul creates a Lead (Acme Corp)
  const leadRes = await request("/leads", {
    method: "POST",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({
      name: "Alice Johnson",
      email: `alice_${ts}@acme.com`,
      phone: "+1-555-0199",
      company: "Acme Enterprises",
      source: LEAD_SOURCES.WEBSITE,
      priority: LEAD_PRIORITIES.HIGH,
      description: "Interested in 50 enterprise user licenses"
    })
  });
  assert(leadRes.status === 201 && leadRes.data.data.lead.assignedTo._id === rahulId, "Rahul creates Lead (Auto-assigned to Rahul)");
  const leadId = leadRes.data.data.lead._id;

  // 6. Rahul retrieves own leads list
  const rahulLeads = await request("/leads", {
    headers: { Authorization: `Bearer ${rahulToken}` }
  });
  assert(rahulLeads.status === 200 && rahulLeads.data.data.leads.some(l => l._id === leadId), "Rahul sees own lead in GET /leads");

  // 7. Sneha retrieves leads: should NOT see Rahul's lead
  const snehaLeads = await request("/leads", {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(snehaLeads.status === 200 && !snehaLeads.data.data.leads.some(l => l._id === leadId), "Data Isolation: Sneha does NOT see Rahul's lead");

  // 8. Sneha tries to view Rahul's lead directly by ID -> 403 Forbidden
  const sneakPeek = await request(`/leads/${leadId}`, {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(sneakPeek.status === 403, "Access Guard: Sneha gets 403 Forbidden viewing unassigned lead by ID");

  // 9. Rahul updates Lead details
  const updateRes = await request(`/leads/${leadId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ priority: LEAD_PRIORITIES.HIGH, description: "Follow-up requested next Monday" })
  });
  assert(updateRes.status === 200 && updateRes.data.data.lead.description === "Follow-up requested next Monday", "Rahul updates Lead details");

  // 10. Rahul updates Lead status to Contacted then Qualified
  const statusRes = await request(`/leads/${leadId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ status: LEAD_STATUSES.QUALIFIED })
  });
  assert(statusRes.status === 200 && statusRes.data.data.lead.status === LEAD_STATUSES.QUALIFIED, "Rahul updates Lead status to Qualified");

  // 11. Rahul tries to reassign lead -> 403 Forbidden (Executives cannot assign)
  const execAssignAttempt = await request(`/leads/${leadId}/assign`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ assignedTo: snehaId })
  });
  assert(execAssignAttempt.status === 403, "Role Guard: Executive cannot reassign leads (403 Forbidden)");

  // 12. Manager Priya views leads: sees Rahul's lead because Rahul reports to Priya
  const managerLeads = await request("/leads", {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  assert(managerLeads.status === 200 && managerLeads.data.data.leads.some(l => l._id === leadId), "Manager Priya can view team lead");

  // 13. Manager Priya reassigns lead from Rahul to Sneha
  const reassignRes = await request(`/leads/${leadId}/assign`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${managerToken}` },
    body: JSON.stringify({ assignedTo: snehaId })
  });
  assert(reassignRes.status === 200 && reassignRes.data.data.lead.assignedTo._id === snehaId, "Manager Priya reassigns lead to Sneha");

  // 14. Sneha now sees the lead
  const snehaNewLeads = await request("/leads", {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(snehaNewLeads.status === 200 && snehaNewLeads.data.data.leads.some(l => l._id === leadId), "Sneha now sees reassigned lead in GET /leads");

  // 15. Search, Filtering, and Pagination query
  const queryRes = await request(`/leads?search=Acme&status=${LEAD_STATUSES.QUALIFIED}&source=${LEAD_SOURCES.WEBSITE}&page=1&limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(queryRes.status === 200 && queryRes.data.meta.page === 1 && queryRes.data.data.leads.length >= 1, "Admin multi-filter query with pagination metadata succeeds");

  // 16. Admin deletes lead
  const deleteRes = await request(`/leads/${leadId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(deleteRes.status === 200 && deleteRes.data.success, "Admin deletes lead");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
