import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { request, loginAsAdmin } from "./helpers.js";

/**
 * Lead Conversion Transaction Tests
 * Verifies the atomic Lead → Customer + Deal conversion flow and all business rules.
 */

describe("Lead Conversion — Transaction & Business Rules", () => {
  let adminToken;
  const timestamp = Date.now();

  before(async () => {
    adminToken = await loginAsAdmin();
  });

  describe("Pre-conversion validations", () => {
    it("Cannot convert a NEW lead (not qualified)", async () => {
      const createRes = await request("POST", "/leads", {
        name: `New Lead ${timestamp}`,
        email: `new_lead_${timestamp}@test.com`,
        source: 1,
        status: 1
      }, adminToken);
      assert.equal(createRes.status, 201);
      const leadId = createRes.body.data.lead._id;

      const convertRes = await request("POST", `/leads/${leadId}/convert`, {
        dealValue: 10000
      }, adminToken);
      assert.equal(convertRes.status, 400);
      assert.ok(convertRes.body.message.toLowerCase().includes("qualified"), "Error should mention 'qualified'");
    });

    it("Cannot convert a LOST lead", async () => {
      const createRes = await request("POST", "/leads", {
        name: `Lost Lead ${timestamp}`,
        email: `lost_lead_${timestamp}@test.com`,
        source: 1,
        status: 6
      }, adminToken);
      assert.equal(createRes.status, 201);
      const leadId = createRes.body.data.lead._id;

      const convertRes = await request("POST", `/leads/${leadId}/convert`, {
        dealValue: 10000
      }, adminToken);
      assert.equal(convertRes.status, 400);
    });
  });

  describe("Successful conversion flow", () => {
    let qualifiedLeadId;
    let createdCustomerId;
    let createdDealId;

    before(async () => {
      // Create + qualify a lead
      const createRes = await request("POST", "/leads", {
        name: `Qualified Lead ${timestamp}`,
        email: `qual_lead_${timestamp}@test.com`,
        company: "Convert Corp",
        source: 1
      }, adminToken);
      assert.equal(createRes.status, 201);
      qualifiedLeadId = createRes.body.data.lead._id;

      const statusRes = await request("PATCH", `/leads/${qualifiedLeadId}/status`, { status: 3 }, adminToken);
      assert.equal(statusRes.status, 200);
    });

    it("Converts a Qualified lead → Customer + Deal atomically", async () => {
      const res = await request("POST", `/leads/${qualifiedLeadId}/convert`, {
        dealName: "Convert Corp Enterprise Deal",
        dealValue: 75000,
        stage: 3,
        address: "123 Enterprise Blvd"
      }, adminToken);

      assert.equal(res.status, 201, `Conversion failed: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.data.lead, "Response should include lead");
      assert.ok(res.body.data.customer, "Response should include customer");
      assert.ok(res.body.data.deal, "Response should include deal");

      assert.equal(res.body.data.lead.status, 5, "Lead status should be 5 (Converted)");

      createdCustomerId = res.body.data.customer._id;
      createdDealId = res.body.data.deal._id;
    });

    it("Lead status is CONVERTED (5) after conversion", async () => {
      const res = await request("GET", `/leads/${qualifiedLeadId}`, null, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.lead.status, 5);
    });

    it("Customer was created with correct data", async () => {
      const res = await request("GET", `/customers/${createdCustomerId}`, null, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.customer.email, `qual_lead_${timestamp}@test.com`);
      assert.equal(res.body.data.customer.company, "Convert Corp");
    });

    it("Deal was created with correct value and stage", async () => {
      const res = await request("GET", `/deals/${createdDealId}`, null, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.deal.value, 75000);
      assert.equal(res.body.data.deal.stage, 3);
    });

    it("Deal expectedRevenue is auto-computed (value × probability / 100)", async () => {
      const res = await request("GET", `/deals/${createdDealId}`, null, adminToken);
      assert.equal(res.status, 200);
      const deal = res.body.data.deal;
      const expected = Math.round(deal.value * (deal.probability / 100) * 100) / 100;
      assert.equal(deal.expectedRevenue, expected, "expectedRevenue should equal value × probability / 100");
    });

    it("Cannot convert the same lead twice (already converted)", async () => {
      const res = await request("POST", `/leads/${qualifiedLeadId}/convert`, {
        dealValue: 50000
      }, adminToken);
      assert.equal(res.status, 400);
      assert.ok(res.body.message.toLowerCase().includes("converted"));
    });

    it("Cannot update a converted lead", async () => {
      const res = await request("PUT", `/leads/${qualifiedLeadId}`, {
        company: "New Company"
      }, adminToken);
      assert.equal(res.status, 400);
    });

    it("Timeline has LEAD_CONVERTED entry after conversion", async () => {
      const res = await request("GET", `/timeline/1/${qualifiedLeadId}`, null, adminToken);
      assert.equal(res.status, 200);
      const actions = res.body.data.timeline.map(e => e.action);
      assert.ok(actions.includes("LEAD_CONVERTED"), "Timeline should include LEAD_CONVERTED");
    });
  });
});
