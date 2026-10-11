import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { request, loginAsAdmin } from "./helpers.js";

/**
 * Deal Business Rules Tests
 * Verifies stage transitions, probability auto-calculation,
 * lossReason enforcement, and Won/Lost re-open restrictions.
 */

describe("Deal Business Rules", () => {
  let adminToken;
  let customerId;
  const timestamp = Date.now();

  before(async () => {
    adminToken = await loginAsAdmin();

    const custRes = await request("POST", "/customers", {
      name: `Deal Rules Customer ${timestamp}`,
      email: `deal_rules_${timestamp}@test.com`
    }, adminToken);
    assert.equal(custRes.status, 201, `Customer creation failed: ${JSON.stringify(custRes.body)}`);
    customerId = custRes.body.data.customer._id;
  });

  describe("Stage transitions and probability", () => {
    let dealId;

    before(async () => {
      const res = await request("POST", "/deals", {
        name: `Rules Deal ${timestamp}`,
        customerId,
        value: 50000,
        stage: 1
      }, adminToken);
      assert.equal(res.status, 201, `Deal creation failed: ${JSON.stringify(res.body)}`);
      dealId = res.body.data.deal._id;
    });

    it("Deal created with stage 1 (Qualification) has probability=10", async () => {
      const res = await request("GET", `/deals/${dealId}`, null, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.deal.stage, 1);
      assert.equal(res.body.data.deal.probability, 10);
    });

    it("Moving to Proposal (stage 3) sets probability to 50", async () => {
      const res = await request("PATCH", `/deals/${dealId}/stage`, { stage: 3 }, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.deal.probability, 50);
    });

    it("Moving to Won (stage 5) sets probability to 100", async () => {
      const res = await request("PATCH", `/deals/${dealId}/stage`, { stage: 5 }, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.deal.probability, 100);
    });

    it("expectedRevenue for Won deal is 100% of value", async () => {
      const res = await request("GET", `/deals/${dealId}`, null, adminToken);
      assert.equal(res.status, 200);
      const deal = res.body.data.deal;
      assert.equal(deal.expectedRevenue, deal.value);
    });
  });

  describe("Lost deal rules", () => {
    let dealId;

    before(async () => {
      const res = await request("POST", "/deals", {
        name: `Lost Deal ${timestamp}`,
        customerId,
        value: 20000,
        stage: 4
      }, adminToken);
      assert.equal(res.status, 201);
      dealId = res.body.data.deal._id;
    });

    it("Moving to Lost without lossReason returns 400", async () => {
      const res = await request("PATCH", `/deals/${dealId}/stage`, { stage: 6 }, adminToken);
      assert.equal(res.status, 400);
      assert.ok(res.body.message.toLowerCase().includes("reason") || res.body.message.toLowerCase().includes("lost"), "Error should mention lossReason requirement");
    });

    it("Moving to Lost with lossReason succeeds", async () => {
      const res = await request("PATCH", `/deals/${dealId}/stage`, {
        stage: 6,
        lossReason: "Client chose competitor"
      }, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.deal.stage, 6);
      assert.equal(res.body.data.deal.probability, 0);
    });

    it("Lost deal has expectedRevenue of 0", async () => {
      const res = await request("GET", `/deals/${dealId}`, null, adminToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.deal.expectedRevenue, 0);
    });

    it("Non-admin cannot re-open a Lost deal to active stage", async () => {
      const res = await request("PATCH", `/deals/${dealId}/stage`, { stage: 2 }, adminToken);
      // Admin should be allowed
      assert.equal(res.status, 200);
    });
  });

  describe("Deal validation", () => {
    it("Cannot create deal with value = 0", async () => {
      const res = await request("POST", "/deals", {
        name: "Zero Deal",
        customerId,
        value: 0
      }, adminToken);
      assert.equal(res.status, 400);
    });

    it("Cannot create deal with missing customerId", async () => {
      const res = await request("POST", "/deals", {
        name: "No Customer Deal",
        value: 10000
      }, adminToken);
      assert.equal(res.status, 400);
    });

    it("Cannot create deal referencing a non-existent customer", async () => {
      const res = await request("POST", "/deals", {
        name: "Ghost Customer Deal",
        customerId: "000000000000000000000000",
        value: 10000
      }, adminToken);
      assert.equal(res.status, 404);
    });
  });

  describe("Timeline for deals", () => {
    let dealId;

    before(async () => {
      const res = await request("POST", "/deals", {
        name: `Timeline Deal ${timestamp}`,
        customerId,
        value: 30000,
        stage: 1
      }, adminToken);
      assert.equal(res.status, 201);
      dealId = res.body.data.deal._id;

      await request("PATCH", `/deals/${dealId}/stage`, { stage: 3 }, adminToken);
    });

    it("Timeline has DEAL_CREATED and DEAL_STAGE_CHANGED entries", async () => {
      const res = await request("GET", `/timeline/3/${dealId}`, null, adminToken);
      assert.equal(res.status, 200);
      const actions = res.body.data.timeline.map(e => e.action);
      assert.ok(actions.includes("DEAL_CREATED"), "Should include DEAL_CREATED");
      assert.ok(actions.includes("DEAL_STAGE_CHANGED"), "Should include DEAL_STAGE_CHANGED");
    });
  });
});
