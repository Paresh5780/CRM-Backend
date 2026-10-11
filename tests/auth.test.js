import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { request, loginAsAdmin } from "./helpers.js";

describe("Auth Routes", () => {
  let adminToken;

  before(async () => {
    adminToken = await loginAsAdmin();
  });

  it("POST /auth/login — success with valid credentials", async () => {
    const res = await request("POST", "/auth/login", {
      email: "admin@crm.com",
      password: "AdminPassword123!"
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken, "accessToken should be present");
    assert.ok(res.body.data.refreshToken, "refreshToken should be present");
  });

  it("POST /auth/login — 401 on wrong password", async () => {
    const res = await request("POST", "/auth/login", {
      email: "admin@crm.com",
      password: "wrongpassword"
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it("POST /auth/login — 400 on missing email", async () => {
    const res = await request("POST", "/auth/login", { password: "AdminPassword123!" });
    assert.equal(res.status, 400);
  });

  it("POST /auth/refresh-token — returns new accessToken", async () => {
    const loginRes = await request("POST", "/auth/login", {
      email: "admin@crm.com",
      password: "AdminPassword123!"
    });
    const { refreshToken } = loginRes.body.data;

    const res = await request("POST", "/auth/refresh-token", { refreshToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken, "new accessToken should be returned");
  });

  it("POST /auth/refresh-token — 401 on invalid token", async () => {
    const res = await request("POST", "/auth/refresh-token", { refreshToken: "notavalidtoken" });
    assert.equal(res.status, 401);
  });

  it("GET /health — 401 without auth token on protected routes", async () => {
    const res = await request("GET", "/leads");
    assert.equal(res.status, 401);
  });

  it("Protected route — 200 with valid token", async () => {
    const res = await request("GET", "/leads", null, adminToken);
    assert.equal(res.status, 200);
  });
});
