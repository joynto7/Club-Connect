# Club Connect

A full-stack platform for managing university clubs, events, and student engagement — club membership, event registration with paid ticketing, venue and resource booking, real-time notifications, analytics, and a full admin panel.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)

---

## Overview

Club Connect covers the full lifecycle of campus club activity for three kinds of users:

- **Students** discover and join clubs, RSVP to events (including paid ones via bKash/Nagad/Rocket/cards), book venues and equipment, follow clubs, earn points and badges, and get real-time notifications.
- **Club officers** manage membership, create and run events with QR check-in, post announcements and discussion threads, track a club budget, and view club-level analytics.
- **Admins** moderate content, manage users and clubs, review a full audit log, configure system settings, and export reports.

## Features

| Area | Highlights |
|---|---|
| **Auth** | JWT access/refresh tokens, email verification, password reset, 2FA (TOTP), Google OAuth, session management |
| **Clubs** | Approval workflow, membership roles, discussion posts, follow system, per-club analytics and budget tracking |
| **Events** | Approval workflow, RSVP with waitlist, QR-code check-in, Q&A, post-event feedback with AI sentiment analysis, paid tickets |
| **Bookings** | Venue and equipment booking with conflict detection |
| **Real-time** | Live notifications, attendance counters, and check-in updates over Socket.io |
| **Admin** | User/club/event moderation, content reports, audit log, bulk actions, system settings |
| **Engagement** | Points, badges, leaderboard, activity feed, member directory |
| **Payments** | Paid event tickets via SSLCommerz (bKash, Nagad, Rocket, cards) |
| **AI** | Claude-powered event description assistant and feedback sentiment analysis |
| **Other** | Calendar view with `.ics` export, PWA with push notifications, CSV/PDF reporting, Slack/Discord club integrations, OpenAPI docs |

## Tech stack

**Frontend** — Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Hook Form + Zod · Socket.io client · Tiptap · Recharts · FullCalendar

**Backend** — Express 5 (ESM) · TypeScript · Prisma 7 + PostgreSQL · Socket.io · JWT + Passport (Google OAuth) · SSLCommerz · Anthropic SDK · Multer + Sharp · Nodemailer · PDFKit · node-cron

**Infrastructure** — Vercel (frontend) · Render (backend) · Neon (Postgres) · Cloudflare R2 (file storage) · Resend (email)

## Project structure

```
Club Connect/
├── backend/           Express API — controllers, routes, Prisma schema & migrations
├── frontend/          Next.js app — App Router pages, components, client-side API layer
├── docker-compose.yml Local Postgres + Redis for development
└── .github/workflows/ CI: type-check, build, migrate, and deploy on push to main
```

## Getting started

**Prerequisites:** Node.js 20+, Docker (for local Postgres/Redis), npm

```bash
git clone https://github.com/joynto7/Club-Connect.git
cd Club-Connect

# Local database + cache
docker compose up -d postgres redis

# Backend
cd backend
npm install
cp .env.example .env        # fill in the values you need — see below
npx prisma migrate deploy
npm run dev                 # http://localhost:5001

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local  # fill in the values you need
npm run dev                 # http://localhost:3000
```

### Environment variables

Both `backend/.env.example` and `frontend/.env.example` are annotated with what each variable is for and which free-tier service to get it from (Neon, Render, Cloudflare R2, Resend, SSLCommerz, Anthropic, Google Cloud, Upstash). Everything except the database and JWT secrets is optional — the app degrades gracefully without AI, payments, push, or OAuth configured.

### API documentation

With the backend running in development, interactive OpenAPI docs are available at `http://localhost:5001/api/docs`. Disabled in production.

## Deployment

CI/CD is configured in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): every push to `main` type-checks and builds both apps, then on success runs database migrations and deploys the frontend to Vercel and the backend to Render.

## License

Private project — all rights reserved.
