import { Customer } from "../models/customer.model.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordTimeline } from "../utils/timelineHelper.js";
import { ROLES, CUSTOMER_STATUSES, ENTITY_TYPES, TIMELINE_ACTIONS } from "../utils/usedConstants.js";

async function getManagerTeamIds(managerId) {
  const teamMembers = await User.find({ managerId }).select("_id");
  return [managerId.toString(), ...teamMembers.map((m) => m._id.toString())];
}

async function checkCustomerAccess(user, customer) {
  if (user.role === ROLES.ADMIN) return true;

  const ownerId = customer.assignedTo?._id
    ? customer.assignedTo._id.toString()
    : customer.assignedTo?.toString();

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

export const createCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, company, address, leadId, assignedTo, status } = req.body;

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
        throw new ApiError(403, "Managers can only assign customers to their own team members");
      }
    }
  } else {
    assignedUserId = req.user._id;
  }

  const customer = await Customer.create({
    name,
    email,
    phone: phone || "",
    company: company || "",
    address: address || "",
    leadId: leadId || null,
    assignedTo: assignedUserId,
    status: status ?? CUSTOMER_STATUSES.ACTIVE
  });

  const populated = await Customer.findById(customer._id)
    .populate("assignedTo", "name email role")
    .populate("leadId", "name company email status");

  recordTimeline({
    entityType: ENTITY_TYPES.CUSTOMER,
    entityId: customer._id,
    action: TIMELINE_ACTIONS.CUSTOMER_CREATED,
    performedBy: req.user._id,
    newValue: { name: customer.name, email: customer.email, company: customer.company }
  });

  return apiResponse(res, {
    statusCode: 201,
    message: "Customer created successfully",
    data: { customer: populated }
  });
});

export const getCustomers = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    search,
    status,
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
        throw new ApiError(403, "You can only view customers belonging to your team");
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

  const [customers, totalRecords] = await Promise.all([
    Customer.find(filter)
      .populate("assignedTo", "name email role")
      .populate("leadId", "name company email status")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Customer.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return apiResponse(res, {
    statusCode: 200,
    message: "Customers fetched successfully",
    data: { customers },
    meta: {
      page,
      limit,
      totalRecords,
      totalPages
    }
  });
});

export const getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await Customer.findById(id)
    .populate("assignedTo", "name email role")
    .populate("leadId", "name company email status");

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const hasAccess = await checkCustomerAccess(req.user, customer);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to view this customer");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "Customer fetched successfully",
    data: { customer }
  });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const hasAccess = await checkCustomerAccess(req.user, customer);
  if (!hasAccess) {
    throw new ApiError(403, "Forbidden: You do not have permission to update this customer");
  }

  const allowedFields = ["name", "email", "phone", "company", "address", "status"];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      customer[field] = updates[field];
    }
  });

  await customer.save();

  const populated = await Customer.findById(customer._id)
    .populate("assignedTo", "name email role")
    .populate("leadId", "name company email status");

  recordTimeline({
    entityType: ENTITY_TYPES.CUSTOMER,
    entityId: customer._id,
    action: TIMELINE_ACTIONS.CUSTOMER_UPDATED,
    performedBy: req.user._id,
    newValue: updates
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Customer updated successfully",
    data: { customer: populated }
  });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  if (req.user.role === ROLES.SALES_MANAGER) {
    const hasAccess = await checkCustomerAccess(req.user, customer);
    if (!hasAccess) {
      throw new ApiError(403, "Forbidden: You cannot delete a customer outside your team");
    }
  }

  await Customer.findByIdAndDelete(id);

  return apiResponse(res, {
    statusCode: 200,
    message: "Customer deleted successfully",
    data: null
  });
});
