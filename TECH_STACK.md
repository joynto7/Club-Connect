# Club Connect — Full Tech Stack

---

## Languages

- TypeScript (frontend + backend)
- SQL (PostgreSQL via Prisma migrations)

---

## Frontend

### Core Framework
- Next.js 16 (App Router)
- React 19
- React DOM 19

### Styling
- Tailwind CSS v4
- PostCSS

### State & Data Fetching
- TanStack React Query v5 — server state, caching, background refetch
- Axios — HTTP client

### Forms & Validation
- React Hook Form v7
- @hookform/resolvers — connects Zod schemas to RHF
- Zod v4 — schema validation

### Real-Time
- socket.io-client v4 — connects to backend Socket.io server

### UI Components & Utilities
- Lucide React — icon library
- Sonner — toast notifications
- Framer Motion — animations
- date-fns — date formatting and manipulation
- use-debounce — debounced search inputs

### Rich Text Editor
- Tiptap (React, Starter Kit, Link extension, Placeholder extension, ProseMirror)

### Charts & Data Visualization
- Recharts — analytics dashboards, budget charts

### Calendar
- FullCalendar (React, DayGrid, TimeGrid, Interaction) — event calendar views

### Payments (client-side)
- @stripe/stripe-js
- @stripe/react-stripe-js — Stripe Checkout integration

### QR Code
- qrcode.react — display QR codes (2FA setup, event check-in)
- html5-qrcode — scan QR codes via camera (event check-in)

### Progressive Web App
- @ducanh2912/next-pwa — service worker, offline support, install prompt

### Dev Tools (Frontend)
- TypeScript v5
- ESLint + eslint-config-next
- Nodemon (not used in frontend — just noting it's backend-only)

---

## Backend

### Core Framework
- Express v5 (ESM modules)
- Node.js 20

### Language & Build
- TypeScript v6
- ts-node — runs TypeScript directly in dev
- tsc — compiles to JavaScript for production

### ORM & Database
- Prisma v7 — ORM, schema, migrations, query builder
- @prisma/client — generated type-safe database client
- @prisma/adapter-pg — PostgreSQL adapter for Prisma

### Authentication & Security
- jsonwebtoken — JWT access tokens (15 min) and refresh tokens (7 days)
- bcryptjs — password hashing
- passport — OAuth middleware
- passport-google-oauth20 — Google OAuth 2.0 strategy
- otplib — TOTP 2FA (two-factor authentication, RFC 6238)
- helmet — HTTP security headers
- cors — Cross-Origin Resource Sharing
- express-rate-limit — rate limiting on auth endpoints

### Real-Time
- socket.io v4 — WebSocket server, authenticated rooms
- ioredis — Redis client for Node.js
- @socket.io/redis-adapter — enables Socket.io across multiple server instances

### File Uploads & Image Processing
- multer — multipart/form-data file handling
- sharp — image resizing and WebP conversion

### Cloud Storage
- @aws-sdk/client-s3 — upload files to AWS S3 or Cloudflare R2
- @aws-sdk/s3-request-presigner — generate pre-signed URLs

### Email
- nodemailer — SMTP email sending (password reset, email verification, notifications)

### Payments
- stripe v22 — Stripe Checkout, webhooks, payment processing

### AI
- @anthropic-ai/sdk — Claude API for AI event description generation and feedback sentiment analysis

### Push Notifications
- web-push — Web Push Protocol, VAPID key authentication

### PDF Generation
- pdfkit — generate PDF reports (event attendance, analytics exports)

### QR Codes
- qrcode — generate QR code data URLs (2FA setup)

### Scheduling
- node-cron — cron job for event reminder emails

### API Documentation
- swagger-jsdoc — builds OpenAPI 3.0.3 spec from JSDoc comments
- swagger-ui-express — serves interactive Swagger UI at /api/docs

### Validation
- zod v3 — request body validation in all controllers

### Utilities
- uuid — generate unique IDs for uploaded files
- dotenv — loads .env into process.env

### Logging
- winston — structured JSON logging in production, pretty console in dev

### Dev Tools (Backend)
- nodemon — auto-restart on file changes in dev
- ts-node — TypeScript execution in dev
- ESLint + @typescript-eslint — linting
- Prettier — code formatting

---

## Database

- PostgreSQL 16 — primary relational database

### Database Models (33 total)
- User
- Session
- Club
- ClubMembership
- Event
- EventAttendance
- Venue
- VenueBooking
- Resource
- ResourceBooking
- Notification
- NotificationPreference
- Announcement
- EventFeedback
- ContentReport
- SystemConfig
- Report
- ClubPost
- ClubPostComment
- ClubPostReaction
- EventQuestion
- ClubFollow
- UserPoints
- PointTransaction
- Achievement
- UserAchievement
- EventReminder
- PushSubscription
- AuditLog
- EmailDigestSubscription
- Payment
- ClubBudget
- BudgetTransaction
- ClubIntegration

---

## Infrastructure & Deployment

### Containerisation
- Docker — multi-stage Dockerfiles for backend and frontend
- Docker Compose — local full-stack environment (Postgres + Redis + backend + frontend)

### Hosting (recommended)
- Vercel — Next.js frontend hosting
- Railway — Express backend + Redis hosting
- Neon / Supabase — managed PostgreSQL

### File Storage
- AWS S3 — file uploads (avatars, event posters, banners, logos)
- Cloudflare R2 — alternative to S3 (S3-compatible, no egress fees)

### CDN & Security
- Cloudflare — DNS, DDoS protection, WAF, SSL/TLS termination

### CI/CD
- GitHub Actions — automated type-check, build, DB migration, and deploy on every push to main

### Secret Management
- Railway Variables — backend secrets in production
- Vercel Environment Variables — frontend env vars in production

---

## External Services

| Service | Purpose |
|---|---|
| Anthropic Claude | AI event descriptions, feedback sentiment analysis |
| Stripe | Payment processing, Checkout sessions, webhooks |
| Google OAuth | Sign in with Google |
| SMTP (Resend / SendGrid) | Transactional email |
| Redis (Upstash / Railway) | Socket.io multi-instance pub/sub |
| AWS S3 / Cloudflare R2 | Persistent file storage |

---

## Dev Environment

- Node.js 20
- npm
- Git + GitHub
- VS Code (recommended)

---

## API

- REST — all main endpoints
- WebSocket (Socket.io) — real-time notifications, event check-in counters, admin queue
- Server-Sent Events (SSE) — AI event description streaming
- OpenAPI 3.0.3 — full API spec auto-generated, served at `/api/docs`
