/**
 * Phase 3 Route Verification Script
 * Tests Lead Conversion, Customer Management, Deal Management & Business Rules
 */

import {
  ROLES,
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  CUSTOMER_STATUSES,
  DEAL_STAGES
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
  console.log("=== STARTING PHASE 3 LEAD CONVERSION, CUSTOMER & DEAL TESTS ===");
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

  // 2. Setup Manager Priya & Executives Rahul and Sneha
  const ts = Date.now();
  const managerRes = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Priya Manager",
      email: `mgr_${ts}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_MANAGER
    })
  });
  const managerId = managerRes.data.data.user._id;

  const rahulRes = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Rahul Exec",
      email: `rahul_${ts}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_EXECUTIVE,
      managerId
    })
  });
  const rahulId = rahulRes.data.data.user._id;

  const snehaRes = await request("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Sneha Exec",
      email: `sneha_${ts}@crm.com`,
      password: "Password123!",
      role: ROLES.SALES_EXECUTIVE,
      managerId
    })
  });
  const snehaId = snehaRes.data.data.user._id;

  // Login tokens
  const rahulLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `rahul_${ts}@crm.com`, password: "Password123!" })
  });
  const rahulToken = rahulLogin.data.data.accessToken;

  const snehaLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `sneha_${ts}@crm.com`, password: "Password123!" })
  });
  const snehaToken = snehaLogin.data.data.accessToken;

  // 3. Rahul creates a Lead (status defaults to NEW)
  const leadRes = await request("/leads", {
    method: "POST",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({
      name: "Alice Stark",
      email: `alice_${ts}@starkindustries.com`,
      company: "Stark Industries",
      phone: "+1-987-654-3210",
      description: "Interested in Cloud Infrastructure ERP"
    })
  });
  assert(leadRes.status === 201, "Lead created by Rahul (status: NEW)");
  const leadId = leadRes.data.data.lead._id;

  // 4. Conversion Guard: Try converting a lead that is still in status NEW -> 400
  const earlyConvert = await request(`/leads/${leadId}/convert`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({
      dealName: "Stark Cloud ERP Deal",
      dealValue: 50000
    })
  });
  assert(earlyConvert.status === 400, "Conversion Guard: Reject converting non-qualified lead (400 Bad Request)");

  // 5. Qualify Lead
  const qualifyRes = await request(`/leads/${leadId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ status: LEAD_STATUSES.QUALIFIED })
  });
  assert(qualifyRes.status === 200 && qualifyRes.data.data.lead.status === LEAD_STATUSES.QUALIFIED, "Rahul qualifies Lead (status: QUALIFIED)");

  // 6. Atomic Lead Conversion (POST /leads/:id/convert)
  const convertRes = await request(`/leads/${leadId}/convert`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({
      dealName: "Stark Cloud ERP",
      dealValue: 50000,
      expectedClosingDate: "2026-12-15T00:00:00.000Z",
      address: "10880 Wilshire Blvd, Los Angeles, CA"
    })
  });
  assert(convertRes.status === 201 && convertRes.data.data.customer && convertRes.data.data.deal, "Atomic Lead Conversion creates Customer and Deal");
  const customerId = convertRes.data.data.customer._id;
  const dealId = convertRes.data.data.deal._id;

  // Verify relationships and fields
  assert(convertRes.data.data.customer.leadId === leadId, "Customer references original Lead ID");
  assert(convertRes.data.data.deal.leadId === leadId, "Deal references original Lead ID");
  assert(convertRes.data.data.deal.customerId === customerId, "Deal references Customer ID");
  assert(convertRes.data.data.lead.status === LEAD_STATUSES.CONVERTED, "Lead status updated to CONVERTED");

  // 7. Prevent Double-Conversion
  const doubleConvert = await request(`/leads/${leadId}/convert`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ dealName: "Second Deal", dealValue: 20000 })
  });
  assert(doubleConvert.status === 400, "Conversion Guard: Prevent converting already converted lead");

  // 8. Prevent modifying converted lead
  const modifyConverted = await request(`/leads/${leadId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ name: "Modified Name" })
  });
  assert(modifyConverted.status === 400, "Immutability Guard: Cannot modify already converted lead");

  // 9. Customer Data Isolation
  const rahulCustomers = await request("/customers", {
    headers: { Authorization: `Bearer ${rahulToken}` }
  });
  assert(rahulCustomers.status === 200 && rahulCustomers.data.data.customers.some(c => c._id === customerId), "Rahul sees own Customer in GET /customers");

  const snehaCustomers = await request("/customers", {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(snehaCustomers.status === 200 && !snehaCustomers.data.data.customers.some(c => c._id === customerId), "Data Isolation: Sneha does NOT see Rahul's customer");

  const sneakCustomer = await request(`/customers/${customerId}`, {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(sneakCustomer.status === 403, "Access Guard: Sneha gets 403 Forbidden on Rahul's customer by ID");

  // 10. Update Customer Details
  const updateCust = await request(`/customers/${customerId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ phone: "+1-999-888-7777" })
  });
  assert(updateCust.status === 200 && updateCust.data.data.customer.phone === "+1-999-888-7777", "Rahul updates Customer details");

  // 11. Deal Data Isolation
  const rahulDeals = await request("/deals", {
    headers: { Authorization: `Bearer ${rahulToken}` }
  });
  assert(rahulDeals.status === 200 && rahulDeals.data.data.deals.some(d => d._id === dealId), "Rahul sees own Deal in GET /deals");

  const snehaDeals = await request("/deals", {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(snehaDeals.status === 200 && !snehaDeals.data.data.deals.some(d => d._id === dealId), "Data Isolation: Sneha does NOT see Rahul's deal");

  const sneakDeal = await request(`/deals/${dealId}`, {
    headers: { Authorization: `Bearer ${snehaToken}` }
  });
  assert(sneakDeal.status === 403, "Access Guard: Sneha gets 403 Forbidden on Rahul's deal by ID");

  // 12. Deal Update & Revenue Recalculation
  const updateDealRes = await request(`/deals/${dealId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ value: 60000 })
  });
  assert(updateDealRes.status === 200 && updateDealRes.data.data.deal.expectedRevenue === 6000, "Deal value update recalculates expected revenue (60,000 * 10% = 6,000)");

  // 13. Deal Stage Progression to Proposal (Stage 3 = 50% probability)
  const proposalStageRes = await request(`/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ stage: DEAL_STAGES.PROPOSAL })
  });
  assert(proposalStageRes.status === 200 && proposalStageRes.data.data.deal.probability === 50 && proposalStageRes.data.data.deal.expectedRevenue === 30000, "Deal Stage Proposal sets probability to 50% and expectedRevenue to 30,000");

  // 14. Deal Closed Won (Stage 5 = 100% probability)
  const wonStageRes = await request(`/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ stage: DEAL_STAGES.WON })
  });
  assert(wonStageRes.status === 200 && wonStageRes.data.data.deal.probability === 100 && wonStageRes.data.data.deal.expectedRevenue === 60000, "Deal Stage Won sets probability to 100% and expectedRevenue to 60,000");

  // 15. Business Rule Guard: Prevent moving closed Won deal back to an active stage
  const revertWon = await request(`/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${rahulToken}` },
    body: JSON.stringify({ stage: DEAL_STAGES.PROPOSAL })
  });
  assert(revertWon.status === 400, "Business Rule Guard: Closed Won deal cannot move back to active stage (400 Bad Request)");

  // 16. Business Rule Guard: Lost deal requires lossReason
  const testDeal = await request("/deals", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: "Secondary Deal",
      customerId: customerId,
      value: 10000
    })
  });
  const testDealId = testDeal.data.data.deal._id;

  const lostNoReason = await request(`/deals/${testDealId}/stage`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ stage: DEAL_STAGES.LOST })
  });
  assert(lostNoReason.status === 400, "Business Rule Guard: Lost deal requires lossReason (400 Bad Request)");

  const lostWithReason = await request(`/deals/${testDealId}/stage`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ stage: DEAL_STAGES.LOST, lossReason: "Client chose competing open-source tool" })
  });
  assert(lostWithReason.status === 200 && lostWithReason.data.data.deal.probability === 0 && lostWithReason.data.data.deal.lossReason === "Client chose competing open-source tool", "Lost deal with valid reason succeeds (probability: 0)");

  // 17. Cleanup test deal and customer
  const delDeal = await request(`/deals/${testDealId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(delDeal.status === 200, "Admin deletes secondary test deal");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
