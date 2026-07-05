# Club Connect — Comprehensive Upgrade Implementation Plan

> **Base:** All 10 original phases complete (73 use cases). All upgrades build on top.
> **Rule:** After every phase completes → update `HANDOVER.md` before starting the next.
> **Stack:** Next.js 16 App Router · Express v5 ESM · Prisma v7 · PostgreSQL · TypeScript

---

## Phase Overview & Order

| # | Phase | Description | New Models | New Pages | Effort |
|---|---|---|---|---|---|
| U1 | UI Polish | Animations, toasts, skeletons, dark mode, command palette | 0 | 0 | Low |
| U2 | Real-Time | Socket.io — live notifications, counters, check-in board | 0 | 0 | Medium |
| U3 | File Uploads + Rich Text | multer + sharp uploads, Tiptap editor | 0 | 0 | Medium |
| U4 | Social & Community | Club posts, event Q&A, follow system, activity feed, member directory | 6 | 5 | High |
| U5 | Gamification | Points, badges, leaderboard, streaks, certificates | 4 | 3 | Medium |
| U6 | Smart Event UX | QR tickets, countdown, reminders, waitlist position, virtual events | 2 | 2 | Medium |
| U7 | AI Features | Claude description assistant, smart recommendations, sentiment analysis | 0 | 0 | Medium |
| U8 | Calendar | FullCalendar view, .ics export, conflict detection | 1 | 1 | Low |
| U9 | PWA + Push | next-pwa, web-push, bottom mobile nav, offline support | 1 | 0 | Medium |
| U10 | Advanced Admin | Audit log, bulk ops, 2FA, email digest, system health | 3 | 3 | Medium |
| U11 | Payments | Stripe paid tickets, club budgets, sponsors | 3 | 2 | High |
| U12 | Integrations | Swagger docs, Google OAuth, Slack/Discord webhooks | 2 | 1 | High |

---

---

## Phase U1 — UI Polish & Micro-interactions

**Goal:** Make every existing page feel alive and polished without adding new features.
**Dependencies to install:** None (Framer Motion, Sonner already in package.json).

### U1.1 — Wire Framer Motion Stagger Animations

**Files to modify:**
- `frontend/src/app/(app)/events/page.tsx` — wrap event cards in `<motion.div>` with staggered entrance
- `frontend/src/app/(app)/clubs/page.tsx` — same for club cards
- `frontend/src/app/(app)/venues/page.tsx` — same
- `frontend/src/app/(app)/resources/page.tsx` — same
- `frontend/src/app/(app)/admin/users/page.tsx` — table rows animate in
- `frontend/src/app/(app)/dashboard/page.tsx` — stat cards stagger in

**Pattern to use everywhere:**
```tsx
// Container
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
// Child
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

<motion.div variants={container} initial="hidden" animate="show" className="grid ...">
  {items.map(i => <motion.div key={i.id} variants={item}>...</motion.div>)}
</motion.div>
```

**StatCard hover:**
Add `whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}` to every StatCard and club/event card.

### U1.2 — Replace All Inline Spinners with Proper Skeletons

**Files to create:**
- `frontend/src/components/shared/Skeleton.tsx` — already exists, extend it:
  - `<EventCardSkeleton />` — 3 lines, image placeholder
  - `<ClubCardSkeleton />` — logo circle + 2 text lines
  - `<TableRowSkeleton cols={5} />` — horizontal bar grid
  - `<StatCardSkeleton />` — icon circle + two bars

**Files to update (replace `skeletonRows()` and generic spinners):**
- `frontend/src/app/(app)/events/page.tsx`
- `frontend/src/app/(app)/clubs/page.tsx`
- `frontend/src/app/(app)/analytics/page.tsx`
- `frontend/src/app/(app)/notifications/page.tsx`
- `frontend/src/app/(app)/admin/users/page.tsx`
- `frontend/src/app/(app)/admin/clubs/page.tsx`
- `frontend/src/app/(app)/admin/events/page.tsx`

### U1.3 — Wire Sonner Toast System

**File to modify:**
- `frontend/src/app/layout.tsx` — add `<Toaster richColors position="top-right" />` once at root

**Replace all inline success/error `<p className="text-red-500">` state messages with:**
```tsx
import { toast } from "sonner";
toast.success("Joined club successfully!");
toast.error("Something went wrong. Please try again.");
toast.loading("Generating report...", { id: "report" });
toast.dismiss("report");
```

**Files to update:**
- Every page with form submissions: `clubs/new/page.tsx`, `events/new/page.tsx`, `profile/page.tsx`, `venues/[id]/page.tsx`, `resources/page.tsx`, `my-bookings/page.tsx`, `announcements/page.tsx`, `settings/notifications/page.tsx`, `admin/*.tsx`

### U1.4 — Enhanced Empty States

**File to update:** `frontend/src/components/shared/EmptyState.tsx`

Add variants: `icon` prop (Lucide component), `title`, `description`, `action` (label + href). Render a styled SVG illustration behind the icon using a soft gradient circle.

Replace all bare "No items" text with `<EmptyState>` throughout all listing pages.

### U1.5 — Complete Dark Mode Audit

**Files to audit and fix missing `dark:` classes:**
- All `bg-[#FAFAFA]` → add `dark:bg-zinc-800/50`
- All `border-gray-100` → add `dark:border-zinc-700`
- All `text-gray-900` headings → add `dark:text-white`
- All `text-gray-500` subtitles → add `dark:text-zinc-400`
- All modal/dialog overlays
- All Recharts charts — wrap with theme-aware color tokens

### U1.6 — Complete Command Palette

**File:** `frontend/src/components/shared/CommandPalette.tsx`

Implement full command palette:
- Trigger: `Cmd+K` / `Ctrl+K` — global `keydown` listener in layout
- Sections: Navigation (all sidebar links), Quick Actions (RSVP, create event, new club), Recent (last 5 pages from `localStorage`)
- Fuzzy filter: filter commands by typed query (simple `includes()` match)
- Keyboard nav: `↑`/`↓` to move, `Enter` to go, `Escape` to close
- Mount `<CommandPalette>` in `frontend/src/app/(app)/layout.tsx`

### U1.7 — Page Transition Wrapper

**File:** `frontend/src/components/shared/PageTransition.tsx` — already exists

Wrap every page's root `<div>` with `<PageTransition>`:
- `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.25 }}`
- Apply to: dashboard, events, clubs, profile, activities, notifications, analytics pages

### U1.8 — Mobile Bottom Navigation Bar

**File to create:** `frontend/src/components/layout/BottomNav.tsx`

