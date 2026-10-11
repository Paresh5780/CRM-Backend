import mongoose from "mongoose";
import { Lead } from "../models/lead.model.js";
import { User } from "../models/user.model.js";
import { Customer } from "../models/customer.model.js";
import { Deal } from "../models/deal.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordTimeline } from "../utils/timelineHelper.js";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  ROLES,
  CUSTOMER_STATUSES,
  DEAL_STAGES,
  STAGE_DEFAULT_PROBABILITIES,
  ENTITY_TYPES,
  TIMELINE_ACTIONS
} from "../utils/usedConstants.js";

async function getManagerTeamIds(managerId) {
  const teamMembers = await User.find({ managerId }).select("_id");
  return [managerId.toString(), ...teamMembers.map((m) => m._id.toString())];
}

async function checkLeadAccess(user, lead) {
  if (user.role === ROLES.ADMIN) return true;

  const leadOwnerId = lead.assignedTo?._id
    ? lead.assignedTo._id.toString()
    : lead.assignedTo?.toString();

  if (user.role === ROLES.SALES_EXECUTIVE) {
    return leadOwnerId === user._id.toString();
  }

  if (user.role === ROLES.SALES_MANAGER) {
    if (!leadOwnerId) return true;
    const teamIds = await getManagerTeamIds(user._id);
    return teamIds.includes(leadOwnerId);
  }

  return false;
}

export const createLead = asyncHandler(async (req, res) => {
  const { name, email, phone, company, source, status, priority, assignedTo, description } = req.body;

  let assignedUserId = assignedTo || null;

  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    assignedUserId = req.user._id;
  } else if (assignedUserId) {
    const targetUser = await User.findById(assignedUserId);
    if (!targetUser || !targetUser.isActive) {
      throw new ApiError(400, "Assigned user does not exist or is inactive");
    }

    if (req.user.role === ROLES.SALES_MANAGER) {
      const teamIds = await getManagerTeamIds(req.user._id);
      if (!teamIds.includes(assignedUserId.toString())) {
        throw new ApiError(403, "Managers can only assign leads to their own team members");
      }
    }
  }

  const lead = await Lead.create({
    name,
    email,
    phone: phone || "",
    company: company || "",
    source: source ?? LEAD_SOURCES.WEBSITE,
    status: status ?? LEAD_STATUSES.NEW,
    priority: priority ?? LEAD_PRIORITIES.MEDIUM,
    assignedTo: assignedUserId,
    description: description || ""
  });

  const populatedLead = await Lead.findById(lead._id).populate("assignedTo", "name email role");

  recordTimeline({
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    action: TIMELINE_ACTIONS.LEAD_CREATED,
    performedBy: req.user._id,
    newValue: { name: lead.name, status: lead.status, source: lead.source }
  });

  return apiResponse(res, {
    statusCode: 201,
    message: "Lead created successfully",
    data: { lead: populatedLead }
  });
});

export const getLeads = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    search,
    status,
    priority,
    source,
    assignedTo,
    startDate,
    endDate,
    sortBy,
    sortOrder
  } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  if (status !== undefined) filter.status = status;
  if (priority !== undefined) filter.priority = priority;
  if (source !== undefined) filter.source = source;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    filter.assignedTo = req.user._id;
  } else if (req.user.role === ROLES.SALES_MANAGER) {
    const teamIds = await getManagerTeamIds(req.user._id);
    if (assignedTo) {
      if (!teamIds.includes(assignedTo)) {
        throw new ApiError(403, "You can only query leads assigned to your team members");
      }
      filter.assignedTo = assignedTo;
    } else {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { assignedTo: { $in: teamIds } },
          { assignedTo: null }
        ]
      });
    }
  } else if (req.user.role === ROLES.ADMIN && assignedTo) {
    filter.assignedTo = assignedTo;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [leads, totalRecords] = await Promise.all([
    Lead.find(filter)
      .populate("assignedTo", "name email role")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return apiResponse(res, {
    statusCode: 200,
    message: "Leads fetched successfully",
    data: { leads },
    meta: {
      page,
      limit,
      totalRecords,
      totalPages
    }
  });
});

export const getLeadById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const lead = await Lead.findById(id).populate("assignedTo", "name email role");
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  const hasAccess = await checkLeadAccess(req.user, lead);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to view this lead");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "Lead fetched successfully",
    data: { lead }
  });
});

