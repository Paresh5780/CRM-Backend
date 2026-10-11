import mongoose from "mongoose";
import { Lead } from "../models/lead.model.js";
import { Deal } from "../models/deal.model.js";
import { Activity } from "../models/activity.model.js";
import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  ROLES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  DEAL_STAGES,
  ACTIVITY_STATUSES
} from "../utils/usedConstants.js";

const STAGE_NAMES = {
  [DEAL_STAGES.QUALIFICATION]: "Qualification",
  [DEAL_STAGES.DISCOVERY]: "Discovery",
  [DEAL_STAGES.PROPOSAL]: "Proposal",
  [DEAL_STAGES.NEGOTIATION]: "Negotiation",
  [DEAL_STAGES.WON]: "Won",
  [DEAL_STAGES.LOST]: "Lost"
};

const SOURCE_NAMES = {
  [LEAD_SOURCES.WEBSITE]: "Website",
  [LEAD_SOURCES.REFERRAL]: "Referral",
  [LEAD_SOURCES.SOCIAL_MEDIA]: "Social Media",
  [LEAD_SOURCES.EMAIL]: "Email",
  [LEAD_SOURCES.PHONE]: "Phone",
  [LEAD_SOURCES.OTHER]: "Other"
};

async function buildScopeMatch(user, query) {
  const { startDate, endDate, assignedTo, managerId } = query;
  const match = {};

  if (user.role === ROLES.SALES_EXECUTIVE) {
    match.assignedTo = new mongoose.Types.ObjectId(user._id);
  } else if (user.role === ROLES.SALES_MANAGER) {
    const teamMembers = await User.find({ managerId: user._id }).select("_id");
    const teamIds = [user._id.toString(), ...teamMembers.map((m) => m._id.toString())];

    if (assignedTo) {
      if (!teamIds.includes(assignedTo)) {
        throw new ApiError(403, "Forbidden: User is not in your team");
      }
      match.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    } else {
      match.assignedTo = { $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
  } else if (user.role === ROLES.ADMIN) {
    if (assignedTo) {
      match.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    } else if (managerId) {
      const teamMembers = await User.find({ managerId }).select("_id");
      const teamIds = [managerId, ...teamMembers.map((m) => m._id.toString())];
      match.assignedTo = { $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
  }

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return match;
}

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const match = await buildScopeMatch(req.user, req.query);

  const leadsAggregation = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        new: { $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.NEW] }, 1, 0] } },
        contacted: { $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.CONTACTED] }, 1, 0] } },
        qualified: { $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.QUALIFIED] }, 1, 0] } },
        unqualified: { $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.UNQUALIFIED] }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.CONVERTED] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.LOST] }, 1, 0] } }
      }
    }
  ]);

  const leadsData = leadsAggregation[0] || {
    total: 0,
    new: 0,
    contacted: 0,
    qualified: 0,
    unqualified: 0,
    converted: 0,
    lost: 0
  };
  delete leadsData._id;

  const leadConversionRate =
    leadsData.total > 0
      ? Math.round((leadsData.converted / leadsData.total) * 10000) / 100
      : 0;

  const activeStages = [
    DEAL_STAGES.QUALIFICATION,
    DEAL_STAGES.DISCOVERY,
    DEAL_STAGES.PROPOSAL,
    DEAL_STAGES.NEGOTIATION
  ];

  const dealsAggregation = await Deal.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        won: { $sum: { $cond: [{ $eq: ["$stage", DEAL_STAGES.WON] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ["$stage", DEAL_STAGES.LOST] }, 1, 0] } },
        active: { $sum: { $cond: [{ $in: ["$stage", activeStages] }, 1, 0] } },
        totalWonRevenue: {
          $sum: { $cond: [{ $eq: ["$stage", DEAL_STAGES.WON] }, "$value", 0] }
        },
        totalActivePipelineValue: {
          $sum: { $cond: [{ $in: ["$stage", activeStages] }, "$value", 0] }
        },
        projectedRevenue: {
          $sum: { $cond: [{ $in: ["$stage", activeStages] }, "$expectedRevenue", 0] }
        }
      }
    }
  ]);

  const dealsData = dealsAggregation[0] || {
    total: 0,
    won: 0,
    lost: 0,
    active: 0,
    totalWonRevenue: 0,
    totalActivePipelineValue: 0,
    projectedRevenue: 0
  };
  delete dealsData._id;

  const closedDealsCount = dealsData.won + dealsData.lost;
  const dealWinRate =
    closedDealsCount > 0
      ? Math.round((dealsData.won / closedDealsCount) * 10000) / 100
      : 0;

  const now = new Date();
  const activitiesAggregation = await Activity.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", ACTIVITY_STATUSES.COMPLETED] }, 1, 0] }
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", ACTIVITY_STATUSES.PENDING] },
                  { $ne: ["$dueDate", null] },
                  { $lt: ["$dueDate", now] }
                ]
              },
              1,
              0
            ]
          }
        },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", ACTIVITY_STATUSES.PENDING] },
                  {
                    $or: [{ $eq: ["$dueDate", null] }, { $gte: ["$dueDate", now] }]
                  }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const activitiesData = activitiesAggregation[0] || {
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0
  };
  delete activitiesData._id;

  const activityCompletionRate =
    activitiesData.total > 0
      ? Math.round((activitiesData.completed / activitiesData.total) * 10000) / 100
      : 0;

  return apiResponse(res, {
    statusCode: 200,
    message: "Dashboard summary analytics fetched successfully",
    data: {
      leads: {
        ...leadsData,
        conversionRate: leadConversionRate
      },
      deals: {
        ...dealsData,
        winRate: dealWinRate,
        totalWonRevenue: Math.round(dealsData.totalWonRevenue * 100) / 100,
        totalActivePipelineValue: Math.round(dealsData.totalActivePipelineValue * 100) / 100,
        projectedRevenue: Math.round(dealsData.projectedRevenue * 100) / 100
      },
      activities: {
        ...activitiesData,
        completionRate: activityCompletionRate
      }
    }
  });
});

