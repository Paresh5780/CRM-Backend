import assert from "node:assert";

const BASE_URL = "http://localhost:5000/api/v1";

async function runTests() {
  console.log("=== STARTING PHASE 5 ANALYTICS INTEGRATION TESTS ===");

  // 1. Login as Admin
  console.log("\n1. Logging in as Admin...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@crm.com",
      password: "AdminPassword123!"
    })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginData)}`);
  const adminToken = loginData.data.accessToken;
  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`
  };
  console.log("✔ Admin logged in successfully");

  // 2. Create a Sales Executive user to test RBAC restrictions
  console.log("\n2. Creating a Sales Executive user for RBAC test...");
  const execEmail = `exec_analytics_${Date.now()}@test.com`;
  const execCreateRes = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Analytics Test Executive",
      email: execEmail,
      password: "Password123!",
      role: 3 // SALES_EXECUTIVE
    })
  });
  const execCreateData = await execCreateRes.json();
  assert.strictEqual(execCreateRes.status, 201, `Executive creation failed: ${JSON.stringify(execCreateData)}`);
  console.log("✔ Sales Executive created");

  // Login as Sales Executive
  const execLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: execEmail,
      password: "Password123!"
    })
  });
  const execLoginData = await execLoginRes.json();
  const execToken = execLoginData.data.accessToken;
  const execHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${execToken}`
  };
  console.log("✔ Sales Executive logged in successfully");

  // 3. Test GET /api/v1/analytics/summary (Admin - Company-wide)
  console.log("\n3. Testing GET /api/v1/analytics/summary (Admin)...");
  const summaryRes = await fetch(`${BASE_URL}/analytics/summary`, {
    headers: adminHeaders
  });
  const summaryData = await summaryRes.json();
  assert.strictEqual(summaryRes.status, 200, `Summary failed: ${JSON.stringify(summaryData)}`);
  assert(summaryData.data.leads !== undefined, "Should contain leads analytics");
  assert(summaryData.data.deals !== undefined, "Should contain deals analytics");
  assert(summaryData.data.activities !== undefined, "Should contain activities analytics");

  console.log("✔ Leads Summary:", summaryData.data.leads);
  console.log("✔ Deals Summary:", summaryData.data.deals);
  console.log("✔ Activities Summary:", summaryData.data.activities);

  // 4. Test GET /api/v1/analytics/dashboard alias
  console.log("\n4. Testing GET /api/v1/analytics/dashboard (Alias)...");
  const dashRes = await fetch(`${BASE_URL}/analytics/dashboard`, {
    headers: adminHeaders
  });
  const dashData = await dashRes.json();
  assert.strictEqual(dashRes.status, 200);
  assert.deepStrictEqual(dashData.data, summaryData.data, "Dashboard alias should return identical data");
  console.log("✔ Dashboard alias works and returns identical data");

  // 5. Test GET /api/v1/analytics/pipeline (Deal stage distribution)
  console.log("\n5. Testing GET /api/v1/analytics/pipeline...");
  const pipelineRes = await fetch(`${BASE_URL}/analytics/pipeline`, {
    headers: adminHeaders
  });
  const pipelineData = await pipelineRes.json();
  assert.strictEqual(pipelineRes.status, 200, `Pipeline failed: ${JSON.stringify(pipelineData)}`);
  assert(Array.isArray(pipelineData.data.pipeline), "Pipeline should be an array");
  assert.strictEqual(pipelineData.data.pipeline.length, 6, "Pipeline should contain exactly 6 stages");
  console.log("✔ Pipeline stages returned:", pipelineData.data.pipeline.map((p) => `${p.stageName} (Stage ${p.stage}): ${p.count} deals, $${p.totalValue}`));

  // 6. Test GET /api/v1/analytics/leads-by-source
  console.log("\n6. Testing GET /api/v1/analytics/leads-by-source...");
  const sourceRes = await fetch(`${BASE_URL}/analytics/leads-by-source`, {
    headers: adminHeaders
  });
  const sourceData = await sourceRes.json();
  assert.strictEqual(sourceRes.status, 200, `Leads by source failed: ${JSON.stringify(sourceData)}`);
  assert(Array.isArray(sourceData.data.sources), "Sources should be an array");
  assert.strictEqual(sourceData.data.sources.length, 6, "Sources should contain exactly 6 sources");
  console.log("✔ Leads by source returned:", sourceData.data.sources.map((s) => `${s.sourceName}: ${s.total} leads (${s.shareOfLeads}%)`));

  // 7. Test GET /api/v1/analytics/team-performance (Admin)
  console.log("\n7. Testing GET /api/v1/analytics/team-performance (Admin)...");
  const teamRes = await fetch(`${BASE_URL}/analytics/team-performance`, {
    headers: adminHeaders
  });
  const teamData = await teamRes.json();
  assert.strictEqual(teamRes.status, 200, `Team performance failed: ${JSON.stringify(teamData)}`);
  assert(teamData.data.teamMembersCount >= 1, "Should list team members");
  assert(Array.isArray(teamData.data.performance), "Performance should be an array");
  console.log(`✔ Team performance returned ${teamData.data.teamMembersCount} user(s):`);
  teamData.data.performance.forEach((p) => {
    console.log(`   - ${p.user.name} (${p.user.email}): Leads=${p.leads.total}, Deals Won=${p.deals.won}, Rev=$${p.deals.wonRevenue}, Acts Done=${p.activities.completed}`);
  });

  // 8. Test RBAC: Sales Executive should get 403 on team-performance
  console.log("\n8. Testing RBAC on GET /api/v1/analytics/team-performance as Executive (expect 403)...");
  const execTeamRes = await fetch(`${BASE_URL}/analytics/team-performance`, {
    headers: execHeaders
  });
  assert.strictEqual(execTeamRes.status, 403, "Executive should receive 403 Forbidden");
  console.log("✔ Correctly received 403 Forbidden for Sales Executive");

  // 9. Test Scoped Summary for Sales Executive (only executive's data, which is currently 0)
  console.log("\n9. Testing GET /api/v1/analytics/summary as Sales Executive (scoped to self)...");
  const execSummaryRes = await fetch(`${BASE_URL}/analytics/summary`, {
    headers: execHeaders
  });
  const execSummaryData = await execSummaryRes.json();
  assert.strictEqual(execSummaryRes.status, 200);
  assert.strictEqual(execSummaryData.data.leads.total, 0, "Executive has 0 assigned leads");
  assert.strictEqual(execSummaryData.data.deals.total, 0, "Executive has 0 assigned deals");
  assert.strictEqual(execSummaryData.data.activities.total, 0, "Executive has 0 assigned activities");
  console.log("✔ Sales Executive correctly scoped to own data (0 totals)");

  // 10. Test Date Range filtering
  console.log("\n10. Testing date range filter on /api/v1/analytics/summary...");
  const pastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const futureYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const dateFilterRes = await fetch(`${BASE_URL}/analytics/summary?startDate=${pastYear}&endDate=${futureYear}`, {
    headers: adminHeaders
  });
  const dateFilterData = await dateFilterRes.json();
  assert.strictEqual(dateFilterRes.status, 200);
  assert.strictEqual(dateFilterData.data.leads.total, summaryData.data.leads.total, "Full date range matches total leads");
  console.log("✔ Date range filtering verified successfully");

  console.log("\n========================================================");
  console.log("🎉 ALL PHASE 5 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