5-tab bottom bar for mobile only (`md:hidden`):
- Home (`/dashboard`), Events (`/events`), Clubs (`/clubs`), Notifications (`/notifications`), Profile (`/profile`)
- Active tab highlighted with `text-[#EBA814]`, inactive with `text-gray-400`
- Notification badge dot on the bell tab (driven by `unreadCount` from localStorage or a tiny API fetch)

**File to modify:** `frontend/src/app/(app)/layout.tsx` — add `<BottomNav />` below `<main>`, add `pb-16 md:pb-0` to `<main>` so content doesn't hide behind it.

---

## Phase U2 — Real-Time Layer (WebSockets)

**Goal:** Replace all polling with Socket.io. App feels live.

### Dependencies

```bash
# Backend
cd backend && npm install socket.io

# Frontend
cd frontend && npm install socket.io-client
```

### U2.1 — Backend Socket Server

**File to modify:** `backend/src/index.ts`

Convert `app.listen()` to an HTTP server + attach Socket.io:
```ts
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true }
});

// Export io so controllers can emit
export { io };

// Auth middleware: validate JWT from handshake
io.use((socket, next) => {
  const token = socket.handshake.auth.token as string;
  if (!token) return next(new Error("Unauthorized"));
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as { userId: string; role: string };
    socket.data.userId = payload.userId;
    socket.data.role = payload.role;
    next();
  } catch { next(new Error("Unauthorized")); }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  // Join user's personal room
  void socket.join(`user:${userId}`);
  // Admins join admin room
  if (["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"].includes(socket.data.role)) {
    void socket.join("admin");
  }
  // Join event room on request
  socket.on("join:event", (eventId: string) => void socket.join(`event:${eventId}`));
  socket.on("leave:event", (eventId: string) => void socket.leave(`event:${eventId}`));
});

httpServer.listen(PORT, ...);
```

**File to create:** `backend/src/lib/socket.ts`
```ts
import { io } from "../index.ts";
export const emitToUser = (userId: string, event: string, data: unknown) =>
  io.to(`user:${userId}`).emit(event, data);
export const emitToEvent = (eventId: string, event: string, data: unknown) =>
  io.to(`event:${eventId}`).emit(event, data);
export const emitToAdmin = (event: string, data: unknown) =>
  io.to("admin").emit(event, data);
```

### U2.2 — Emit Events from Controllers

**`notificationService.ts`:** after `prisma.notification.create(...)`, call:
```ts
import { emitToUser } from "../lib/socket.ts";
emitToUser(userId, "notification:new", notification);
```

**`eventController.ts`:** after RSVP / cancel registration:
```ts
emitToEvent(eventId, "event:attendance_changed", { registeredCount, waitlistCount });
```

After check-in toggle:
```ts
emitToEvent(eventId, "event:checkin", { userId, checkedIn, checkedInAt });
```

**`clubController.ts`:** after membership approve/reject:
```ts
emitToUser(userId, "club:membership_updated", { clubId, status });
```

**`adminController.ts` (via notification service):** when a new club/event is submitted for approval, emit to admin room:
```ts
emitToAdmin("admin:new_pending", { type: "club" | "event", id, title });
```

### U2.3 — Frontend Socket Hook

**File to create:** `frontend/src/lib/socket.ts`
```ts
import { io, type Socket } from "socket.io-client";
let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL!, {
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
```

**File to create:** `frontend/src/hooks/useSocket.ts`
```ts
"use client";
import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { getAuthState } from "@/lib/tokenStorage";

export function useSocket() {
  const socketRef = useRef(getSocket(getAuthState()?.accessToken ?? ""));
  return socketRef.current;
}
```

### U2.4 — Update NotificationBell (remove polling)

**File:** `frontend/src/components/shared/NotificationBell.tsx`

Remove `setInterval` polling entirely. Instead:
```tsx
const socket = useSocket();
useEffect(() => {
  socket.on("notification:new", (notif) => {
    setUnreadCount(c => c + 1);
    setNotifications(prev => [notif, ...prev]);
  });
  return () => { socket.off("notification:new"); };
}, [socket]);
```

### U2.5 — Live Attendee Counter on Event Detail

**File:** `frontend/src/app/(app)/events/[id]/page.tsx`

```tsx
const socket = useSocket();
useEffect(() => {
  socket.emit("join:event", eventId);
  socket.on("event:attendance_changed", ({ registeredCount, waitlistCount }) => {
    setRegisteredCount(registeredCount);
    setWaitlistCount(waitlistCount);
  });
  return () => {
    socket.emit("leave:event", eventId);
    socket.off("event:attendance_changed");
  };
}, [socket, eventId]);
```
Render: `<AnimatedCounter value={registeredCount} />` in the attendee count badge.

### U2.6 — Live Check-in Board on Event Manage

**File:** `frontend/src/app/(app)/events/[id]/manage/page.tsx`

```tsx
useEffect(() => {
  socket.emit("join:event", eventId);
  socket.on("event:checkin", ({ userId, checkedIn }) => {
    setAttendees(prev => prev.map(a => a.userId === userId ? { ...a, checkedIn } : a));
  });
  return () => { socket.emit("leave:event", eventId); socket.off("event:checkin"); };
}, [socket, eventId]);
```

### U2.7 — Admin Real-Time Queue

**File:** `frontend/src/app/(app)/dashboard/page.tsx` (AdminDashboard)

```tsx
useEffect(() => {
  socket.on("admin:new_pending", ({ type, title }) => {
    toast.info(`New ${type} pending approval: ${title}`);
    // Increment pending count badge
    setStats(prev => prev ? { ...prev, counts: { ...prev.counts, [`pending${capitalize(type)}s`]: prev.counts[`pending${capitalize(type)}s`] + 1 } } : prev);
  });
  return () => { socket.off("admin:new_pending"); };
}, [socket]);
```

---

## Phase U3 — File Uploads + Rich Text Editor

**Goal:** Real file uploads for avatars, event posters, club logos/banners. Rich text descriptions.

### Dependencies

```bash
# Backend
cd backend && npm install multer sharp
npm install --save-dev @types/multer

# Frontend
cd frontend && npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
```

### U3.1 — Backend Upload Infrastructure

**File to create:** `backend/src/middleware/upload.ts`
```ts
import multer from "multer";
const storage = multer.memoryStorage();
export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP allowed"));
  },
}).single("file");
```