export const updateLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  const hasAccess = await checkLeadAccess(req.user, lead);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to modify this lead");
  }

  if (lead.status === LEAD_STATUSES.CONVERTED) {
    throw new ApiError(400, "Cannot modify a lead that has already been converted");
  }

  const allowedFields = ["name", "email", "phone", "company", "source", "status", "priority", "description"];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      lead[field] = updates[field];
    }
  });

  await lead.save();

  const populatedLead = await Lead.findById(lead._id).populate("assignedTo", "name email role");

  recordTimeline({
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    action: TIMELINE_ACTIONS.LEAD_UPDATED,
    performedBy: req.user._id,
    newValue: updates
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Lead updated successfully",
    data: { lead: populatedLead }
  });
});

export const updateLeadStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  const hasAccess = await checkLeadAccess(req.user, lead);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to update this lead's status");
  }

  if (lead.status === LEAD_STATUSES.CONVERTED) {
    throw new ApiError(400, "Cannot change status of an already converted lead");
  }

  const previousStatus = lead.status;
  lead.status = status;
  await lead.save();

  recordTimeline({
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    action: TIMELINE_ACTIONS.LEAD_STATUS_CHANGED,
    performedBy: req.user._id,
    previousValue: { status: previousStatus },
    newValue: { status }
  });

  return apiResponse(res, {
    statusCode: 200,
    message: `Lead status updated to '${status}' successfully`,
    data: { lead }
  });
});

export const assignLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  if (lead.status === LEAD_STATUSES.CONVERTED) {
    throw new ApiError(400, "Cannot reassign a converted lead");
  }

  if (req.user.role === ROLES.SALES_MANAGER) {
    const hasAccess = await checkLeadAccess(req.user, lead);
    if (!hasAccess) {
      throw new ApiError(403, "Forbidden: You can only reassign leads within your team");
    }
  }

  if (assignedTo) {
    const targetUser = await User.findById(assignedTo);
    if (!targetUser || !targetUser.isActive) {
      throw new ApiError(400, "Target user does not exist or is inactive");
    }

    if (req.user.role === ROLES.SALES_MANAGER) {
      const teamIds = await getManagerTeamIds(req.user._id);
      if (!teamIds.includes(assignedTo)) {
        throw new ApiError(403, "Managers can only assign leads to members of their own team");
      }
    }
  }

  const previousAssignedTo = lead.assignedTo;
  lead.assignedTo = assignedTo || null;
  await lead.save();

  const populatedLead = await Lead.findById(lead._id).populate("assignedTo", "name email role");

  recordTimeline({
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    action: TIMELINE_ACTIONS.LEAD_ASSIGNED,
    performedBy: req.user._id,
    previousValue: { assignedTo: previousAssignedTo },
    newValue: { assignedTo: assignedTo || null }
  });

  return apiResponse(res, {
    statusCode: 200,
    message: assignedTo ? "Lead assigned successfully" : "Lead unassigned successfully",
    data: { lead: populatedLead }
  });
});

export const deleteLead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  if (req.user.role === ROLES.SALES_MANAGER) {
    const hasAccess = await checkLeadAccess(req.user, lead);
    if (!hasAccess) {
      throw new ApiError(403, "Forbidden: You cannot delete a lead outside your team");
    }
  }

  await Lead.findByIdAndDelete(id);

  return apiResponse(res, {
    statusCode: 200,
    message: "Lead deleted successfully",
    data: null
  });
});