export const getPipelineStageDistribution = asyncHandler(async (req, res) => {
  const match = await buildScopeMatch(req.user, req.query);

  const stageAggregations = await Deal.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$stage",
        count: { $sum: 1 },
        totalValue: { $sum: "$value" },
        projectedRevenue: { $sum: "$expectedRevenue" }
      }
    }
  ]);

  const stageMap = {};
  stageAggregations.forEach((item) => {
    stageMap[item._id] = item;
  });

  const totalDeals = stageAggregations.reduce((sum, item) => sum + item.count, 0);
  const totalValue = stageAggregations.reduce((sum, item) => sum + item.totalValue, 0);

  const pipeline = Object.values(DEAL_STAGES).map((stageNum) => {
    const item = stageMap[stageNum] || { count: 0, totalValue: 0, projectedRevenue: 0 };
    const count = item.count;
    const value = Math.round(item.totalValue * 100) / 100;
    const projected = Math.round(item.projectedRevenue * 100) / 100;
    const avgValue = count > 0 ? Math.round((value / count) * 100) / 100 : 0;
    const percentage =
      totalDeals > 0 ? Math.round((count / totalDeals) * 10000) / 100 : 0;

    return {
      stage: stageNum,
      stageName: STAGE_NAMES[stageNum] || `Stage ${stageNum}`,
      count,
      totalValue: value,
      avgValue,
      projectedRevenue: projected,
      percentage
    };
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Deal pipeline stage distribution fetched successfully",
    data: {
      totalDeals,
      totalValue: Math.round(totalValue * 100) / 100,
      pipeline
    }
  });
});

export const getLeadsBySource = asyncHandler(async (req, res) => {
  const match = await buildScopeMatch(req.user, req.query);

  const sourceAggregations = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$source",
        total: { $sum: 1 },
        converted: {
          $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.CONVERTED] }, 1, 0] }
        }
      }
    }
  ]);

  const sourceMap = {};
  sourceAggregations.forEach((item) => {
    sourceMap[item._id] = item;
  });

  const totalLeads = sourceAggregations.reduce((sum, item) => sum + item.total, 0);

  const sources = Object.values(LEAD_SOURCES).map((sourceNum) => {
    const item = sourceMap[sourceNum] || { total: 0, converted: 0 };
    const total = item.total;
    const converted = item.converted;
    const conversionRate =
      total > 0 ? Math.round((converted / total) * 10000) / 100 : 0;
    const shareOfLeads =
      totalLeads > 0 ? Math.round((total / totalLeads) * 10000) / 100 : 0;

    return {
      source: sourceNum,
      sourceName: SOURCE_NAMES[sourceNum] || `Source ${sourceNum}`,
      total,
      converted,
      conversionRate,
      shareOfLeads
    };
  });

  return apiResponse(res, {
    statusCode: 200,
    message: "Leads by source analytics fetched successfully",
    data: {
      totalLeads,
      sources
    }
  });
});

