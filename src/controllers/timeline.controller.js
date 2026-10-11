import { Timeline } from "../models/timeline.model.js";
import { Lead } from "../models/lead.model.js";
import { Customer } from "../models/customer.model.js";
import { Deal } from "../models/deal.model.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ROLES, ENTITY_TYPES } from "../utils/usedConstants.js";

async function getManagerTeamIds(managerId) {
  const teamMembers = await User.find({ managerId }).select("_id");
  return [managerId.toString(), ...teamMembers.map((m) => m._id.toString())];
}

async function checkEntityAccess(user, entityType, entityId) {
  if (user.role === ROLES.ADMIN) return true;

  let entity = null;

  if (entityType === ENTITY_TYPES.LEAD) {
    entity = await Lead.findById(entityId).select("assignedTo");
  } else if (entityType === ENTITY_TYPES.CUSTOMER) {
    entity = await Customer.findById(entityId).select("assignedTo");
  } else if (entityType === ENTITY_TYPES.DEAL) {
    entity = await Deal.findById(entityId).select("assignedTo");
  }

  if (!entity) return false;

  const ownerId = entity.assignedTo?.toString();

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

export const getTimeline = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const entityTypeNum = Number(entityType);

  if (!Object.values(ENTITY_TYPES).includes(entityTypeNum)) {
    throw new ApiError(400, "Invalid entity type. Use 1 (Lead), 2 (Customer), or 3 (Deal)");
  }

  const hasAccess = await checkEntityAccess(req.user, entityTypeNum, entityId);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to view this timeline");
  }

  const timeline = await Timeline.find({
    entityType: entityTypeNum,
    entityId
  })
    .populate("performedBy", "name email role")
    .sort({ createdAt: -1 });

  return apiResponse(res, {
    statusCode: 200,
    message: "Timeline fetched successfully",
    data: { timeline }
  });
});
