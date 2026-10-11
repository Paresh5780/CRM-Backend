
# CRM Sales Management API

A production-grade REST API for managing the complete B2B sales lifecycle — from lead capture through customer conversion, deal tracking, activity management, and analytics reporting.

---

## Table of Contents
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Business Logic](#business-logic)
- [Environment Configuration](#environment-configuration)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Running Tests](#running-tests)
- [Deployment](#deployment)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (HTTP)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Express Application                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Helmet +   │  │  Rate Limit  │  │      CORS       │   │
│  │   Security   │  │  (per env)   │  │  (whitelist)    │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Routes Layer                      │   │
│  │  /auth  /users  /leads  /customers  /deals           │   │
│  │  /activities  /timeline  /analytics  /docs           │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │              Middleware Pipeline                     │   │
│  │  authenticate → authorize → validate (Zod)          │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │                 Controllers Layer                    │   │
│  │  auth  user  lead  customer  deal  activity          │   │
│  │  timeline  analytics                                 │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │               Mongoose Models / ODM                  │   │
│  │  User  Lead  Customer  Deal  Activity  Timeline      │   │
│  └──────────────────────┬───────────────────────────────┘   │
└──────────────────────── │ ──────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│               MongoDB Atlas (cloud database)               │
└────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
Request → Helmet/CORS → Rate Limit → Router → authenticate
        → [authorize] → [validate] → Controller → Model → DB
        → apiResponse wrapper → Client
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 (ES Modules) |
| Framework | Express 4 |
| Database | MongoDB via Mongoose 8 |
| Auth | JWT (access + refresh token pattern) |
| Validation | Zod |
| Security | Helmet, express-rate-limit, bcrypt |
| API Docs | Swagger UI / OpenAPI 3.0 (swagger-ui-express) |
| Testing | Node.js built-in `--test` runner |

---

## Project Structure

```
crm-sales-api/
├── src/
│   ├── app.js                    # Express app setup, middleware, route mounting
│   ├── server.js                 # Entry point — DB connect, seed, listen
│   ├── config/
│   │   ├── db.js                 # Mongoose connection
│   │   ├── env.js                # Validated environment config
│   │   ├── seedAdmin.js          # Ensures default Admin account exists
│   │   └── swagger.js            # Full OpenAPI 3.0 spec
│   ├── controllers/
│   │   ├── auth.controller.js    # Login, refresh, logout, /me
│   │   ├── user.controller.js    # User CRUD
│   │   ├── lead.controller.js    # Lead lifecycle + conversion
│   │   ├── customer.controller.js
│   │   ├── deal.controller.js    # Deal pipeline + stage transitions
│   │   ├── activity.controller.js
│   │   ├── timeline.controller.js
│   │   └── analytics.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js    # authenticate + authorize
│   │   ├── validate.js           # Zod request validation
│   │   ├── errorHandler.js       # Centralized error handler
│   │   └── notFound.js           # 404 handler
│   ├── models/
│   │   ├── user.model.js         # Bcrypt, toJSON, role enum
│   │   ├── lead.model.js         # Lead schema + indexes
│   │   ├── customer.model.js
│   │   ├── deal.model.js         # Pre-save hook: probability & expectedRevenue
│   │   ├── activity.model.js     # Virtual: computedStatus (overdue detection)
│   │   └── timeline.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── lead.routes.js
│   │   ├── customer.routes.js
│   │   ├── deal.routes.js
│   │   ├── activity.routes.js
│   │   ├── timeline.routes.js
│   │   ├── analytics.routes.js
│   │   └── health.routes.js
│   ├── utils/
│   │   ├── usedConstants.js      # All numeric enum constants
│   │   ├── apiResponse.js        # Uniform response wrapper
│   │   ├── ApiError.js           # Custom HTTP error class
│   │   ├── asyncHandler.js       # Async error propagation
│   │   ├── token.js              # JWT sign/verify helpers
│   │   └── timelineHelper.js     # Fire-and-forget timeline recorder
│   └── validators/               # Zod schemas per resource
├── tests/
│   ├── helpers.js                # Shared request util + login helpers
│   ├── auth.test.js              # Auth flow tests
│   ├── rbac.test.js              # Role permission tests
│   ├── lead-conversion.test.js   # Lead → Customer + Deal transaction tests
│   └── deal-rules.test.js        # Deal stage, probability, lossReason tests
├── .env                          # Environment variables (not committed)
├── .env.example                  # Template for environment setup
└── package.json
```

---

## Business Logic

### Roles & Permissions

All roles are stored as integers in the database and defined in `usedConstants.js`.

| Role | Value | Scope |
|---|---|---|
| Admin | `1` | Full access — all records, all users |
| Sales Manager | `2` | Own records + direct reports' records |
| Sales Executive | `3` | Only their own assigned records |

### Lead Lifecycle

```
New (1) → Contacted (2) → Qualified (3) → Converted (5)
                        ↘                ↘
                    Unqualified (4)     Lost (6)
```

**Conversion Rules:**
- Only leads with status = `Qualified (3)` can be converted.
- Conversion is **atomic** — creates Customer + Deal in a single MongoDB transaction (falls back gracefully if replica set is unavailable).
- After conversion, the lead is locked — no further status changes or field edits are allowed.
- Duplicate conversion attempts return `400`.

### Deal Pipeline

```
Qualification (1) → Discovery (2) → Proposal (3) → Negotiation (4) → Won (5)
                                                                    ↘ Lost (6)
```

**Auto-computed fields (Mongoose pre-save hook):**
- `probability`: auto-set from `STAGE_DEFAULT_PROBABILITIES` when stage changes (10/25/50/75/100/0).
- `expectedRevenue`: always `value × probability / 100`.

**Stage Rules:**
- Moving to `Lost (6)` requires a non-empty `lossReason`.
- Moving a `Won` or `Lost` deal back to an active stage is restricted to **Admins only**.

### Activity Overdue Detection

Activities have a virtual `computedStatus` field:
- If `status = Pending` and `dueDate < now` → `computedStatus = 3 (Overdue)`.
- The stored `status` field only holds `1 (Pending)` or `2 (Completed)`.

### Timeline Audit

Every significant action (create, update, status change, assign, convert, stage change, complete) triggers a fire-and-forget `recordTimeline()` call. Timeline entries are stored with `previousValue`, `newValue`, and `performedBy` references.

---

## Environment Configuration

Copy `.env.example` and fill in values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | ✅ | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | ✅ | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | ✅ | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (e.g. `7d`) |
| `PORT` | ✅ | HTTP port (default `5000`) |
| `NODE_ENV` | ✅ | `development` or `production` |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | ✅ | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX` | ✅ | Max requests per window |

**`.env.example`:**
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/crm-sales
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- A MongoDB Atlas cluster (or local MongoDB with replica set for full transaction support)

### Installation

```bash
cd crm-sales-api
npm install
cp .env.example .env
# Edit .env with your values
```

### Run in Development

```bash
npm run dev
```

The server starts on `http://localhost:5000`. On first startup, a default Admin account is seeded:

| Field | Value |
|---|---|
| Email | `admin@crm.com` |
| Password | `AdminPassword123!` |

---

## API Documentation

### Interactive Swagger UI

Once the server is running, open:

```
http://localhost:5000/api/v1/docs
```

The Swagger UI provides:
- Full endpoint reference with request/response schemas
- Live "Try it out" for all endpoints
- Enum constant reference tables
- Authentication flow guide

### Base URL

```
http://localhost:5000/api/v1
```

### Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@crm.com", "password": "AdminPassword123!" }
```

All subsequent requests must include:
```
Authorization: Bearer <accessToken>
```

### Endpoint Summary

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh-token`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET/POST /users`, `GET/PUT/DELETE /users/:id` |
| Leads | `GET/POST /leads`, `GET/PUT/DELETE /leads/:id`, `PATCH /:id/status`, `PATCH /:id/assign`, `POST /:id/convert` |
| Customers | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| Deals | `GET/POST /deals`, `GET/PUT/DELETE /deals/:id`, `PATCH /:id/stage` |
| Activities | `GET/POST /activities`, `GET/PUT/DELETE /activities/:id`, `PATCH /:id/complete` |
| Timeline | `GET /timeline/:entityType/:entityId` |
| Analytics | `GET /analytics/summary`, `/pipeline`, `/leads-by-source`, `/team-performance` |
| Health | `GET /health` |

---

## Running Tests

> **Prerequisite:** The API server must be running on `http://localhost:5000`.

```bash
# Run all test suites
npm test

# Run individual suites
npm run test:auth      # Auth flow
npm run test:rbac      # RBAC permissions
npm run test:leads     # Lead conversion transaction
npm run test:deals     # Deal business rules
```

### Test Coverage

| Suite | Tests | What it covers |
|---|---|---|
| `auth.test.js` | 7 | Login, wrong credentials, token refresh, auth guard |
| `rbac.test.js` | 15 | Role-based access: users, leads, analytics, deal stage re-open |
| `lead-conversion.test.js` | 10 | Pre-conversion rules, atomic transaction, duplicate guard, timeline |
| `deal-rules.test.js` | 12 | Stage transitions, auto-probability, lossReason, validation, timeline |
| **Total** | **44** | |

---

## Deployment

### Production Start

```bash
NODE_ENV=production npm start
```

### Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, randomly-generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (≥ 64 chars)
- [ ] Configure `CORS_ORIGINS` to your production frontend URL only
- [ ] Use MongoDB Atlas with a replica set for full transaction support
- [ ] Set appropriate `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` for your expected traffic
- [ ] Enable HTTPS via a reverse proxy (Nginx, Caddy) or your hosting provider

### Hosting Recommendations

| Provider | Notes |
|---|---|
| **Railway** | One-click Node.js deploy, env vars in dashboard |
| **Render** | Free tier available, env vars supported |
| **Fly.io** | Excellent for Docker-based Node.js |
| **Heroku** | Classic choice, needs Procfile: `web: node src/server.js` |

### Health Check

```
GET /api/v1/health
```

Returns `200 OK` when the server is running. Use this as your load balancer / uptime monitor endpoint.
=======