export const getTeamPerformance = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    throw new ApiError(403, "Forbidden: Sales Executives cannot view team performance breakdown");
  }

  const { managerId } = req.query;
  let targetUsers = [];

  if (req.user.role === ROLES.SALES_MANAGER) {
    const teamMembers = await User.find({ managerId: req.user._id, isActive: true })
      .select("_id name email role")
      .lean();
    const managerUser = await User.findById(req.user._id)
      .select("_id name email role")
      .lean();
    targetUsers = [managerUser, ...teamMembers];
  } else if (req.user.role === ROLES.ADMIN) {
    const userQuery = { isActive: true };
    if (managerId) {
      const reports = await User.find({ managerId, isActive: true })
        .select("_id name email role")
        .lean();
      const managerUser = await User.findById(managerId)
        .select("_id name email role")
        .lean();
      targetUsers = managerUser ? [managerUser, ...reports] : reports;
    } else {
      targetUsers = await User.find(userQuery).select("_id name email role").lean();
    }
  }

  const now = new Date();
  const performanceReport = await Promise.all(
    targetUsers.map(async (u) => {
      const userObjectId = new mongoose.Types.ObjectId(u._id);

      const leadStats = await Lead.aggregate([
        { $match: { assignedTo: userObjectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ["$status", LEAD_STATUSES.CONVERTED] }, 1, 0] }
            }
          }
        }
      ]);
      const leadTotal = leadStats[0]?.total || 0;
      const leadConverted = leadStats[0]?.converted || 0;

      const dealStats = await Deal.aggregate([
        { $match: { assignedTo: userObjectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ["$stage", DEAL_STAGES.WON] }, 1, 0] } },
            lost: { $sum: { $cond: [{ $eq: ["$stage", DEAL_STAGES.LOST] }, 1, 0] } },
            wonRevenue: {
              $sum: { $cond: [{ $eq: ["$stage", DEAL_STAGES.WON] }, "$value", 0] }
            }
          }
        }
      ]);
      const dealTotal = dealStats[0]?.total || 0;
      const dealWon = dealStats[0]?.won || 0;
      const dealLost = dealStats[0]?.lost || 0;
      const wonRevenue = Math.round((dealStats[0]?.wonRevenue || 0) * 100) / 100;

      const actStats = await Activity.aggregate([
        { $match: { assignedTo: userObjectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", ACTIVITY_STATUSES.COMPLETED] }, 1, 0] }
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", ACTIVITY_STATUSES.PENDING] },
                      { $ne: ["$dueDate", null] },
                      { $lt: ["$dueDate", now] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      const actTotal = actStats[0]?.total || 0;
      const actCompleted = actStats[0]?.completed || 0;
      const actOverdue = actStats[0]?.overdue || 0;

      return {
        user: {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role
        },
        leads: {
          total: leadTotal,
          converted: leadConverted,
          conversionRate:
            leadTotal > 0 ? Math.round((leadConverted / leadTotal) * 10000) / 100 : 0
        },
        deals: {
          total: dealTotal,
          won: dealWon,
          lost: dealLost,
          wonRevenue,
          winRate:
            dealWon + dealLost > 0
              ? Math.round((dealWon / (dealWon + dealLost)) * 10000) / 100
              : 0
        },
        activities: {
          total: actTotal,
          completed: actCompleted,
          overdue: actOverdue,
          completionRate:
            actTotal > 0 ? Math.round((actCompleted / actTotal) * 10000) / 100 : 0
        }
      };
    })
  );

  return apiResponse(res, {
    statusCode: 200,
    message: "Team performance breakdown fetched successfully",
    data: {
      teamMembersCount: performanceReport.length,
      performance: performanceReport
    }
  });
});