**File to create:** `backend/src/controllers/uploadController.ts`
```ts
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuid } from "uuid";

// Writes to backend/public/uploads/<type>/<uuid>.<ext>
export async function uploadFile(req, res) {
  const { type } = req.query; // "avatar" | "poster" | "banner" | "logo"
  const dims = { avatar: [256, 256], poster: [1200, 630], banner: [1440, 400], logo: [256, 256] };
  const [w, h] = dims[type] ?? [1200, 630];

  const filename = `${uuid()}.webp`;
  const dir = path.join(process.cwd(), "public", "uploads", type);
  await fs.mkdir(dir, { recursive: true });

  await sharp(req.file!.buffer).resize(w, h, { fit: "cover" }).webp({ quality: 85 }).toFile(path.join(dir, filename));

  const url = `/uploads/${type}/${filename}`;
  res.json({ url });
}
```

**File to create:** `backend/src/routes/uploads.ts`
```ts
router.post("/", authenticateJWT, uploadImage, uploadFile);
```

**Serve static files in `index.ts`:**
```ts
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "../../public/uploads")));
```

### U3.2 — Frontend FileUpload Component

**File to create:** `frontend/src/components/shared/FileUpload.tsx`

Props: `value: string | null`, `onChange: (url: string) => void`, `type: "avatar" | "poster" | "banner" | "logo"`, `label?: string`

Behavior:
- Drag-and-drop zone with dashed border
- On file drop/select → POST to `NEXT_PUBLIC_API_URL/uploads?type=<type>` with FormData
- Show upload progress spinner
- After success → call `onChange(url)`, show preview image
- "Remove" button clears the value
- Avatar type: renders as a circle preview
- All other types: renders as a rectangle with aspect ratio

### U3.3 — Wire FileUpload into Forms

**`frontend/src/app/(app)/profile/page.tsx`:**
Replace `<input name="avatarUrl" />` text input with `<FileUpload type="avatar" />`.

**`frontend/src/app/(app)/events/new/page.tsx` and `events/[id]/manage`:**
Replace `posterUrl` text input with `<FileUpload type="poster" />`.

**`frontend/src/app/(app)/clubs/new/page.tsx` and `clubs/[slug]/manage`:**
Replace `logoUrl` text input with `<FileUpload type="logo" />`.
Replace `bannerUrl` text input with `<FileUpload type="banner" />`.

**Display banner on club profile:** `frontend/src/app/(app)/clubs/[slug]/page.tsx`
Add a full-width banner image at the top when `club.bannerUrl` is set, with the logo overlaid on the left edge.

**Display poster on event detail:** `frontend/src/app/(app)/events/[id]/page.tsx`
When `event.posterUrl` is set, render as hero image at top of the page. When null, show a gradient placeholder using category color.

### U3.4 — Tiptap Rich Text Editor

**File to create:** `frontend/src/components/shared/RichTextEditor.tsx`
```tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Link, Placeholder.configure({ placeholder })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      {/* Toolbar: Bold, Italic, Bullet List, Ordered List, Link */}
      <ToolbarButtons editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[120px] focus-within:ring-2 focus-within:ring-[#EBA814]/40"
      />
    </div>
  );
}
```

**File to create:** `frontend/src/components/shared/RichTextDisplay.tsx`
```tsx
export default function RichTextDisplay({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

**Wire into forms:**
- `events/new/page.tsx` + `events/[id]/manage` — replace description `<textarea>` with `<RichTextEditor>`
- `announcements/page.tsx` create modal — same
- `clubs/new/page.tsx` + `clubs/[slug]/manage` — same for description

**Wire display into pages:**
- `events/[id]/page.tsx` — replace `<p>{event.description}</p>` with `<RichTextDisplay html={event.description} />`
- `clubs/[slug]/page.tsx` — same for `club.description`
- `announcements/page.tsx` — same for announcement content

---

## Phase U4 — Social & Community Features

**Goal:** Club Connect becomes the social hub — posts, Q&A, follows, activity feed.

### Dependencies — None new

### U4.1 — Schema Changes

**Add to `backend/prisma/schema.prisma`:**

```prisma
model ClubPost {
  id        String             @id @default(uuid())
  club      Club               @relation(fields: [clubId], references: [id], onDelete: Cascade)
  clubId    String
  author    User               @relation(fields: [authorId], references: [id])
  authorId  String
  title     String
  content   String
  isPinned  Boolean            @default(false)
  comments  ClubPostComment[]
  reactions ClubPostReaction[]
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
}

