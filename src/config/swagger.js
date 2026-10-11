import swaggerJsdoc from "swagger-jsdoc";
import { ROLES, LEAD_SOURCES, LEAD_STATUSES, LEAD_PRIORITIES, DEAL_STAGES, ACTIVITY_TYPES, ACTIVITY_STATUSES, ENTITY_TYPES } from "../utils/usedConstants.js";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "CRM Sales Management API",
      version: "1.0.0",
      description: `
## Overview
A production-grade REST API for managing the complete sales lifecycle: Leads → Customers → Deals → Activities.

## Authentication
All protected routes require a **Bearer JWT token** in the \`Authorization\` header.

\`\`\`
Authorization: Bearer <your_access_token>
\`\`\`

Obtain a token via \`POST /api/v1/auth/login\`.

## Roles & Permissions
| Role | Value | Capabilities |
|---|---|---|
| Admin | 1 | Full access — all users, all records |
| Sales Manager | 2 | Own records + their team members' records |
| Sales Executive | 3 | Own assigned records only |

## Numeric Constants
All enum fields use integers for efficiency. See the **Schemas** section for the full reference.
      `,
      contact: {
        name: "CRM API Support"
      }
    },
    servers: [
      { url: "/api/v1", description: "Current server" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        // ─── Enum References ────────────────────────────────────────────
        RoleEnum: {
          type: "integer",
          enum: Object.values(ROLES),
          description: `1=Admin, 2=Sales Manager, 3=Sales Executive`
        },
        LeadSourceEnum: {
          type: "integer",
          enum: Object.values(LEAD_SOURCES),
          description: `1=Website, 2=Referral, 3=Social Media, 4=Email, 5=Phone, 6=Other`
        },
        LeadStatusEnum: {
          type: "integer",
          enum: Object.values(LEAD_STATUSES),
          description: `1=New, 2=Contacted, 3=Qualified, 4=Unqualified, 5=Converted, 6=Lost`
        },
        LeadPriorityEnum: {
          type: "integer",
          enum: Object.values(LEAD_PRIORITIES),
          description: `1=Low, 2=Medium, 3=High`
        },
        DealStageEnum: {
          type: "integer",
          enum: Object.values(DEAL_STAGES),
          description: `1=Qualification, 2=Discovery, 3=Proposal, 4=Negotiation, 5=Won, 6=Lost`
        },
        ActivityTypeEnum: {
          type: "integer",
          enum: Object.values(ACTIVITY_TYPES),
          description: `1=Call, 2=Email, 3=Meeting, 4=Demo, 5=Follow-Up, 6=Reminder, 7=Note`
        },
        ActivityStatusEnum: {
          type: "integer",
          enum: [ACTIVITY_STATUSES.PENDING, ACTIVITY_STATUSES.COMPLETED],
          description: `1=Pending, 2=Completed (3=Overdue is computed virtually)`
        },
        EntityTypeEnum: {
          type: "integer",
          enum: Object.values(ENTITY_TYPES),
          description: `1=Lead, 2=Customer, 3=Deal`
        },

        // ─── Response Wrappers ───────────────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" },
            meta: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                totalRecords: { type: "integer" },
                totalPages: { type: "integer" }
              }
            }
          }
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: { type: "array", items: { type: "object" } }
          }
        },

        // ─── User ────────────────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "6612a8f3e4b0a0001b8e4f01" },
            name: { type: "string", example: "Alice Smith" },
            email: { type: "string", format: "email", example: "alice@company.com" },
            phone: { type: "string", example: "+919876543210" },
            role: { $ref: "#/components/schemas/RoleEnum" },
            isActive: { type: "boolean", example: true },
            managerId: { type: "string", nullable: true, example: null },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        CreateUserBody: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Bob Jones" },
            email: { type: "string", format: "email", example: "bob@company.com" },
            password: { type: "string", minLength: 8, example: "SecurePass1!" },
            phone: { type: "string", example: "+919876543210" },
            role: { $ref: "#/components/schemas/RoleEnum" },
            managerId: { type: "string", nullable: true, example: null }
          }
        },

        // ─── Lead ────────────────────────────────────────────────────────
        Lead: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", example: "Raj Patel" },
            email: { type: "string", format: "email", example: "raj@acme.com" },
            phone: { type: "string", example: "+919999999999" },
            company: { type: "string", example: "Acme Corp" },
            source: { $ref: "#/components/schemas/LeadSourceEnum" },
            status: { $ref: "#/components/schemas/LeadStatusEnum" },
            priority: { $ref: "#/components/schemas/LeadPriorityEnum" },
            assignedTo: { $ref: "#/components/schemas/User" },
            description: { type: "string" },
            convertedCustomerId: { type: "string", nullable: true },
            convertedDealId: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        CreateLeadBody: {
          type: "object",
          required: ["name", "email"],
          properties: {
            name: { type: "string", example: "Raj Patel" },
            email: { type: "string", format: "email", example: "raj@acme.com" },
            phone: { type: "string", example: "+919999999999" },
            company: { type: "string", example: "Acme Corp" },
            source: { $ref: "#/components/schemas/LeadSourceEnum" },
            status: { $ref: "#/components/schemas/LeadStatusEnum" },
            priority: { $ref: "#/components/schemas/LeadPriorityEnum" },
            assignedTo: { type: "string", example: "6612a8f3e4b0a0001b8e4f01" },
            description: { type: "string" }
          }
        },
        ConvertLeadBody: {
          type: "object",
          required: ["dealValue"],
          properties: {
            dealName: { type: "string", example: "Acme Corp Enterprise Deal" },
            dealValue: { type: "number", minimum: 0.01, example: 50000 },
            stage: { $ref: "#/components/schemas/DealStageEnum" },
            probability: { type: "number", minimum: 0, maximum: 100, example: 25 },
            expectedClosingDate: { type: "string", format: "date-time" },
            address: { type: "string", example: "123 Main St, Mumbai" }
          }
        },

        // ─── Customer ────────────────────────────────────────────────────
        Customer: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", example: "Raj Patel" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            company: { type: "string" },
            address: { type: "string" },
            status: { type: "integer", enum: [1, 2], description: "1=Active, 2=Inactive" },
            leadId: { type: "string", nullable: true },
            assignedTo: { $ref: "#/components/schemas/User" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },

        // ─── Deal ────────────────────────────────────────────────────────
        Deal: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", example: "Acme Corp Enterprise Deal" },
            customerId: { $ref: "#/components/schemas/Customer" },
            leadId: { type: "string", nullable: true },
            assignedTo: { $ref: "#/components/schemas/User" },
            value: { type: "number", example: 50000 },
            probability: { type: "number", example: 50 },
            expectedRevenue: { type: "number", example: 25000, description: "value × probability / 100 (auto-computed)" },
            stage: { $ref: "#/components/schemas/DealStageEnum" },
            expectedClosingDate: { type: "string", format: "date-time", nullable: true },
            lossReason: { type: "string" },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        CreateDealBody: {
          type: "object",
          required: ["name", "customerId", "value"],
          properties: {
            name: { type: "string", example: "Acme Corp Enterprise Deal" },
            customerId: { type: "string", example: "6612a8f3e4b0a0001b8e4f02" },
            leadId: { type: "string", nullable: true },
            value: { type: "number", minimum: 0.01, example: 50000 },
            probability: { type: "number", minimum: 0, maximum: 100 },
            stage: { $ref: "#/components/schemas/DealStageEnum" },
            expectedClosingDate: { type: "string", format: "date-time" },
            description: { type: "string" }
          }
        },
        UpdateDealStageBody: {
          type: "object",
          required: ["stage"],
          properties: {
            stage: { $ref: "#/components/schemas/DealStageEnum" },
            lossReason: { type: "string", description: "Required when stage=6 (Lost)", example: "Budget cut" }
          }
        },

        // ─── Activity ────────────────────────────────────────────────────
        Activity: {
          type: "object",
          properties: {
            _id: { type: "string" },
            type: { $ref: "#/components/schemas/ActivityTypeEnum" },
            title: { type: "string", example: "Follow-up call with Raj" },
            description: { type: "string" },
            entityType: { $ref: "#/components/schemas/EntityTypeEnum" },
            entityId: { type: "string" },
            assignedTo: { $ref: "#/components/schemas/User" },
            dueDate: { type: "string", format: "date-time", nullable: true },
            status: { $ref: "#/components/schemas/ActivityStatusEnum" },
            computedStatus: { type: "integer", description: "Virtual field: 1=Pending, 2=Completed, 3=Overdue" },
            completedAt: { type: "string", format: "date-time", nullable: true },
            createdBy: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        CreateActivityBody: {
          type: "object",
          required: ["type", "title", "entityType", "entityId"],
          properties: {
            type: { $ref: "#/components/schemas/ActivityTypeEnum" },
            title: { type: "string", example: "Follow-up call with Raj" },
            description: { type: "string" },
            entityType: { $ref: "#/components/schemas/EntityTypeEnum" },
            entityId: { type: "string", example: "6612a8f3e4b0a0001b8e4f03" },
            assignedTo: { type: "string" },
            dueDate: { type: "string", format: "date-time" }
          }
        },

        // ─── Timeline ────────────────────────────────────────────────────
        TimelineEntry: {
          type: "object",
          properties: {
            _id: { type: "string" },
            entityType: { $ref: "#/components/schemas/EntityTypeEnum" },
            entityId: { type: "string" },
            action: { type: "string", example: "LEAD_CREATED" },
            performedBy: { $ref: "#/components/schemas/User" },
            previousValue: { type: "object", nullable: true },
            newValue: { type: "object", nullable: true },
            metadata: { type: "object", nullable: true },
            createdAt: { type: "string", format: "date-time" }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication — login, token refresh, logout" },
      { name: "Users", description: "User management (Admin only for create/update/delete)" },
      { name: "Leads", description: "Lead lifecycle management — create, qualify, assign, convert" },
      { name: "Customers", description: "Customer records created from converted leads" },
      { name: "Deals", description: "Deal pipeline — stages, probabilities, revenue tracking" },
      { name: "Activities", description: "Tasks, calls, meetings, follow-ups linked to any entity" },
      { name: "Timeline", description: "Audit history for leads, customers, and deals" },
      { name: "Analytics", description: "Dashboard, pipeline, source, and team performance reports" },
      { name: "Health", description: "Server health check" }
    ],
    paths: {
      // ─── Health ──────────────────────────────────────────────────────
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          security: [],
          responses: {
            200: { description: "API is running" }
          }
        }
      },

      // ─── Auth ────────────────────────────────────────────────────────
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login and receive JWT tokens",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "admin@crm.com" },
                    password: { type: "string", example: "AdminPassword123!" }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: "Login successful — returns accessToken and refreshToken" },
            401: { description: "Invalid credentials" }
          }
        }
      },
      "/auth/refresh-token": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token using refresh token",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["refreshToken"],
                  properties: { refreshToken: { type: "string" } }
                }
              }
            }
          },
          responses: {
            200: { description: "New access token issued" },
            401: { description: "Invalid or expired refresh token" }
          }
        }
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout (invalidate refresh token)",
          responses: {
            200: { description: "Logged out successfully" }
          }
        }
      },

      // ─── Users ───────────────────────────────────────────────────────
      "/users": {
        get: {
          tags: ["Users"],
          summary: "List all users",
          description: "Admin: all users. Manager: their team members. Executive: only themselves.",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
            { in: "query", name: "role", schema: { $ref: "#/components/schemas/RoleEnum" } },
            { in: "query", name: "isActive", schema: { type: "boolean" } },
            { in: "query", name: "search", schema: { type: "string" } }
          ],
          responses: { 200: { description: "Users list" } }
        },
        post: {
          tags: ["Users"],
          summary: "Create a new user (Admin only)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserBody" }
              }
            }
          },
          responses: {
            201: { description: "User created" },
            403: { description: "Forbidden" }
          }
        }
      },
      "/users/{id}": {
        get: {
          tags: ["Users"],
          summary: "Get user by ID",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "User details" }, 404: { description: "Not found" } }
        },
        put: {
          tags: ["Users"],
          summary: "Update user (Admin only for role/status changes)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserBody" }
              }
            }
          },
          responses: { 200: { description: "User updated" }, 403: { description: "Forbidden" } }
        },
        delete: {
          tags: ["Users"],
          summary: "Deactivate a user (Admin only)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "User deactivated" }, 403: { description: "Forbidden" } }
        }
      },

      // ─── Leads ───────────────────────────────────────────────────────
      "/leads": {
        get: {
          tags: ["Leads"],
          summary: "List leads (role-scoped)",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
            { in: "query", name: "search", schema: { type: "string" } },
            { in: "query", name: "status", schema: { $ref: "#/components/schemas/LeadStatusEnum" } },
            { in: "query", name: "priority", schema: { $ref: "#/components/schemas/LeadPriorityEnum" } },
            { in: "query", name: "source", schema: { $ref: "#/components/schemas/LeadSourceEnum" } },
            { in: "query", name: "assignedTo", schema: { type: "string" } },
            { in: "query", name: "startDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "endDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "sortBy", schema: { type: "string", default: "createdAt" } },
            { in: "query", name: "sortOrder", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } }
          ],
          responses: { 200: { description: "Paginated leads list" } }
        },
        post: {
          tags: ["Leads"],
          summary: "Create a lead",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CreateLeadBody" } }
            }
          },
          responses: { 201: { description: "Lead created" } }
        }
      },
      "/leads/{id}": {
        get: {
          tags: ["Leads"],
          summary: "Get lead by ID",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Lead details" }, 403: { description: "Access denied" }, 404: { description: "Not found" } }
        },
        put: {
          tags: ["Leads"],
          summary: "Update lead fields",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLeadBody" } } }
          },
          responses: { 200: { description: "Lead updated" } }
        },
        delete: {
          tags: ["Leads"],
          summary: "Delete lead (Admin / Manager only)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Lead deleted" }, 403: { description: "Forbidden" } }
        }
      },
      "/leads/{id}/status": {
        patch: {
          tags: ["Leads"],
          summary: "Update lead status",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: { status: { $ref: "#/components/schemas/LeadStatusEnum" } }
                }
              }
            }
          },
          responses: { 200: { description: "Status updated" }, 400: { description: "Cannot modify converted lead" } }
        }
      },
      "/leads/{id}/assign": {
        patch: {
          tags: ["Leads"],
          summary: "Assign lead to a user (Admin / Manager only)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { assignedTo: { type: "string", nullable: true } }
                }
              }
            }
          },
          responses: { 200: { description: "Lead assigned" }, 403: { description: "Forbidden" } }
        }
      },
      "/leads/{id}/convert": {
        post: {
          tags: ["Leads"],
          summary: "Convert a Qualified lead into Customer + Deal (atomic transaction)",
          description: "Requires lead status = Qualified (3). Creates Customer and Deal atomically. Lead status is set to Converted (5).",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ConvertLeadBody" } } }
          },
          responses: {
            201: { description: "Lead converted — returns lead, customer, and deal" },
            400: { description: "Lead not qualified or already converted" }
          }
        }
      },

      // ─── Customers ───────────────────────────────────────────────────
      "/customers": {
        get: {
          tags: ["Customers"],
          summary: "List customers (role-scoped)",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
            { in: "query", name: "search", schema: { type: "string" } },
            { in: "query", name: "status", schema: { type: "integer", enum: [1, 2] } },
            { in: "query", name: "assignedTo", schema: { type: "string" } }
          ],
          responses: { 200: { description: "Paginated customers" } }
        },
        post: {
          tags: ["Customers"],
          summary: "Create a customer directly",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    phone: { type: "string" },
                    company: { type: "string" },
                    address: { type: "string" },
                    assignedTo: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { 201: { description: "Customer created" } }
        }
      },
      "/customers/{id}": {
        get: {
          tags: ["Customers"],
          summary: "Get customer by ID",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Customer details" }, 404: { description: "Not found" } }
        },
        put: {
          tags: ["Customers"],
          summary: "Update customer",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" }, address: { type: "string" }, status: { type: "integer" } } }
              }
            }
          },
          responses: { 200: { description: "Customer updated" } }
        },
        delete: {
          tags: ["Customers"],
          summary: "Delete customer (Admin / Manager only)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Customer deleted" }, 403: { description: "Forbidden" } }
        }
      },

      // ─── Deals ───────────────────────────────────────────────────────
      "/deals": {
        get: {
          tags: ["Deals"],
          summary: "List deals (role-scoped)",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
            { in: "query", name: "search", schema: { type: "string" } },
            { in: "query", name: "stage", schema: { $ref: "#/components/schemas/DealStageEnum" } },
            { in: "query", name: "customerId", schema: { type: "string" } },
            { in: "query", name: "minAmount", schema: { type: "number" } },
            { in: "query", name: "maxAmount", schema: { type: "number" } },
            { in: "query", name: "sortBy", schema: { type: "string", default: "createdAt" } },
            { in: "query", name: "sortOrder", schema: { type: "string", enum: ["asc", "desc"] } }
          ],
          responses: { 200: { description: "Paginated deals" } }
        },
        post: {
          tags: ["Deals"],
          summary: "Create a deal",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateDealBody" } } }
          },
          responses: { 201: { description: "Deal created" } }
        }
      },
      "/deals/{id}": {
        get: {
          tags: ["Deals"],
          summary: "Get deal by ID",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deal details" }, 404: { description: "Not found" } }
        },
        put: {
          tags: ["Deals"],
          summary: "Update deal fields",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    value: { type: "number" },
                    probability: { type: "number" },
                    expectedClosingDate: { type: "string", format: "date-time" },
                    description: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { 200: { description: "Deal updated" } }
        },
        delete: {
          tags: ["Deals"],
          summary: "Delete deal (Admin / Manager only)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deal deleted" }, 403: { description: "Forbidden" } }
        }
      },
      "/deals/{id}/stage": {
        patch: {
          tags: ["Deals"],
          summary: "Update deal stage",
          description: "Moving to Lost (6) requires `lossReason`. Moving a Won/Lost deal back to active is restricted to Admins only.",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateDealStageBody" } } }
          },
          responses: {
            200: { description: "Stage updated" },
            400: { description: "Missing lossReason or invalid transition" }
          }
        }
      },

      // ─── Activities ──────────────────────────────────────────────────
      "/activities": {
        get: {
          tags: ["Activities"],
          summary: "List activities (role-scoped)",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
            { in: "query", name: "entityType", schema: { $ref: "#/components/schemas/EntityTypeEnum" } },
            { in: "query", name: "entityId", schema: { type: "string" } },
            { in: "query", name: "type", schema: { $ref: "#/components/schemas/ActivityTypeEnum" } },
            { in: "query", name: "status", schema: { $ref: "#/components/schemas/ActivityStatusEnum" } },
            { in: "query", name: "assignedTo", schema: { type: "string" } }
          ],
          responses: { 200: { description: "Paginated activities" } }
        },
        post: {
          tags: ["Activities"],
          summary: "Create an activity",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateActivityBody" } } }
          },
          responses: { 201: { description: "Activity created" } }
        }
      },
      "/activities/{id}": {
        get: {
          tags: ["Activities"],
          summary: "Get activity by ID",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Activity details" }, 404: { description: "Not found" } }
        },
        put: {
          tags: ["Activities"],
          summary: "Update activity",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateActivityBody" } } }
          },
          responses: { 200: { description: "Activity updated" } }
        },
        delete: {
          tags: ["Activities"],
          summary: "Delete activity (Admin / Manager only)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Activity deleted" }, 403: { description: "Forbidden" } }
        }
      },
      "/activities/{id}/complete": {
        patch: {
          tags: ["Activities"],
          summary: "Mark activity as complete",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Activity completed" } }
        }
      },

      // ─── Timeline ────────────────────────────────────────────────────
      "/timeline/{entityType}/{entityId}": {
        get: {
          tags: ["Timeline"],
          summary: "Get audit timeline for an entity",
          parameters: [
            { in: "path", name: "entityType", required: true, schema: { $ref: "#/components/schemas/EntityTypeEnum" }, description: "1=Lead, 2=Customer, 3=Deal" },
            { in: "path", name: "entityId", required: true, schema: { type: "string" } }
          ],
          responses: { 200: { description: "Timeline entries in reverse-chronological order" }, 403: { description: "Access denied" } }
        }
      },

      // ─── Analytics ───────────────────────────────────────────────────
      "/analytics/summary": {
        get: {
          tags: ["Analytics"],
          summary: "Dashboard summary — leads, deals, activities KPIs",
          parameters: [
            { in: "query", name: "startDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "endDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "assignedTo", schema: { type: "string" } },
            { in: "query", name: "managerId", schema: { type: "string" } }
          ],
          responses: { 200: { description: "Dashboard summary data" } }
        }
      },
      "/analytics/pipeline": {
        get: {
          tags: ["Analytics"],
          summary: "Deal pipeline distribution by stage",
          parameters: [
            { in: "query", name: "startDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "endDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "assignedTo", schema: { type: "string" } }
          ],
          responses: { 200: { description: "Pipeline stage data" } }
        }
      },
      "/analytics/leads-by-source": {
        get: {
          tags: ["Analytics"],
          summary: "Lead counts and conversion rates by source",
          parameters: [
            { in: "query", name: "startDate", schema: { type: "string", format: "date-time" } },
            { in: "query", name: "endDate", schema: { type: "string", format: "date-time" } }
          ],
          responses: { 200: { description: "Leads by source data" } }
        }
      },
      "/analytics/team-performance": {
        get: {
          tags: ["Analytics"],
          summary: "Per-user performance breakdown (Admin / Manager only)",
          parameters: [
            { in: "query", name: "managerId", schema: { type: "string" } }
          ],
          responses: {
            200: { description: "Team performance data" },
            403: { description: "Forbidden — Sales Executives cannot access this" }
          }
        }
      }
    }
  },
  apis: []
};

export const swaggerSpec = swaggerJsdoc(options);
