# Mission Control - Support Operations Center

## Overview

Mission Control is a web-based support ticket management system (MVP) designed for external support operations via Telegram DM. It provides a Kanban board, activity feed, and detailed ticket views for multi-user teams handling support, budget, and logistics queues.

The app manages support tickets with statuses (inbox, needs_info, assigned, in_progress, waiting, review, done), categorized by queue (support/budget/logistics) and severity (S1/S2/S3). It tracks visitors (end-users who interact via Telegram), companies (B2B entities), and internal team members. Each ticket has a comment thread supporting both internal and external messages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (not Next.js despite the original spec — uses Vite as the bundler)
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming, Inter + JetBrains Mono fonts
- **Auth Context**: Custom React context (`AuthProvider`) managing JWT-based authentication state
- **Key Pages**:
  - `/` — Kanban board with ticket cards organized by status columns
  - `/feed` — Chronological activity feed with filters
  - `/ticket/:id` — Ticket detail view with comment thread and metadata
  - `/admin` — Team/user management (admin-only)
  - Login page (shown when unauthenticated)

### Backend
- **Framework**: Express.js running on Node.js with TypeScript (compiled via tsx in dev, esbuild for production)
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **Auth**: JWT-based authentication with bcryptjs password hashing. Tokens stored in httpOnly cookies (`mc_token`). Middleware extracts user from Authorization header or cookie.
- **Roles**: `admin` and `member` roles with role-based access control via `requireRole` middleware
- **Storage Layer**: Abstracted through `IStorage` interface in `server/storage.ts`, implemented with Drizzle ORM queries

### Database
- **Database**: PostgreSQL (required, configured via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-kit` for schema management
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migration Strategy**: `drizzle-kit push` for schema synchronization (no migration files approach)
- **Key Tables**:
  - `users` — Internal team members (admin/member roles, bcrypt password hashes)
  - `sessions` — JWT session tracking
  - `visitors` — External users (Telegram users), with registration/onboarding fields, persona type, contact info
  - `companies` — B2B company entities (CNPJ, trade name, legal name, status)
  - `visitor_company` — Many-to-many relationship between visitors and companies
  - `tickets` — Support tickets with public_id (e.g., "MC-000123"), status, queue, severity, visitor/company references
  - `ticket_assignees` — Many-to-many between tickets and users
  - `comments` — Ticket comments with `is_internal` flag and author type (visitor/admin/system)
  - `activities` — Activity log entries with type, ticket reference, payload JSON

### Build & Deployment
- **Dev**: `tsx server/index.ts` runs the Express server which proxies to Vite dev server for HMR
- **Production Build**: `script/build.ts` uses Vite to build the client and esbuild to bundle the server into `dist/index.cjs`
- **Static Serving**: Production serves built client files from `dist/public` with SPA fallback to `index.html`
- **Port**: Dev client runs on port 5000

### Project Structure
```
client/           — React frontend (Vite root)
  src/
    components/   — Reusable components (Layout, shadcn/ui)
    pages/        — Route pages (Kanban, Feed, TicketDetail, Admin, Login)
    lib/          — Utilities (auth context, query client, utils)
    hooks/        — Custom React hooks
server/           — Express backend
  index.ts        — Server entry point
  routes.ts       — API route definitions
  storage.ts      — Database access layer (IStorage interface)
  auth.ts         — Authentication middleware and helpers
  db.ts           — Drizzle/pg pool setup
  seed.ts         — Database seeding script
  vite.ts         — Vite dev server integration
  static.ts       — Production static file serving
shared/           — Shared code between client and server
  schema.ts       — Drizzle ORM schema definitions + Zod schemas
migrations/       — Drizzle migration output directory
```

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable using the `pg` driver

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and schema management for PostgreSQL
- **express** — HTTP server framework
- **jsonwebtoken** — JWT token generation and verification
- **bcryptjs** — Password hashing
- **zod** + **drizzle-zod** — Schema validation (shared between client and server)
- **@tanstack/react-query** — Client-side data fetching and caching
- **wouter** — Client-side routing
- **date-fns** — Date formatting utilities
- **@dnd-kit** — Drag-and-drop support (available for Kanban board)

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — Secret for signing JWT tokens (defaults to `"mission-control-dev-secret"` in dev)

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay in development
- `@replit/vite-plugin-cartographer` — Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner` — Dev banner (dev only)
- Custom `vite-plugin-meta-images` — OpenGraph meta tag management for Replit deployments