model ClubPostComment {
  id        String   @id @default(uuid())
  post      ClubPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ClubPostReaction {
  id        String   @id @default(uuid())
  post      ClubPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    String
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  emoji     String   @default("👍")
  createdAt DateTime @default(now())
  @@unique([postId, userId])
}

model EventQuestion {
  id          String   @id @default(uuid())
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId     String
  author      User     @relation(fields: [authorId], references: [id])
  authorId    String
  question    String
  upvotes     Int      @default(0)
  isAnswered  Boolean  @default(false)
  answer      String?
  answeredBy  User?    @relation("QuestionAnswerer", fields: [answeredById], references: [id])
  answeredById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ClubFollow {
  id        String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  club      Club     @relation(fields: [clubId], references: [id], onDelete: Cascade)
  clubId    String
  createdAt DateTime @default(now())
  @@unique([userId, clubId])
}
```

Add reverse relations to `User`, `Club`, `Event`.

### U4.2 — Backend: Club Posts API

**File to create:** `backend/src/controllers/clubPostController.ts`

Handlers:
- `listPosts(req, res)` — GET `/clubs/:id/posts` — auth — paginated, pinned first
- `createPost(req, res)` — POST `/clubs/:id/posts` — officer only
- `updatePost(req, res)` — PUT `/clubs/:id/posts/:postId` — author or officer
- `deletePost(req, res)` — DELETE `/clubs/:id/posts/:postId` — author or officer
- `pinPost(req, res)` — POST `/clubs/:id/posts/:postId/pin` — officer only
- `addComment(req, res)` — POST `/clubs/:id/posts/:postId/comments` — member
- `deleteComment(req, res)` — DELETE `/clubs/:id/posts/:postId/comments/:commentId` — author or officer
- `reactToPost(req, res)` — POST `/clubs/:id/posts/:postId/react` — toggle reaction, body: `{ emoji }`

**File to create:** `backend/src/routes/clubPosts.ts`
Mount in `clubs.ts` router under `/:id/posts`.

### U4.3 — Backend: Event Q&A API

**File to create:** `backend/src/controllers/eventQAController.ts`

Handlers:
- `listQuestions(req, res)` — GET `/events/:id/questions` — optionalAuth — ordered by upvotes desc
- `submitQuestion(req, res)` — POST `/events/:id/questions` — auth, must be registered attendee
- `upvoteQuestion(req, res)` — POST `/events/:id/questions/:qId/upvote` — auth
- `answerQuestion(req, res)` — PUT `/events/:id/questions/:qId/answer` — officer/admin — body: `{ answer }`

Mount in `events.ts` router under `/:id/questions`.

### U4.4 — Backend: Follow System

Add to `clubController.ts`:
- `followClub(req, res)` — POST `/clubs/:id/follow` — auth — upsert `ClubFollow`
- `unfollowClub(req, res)` — DELETE `/clubs/:id/follow` — auth
- Get follow status in `getClub`: include `_count: { followers: true }` and check if current user follows

### U4.5 — Backend: Activity Feed

**File to create:** `backend/src/controllers/feedController.ts`

`getFeed(req, res)` — GET `/feed` — auth — paginated, returns:
```ts
// Merge and sort by createdAt desc:
// 1. New events from clubs user is member/follower of (APPROVED events, created in last 30 days)
// 2. New announcements for user's clubs
// 3. Upcoming events user is registered for (next 3 days)
// 4. New members who joined user's clubs (last 7 days)
type FeedItem = {
  type: "NEW_EVENT" | "ANNOUNCEMENT" | "REMINDER" | "NEW_MEMBER";
  id: string;
  title: string;
  subtitle: string;
  link: string;
  createdAt: string;
  image?: string;
}
```

### U4.6 — Frontend: Club Discussion Board

**File to create:** `frontend/src/app/(app)/clubs/[slug]/discuss/page.tsx`

Layout:
- Left: list of posts (card per post, pinned highlighted, reaction counts, comment count)
- Click a post → expands inline to show comments + reaction bar + comment input
- Top: "New Post" button (officer only) opens a modal with title + RichTextEditor body
- Empty state: "No posts yet. Officers can start a discussion."

### U4.7 — Frontend: Event Q&A Section

**File to modify:** `frontend/src/app/(app)/events/[id]/page.tsx`

Add a collapsible "Questions & Answers" section below event description:
- Lists questions sorted by upvote count
- Each question: upvote button, question text, "Answered" badge if answered
- Expanded answered question shows the officer's reply in a green box
- Input at bottom: "Ask a question..." (visible to registered attendees only)
- Officers see an "Answer" button on each unanswered question

### U4.8 — Frontend: Follow Button on Club Profile

**File to modify:** `frontend/src/app/(app)/clubs/[slug]/page.tsx`

Add a "Follow" / "Following" toggle button next to the "Join" button.
Show follower count: "142 followers".
When following, the button shows a checkmark icon.

### U4.9 — Frontend: Activity Feed Page

**File to create:** `frontend/src/app/(app)/feed/page.tsx`

Full-screen activity feed:
- Infinite scroll list of `FeedItem` cards
- Card types styled differently by type:
  - `NEW_EVENT`: amber icon, event details, one-click RSVP button
  - `ANNOUNCEMENT`: blue icon, announcement preview, "View" link
  - `REMINDER`: clock icon, countdown display
  - `NEW_MEMBER`: person icon, "X joined Y club"
- Filter tabs: All · Events · Announcements · Reminders

Add "Feed" to `getNavItems()` in `AppShell.tsx` with `<Rss>` icon.

### U4.10 — Frontend: Member Directory

**File to create:** `frontend/src/app/(app)/members/page.tsx`

Searchable, filterable student directory:
- Search by name
- Filter: department (dropdown), year, interests (multi-select chips)
- User cards showing: avatar/initials, name, department, year, clubs (up to 3 chip badges)
- Click a user card → `/profile/[userId]`

**Backend:** Add `GET /users` endpoint (admin or any logged-in user, returns public profile fields only — no email, no admin-only fields). Add to `userRoutes.ts`.

**File to create:** `frontend/src/app/(app)/profile/[userId]/page.tsx`
Public profile view: avatar, name, department, year, interests, clubs, events attended count, badges (Phase U5).

---

## Phase U5 — Gamification & Engagement

**Goal:** Students feel rewarded for participation.

### U5.1 — Schema Changes

```prisma
model UserPoints {
  id           String             @id @default(uuid())
  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String             @unique
  points       Int                @default(0)
  level        Int                @default(1)
  transactions PointTransaction[]
  updatedAt    DateTime           @updatedAt
}

model PointTransaction {
  id          String     @id @default(uuid())
  userPoints  UserPoints @relation(fields: [userPointsId], references: [id])
  userPointsId String
  delta       Int        // positive = earn, negative = deduct
  reason      String     // "EVENT_ATTENDED", "CLUB_JOINED", etc.
  createdAt   DateTime   @default(now())
}

model Achievement {
  slug        String            @id    // e.g. "first_event"
  name        String
  description String
  icon        String            // emoji
  unlockedBy  UserAchievement[]
}

model UserAchievement {
  id          String      @id @default(uuid())
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  achievement Achievement @relation(fields: [achievementSlug], references: [slug])
  achievementSlug String
  unlockedAt  DateTime    @default(now())
  @@unique([userId, achievementSlug])
}
```

Add reverse relations to `User`.

### U5.2 — Backend: Points Service

**File to create:** `backend/src/services/pointsService.ts`

```ts
const POINT_VALUES = {
  EVENT_REGISTERED: 5,
  EVENT_ATTENDED: 20,
  FEEDBACK_SUBMITTED: 10,
  CLUB_JOINED: 15,
  CLUB_CREATED: 50,
  EVENT_CREATED: 30,
};

export async function awardPoints(userId: string, reason: keyof typeof POINT_VALUES) {
  const delta = POINT_VALUES[reason];
  await prisma.$transaction([
    prisma.userPoints.upsert({
      where: { userId },
      create: { userId, points: delta, level: computeLevel(delta) },
      update: { points: { increment: delta }, level: { set: computeLevel(currentPoints + delta) } },
    }),
    prisma.pointTransaction.create({ data: { userPointsId: ..., delta, reason } }),
  ]);
  await checkAndUnlockAchievements(userId);
}
```

Trigger `awardPoints` from controllers:
- `eventController.ts` → RSVP confirmed: `EVENT_REGISTERED`
- `eventController.ts` → check-in: `EVENT_ATTENDED`
- `feedbackController.ts` → feedback submitted: `FEEDBACK_SUBMITTED`
- `clubController.ts` → membership approved: `CLUB_JOINED`
- `clubController.ts` → club approved: `CLUB_CREATED`
- `eventController.ts` → event approved: `EVENT_CREATED`

### U5.3 — Backend: Achievement Service

**File to create:** `backend/src/services/achievementService.ts`

Seed `Achievement` table with built-in badges. `checkAndUnlockAchievements(userId)`:
- Query user's current stats
- For each unowned achievement where condition is met → create `UserAchievement`
- Emit notification: "🏆 You earned the [name] badge!"

Achievement conditions:
| Slug | Condition |
|---|---|
| `first_event` | `EventAttendance.checkedIn` count ≥ 1 |
| `regular` | checkedIn count ≥ 5 |
| `campus_legend` | checkedIn count ≥ 25 |
| `club_founder` | approved clubs created ≥ 1 |
| `super_connector` | APPROVED memberships ≥ 3 |
| `voice` | EventFeedback count ≥ 3 |
| `event_organizer` | APPROVED events created ≥ 1 |

### U5.4 — Backend: Points & Leaderboard API

Add to `userRoutes.ts`:
- `GET /users/me/points` — auth — own points, level, transaction history
- `GET /users/me/achievements` — auth — owned badges

**File to create:** `backend/src/routes/leaderboard.ts`
- `GET /leaderboard` — optionalAuth — top 20 by points (`UserPoints` ordered by `points desc`)
- `GET /leaderboard/semester` — filtered by `PointTransaction.createdAt` in current semester window

### U5.5 — Frontend: Badges on Profile

**File to modify:** `frontend/src/app/(app)/profile/page.tsx`

Add a "Badges & Points" section:
- XP bar: current points, level badge (e.g. "Level 3 · Campus Regular"), progress to next level
- Badge grid: earned badges shown in color, locked badges shown greyed out with lock icon
- Hover tooltip on each badge: name + description + unlock condition

### U5.6 — Frontend: Leaderboard Page

**File to create:** `frontend/src/app/(app)/leaderboard/page.tsx`

Top 20 table with:
- Rank (1st/2nd/3rd get crown/medal icons)
- Avatar + name + department
- Points total
- Level badge
- Badges count
- "You are ranked #47" banner at the bottom if the current user is not in top 20

Add "Leaderboard" to nav in `AppShell.tsx` (visible to all).

### U5.7 — Frontend: Dashboard Streak Widget

**File to modify:** `frontend/src/app/(app)/dashboard/page.tsx` (StudentDashboard)

Add a streak + points widget card:
- "🔥 3-week streak" — computed from consecutive weeks with ≥ 1 check-in
- "⭐ 145 points · Level 2" — fetched from `/users/me/points`
- Progress bar to next level milestone

### U5.8 — Digital Attendance Certificate

**Backend — add to `reportController.ts`:**
New report type `CERTIFICATE` — takes `{ eventId, userId }`, generates a PDF with:
- Club Connect branding (logo, amber accent)
- "Certificate of Attendance"
- Student name, event name, club name, date
- Auto-signature line: "Club Connect Platform"

**Frontend — `events/[id]/page.tsx`:**
After check-in is confirmed, show a "Download Certificate" button that calls `generateReport({ type: "CERTIFICATE", format: "PDF", eventId, userId })`.

---

## Phase U6 — Smart Event Experience

**Goal:** Events feel professional — QR tickets, live countdowns, reminders, virtual events.

### U6.1 — Schema Changes

```prisma
model EventReminder {
  id            String   @id @default(uuid())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        String
  event         Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId       String
  minutesBefore Int      // 1440 = 1 day, 60 = 1 hour, 15 = 15 min
  sent          Boolean  @default(false)
  createdAt     DateTime @default(now())
  @@unique([userId, eventId, minutesBefore])
}

// Add to Event model:
// isVirtual  Boolean @default(false)
// meetingUrl String?
// tags       String[]
```

### U6.2 — Backend: QR Ticket System

**File to create:** `backend/src/controllers/ticketController.ts`

`getTicket(req, res)`:
- `GET /events/:id/ticket` — auth, must be `REGISTERED`
- Generate payload: `{ eventId, userId, exp: now + 24h }`
- Sign with `JWT_ACCESS_TOKEN_SECRET` using a short token
- Return: `{ token, eventTitle, attendeeName, startsAt, location }`

`scanTicket(req, res)`:
- `POST /events/:id/scan` — auth, must be club officer for that event
- Body: `{ token }` — verify JWT signature and claims
- If valid and `checkedIn === false` → flip check-in, emit `event:checkin` via socket
- Return: `{ success, attendee: { name, id } }`

**No QR image generation needed on backend.** The frontend generates the QR image client-side from the token.

### U6.3 — Frontend: QR Ticket on Event Detail

**Install:** `npm install qrcode.react`

**File to modify:** `frontend/src/app/(app)/events/[id]/page.tsx`

When `myRegistration.status === "REGISTERED"` and `!myRegistration.isWaitlisted`, show:
```tsx
import { QRCodeSVG } from "qrcode.react";
// Fetch ticket token from GET /events/:id/ticket
<div className="p-6 border-2 border-dashed border-[#EBA814]/40 rounded-2xl text-center">
  <p className="text-sm font-bold mb-3">Your Event Ticket</p>
  <QRCodeSVG value={ticketToken} size={180} />
  <p className="text-xs text-gray-400 mt-3">Show this at check-in</p>
</div>
```

### U6.4 — Frontend: QR Scanner Page (Mobile Optimized)

**Install:** `npm install html5-qrcode`

**File to create:** `frontend/src/app/(app)/events/[id]/scan/page.tsx`

- Officer-only page (redirect non-officers away)
- Full-screen camera view using `Html5QrcodeScanner`
- On successful scan → POST to `/events/:id/scan` with the token
- Success: green flash + attendee name displayed in a card
- Error: red flash + error message
- Manual entry fallback: text input for token paste

### U6.5 — Frontend: Live Countdown Timer

**File to create:** `frontend/src/components/shared/EventCountdown.tsx`

```tsx
// Shows: "Starts in 2d 4h 32m" / "Happening now!" / "Ended X hours ago"
export default function EventCountdown({ startsAt, endsAt }: { startsAt: string; endsAt?: string }) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    const tick = () => { /* compute diff */ setDisplay(formatted); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startsAt, endsAt]);
  return <span className="text-sm font-semibold text-[#EBA814]">{display}</span>;
}
```

Wire into `events/[id]/page.tsx` directly below event title.

### U6.6 — Backend + Frontend: Event Reminders

**Backend — `backend/src/controllers/eventController.ts`:**
After successful RSVP (`POST /events/:id/register`):
- Create default reminder 1440 min (1 day) before event if not already exists

**User can also set custom reminders:** add `POST /events/:id/reminders` endpoint — body: `{ minutesBefore: 1440 | 60 | 15 }`.

**Backend — Cron job `backend/src/jobs/reminderJob.ts`:**
```ts
import cron from "node-cron";
// Every minute check for reminders due in the next window
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const reminders = await prisma.eventReminder.findMany({
    where: { sent: false, event: { startsAt: { lte: new Date(now.getTime() + maxOffset) } } },
    include: { event: true, user: true },
  });
  for (const r of reminders) {
    const targetTime = new Date(r.event.startsAt.getTime() - r.minutesBefore * 60000);
    if (now >= targetTime) {
      await notificationService.createNotification({ userId: r.userId, type: "EVENT_REMINDER", ... });
      await prisma.eventReminder.update({ where: { id: r.id }, data: { sent: true } });
    }
  }
});
```

Install `node-cron` in backend. Import `reminderJob.ts` from `index.ts`.

**Frontend — `events/[id]/page.tsx`:**
Show reminder picker when registered:
```tsx
<div className="flex gap-2 mt-3">
  {[{ label: "1 day before", value: 1440 }, { label: "1 hour", value: 60 }, { label: "15 min", value: 15 }].map(r => (
    <button key={r.value} onClick={() => setReminder(r.value)} className="text-xs px-3 py-1.5 rounded-full border ...">
      {r.label}
    </button>
  ))}
