import { Deal } from "../models/deal.model.js";
import { Customer } from "../models/customer.model.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordTimeline } from "../utils/timelineHelper.js";
import {
  ROLES,
  DEAL_STAGES,
  STAGE_DEFAULT_PROBABILITIES,
  ENTITY_TYPES,
  TIMELINE_ACTIONS
} from "../utils/usedConstants.js";

async function getManagerTeamIds(managerId) {
  const teamMembers = await User.find({ managerId }).select("_id");
  return [managerId.toString(), ...teamMembers.map((m) => m._id.toString())];
}

async function checkDealAccess(user, deal) {
  if (user.role === ROLES.ADMIN) return true;

  const ownerId = deal.assignedTo?._id
    ? deal.assignedTo._id.toString()
    : deal.assignedTo?.toString();

  if (user.role === ROLES.SALES_EXECUTIVE) {
    return ownerId === user._id.toString();
  }

  if (user.role === ROLES.SALES_MANAGER) {
    if (!ownerId) return true;
    const teamIds = await getManagerTeamIds(user._id);
    return teamIds.includes(ownerId);
  }

  return false;
}

export const createDeal = asyncHandler(async (req, res) => {
  const {
    name,
    customerId,
    leadId,
    value,
    probability,
    stage,
    expectedClosingDate,
    description
  } = req.body;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const assignedUserId = customer.assignedTo || req.user._id;
  const initialStage = stage || DEAL_STAGES.QUALIFICATION;
  const initialProbability = probability ?? STAGE_DEFAULT_PROBABILITIES[initialStage];

  const deal = await Deal.create({
    name,
    customerId,
    leadId: leadId || null,
    assignedTo: assignedUserId,
    value,
    stage: initialStage,
    probability: initialProbability,
    expectedClosingDate: expectedClosingDate ? new Date(expectedClosingDate) : null,
    description: description || ""
  });

  const populated = await Deal.findById(deal._id)
    .populate("assignedTo", "name email role")
    .populate("customerId", "name email company")
    .populate("leadId", "name company");

  recordTimeline({
    entityType: ENTITY_TYPES.DEAL,
    entityId: deal._id,
    action: TIMELINE_ACTIONS.DEAL_CREATED,
    performedBy: req.user._id,
    newValue: { name: deal.name, value: deal.value, stage: deal.stage }
  });

  return apiResponse(res, {
    statusCode: 201,
    message: "Deal created successfully",
    data: { deal: populated }
  });
});

export const getDeals = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    search,
    stage,
    customerId,
    assignedTo,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    sortBy,
    sortOrder
  } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
  }

  if (stage !== undefined) filter.stage = stage;
  if (customerId) filter.customerId = customerId;

  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.value = {};
    if (minAmount !== undefined) filter.value.$gte = minAmount;
    if (maxAmount !== undefined) filter.value.$lte = maxAmount;
  }

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
        throw new ApiError(403, "You can only view deals belonging to your team");
      }
      filter.assignedTo = assignedTo;
    } else {
      filter.assignedTo = { $in: teamIds };
    }
  } else if (req.user.role === ROLES.ADMIN && assignedTo) {
    filter.assignedTo = assignedTo;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [deals, totalRecords] = await Promise.all([
    Deal.find(filter)
      .populate("assignedTo", "name email role")
      .populate("customerId", "name email company")
      .populate("leadId", "name company")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Deal.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return apiResponse(res, {
    statusCode: 200,
    message: "Deals fetched successfully",
    data: { deals },
    meta: {
      page,
      limit,
      totalRecords,
      totalPages
    }
  });
});

export const getDealById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deal = await Deal.findById(id)
    .populate("assignedTo", "name email role")
    .populate("customerId", "name email company")
    .populate("leadId", "name company");

  if (!deal) {
    throw new ApiError(404, "Deal not found");
  }

  const hasAccess = await checkDealAccess(req.user, deal);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to view this deal");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "Deal fetched successfully",
    data: { deal }
  });
});