export const convertLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dealName, dealValue, stage, probability, expectedClosingDate, address } = req.body;

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  const hasAccess = await checkLeadAccess(req.user, lead);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to convert this lead");
  }

  if (lead.status === LEAD_STATUSES.CONVERTED) {
    throw new ApiError(400, "This lead has already been converted");
  }

  if (lead.status !== LEAD_STATUSES.QUALIFIED) {
    throw new ApiError(400, "Only qualified leads can be converted into customer and deal");
  }

  const session = await mongoose.startSession();
  let createdCustomer, createdDeal;

  try {
    await session.withTransaction(async () => {
      const [customer] = await Customer.create(
        [
          {
            name: lead.name,
            email: lead.email,
            phone: lead.phone || "",
            company: lead.company || "",
            address: address || "",
            leadId: lead._id,
            assignedTo: lead.assignedTo || req.user._id,
            status: CUSTOMER_STATUSES.ACTIVE
          }
        ],
        { session }
      );
      createdCustomer = customer;

      const dealStage = stage || DEAL_STAGES.QUALIFICATION;
      const dealProbability = probability ?? STAGE_DEFAULT_PROBABILITIES[dealStage];

      const [deal] = await Deal.create(
        [
          {
            name: dealName || `${lead.company || lead.name} Deal`,
            leadId: lead._id,
            customerId: customer._id,
            assignedTo: lead.assignedTo || req.user._id,
            value: dealValue,
            stage: dealStage,
            probability: dealProbability,
            expectedClosingDate: expectedClosingDate ? new Date(expectedClosingDate) : null,
            description: lead.description || ""
          }
        ],
        { session }
      );
      createdDeal = deal;

      lead.status = LEAD_STATUSES.CONVERTED;
      lead.convertedCustomerId = customer._id;
      lead.convertedDealId = deal._id;
      await lead.save({ session });
    });
  } catch (error) {
    if (error.message && error.message.includes("replica set")) {
      const customer = await Customer.create({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || "",
        company: lead.company || "",
        address: address || "",
        leadId: lead._id,
        assignedTo: lead.assignedTo || req.user._id,
        status: CUSTOMER_STATUSES.ACTIVE
      });
      createdCustomer = customer;

      const dealStage = stage || DEAL_STAGES.QUALIFICATION;
      const dealProbability = probability ?? STAGE_DEFAULT_PROBABILITIES[dealStage];

      const deal = await Deal.create({
        name: dealName || `${lead.company || lead.name} Deal`,
        leadId: lead._id,
        customerId: customer._id,
        assignedTo: lead.assignedTo || req.user._id,
        value: dealValue,
        stage: dealStage,
        probability: dealProbability,
        expectedClosingDate: expectedClosingDate ? new Date(expectedClosingDate) : null,
        description: lead.description || ""
      });
      createdDeal = deal;

      lead.status = LEAD_STATUSES.CONVERTED;
      lead.convertedCustomerId = customer._id;
      lead.convertedDealId = deal._id;
      await lead.save();
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  recordTimeline({
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    action: TIMELINE_ACTIONS.LEAD_CONVERTED,
    performedBy: req.user._id,
    previousValue: { status: LEAD_STATUSES.QUALIFIED },
    newValue: { status: LEAD_STATUSES.CONVERTED, customerId: createdCustomer._id, dealId: createdDeal._id }
  });

  recordTimeline({
    entityType: ENTITY_TYPES.CUSTOMER,
    entityId: createdCustomer._id,
    action: TIMELINE_ACTIONS.CUSTOMER_CREATED,
    performedBy: req.user._id,
    newValue: { name: createdCustomer.name, email: createdCustomer.email },
    metadata: { convertedFromLead: lead._id }
  });

  recordTimeline({
    entityType: ENTITY_TYPES.DEAL,
    entityId: createdDeal._id,
    action: TIMELINE_ACTIONS.DEAL_CREATED,
    performedBy: req.user._id,
    newValue: { name: createdDeal.name, value: createdDeal.value, stage: createdDeal.stage },
    metadata: { convertedFromLead: lead._id }
  });

  return apiResponse(res, {
    statusCode: 201,
    message: "Lead converted successfully to Customer and Deal",
    data: {
      lead,
      customer: createdCustomer,
      deal: createdDeal
    }
  });
});