</div>
```

### U6.7 — Virtual Event Support

**Schema:** Add `isVirtual Boolean @default(false)` and `meetingUrl String?` to `Event`.

**Backend:** Include these fields in event create/update endpoints. In `getEvent`, only include `meetingUrl` if:
- The requester is authenticated AND
- They have a `REGISTERED` attendance AND
- `event.startsAt <= now` (event is live or started)

**Frontend — `events/[id]/page.tsx`:**
- Creation form: "Virtual Event" toggle. When toggled on, reveal "Meeting URL" field.
- Event detail: show "Virtual Event" badge. When event is live and user is registered: show a `Join Meeting` button (green) linking to `meetingUrl`.

### U6.8 — Waitlist Position Display

**Backend:** In `GET /events/:id` response, when `myRegistration.isWaitlisted === true`, compute:
```ts
const waitlistPosition = await prisma.eventAttendance.count({
  where: { eventId, isWaitlisted: true, createdAt: { lte: myAttendance.createdAt } }
});
// Add to response: waitlistPosition
```

**Frontend — `events/[id]/page.tsx`:**
When waitlisted: show "You are #3 on the waitlist" in an amber pill.
Via socket: update this in real time when `event:attendance_changed` fires (re-fetch `myRegistration`).

---

## Phase U7 — AI & Smart Features

**Goal:** Claude API integration — description assistant, smart recommendations, sentiment insights.

### Dependencies

```bash
cd backend && npm install @anthropic-ai/sdk
```

Add `ANTHROPIC_API_KEY=...` to `backend/.env`.

### U7.1 — AI Event Description Assistant

**File to create:** `backend/src/controllers/aiController.ts`

```ts
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic();

