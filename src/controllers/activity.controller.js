import { Activity } from "../models/activity.model.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordTimeline } from "../utils/timelineHelper.js";
import {
  ROLES,
  ACTIVITY_STATUSES,
  ENTITY_TYPES,
  TIMELINE_ACTIONS
} from "../utils/usedConstants.js";

async function getManagerTeamIds(managerId) {
  const teamMembers = await User.find({ managerId }).select("_id");
  return [managerId.toString(), ...teamMembers.map((m) => m._id.toString())];
}

async function checkActivityAccess(user, activity) {
  if (user.role === ROLES.ADMIN) return true;

  const ownerId = activity.assignedTo?._id
    ? activity.assignedTo._id.toString()
    : activity.assignedTo?.toString();

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

export const createActivity = asyncHandler(async (req, res) => {
  const { type, title, description, entityType, entityId, assignedTo, dueDate } = req.body;

  let assignedUserId = assignedTo || req.user._id;

  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    assignedUserId = req.user._id;
  } else if (assignedTo) {
    const targetUser = await User.findById(assignedTo);
    if (!targetUser || !targetUser.isActive) {
      throw new ApiError(400, "Assigned user does not exist or is inactive");
    }

    if (req.user.role === ROLES.SALES_MANAGER) {
      const teamIds = await getManagerTeamIds(req.user._id);
      if (!teamIds.includes(assignedTo.toString())) {
        throw new ApiError(403, "Managers can only assign activities to their own team members");
      }
    }
  }

  const activity = await Activity.create({
    type,
    title,
    description: description || "",
    entityType,
    entityId,
    assignedTo: assignedUserId,
    dueDate: dueDate ? new Date(dueDate) : null,
    status: ACTIVITY_STATUSES.PENDING,
    createdBy: req.user._id
  });

  const populated = await Activity.findById(activity._id)
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email");

  recordTimeline({
    entityType,
    entityId,
    action: TIMELINE_ACTIONS.ACTIVITY_CREATED,
    performedBy: req.user._id,
    newValue: { type, title, status: ACTIVITY_STATUSES.PENDING }
  });

  return apiResponse(res, {
    statusCode: 201,
    message: "Activity created successfully",
    data: { activity: populated }
  });
});

export const getActivities = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    search,
    entityType,
    entityId,
    type,
    status,
    overdue,
    assignedTo,
    startDate,
    endDate,
    sortBy,
    sortOrder
  } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
  }

  if (entityType !== undefined) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (type !== undefined) filter.type = type;

  if (overdue === true || status === ACTIVITY_STATUSES.OVERDUE) {
    filter.status = ACTIVITY_STATUSES.PENDING;
    filter.dueDate = { $lt: new Date() };
  } else if (status !== undefined) {
    if (status === ACTIVITY_STATUSES.PENDING) {
      filter.status = ACTIVITY_STATUSES.PENDING;
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { dueDate: null },
          { dueDate: { $gte: new Date() } }
        ]
      });
    } else {
      filter.status = status;
    }
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
        throw new ApiError(403, "You can only view activities belonging to your team");
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

  const [activities, totalRecords] = await Promise.all([
    Activity.find(filter)
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Activity.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return apiResponse(res, {
    statusCode: 200,
    message: "Activities fetched successfully",
    data: { activities },
    meta: {
      page,
      limit,
      totalRecords,
      totalPages
    }
  });
});

export const getActivityById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const activity = await Activity.findById(id)
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email");

  if (!activity) {
    throw new ApiError(404, "Activity not found");
  }

  const hasAccess = await checkActivityAccess(req.user, activity);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to view this activity");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "Activity fetched successfully",
    data: { activity }
  });
});

export const updateActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, title, description, dueDate } = req.body;

  const activity = await Activity.findById(id);
  if (!activity) {
    throw new ApiError(404, "Activity not found");
  }

  const hasAccess = await checkActivityAccess(req.user, activity);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to update this activity");
  }

  if (activity.status === ACTIVITY_STATUSES.COMPLETED) {
    throw new ApiError(400, "Cannot modify a completed activity");
  }

  if (type !== undefined) activity.type = type;
  if (title !== undefined) activity.title = title;
  if (description !== undefined) activity.description = description;
  if (dueDate !== undefined) {
    activity.dueDate = dueDate ? new Date(dueDate) : null;
  }

  await activity.save();

  const populated = await Activity.findById(activity._id)
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email");

  return apiResponse(res, {
    statusCode: 200,
    message: "Activity updated successfully",
    data: { activity: populated }
  });
});

export const completeActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const activity = await Activity.findById(id);
  if (!activity) {
    throw new ApiError(404, "Activity not found");
  }

  const hasAccess = await checkActivityAccess(req.user, activity);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to complete this activity");
  }

  if (activity.status === ACTIVITY_STATUSES.COMPLETED) {
    throw new ApiError(400, "Activity is already completed");
  }

  activity.status = ACTIVITY_STATUSES.COMPLETED;
  activity.completedAt = new Date();
  await activity.save();

  const populated = await Activity.findById(activity._id)
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email");

  recordTimeline({
    entityType: activity.entityType,
    entityId: activity.entityId,
    action: TIMELINE_ACTIONS.ACTIVITY_COMPLETED,
    performedBy: req.user._id,
    previousValue: { status: ACTIVITY_STATUSES.PENDING },
    newValue: { status: ACTIVITY_STATUSES.COMPLETED, title: activity.title }
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Activity marked as completed",
    data: { activity: populated }
  });
});

export const deleteActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const activity = await Activity.findById(id);
  if (!activity) {
    throw new ApiError(404, "Activity not found");
  }

  if (req.user.role === ROLES.SALES_MANAGER) {
    const hasAccess = await checkActivityAccess(req.user, activity);
    if (!hasAccess) {
      throw new ApiError(403, "Forbidden: You cannot delete an activity outside your team");
    }
  }

  await Activity.findByIdAndDelete(id);

  return apiResponse(res, {
    statusCode: 200,
    message: "Activity deleted successfully",
    data: null
  });
});