export const updateDeal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, value, probability, expectedClosingDate, description } = req.body;

  const deal = await Deal.findById(id);
  if (!deal) {
    throw new ApiError(404, "Deal not found");
  }

  const hasAccess = await checkDealAccess(req.user, deal);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to modify this deal");
  }

  if (name !== undefined) deal.name = name;
  if (value !== undefined) deal.value = value;
  if (probability !== undefined) deal.probability = probability;
  if (expectedClosingDate !== undefined) {
    deal.expectedClosingDate = expectedClosingDate ? new Date(expectedClosingDate) : null;
  }
  if (description !== undefined) deal.description = description;

  await deal.save();

  const populated = await Deal.findById(deal._id)
    .populate("assignedTo", "name email role")
    .populate("customerId", "name email company")
    .populate("leadId", "name company");

  recordTimeline({
    entityType: ENTITY_TYPES.DEAL,
    entityId: deal._id,
    action: TIMELINE_ACTIONS.DEAL_UPDATED,
    performedBy: req.user._id,
    newValue: { name, value, probability, expectedClosingDate, description }
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Deal updated successfully",
    data: { deal: populated }
  });
});

export const updateDealStage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage, lossReason } = req.body;

  const deal = await Deal.findById(id);
  if (!deal) {
    throw new ApiError(404, "Deal not found");
  }

  const hasAccess = await checkDealAccess(req.user, deal);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to modify this deal");
  }

  const currentStage = deal.stage;
  const isCurrentlyClosed = [DEAL_STAGES.WON, DEAL_STAGES.LOST].includes(currentStage);
  const isMovingToActive = [
    DEAL_STAGES.QUALIFICATION,
    DEAL_STAGES.DISCOVERY,
    DEAL_STAGES.PROPOSAL,
    DEAL_STAGES.NEGOTIATION
  ].includes(stage);

  if (isCurrentlyClosed && isMovingToActive && req.user.role !== ROLES.ADMIN) {
    throw new ApiError(400, "A closed Won or Lost deal cannot freely move back to an active stage");
  }

  if (stage === DEAL_STAGES.LOST) {
    if (!lossReason || lossReason.trim().length === 0) {
      throw new ApiError(400, "A Lost deal must contain an appropriate reason");
    }
    deal.lossReason = lossReason;
    deal.probability = 0;
  }

  if (stage === DEAL_STAGES.WON) {
    deal.probability = 100;
  } else if (!isCurrentlyClosed && STAGE_DEFAULT_PROBABILITIES[stage] !== undefined) {
    deal.probability = STAGE_DEFAULT_PROBABILITIES[stage];
  }

  deal.stage = stage;
  await deal.save();

  const populated = await Deal.findById(deal._id)
    .populate("assignedTo", "name email role")
    .populate("customerId", "name email company")
    .populate("leadId", "name company");

  recordTimeline({
    entityType: ENTITY_TYPES.DEAL,
    entityId: deal._id,
    action: TIMELINE_ACTIONS.DEAL_STAGE_CHANGED,
    performedBy: req.user._id,
    previousValue: { stage: currentStage },
    newValue: { stage }
  });

  return apiResponse(res, {
    statusCode: 200,
    message: `Deal stage updated to '${stage}' successfully`,
    data: { deal: populated }
  });
});

export const deleteDeal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deal = await Deal.findById(id);
  if (!deal) {
    throw new ApiError(404, "Deal not found");
  }

  if (req.user.role === ROLES.SALES_MANAGER) {
    const hasAccess = await checkDealAccess(req.user, deal);
    if (!hasAccess) {
      throw new ApiError(403, "Forbidden: You cannot delete a deal outside your team");
    }
  }

  await Deal.findByIdAndDelete(id);

  return apiResponse(res, {
    statusCode: 200,
    message: "Deal deleted successfully",
    data: null
  });
});