export async function generateEventDescription(req, res) {
  const { title, category, location } = req.body;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  const stream = await anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Write a compelling 2-paragraph event description for a university club event. 
Title: ${title}. Category: ${category}. Location: ${location}.
Be enthusiastic, informative, and student-friendly. Do not use placeholder text.`
    }]
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
    }
  }
  res.write("data: [DONE]\n\n");
  res.end();
}
```

**File to create:** `backend/src/routes/ai.ts`
- `POST /ai/event-description` — auth (officer only)

**Frontend — `events/new/page.tsx`:**
Add "AI Assist" button next to description field. On click:
- Fetch streamed SSE from `/ai/event-description`
- Display text character-by-character in the description editor as it streams
- Show "Generating..." spinner, replace with "Regenerate" after done
- User can accept (keep what's in editor) or clear and type manually

### U7.2 — Smart Recommendations v2

**Backend — upgrade `searchController.ts`:**

Current: simple `category IN user.interests` match.
Upgrade: score events by multiple signals:
```ts
const score = (event: Event, user: User): number => {
  let s = 0;
  if (user.interests.some(i => event.category.toLowerCase().includes(i.toLowerCase()))) s += 3;
  if (userClubIds.includes(event.clubId)) s += 2; // from a club user is in
  if (user.interests.some(i => event.tags?.includes(i))) s += 1;
  // Recency boost: events starting in 1-7 days get +1
  const daysAway = (new Date(event.startsAt).getTime() - Date.now()) / 86400000;
  if (daysAway >= 1 && daysAway <= 7) s += 1;
  return s;
};
```
Sort by score desc, return top 8. Fall back to upcoming events if all scores = 0.

### U7.3 — Sentiment Analysis on Feedback

**Backend — `feedbackController.ts` → `getEventFeedback`:**
After fetching all feedback, call:
```ts
const comments = feedbacks.filter(f => f.comment).map(f => f.comment).join("\n---\n");
if (comments.length > 0) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Analyze these event feedback comments and return JSON only:
{"sentiment": "positive"|"neutral"|"negative", "positivePercent": number, "topThemes": string[3], "summary": string}
Comments:\n${comments}`
    }]
  });
  const sentiment = JSON.parse(msg.content[0].text);
  // Include in response
}
```

**Frontend — `events/[id]/feedback/page.tsx`:**
Add a "AI Sentiment Analysis" section at the top of the feedback report:
- Sentiment gauge (green/yellow/red)
- Top 3 themes as chips
- 1-sentence summary

---

## Phase U8 — Calendar & Scheduling

**Goal:** Full calendar view of all events. Add to external calendars.

### Dependencies

```bash
cd frontend && npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

### U8.1 — Schema Change

```prisma
// Add to Event model:
// icsToken String @unique @default(uuid())  — stable token for iCal export
```

### U8.2 — Backend: iCal Export

