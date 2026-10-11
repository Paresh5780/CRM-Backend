import assert from "node:assert";
import { TIMELINE_ACTIONS } from "./src/utils/usedConstants.js";

const BASE_URL = "http://localhost:5000/api/v1";

async function runTests() {
  console.log("=== STARTING PHASE 4 INTEGRATION TESTS ===");

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

  // 2. Create a test lead
  console.log("\n2. Creating a test Lead for Activity and Timeline testing...");
  const leadRes = await fetch(`${BASE_URL}/leads`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase 4 Test Lead",
      email: `phase4_${Date.now()}@test.com`,
      phone: "+91 9876543210",
      company: "Phase 4 Enterprise",
      source: 1 // WEBSITE
    })
  });
  const leadData = await leadRes.json();
  assert.strictEqual(leadRes.status, 201, `Lead creation failed: ${JSON.stringify(leadData)}`);
  const leadId = leadData.data.lead._id;
  console.log(`✔ Lead created with ID: ${leadId}`);

  // 3. Check Lead Timeline
  console.log("\n3. Fetching Timeline for the new Lead (GET /api/v1/timeline/1/:leadId)...");
  await new Promise((r) => setTimeout(r, 100));
  const leadTimelineRes = await fetch(`${BASE_URL}/timeline/1/${leadId}`, {
    headers: adminHeaders
  });
  const leadTimelineData = await leadTimelineRes.json();
  assert.strictEqual(leadTimelineRes.status, 200);
  assert(leadTimelineData.data.timeline.length >= 1, "Timeline should contain LEAD_CREATED event");
  console.log(`✔ Lead Timeline contains ${leadTimelineData.data.timeline.length} event(s). First event action: ${leadTimelineData.data.timeline[0].action}`);

  // 4. Create an Activity for Lead (due date in future -> PENDING)
  console.log("\n4. Creating an Activity (CALL) with future due date...");
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const act1Res = await fetch(`${BASE_URL}/activities`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      type: 1, // CALL
      title: "Discovery Call with Lead",
      description: "Discuss project requirements and budget",
      entityType: 1, // LEAD
      entityId: leadId,
      dueDate: futureDate
    })
  });
  const act1Data = await act1Res.json();
  assert.strictEqual(act1Res.status, 201, `Create activity failed: ${JSON.stringify(act1Data)}`);
  const act1 = act1Data.data.activity;
  assert.strictEqual(act1.status, 1); // PENDING
  assert.strictEqual(act1.computedStatus, 1); // Not overdue -> 1 (PENDING)
  console.log(`✔ Activity created with ID: ${act1._id}, computedStatus: ${act1.computedStatus} (PENDING)`);

  // 5. Create an Activity with PAST due date -> should compute as OVERDUE (3)
  console.log("\n5. Creating an Activity with PAST due date to test OVERDUE virtual computation...");
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const act2Res = await fetch(`${BASE_URL}/activities`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      type: 2, // EMAIL
      title: "Follow-up email overdue",
      description: "Send proposal recap email",
      entityType: 1, // LEAD
      entityId: leadId,
      dueDate: pastDate
    })
  });
  const act2Data = await act2Res.json();
  assert.strictEqual(act2Res.status, 201);
  const act2 = act2Data.data.activity;
  assert.strictEqual(act2.status, 1); // Stored as PENDING
  assert.strictEqual(act2.computedStatus, 3); // Computed dynamically as OVERDUE!
  console.log(`✔ Overdue Activity created! Stored status: ${act2.status}, computedStatus: ${act2.computedStatus} (OVERDUE)`);

  // 6. Test GET /api/v1/activities with query filtering
  console.log("\n6. Listing Activities with filters (entityType=1, entityId=leadId)...");
  const listRes = await fetch(`${BASE_URL}/activities?entityType=1&entityId=${leadId}`, {
    headers: adminHeaders
  });
  const listData = await listRes.json();
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listData.data.activities.length, 2);
  console.log(`✔ Successfully listed ${listData.data.activities.length} activities for Lead`);

  // 7. Test overdue filter
  console.log("\n7. Listing Activities with overdue=true filter...");
  const overdueListRes = await fetch(`${BASE_URL}/activities?entityType=1&entityId=${leadId}&overdue=true`, {
    headers: adminHeaders
  });
  const overdueListData = await overdueListRes.json();
  assert.strictEqual(overdueListRes.status, 200);
  assert.strictEqual(overdueListData.data.activities.length, 1);
  assert.strictEqual(overdueListData.data.activities[0]._id, act2._id);
  console.log(`✔ Overdue filter verified! Only overdue activity returned.`);

  // 8. Test Update Activity
  console.log("\n8. Updating Activity title and description...");
  const updateRes = await fetch(`${BASE_URL}/activities/${act1._id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      title: "Discovery Call - Updated with Agenda",
      description: "Client interested in enterprise tier"
    })
  });
  const updateData = await updateRes.json();
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateData.data.activity.title, "Discovery Call - Updated with Agenda");
  console.log("✔ Activity updated successfully");

  // 9. Test Complete Activity (PATCH /:id/complete)
  console.log("\n9. Completing Activity (PATCH /api/v1/activities/:id/complete)...");
  const completeRes = await fetch(`${BASE_URL}/activities/${act1._id}/complete`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      notes: "Call finished. Customer agreed to demo."
    })
  });
  const completeData = await completeRes.json();
  assert.strictEqual(completeRes.status, 200);
  const completedAct = completeData.data.activity;
  assert.strictEqual(completedAct.status, 2); // COMPLETED
  assert.strictEqual(completedAct.computedStatus, 2); // COMPLETED
  assert(completedAct.completedAt, "completedAt should be timestamped");
  console.log(`✔ Activity completed! Status: ${completedAct.status}, completedAt: ${completedAct.completedAt}`);

  // 10. Check Timeline for Activity Completed event
  console.log("\n10. Checking Timeline for Activity Completed event...");
  await new Promise((r) => setTimeout(r, 100));
  const leadTimelineRes2 = await fetch(`${BASE_URL}/timeline/1/${leadId}`, {
    headers: adminHeaders
  });
  const leadTimelineData2 = await leadTimelineRes2.json();
  const timelineActions = leadTimelineData2.data.timeline.map((t) => t.action);
  console.log("✔ Lead Timeline events so far:", timelineActions);
  assert(timelineActions.includes(TIMELINE_ACTIONS.ACTIVITY_CREATED), "Should contain ACTIVITY_CREATED");
  assert(timelineActions.includes(TIMELINE_ACTIONS.ACTIVITY_COMPLETED), "Should contain ACTIVITY_COMPLETED");

  // 11. Convert Lead and check Customer & Deal Timelines
  console.log("\n11. Converting Lead to Customer & Deal, then checking Timeline audit logs...");
  await fetch(`${BASE_URL}/leads/${leadId}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: 3 }) // QUALIFIED
  });

  const convertRes = await fetch(`${BASE_URL}/leads/${leadId}/convert`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      dealName: "Phase 4 Enterprise License",
      dealValue: 75000,
      expectedClosingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  });
  const convertData = await convertRes.json();
  assert.strictEqual(convertRes.status, 201, `Convert failed: ${JSON.stringify(convertData)}`);
  const customerId = convertData.data.customer._id;
  const dealId = convertData.data.deal._id;
  console.log(`✔ Lead converted! Customer ID: ${customerId}, Deal ID: ${dealId}`);

  await new Promise((r) => setTimeout(r, 150));

  // Check Customer Timeline (entityType = 2)
  const custTimelineRes = await fetch(`${BASE_URL}/timeline/2/${customerId}`, {
    headers: adminHeaders
  });
  const custTimelineData = await custTimelineRes.json();
  assert.strictEqual(custTimelineRes.status, 200);
  assert(custTimelineData.data.timeline.length >= 1, "Customer timeline should have CUSTOMER_CREATED event");
  console.log(`✔ Customer Timeline contains ${custTimelineData.data.timeline.length} event(s). Action: ${custTimelineData.data.timeline[0].action}`);

  // Check Deal Timeline (entityType = 3)
  const dealTimelineRes = await fetch(`${BASE_URL}/timeline/3/${dealId}`, {
    headers: adminHeaders
  });
  const dealTimelineData = await dealTimelineRes.json();
  assert.strictEqual(dealTimelineRes.status, 200);
  assert(dealTimelineData.data.timeline.length >= 1, "Deal timeline should have DEAL_CREATED event");
  console.log(`✔ Deal Timeline contains ${dealTimelineData.data.timeline.length} event(s). Action: ${dealTimelineData.data.timeline[0].action}`);

  // 12. Update Deal stage and check stage changed in timeline
  console.log("\n12. Updating Deal stage to PROPOSAL (3) and checking deal timeline...");
  const stageRes = await fetch(`${BASE_URL}/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ stage: 3 })
  });
  assert.strictEqual(stageRes.status, 200);

  await new Promise((r) => setTimeout(r, 100));
  const dealTimelineRes2 = await fetch(`${BASE_URL}/timeline/3/${dealId}`, {
    headers: adminHeaders
  });
  const dealTimelineData2 = await dealTimelineRes2.json();
  const dealActions = dealTimelineData2.data.timeline.map((t) => t.action);
  console.log("✔ Deal Timeline events:", dealActions);
  assert(dealActions.includes(TIMELINE_ACTIONS.DEAL_STAGE_CHANGED), "Should contain DEAL_STAGE_CHANGED");

  // 13. Delete Activity (Admin/Manager allowed)
  console.log("\n13. Deleting overdue activity (DELETE /api/v1/activities/:id)...");
  const deleteRes = await fetch(`${BASE_URL}/activities/${act2._id}`, {
    method: "DELETE",
    headers: adminHeaders
  });
  const deleteData = await deleteRes.json();
  assert.strictEqual(deleteRes.status, 200);
  console.log("✔ Activity deleted successfully!");

  console.log("\n========================================================");
  console.log("🎉 ALL PHASE 4 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
