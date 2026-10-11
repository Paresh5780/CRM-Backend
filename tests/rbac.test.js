import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { request, loginAsAdmin, loginAs } from "./helpers.js";

/**
 * RBAC Permission Tests
 * Verifies that each role can only access what it is allowed to.
 */

describe("RBAC — Role-Based Access Control", () => {
  let adminToken;
  let managerToken;
  let execToken;
  let managerId;
  let execId;
  let exec2Id;

  const timestamp = Date.now();

  before(async () => {
    adminToken = await loginAsAdmin();

    // Create a Sales Manager
    const managerRes = await request("POST", "/users", {
      name: "Test Manager",
      email: `manager_rbac_${timestamp}@test.com`,
      password: "TestPass1!",
      role: 2
    }, adminToken);
    assert.equal(managerRes.status, 201, `Create manager failed: ${JSON.stringify(managerRes.body)}`);
    managerId = managerRes.body.data.user._id;

    // Create Sales Executive under that manager
    const execRes = await request("POST", "/users", {
      name: "Test Executive",
      email: `exec_rbac_${timestamp}@test.com`,
      password: "TestPass1!",
      role: 3,
      managerId
    }, adminToken);
    assert.equal(execRes.status, 201, `Create exec failed: ${JSON.stringify(execRes.body)}`);
    execId = execRes.body.data.user._id;

    // Create a second exec for deactivation test
    const exec2Res = await request("POST", "/users", {
      name: "Test Executive 2",
      email: `exec2_rbac_${timestamp}@test.com`,
      password: "TestPass1!",
      role: 3,
      managerId
    }, adminToken);
    assert.equal(exec2Res.status, 201);
    exec2Id = exec2Res.body.data.user._id;

    managerToken = await loginAs(`manager_rbac_${timestamp}@test.com`, "TestPass1!");
    execToken = await loginAs(`exec_rbac_${timestamp}@test.com`, "TestPass1!");
  });

  describe("User Management RBAC", () => {
    it("Admin — can create users", async () => {
      const res = await request("POST", "/users", {
        name: "Temp User",
        email: `temp_${timestamp}@test.com`,
        password: "TestPass1!",
        role: 3
      }, adminToken);
      assert.equal(res.status, 201);
    });

    it("Manager — cannot create users (403)", async () => {
      const res = await request("POST", "/users", {
        name: "Unauthorized",
        email: `unauth_${timestamp}@test.com`,
        password: "TestPass1!",
        role: 3
      }, managerToken);
      assert.equal(res.status, 403);
    });

    it("Executive — cannot create users (403)", async () => {
      const res = await request("POST", "/users", {
        name: "Unauthorized",
        email: `unauth2_${timestamp}@test.com`,
        password: "TestPass1!",
        role: 3
      }, execToken);
      assert.equal(res.status, 403);
    });

    it("Admin — can deactivate a user", async () => {
      const res = await request("DELETE", `/users/${exec2Id}`, null, adminToken);
      assert.equal(res.status, 200);
    });

    it("Manager — cannot deactivate a user (403)", async () => {
      const res = await request("DELETE", `/users/${exec2Id}`, null, managerToken);
      assert.equal(res.status, 403);
    });
  });

  describe("Leads RBAC", () => {
    let leadId;

    before(async () => {
      const res = await request("POST", "/leads", {
        name: `RBAC Lead ${timestamp}`,
        email: `rbac_lead_${timestamp}@test.com`,
        company: "RBAC Corp",
        source: 1,
        assignedTo: execId
      }, adminToken);
      assert.equal(res.status, 201, `Lead creation failed: ${JSON.stringify(res.body)}`);
      leadId = res.body.data.lead._id;
    });

    it("Admin — can assign leads", async () => {
      const res = await request("PATCH", `/leads/${leadId}/assign`, { assignedTo: execId }, adminToken);
      assert.equal(res.status, 200);
    });

    it("Manager — can assign team member's lead", async () => {
      const res = await request("PATCH", `/leads/${leadId}/assign`, { assignedTo: execId }, managerToken);
      assert.equal(res.status, 200);
    });

    it("Executive — cannot assign leads (403)", async () => {
      const res = await request("PATCH", `/leads/${leadId}/assign`, { assignedTo: execId }, execToken);
      assert.equal(res.status, 403);
    });

    it("Admin — can delete leads", async () => {
      const tmpLead = await request("POST", "/leads", {
        name: "Delete Me",
        email: `delete_${timestamp}@test.com`,
        source: 1,
        assignedTo: execId
      }, adminToken);
      assert.equal(tmpLead.status, 201);
      const delRes = await request("DELETE", `/leads/${tmpLead.body.data.lead._id}`, null, adminToken);
      assert.equal(delRes.status, 200);
    });

    it("Executive — cannot delete leads (403)", async () => {
      const res = await request("DELETE", `/leads/${leadId}`, null, execToken);
      assert.equal(res.status, 403);
    });
  });

  describe("Analytics RBAC", () => {
    it("Admin — can access team-performance", async () => {
      const res = await request("GET", "/analytics/team-performance", null, adminToken);
      assert.equal(res.status, 200);
    });

    it("Manager — can access team-performance", async () => {
      const res = await request("GET", "/analytics/team-performance", null, managerToken);
      assert.equal(res.status, 200);
    });

    it("Executive — cannot access team-performance (403)", async () => {
      const res = await request("GET", "/analytics/team-performance", null, execToken);
      assert.equal(res.status, 403);
    });
  });

  describe("Deal Stage RBAC", () => {
    let customerId;
    let wonDealId;

    before(async () => {
      const custRes = await request("POST", "/customers", {
        name: `RBAC Customer ${timestamp}`,
        email: `rbac_cust_${timestamp}@test.com`,
        assignedTo: execId
      }, adminToken);
      assert.equal(custRes.status, 201, `Customer creation failed: ${JSON.stringify(custRes.body)}`);
      customerId = custRes.body.data.customer._id;

      const dealRes = await request("POST", "/deals", {
        name: `RBAC Won Deal ${timestamp}`,
        customerId,
        value: 10000,
        stage: 5
      }, adminToken);
      assert.equal(dealRes.status, 201, `Deal creation failed: ${JSON.stringify(dealRes.body)}`);
      wonDealId = dealRes.body.data.deal._id;
    });

    it("Non-admin — cannot reopen a Won deal to active stage (400)", async () => {
      const res = await request("PATCH", `/deals/${wonDealId}/stage`, { stage: 1 }, managerToken);
      assert.equal(res.status, 400);
    });

    it("Admin — can reopen a Won deal to active stage", async () => {
      const res = await request("PATCH", `/deals/${wonDealId}/stage`, { stage: 1 }, adminToken);
      assert.equal(res.status, 200);
    });
  });
});