**Add to `eventController.ts`:**
`getEventIcs(req, res)`:
- `GET /events/:id/ics` — optionalAuth
- Build ICS string manually:
```ts
const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n
DTSTART:${formatIcsDate(event.startsAt)}\n
DTEND:${formatIcsDate(event.endsAt ?? event.startsAt)}\n
SUMMARY:${event.title}\n
DESCRIPTION:${stripHtml(event.description ?? "")}\n
LOCATION:${event.location}\n
END:VEVENT\nEND:VCALENDAR`;
res.setHeader("Content-Type", "text/calendar");
res.setHeader("Content-Disposition", `attachment; filename="${event.title}.ics"`);
res.send(ics);
```

### U8.3 — Frontend: Calendar Page

**File to create:** `frontend/src/app/(app)/calendar/page.tsx`

```tsx
"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Fetch all APPROVED events from /events (no pagination, get all)
// Map to FullCalendar EventInput format:
const fcEvents = events.map(e => ({
  id: e.id,
  title: e.title,
  start: e.startsAt,
  end: e.endsAt,
  backgroundColor: isRsvpd(e.id) ? "#EBA814" : "#6B7280",
  extendedProps: { club: e.club.name, location: e.location }
}));
```

Features:
- Month / Week / Day toggle (header toolbar)
- Click event → popover showing event title, club, location, RSVP status + link to full detail
- Toggle: "My Events Only" — filters to only user's RSVPd events
- "Today" button to jump to current date

**Add to `getNavItems()` in `AppShell.tsx`:** `{ label: "Calendar", href: "/calendar", icon: <CalendarDays size={18} /> }`

### U8.4 — Frontend: Add to Calendar Buttons

**File to modify:** `frontend/src/app/(app)/events/[id]/page.tsx`

Below the event date/time info, add two small buttons:
1. "Add to Google Calendar" — opens deep link:
   ```
   https://www.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...
   ```
2. "Download .ics" — downloads from `GET /events/:id/ics`

### U8.5 — Conflict Detection on RSVP

**Backend — `eventController.ts` RSVP handler:**
After confirming user is not already registered, before creating `EventAttendance`:
```ts
const conflicts = await prisma.eventAttendance.findMany({
  where: {
    userId,
    status: "REGISTERED",
    isWaitlisted: false,
    event: {
      startsAt: { lte: event.endsAt ?? event.startsAt },
      endsAt: { gte: event.startsAt },
      status: "APPROVED",
    },
  },
  include: { event: { select: { title: true, startsAt: true } } },
});
if (conflicts.length > 0) {
  // Return 200 with warning, don't block — soft check
  res.json({ ...attendance, warning: `You already have "${conflicts[0].event.title}" at this time.` });
  return;
}
```

**Frontend:** Show a yellow warning toast when `warning` is returned in the RSVP response.

---

## Phase U9 — PWA & Mobile-First

**Goal:** Club Connect installs as a native-feeling app on phones.

### Dependencies

```bash
cd frontend && npm install next-pwa
npm install web-push
npm install --save-dev @types/web-push
# Backend:
cd backend && npm install web-push
npm install --save-dev @types/web-push
```

Generate VAPID keys: `npx web-push generate-vapid-keys` — add to `.env`.

### U9.1 — Schema Change

```prisma
model PushSubscription {
  id         String   @id @default(uuid())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  endpoint   String   @unique
  p256dh     String
  auth       String
  userAgent  String?
  createdAt  DateTime @default(now())
}
```

### U9.2 — Backend: Push Notification Endpoint

**Add to `userRoutes.ts`:**
- `POST /users/me/push-subscription` — auth — body: `{ endpoint, keys: { p256dh, auth } }` — upsert subscription
- `DELETE /users/me/push-subscription` — auth — remove by endpoint

**Integrate into `notificationService.ts`:**
```ts
import webpush from "web-push";
webpush.setVapidDetails("mailto:admin@clubconnect.edu", VAPID_PUBLIC, VAPID_PRIVATE);

// After creating DB notification:
const subs = await prisma.pushSubscription.findMany({ where: { userId } });
for (const sub of subs) {
  webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify({ title, message, link })).catch(() => {});
}
```

### U9.3 — Frontend: PWA Config

**File to modify:** `frontend/next.config.ts`
```ts
import withPWA from "next-pwa";
export default withPWA({ dest: "public", disable: process.env.NODE_ENV === "development" })({ /* existing config */ });
```

**File to create:** `frontend/public/manifest.json`
```json
{
  "name": "Club Connect",
  "short_name": "ClubConnect",
  "theme_color": "#EBA814",
  "background_color": "#ffffff",
  "display": "standalone",
  "scope": "/",
  "start_url": "/dashboard",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add `<link rel="manifest" href="/manifest.json" />` and theme-color meta to `frontend/src/app/layout.tsx`.

Design and save `icon-192.png` and `icon-512.png` in `frontend/public/`.

### U9.4 — Frontend: Push Permission + Subscribe

**File to create:** `frontend/src/hooks/usePushNotifications.ts`
```ts
export function usePushNotifications() {
  const subscribe = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    await api.post("/users/me/push-subscription", sub.toJSON());
  };
  return { subscribe, isSupported: "serviceWorker" in navigator && "PushManager" in window };
}
```

**File to modify:** `frontend/src/app/(app)/settings/notifications/page.tsx`
Add a "Push Notifications" toggle at the top. On enable → call `subscribe()`. On disable → delete subscription.

### U9.5 — Frontend: Mobile Bottom Navigation

**File to modify:** `frontend/src/components/layout/BottomNav.tsx` (created in U1.8)
Ensure notification badge dot is live (driven by socket `notification:new` event from U2.4).

---

## Phase U10 — Advanced Admin & Audit

### U10.1 — Schema Changes

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  actor      User     @relation(fields: [actorId], references: [id])
  actorId    String
  action     String   // "APPROVE_CLUB" | "SUSPEND_USER" | "CHANGE_ROLE" | etc.
  targetType String   // "Club" | "User" | "Event" | "Setting"
  targetId   String
  details    Json     @default("{}")
  ipAddress  String?
  createdAt  DateTime @default(now())
}

// Add to User:
// twoFactorSecret  String?
// twoFactorEnabled Boolean @default(false)

