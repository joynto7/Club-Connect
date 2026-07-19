import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Club Connect API",
      version: "1.0.0",
      description:
        "REST API for Club Connect — a university club management platform. Supports auth, clubs, events, venues, resources, notifications, analytics, payments, AI features, and more.",
      contact: { name: "Club Connect Team" },
    },
    servers: [
      { url: process.env.APP_URL ?? "http://127.0.0.1:5001", description: "API server" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Access token obtained from POST /auth/login",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            role: { type: "string", enum: ["STUDENT", "CLUB_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"] },
            department: { type: "string", nullable: true },
            year: { type: "string", nullable: true },
            interests: { type: "array", items: { type: "string" } },
            avatarUrl: { type: "string", nullable: true },
            emailVerified: { type: "boolean" },
            isSuspended: { type: "boolean" },
          },
        },
        Club: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string", nullable: true },
            category: { type: "string" },
            logoUrl: { type: "string", nullable: true },
            bannerUrl: { type: "string", nullable: true },
            status: { type: "string", enum: ["PENDING", "ACTIVE", "INACTIVE"] },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        Event: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            location: { type: "string" },
            category: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"] },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time", nullable: true },
            capacity: { type: "integer", nullable: true },
            isPaid: { type: "boolean" },
            ticketPrice: { type: "integer", nullable: true, description: "Price in cents" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string" },
            message: { type: "string" },
            read: { type: "boolean" },
            link: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Announcement: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            content: { type: "string" },
            priority: { type: "string" },
            publishedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Tokens: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: {} },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            pages: { type: "integer" },
          },
        },
        ClubIntegration: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            clubId: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["SLACK", "DISCORD"] },
            webhookUrl: { type: "string", format: "uri" },
            events: {
              type: "array",
              items: { type: "string", enum: ["NEW_EVENT", "NEW_MEMBER", "ANNOUNCEMENT"] },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication & account management" },
      { name: "Users", description: "User profile & preferences" },
      { name: "Clubs", description: "Club management & membership" },
      { name: "Events", description: "Event management, RSVP & check-in" },
      { name: "Venues", description: "Venue booking" },
      { name: "Resources", description: "Equipment & resource booking" },
      { name: "Notifications", description: "In-app notifications" },
      { name: "Announcements", description: "Club & global announcements" },
      { name: "Search", description: "Search & recommendations" },
      { name: "Analytics", description: "Club & platform analytics" },
      { name: "Admin", description: "Admin panel operations" },
      { name: "Reports", description: "Export reports (CSV/PDF)" },
      { name: "Payments", description: "SSLCommerz checkout & club budgets" },
      { name: "AI", description: "Claude AI features" },
      { name: "Leaderboard", description: "Points & leaderboard" },
      { name: "Integrations", description: "Slack/Discord webhook integrations" },
    ],
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────────
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new account",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "password"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                    department: { type: "string" },
                    year: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Registered successfully — verification email sent" },
            "409": { description: "Email already registered", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Log in and receive JWT tokens",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      { $ref: "#/components/schemas/Tokens" },
                      {
                        type: "object",
                        properties: { requires2FA: { type: "boolean" }, tempToken: { type: "string" } },
                      },
                    ],
                  },
                },
              },
            },
            "401": { description: "Invalid credentials" },
            "423": { description: "Account locked" },
          },
        },
      },
      "/auth/logout": {
        post: { tags: ["Auth"], summary: "Log out (clears session & refresh token)", responses: { "200": { description: "Logged out" } } },
      },
      "/auth/refresh-token": {
        post: {
          tags: ["Auth"],
          summary: "Rotate access and refresh tokens",
          security: [],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } } } } },
          responses: { "200": { description: "New tokens", content: { "application/json": { schema: { $ref: "#/components/schemas/Tokens" } } } } },
        },
      },
      "/auth/me": {
        get: { tags: ["Auth"], summary: "Get the authenticated user's profile", responses: { "200": { description: "User object", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } } },
      },
      "/auth/google": {
        get: {
          tags: ["Auth"],
          summary: "Start Google OAuth flow (redirects to Google consent page)",
          security: [],
          responses: { "302": { description: "Redirect to Google" } },
        },
      },
      "/auth/google/callback": {
        get: {
          tags: ["Auth"],
          summary: "Google OAuth callback — redirects to frontend with tokens",
          security: [],
          parameters: [
            { in: "query", name: "code", required: true, schema: { type: "string" } },
            { in: "query", name: "state", schema: { type: "string" } },
          ],
          responses: { "302": { description: "Redirect to frontend /auth/google/callback with tokens in query params" } },
        },
      },
      "/auth/2fa/setup": {
        post: { tags: ["Auth"], summary: "Generate 2FA TOTP secret & QR code", responses: { "200": { description: "{ secret, qrDataUrl }" } } },
      },
      "/auth/2fa/verify": {
        post: { tags: ["Auth"], summary: "Verify TOTP code and enable 2FA", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string", minLength: 6, maxLength: 6 } } } } } }, responses: { "200": { description: "2FA enabled" } } },
      },
      "/auth/2fa/disable": {
        post: { tags: ["Auth"], summary: "Disable 2FA", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string" } } } } } }, responses: { "200": { description: "2FA disabled" } } },
      },
      "/auth/2fa/login": {
        post: { tags: ["Auth"], summary: "Complete 2FA login with TOTP code", security: [], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["tempToken", "token"], properties: { tempToken: { type: "string" }, token: { type: "string" } } } } } }, responses: { "200": { description: "Tokens", content: { "application/json": { schema: { $ref: "#/components/schemas/Tokens" } } } } } },
      },
      "/auth/sessions": {
        get: { tags: ["Auth"], summary: "List active sessions for the current user", responses: { "200": { description: "Array of Session objects" } } },
      },
      "/auth/sessions/all": {
        delete: { tags: ["Auth"], summary: "Revoke all sessions (log out everywhere)", responses: { "200": { description: "All sessions revoked" } } },
      },
      "/auth/sessions/{id}": {
        delete: { tags: ["Auth"], summary: "Revoke a specific session", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Session revoked" } } },
      },
      // ── Users ─────────────────────────────────────────────────────────────
      "/users/me": {
        get: { tags: ["Users"], summary: "Get current user's full profile", responses: { "200": { description: "User profile", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } } },
        put: { tags: ["Users"], summary: "Update current user's profile", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, department: { type: "string" }, year: { type: "string" }, interests: { type: "array", items: { type: "string" } }, avatarUrl: { type: "string" } } } } } }, responses: { "200": { description: "Updated user" } } },
      },
      "/users/me/history": {
        get: { tags: ["Users"], summary: "Get participation history (events + clubs)", responses: { "200": { description: "History object" } } },
      },
      "/users/me/clubs": {
        get: { tags: ["Users"], summary: "Get clubs the current user belongs to", responses: { "200": { description: "Array of club memberships" } } },
      },
      "/users/me/points": {
        get: { tags: ["Users"], summary: "Get current user's points, level, and transaction history", responses: { "200": { description: "Points data" } } },
      },
      "/users/me/achievements": {
        get: { tags: ["Users"], summary: "Get all 7 achievements with unlock status", responses: { "200": { description: "Achievement list" } } },
      },
      "/users/me/notification-preferences": {
        get: { tags: ["Users"], summary: "Get notification preferences", responses: { "200": { description: "Preferences object" } } },
        put: { tags: ["Users"], summary: "Update notification preferences", responses: { "200": { description: "Updated preferences" } } },
      },
      "/users/me/push-subscription": {
        post: { tags: ["Users"], summary: "Register a push subscription", responses: { "200": { description: "Subscription saved" } } },
        delete: { tags: ["Users"], summary: "Remove push subscription", responses: { "200": { description: "Subscription removed" } } },
      },
      "/users": {
        get: { tags: ["Users"], summary: "User directory — search by name, department, year", parameters: [{ in: "query", name: "search", schema: { type: "string" } }, { in: "query", name: "department", schema: { type: "string" } }, { in: "query", name: "year", schema: { type: "string" } }], responses: { "200": { description: "Array of public user profiles" } } },
      },
      "/users/{userId}": {
        get: { tags: ["Users"], summary: "Get a public user profile", parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Public profile" } } },
      },
      // ── Clubs ─────────────────────────────────────────────────────────────
      "/clubs": {
        get: { tags: ["Clubs"], summary: "Browse club directory", security: [{}], parameters: [{ in: "query", name: "q", schema: { type: "string" } }, { in: "query", name: "category", schema: { type: "string" } }], responses: { "200": { description: "Array of clubs" } } },
        post: { tags: ["Clubs"], summary: "Request club creation", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "description"], properties: { name: { type: "string" }, description: { type: "string" }, category: { type: "string" }, tags: { type: "array", items: { type: "string" } } } } } } }, responses: { "201": { description: "Club created (PENDING)" } } },
      },
      "/clubs/{id}": {
        get: { tags: ["Clubs"], summary: "Get club profile", security: [{}], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" }, description: "Club UUID or slug" }], responses: { "200": { description: "Club detail" } } },
        put: { tags: ["Clubs"], summary: "Update club info (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated club" } } },
        delete: { tags: ["Clubs"], summary: "Deactivate club (admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Club deactivated" } } },
      },
      "/clubs/{id}/approve": {
        post: { tags: ["Clubs"], summary: "Approve club (admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Club approved" } } },
      },
      "/clubs/{id}/reject": {
        post: { tags: ["Clubs"], summary: "Reject club (admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Club rejected" } } },
      },
      "/clubs/{id}/members": {
        get: { tags: ["Clubs"], summary: "List club members", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Members list" } } },
      },
      "/clubs/{id}/members/request": {
        post: { tags: ["Clubs"], summary: "Request membership", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "201": { description: "Request submitted" } } },
      },
      "/clubs/{id}/follow": {
        post: { tags: ["Clubs"], summary: "Follow a club", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Followed" } } },
        delete: { tags: ["Clubs"], summary: "Unfollow a club", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Unfollowed" } } },
      },
      "/clubs/{id}/analytics": {
        get: { tags: ["Analytics"], summary: "Get club analytics (officer/admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Club analytics data" } } },
      },
      "/clubs/{id}/budget": {
        get: { tags: ["Payments"], summary: "Get club budget (auto-creates on first call)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Budget with transactions" } } },
      },
      "/clubs/{id}/budget/allocate": {
        put: { tags: ["Payments"], summary: "Set budget allocation (admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Budget updated" } } },
      },
      "/clubs/{id}/budget/transactions": {
        post: { tags: ["Payments"], summary: "Add a budget transaction (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "201": { description: "Transaction added" } } },
      },
      "/clubs/{id}/integrations": {
        get: { tags: ["Integrations"], summary: "List Slack/Discord integrations for a club", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Array of ClubIntegration objects", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ClubIntegration" } } } } } } },
        post: { tags: ["Integrations"], summary: "Create or update a webhook integration (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["type", "webhookUrl", "events"], properties: { type: { type: "string", enum: ["SLACK", "DISCORD"] }, webhookUrl: { type: "string", format: "uri" }, events: { type: "array", items: { type: "string", enum: ["NEW_EVENT", "NEW_MEMBER", "ANNOUNCEMENT"] } } } } } } }, responses: { "200": { description: "Integration saved", content: { "application/json": { schema: { $ref: "#/components/schemas/ClubIntegration" } } } } } },
      },
      "/clubs/{id}/integrations/{integrationId}": {
        delete: { tags: ["Integrations"], summary: "Delete a webhook integration (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }, { in: "path", name: "integrationId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } },
      },
      // ── Events ────────────────────────────────────────────────────────────
      "/events": {
        get: { tags: ["Events"], summary: "List events", security: [{}], parameters: [{ in: "query", name: "q", schema: { type: "string" } }, { in: "query", name: "filter", schema: { type: "string", enum: ["upcoming", "week", "month", "all"] } }, { in: "query", name: "category", schema: { type: "string" } }], responses: { "200": { description: "Array of events" } } },
        post: { tags: ["Events"], summary: "Create event (officer only) — status PENDING_APPROVAL", responses: { "201": { description: "Event created" } } },
      },
      "/events/{id}": {
        get: { tags: ["Events"], summary: "Get event detail", security: [{}], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Event detail with myRegistration" } } },
        put: { tags: ["Events"], summary: "Update event (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated event" } } },
        delete: { tags: ["Events"], summary: "Cancel event (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Event cancelled" } } },
      },
      "/events/{id}/register": {
        post: { tags: ["Events"], summary: "RSVP for an event", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "201": { description: "Registered (or waitlisted)" } } },
        delete: { tags: ["Events"], summary: "Cancel registration", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Registration cancelled" } } },
      },
      "/events/{id}/approve": {
        post: { tags: ["Events"], summary: "Approve event (admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Event approved" } } },
      },
      "/events/{id}/reject": {
        post: { tags: ["Events"], summary: "Reject event (admin only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Event rejected" } } },
      },
      "/events/{id}/feedback": {
        post: { tags: ["Events"], summary: "Submit feedback (registered attendee, event ended)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "201": { description: "Feedback submitted" } } },
        get: { tags: ["Events"], summary: "Get feedback + sentiment analysis (officer/admin)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Aggregated feedback with sentiment" } } },
      },
      "/events/{id}/ticket": {
        get: { tags: ["Events"], summary: "Get QR ticket token (confirmed attendee only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "{ token, eventTitle, attendeeName, startsAt, location }" } } },
      },
      "/events/{id}/scan": {
        post: { tags: ["Events"], summary: "Scan QR ticket (officer only)", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string" } } } } } }, responses: { "200": { description: "Scan result" } } },
      },
      "/events/{id}/ics": {
        get: { tags: ["Events"], summary: "Download .ics calendar file", security: [{}], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "iCal file", content: { "text/calendar": {} } } } },
      },
      "/events/{id}/checkout": {
        post: { tags: ["Payments"], summary: "Create SSLCommerz payment session for paid event", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "{ sessionUrl }" } } },
      },
      // ── Search ────────────────────────────────────────────────────────────
      "/search": {
        get: { tags: ["Search"], summary: "Global search across clubs, events, announcements", security: [{}], parameters: [{ in: "query", name: "q", required: true, schema: { type: "string" } }, { in: "query", name: "type", schema: { type: "string", enum: ["all", "clubs", "events", "announcements"] } }], responses: { "200": { description: "Search results" } } },
      },
      "/search/recommendations": {
        get: { tags: ["Search"], summary: "Personalized event recommendations (multi-signal scoring)", responses: { "200": { description: "Recommended events" } } },
      },
      // ── Notifications ─────────────────────────────────────────────────────
      "/notifications": {
        get: { tags: ["Notifications"], summary: "List latest 50 notifications", responses: { "200": { description: "{ notifications, unreadCount }" } } },
      },
      "/notifications/read-all": {
        put: { tags: ["Notifications"], summary: "Mark all notifications as read", responses: { "200": { description: "All marked read" } } },
      },
      "/notifications/{id}/read": {
        put: { tags: ["Notifications"], summary: "Mark a single notification as read", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Marked read" } } },
      },
      // ── Announcements ─────────────────────────────────────────────────────
      "/announcements": {
        get: { tags: ["Announcements"], summary: "List announcements (global + user's clubs)", security: [{}], responses: { "200": { description: "Array of announcements" } } },
        post: { tags: ["Announcements"], summary: "Create announcement (officer: club-only; admin: global)", responses: { "201": { description: "Announcement created" } } },
      },
      // ── Venues ────────────────────────────────────────────────────────────
      "/venues": {
        get: { tags: ["Venues"], summary: "List active venues", security: [{}], responses: { "200": { description: "Array of venues" } } },
        post: { tags: ["Venues"], summary: "Create venue (admin only)", responses: { "201": { description: "Venue created" } } },
      },
      "/venues/{id}/book": {
        post: { tags: ["Venues"], summary: "Request a venue booking", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "201": { description: "Booking request created" } } },
      },
      "/venues/{id}/availability": {
        get: { tags: ["Venues"], summary: "Check venue availability for a date", security: [{}], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }, { in: "query", name: "date", required: true, schema: { type: "string", format: "date" } }], responses: { "200": { description: "Approved bookings on that date" } } },
      },
      // ── Admin ─────────────────────────────────────────────────────────────
      "/admin/stats": {
        get: { tags: ["Admin"], summary: "Platform statistics (admin only)", responses: { "200": { description: "Pending counts, lists, recent activity" } } },
      },
      "/admin/analytics": {
        get: { tags: ["Analytics"], summary: "System-wide analytics (admin only)", responses: { "200": { description: "Platform analytics" } } },
      },
      "/admin/audit-log": {
        get: { tags: ["Admin"], summary: "Paginated audit log (admin only)", parameters: [{ in: "query", name: "action", schema: { type: "string" } }, { in: "query", name: "from", schema: { type: "string", format: "date" } }, { in: "query", name: "to", schema: { type: "string", format: "date" } }, { in: "query", name: "page", schema: { type: "integer" } }], responses: { "200": { description: "Paginated audit log" } } },
      },
      "/admin/users": {
        get: { tags: ["Admin"], summary: "List all users (admin only)", parameters: [{ in: "query", name: "q", schema: { type: "string" } }, { in: "query", name: "role", schema: { type: "string" } }, { in: "query", name: "suspended", schema: { type: "boolean" } }, { in: "query", name: "page", schema: { type: "integer" } }], responses: { "200": { description: "Paginated users" } } },
      },
      "/admin/clubs/bulk-approve": {
        post: { tags: ["Admin"], summary: "Bulk approve clubs", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } } } } } }, responses: { "200": { description: "{ approved, failed }" } } },
      },
      "/admin/events/bulk-approve": {
        post: { tags: ["Admin"], summary: "Bulk approve events", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } } } } } }, responses: { "200": { description: "{ approved, failed }" } } },
      },
      "/admin/users/bulk-suspend": {
        post: { tags: ["Admin"], summary: "Bulk suspend users", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } }, reason: { type: "string" } } } } } }, responses: { "200": { description: "{ suspended, failed }" } } },
      },
      // ── Reports ───────────────────────────────────────────────────────────
      "/reports": {
        get: { tags: ["Reports"], summary: "List generated reports (admin only)", responses: { "200": { description: "Array of report metadata" } } },
      },
      "/reports/generate": {
        post: { tags: ["Reports"], summary: "Generate and stream a report (admin only)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["type", "format"], properties: { type: { type: "string", enum: ["MEMBERS", "ATTENDANCE", "EVENTS", "SYSTEM"] }, format: { type: "string", enum: ["CSV", "PDF"] }, clubId: { type: "string" }, eventId: { type: "string" } } } } } }, responses: { "200": { description: "File stream (CSV or PDF)" } } },
      },
      "/reports/certificate": {
        post: { tags: ["Reports"], summary: "Download attendance certificate PDF (checked-in attendees only)", responses: { "200": { description: "PDF file stream" } } },
      },
      // ── AI ────────────────────────────────────────────────────────────────
      "/ai/event-description": {
        post: { tags: ["AI"], summary: "Generate event description via Claude (SSE streaming, officer only)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title"], properties: { title: { type: "string" }, category: { type: "string" }, location: { type: "string" } } } } } }, responses: { "200": { description: "SSE stream: data: {text} ... data: [DONE]", content: { "text/event-stream": {} } } } },
      },
      // ── Leaderboard ───────────────────────────────────────────────────────
      "/leaderboard": {
        get: { tags: ["Leaderboard"], summary: "All-time leaderboard (top 20)", security: [{}], responses: { "200": { description: "Ranked user list" } } },
      },
      "/leaderboard/semester": {
        get: { tags: ["Leaderboard"], summary: "Semester leaderboard (top 20 since 2026-01-01)", security: [{}], responses: { "200": { description: "Ranked user list" } } },
      },
      // ── Payments ──────────────────────────────────────────────────────────
      "/payments/my": {
        get: { tags: ["Payments"], summary: "List current user's payment history", responses: { "200": { description: "Array of payments" } } },
      },
      "/payments/sslcommerz/success": {
        post: { tags: ["Payments"], summary: "SSLCommerz success redirect (form-encoded, no auth — verified server-side before trusting)", security: [], responses: { "302": { description: "Redirect to frontend event page" } } },
      },
      "/payments/sslcommerz/fail": {
        post: { tags: ["Payments"], summary: "SSLCommerz failure redirect (form-encoded, no auth)", security: [], responses: { "302": { description: "Redirect to frontend event page" } } },
      },
      "/payments/sslcommerz/cancel": {
        post: { tags: ["Payments"], summary: "SSLCommerz cancellation redirect (form-encoded, no auth)", security: [], responses: { "302": { description: "Redirect to frontend event page" } } },
      },
      "/payments/sslcommerz/ipn": {
        post: { tags: ["Payments"], summary: "SSLCommerz server-to-server IPN (form-encoded, no auth)", security: [], responses: { "200": { description: "Acknowledged" } } },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