model EmailDigestSubscription {
  id        String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String   @unique
  frequency String   @default("WEEKLY") // "DAILY" | "WEEKLY" | "NONE"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### U10.2 — Audit Log Middleware

**File to create:** `backend/src/lib/auditLog.ts`
```ts
export async function log(actorId: string, action: string, targetType: string, targetId: string, details = {}, ip?: string) {
  await prisma.auditLog.create({ data: { actorId, action, targetType, targetId, details, ipAddress: ip } });
}
```

Call `log(...)` in every admin controller action (approve club, reject club, suspend user, activate user, change role, resolve report, dismiss report, upsert setting).

### U10.3 — Audit Log Admin Page

**File to create:** `frontend/src/app/(app)/admin/audit-log/page.tsx`

Filterable table:
- Date range picker (from / to)
- Action type dropdown
- Actor name search
- Paginated table: time, actor, action, target, IP

**Backend:** `GET /admin/audit-log` — admin only — supports `?actorId= &action= &from= &to= &page= &limit=`

### U10.4 — Bulk Admin Operations

**Backend — add to `adminController.ts`:**
- `POST /admin/clubs/bulk-approve` — body: `{ ids: string[] }` — returns `{ approved: number, failed: number }`
- `POST /admin/events/bulk-approve` — same pattern
- `POST /admin/users/bulk-suspend` — body: `{ ids: string[], reason? }`

**Frontend — admin/clubs, admin/events, admin/users pages:**
Add checkbox column. When ≥ 1 selected: float a "Bulk Actions" toolbar at the bottom with action buttons + count badge.

### U10.5 — Two-Factor Authentication

**Backend:**
```bash
cd backend && npm install otplib qrcode
npm install --save-dev @types/qrcode
```

New endpoints in `authRoutes.ts`:
- `POST /auth/2fa/setup` — auth — generate TOTP secret + return QR code data URL
- `POST /auth/2fa/verify` — auth — body: `{ token }` — verify 6-digit code, then set `twoFactorEnabled = true`
- `POST /auth/2fa/disable` — auth — body: `{ token }` — verify code, then disable
- Login flow: after password + session check → if `twoFactorEnabled`, return `{ requires2FA: true, tempToken }` with 403 — second request to `POST /auth/2fa/login` with `{ tempToken, token }` exchanges for access token

**Frontend:**
`frontend/src/app/(app)/settings/security/page.tsx` — new page:
- Show current 2FA status
- "Enable 2FA" button → fetch setup QR → show QR code image (using `<img src={qrDataUrl}`) + 6-digit input for confirmation
- "Disable 2FA" button → show 6-digit confirmation input
- On login page: if server returns `requires2FA`, show a second step 6-digit input form

---

## Phase U11 — Payments & Institutional

### Dependencies

```bash
cd backend && npm install stripe
cd frontend && npm install @stripe/stripe-js @stripe/react-stripe-js
```

### U11.1 — Schema Changes

```prisma
// Add to Event model:
// isPaid      Boolean  @default(false)
// ticketPrice Decimal? @db.Decimal(10, 2)

model Payment {
  id              String   @id @default(uuid())
  user            User     @relation(fields: [userId], references: [id])
  userId          String
  event           Event    @relation(fields: [eventId], references: [id])
  eventId         String
  stripePaymentId String   @unique
  amount          Int      // in cents
  currency        String   @default("usd")
  status          String   @default("pending") // "pending" | "succeeded" | "refunded"
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ClubBudget {
  id             String             @id @default(uuid())
  club           Club               @relation(fields: [clubId], references: [id])
  clubId         String             @unique
  totalAllocated Int                @default(0) // in cents
  fiscalYear     String             @default("2026")
  transactions   BudgetTransaction[]
  updatedAt      DateTime           @updatedAt
}

model BudgetTransaction {
  id          String     @id @default(uuid())
  budget      ClubBudget @relation(fields: [budgetId], references: [id])
  budgetId    String
  description String
  amount      Int        // in cents — positive = income, negative = expense
  type        String     // "INCOME" | "EXPENSE"
  receiptUrl  String?
  createdBy   User       @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime   @default(now())
}
```

### U11.2 — Backend: Stripe Checkout

**File to create:** `backend/src/controllers/paymentController.ts`

- `createCheckoutSession(req, res)` — `POST /events/:id/checkout` — auth
  - Verifies event `isPaid`, creates `stripe.checkout.sessions.create({...})`
  - Returns `{ sessionUrl }`
- `stripeWebhook(req, res)` — `POST /payments/webhook` — raw body, verify Stripe signature
  - On `checkout.session.completed` → find payment, update status, create `EventAttendance`

**Frontend — `events/[id]/page.tsx`:**
If `event.isPaid` and user hasn't registered: replace RSVP button with "Buy Ticket · $X.XX" → redirect to Stripe Checkout URL.

### U11.3 — Club Budget Tracking

**Backend:** CRUD endpoints for `ClubBudget` and `BudgetTransaction` under `/clubs/:id/budget`.

**Frontend:**
`frontend/src/app/(app)/clubs/[slug]/budget/page.tsx` — officer-only budget page:
- Allocated vs. spent progress bar
- Transaction log table (income green, expense red)
- "+ Add Transaction" modal
- Receipt upload via `FileUpload` component

---

## Phase U12 — Integrations & Open API

### U12.1 — Swagger / OpenAPI Docs

```bash
cd backend && npm install swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```

Add JSDoc `@swagger` annotations to all route files. Mount Swagger UI at `/api/docs` (available in development; behind admin auth in production).

### U12.2 — Google OAuth Login

```bash
cd backend && npm install passport passport-google-oauth20
npm install --save-dev @types/passport @types/passport-google-oauth20
```

Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to `.env`.

New endpoints in `authRoutes.ts`:
- `GET /auth/google` — redirect to Google OAuth
- `GET /auth/google/callback` — receive token, find-or-create user, issue JWT, redirect to frontend

**Frontend — `login/page.tsx` + `register/page.tsx`:**
Add "Continue with Google" button below the form (with Google logo icon, styled consistently).

### U12.3 — Slack/Discord Webhooks

**Schema:** Add `ClubIntegration` model: `{ clubId, type: "SLACK" | "DISCORD", webhookUrl, events String[] }`.

**Backend:** When events listed in `ClubIntegration.events` occur (new event approved, new member, announcement), POST a formatted rich message to the configured webhook URL.

**Frontend — `clubs/[slug]/manage/page.tsx`:** Add new "Integrations" tab. Show form to input webhook URL + checkbox list of events to notify on.

---

## Implementation Rules

1. **Complete one phase fully before starting the next.**
2. **After each phase:** run `npm run build` in both frontend and backend to ensure no TypeScript errors.
3. **After each phase:** update `HANDOVER.md` with the new files, endpoints, and business logic rules.
4. **Migrations:** Run `npx prisma migrate dev --name <phase>` after every schema change.
5. **Never break existing functionality** — test existing features (login, RSVP, admin panel) still work after each phase.
6. **Keep `exactOptionalPropertyTypes: true`** — use `?? null` for all optional Prisma fields, never `undefined`.

---

## Current Status

| Phase | Status |
|---|---|
| U1 — UI Polish | Complete ✅ |
| U2 — Real-Time | Complete ✅ |
| U3 — File Uploads + Rich Text | Complete ✅ |
| U4 — Social & Community | Complete ✅ |
| U5 — Gamification | Complete ✅ |
| U6 — Smart Event UX | Complete ✅ |
| U7 — AI Features | Complete ✅ |
| U8 — Calendar | Complete ✅ |
| U9 — PWA | Complete ✅ |
| U10 — Advanced Admin | Complete ✅ |
| U11 — Payments | Complete ✅ |
| U12 — Integrations | Complete ✅ |

*Last updated: 2026-06-08 — U12 complete — ALL PHASES DONE*
