# Piplav Village Solar Registration

Solar registration app for **Piplav village** (Dist. Anand, Gujarat, PIN 388460).
Every registration is a residential rooftop on the standard 2.18 kW system, so
village, district, state, PIN code, customer type and system size are pre-filled:

```
FIELD AGENT → LOGIN → NEW REGISTRATION → CUSTOMER DETAILS → ADDRESS → SYSTEM SIZE (2.18 kW)
  → ELECTRICITY CONSUMER NAME + NUMBER → DOCUMENTS → NOTES → REVIEW → SUBMIT
  → DATABASE + CLOUDINARY → ADMIN DASHBOARD → ADMIN VIEWS COMPLETE REGISTRATION
```

This is **not** an HRMS, payroll, attendance, or generic CRM system. It does exactly
one job: field agents collect customer + document information in the field, and
admins manage the resulting leads from a central dashboard.

## 1. Architecture Overview

```
solar-lead-system/
  client/     React 18 + TypeScript + Vite + Tailwind + shadcn-style components
  server/     Node.js + Express + TypeScript + Mongoose
  README.md
  .gitignore
```

- **Frontend**: mobile-first multi-step wizard for field agents; desktop-first
  (responsive) dashboard for admins. React Router role-based routing, React Hook
  Form + Zod for validation, Axios with automatic refresh-token retry.
- **Backend**: REST API, JWT auth via httpOnly cookies (access + refresh), all
  authorization enforced server-side (never trusts frontend role/IDs).
- **Database**: MongoDB via Mongoose. Documents (files) are never stored in
  MongoDB — only metadata + a Cloudinary reference.
- **File storage**: Cloudinary, using the `authenticated` delivery type so
  uploaded documents are never publicly reachable. Access is only ever granted
  through a short-lived signed URL minted by the backend after checking
  permissions.

## 2. Roles & Permissions

| Capability | Field Agent | Admin |
|---|---|---|
| Login | ✅ | ✅ |
| Create / edit own draft leads | ✅ | – |
| Submit leads | ✅ (own) | – |
| View own leads | ✅ | ✅ (all) |
| View other agents' leads | ❌ | ✅ |
| Upload documents to own leads | ✅ | – |
| View documents | own leads only | any lead |
| Download documents | ❌ | ✅ |
| Change lead status | ❌ | ✅ |
| Archive / restore leads | ❌ | ✅ |
| Manage agents | ❌ | ✅ |
| View audit logs | ❌ | ✅ |
| Export leads (non-sensitive) | ❌ | ✅ |

All of the above is enforced in Express middleware/controllers
(`server/src/middleware/auth.middleware.ts`, `server/src/services/lead.service.ts`'s
`canAccessLead`), **not** just hidden in the UI.

## 3. Database Design

**User** — `name, email, phone, passwordHash, role (ADMIN|AGENT), status
(ACTIVE|DISABLED), mustChangePassword, refreshTokenVersion`. Indexed on
`role + status`.

**Lead** — `leadId` (unique, auto-generated `SOL-000001`), `customerBasicDetails`,
`customerAddress`, `solarInformation`, `electricityDetails`, `documents[]`
(metadata only), `notes`, `createdBy`, `status`, `isDraft`, `archived`. Indexed on
`leadId`, `customerBasicDetails.mobileNumber`, `electricityDetails.consumerNumber`,
`createdBy`, `status`, `createdAt`, `archived`, `isDraft`, plus a text index on
customer name for search.

**Counter** — a single-document-per-key atomic sequence
(`findOneAndUpdate({ $inc })`) used to generate `SOL-000001`, `SOL-000002`, …
safely even when multiple agents submit leads at the same instant.

**AuditLog** — `action, actorId, actorName, actorRole, targetType, targetId,
targetLabel, details, ipAddress, createdAt`. Deliberately never stores document
contents, passwords, tokens, or full ID numbers — only human-readable summaries
("NEW → CONTACTED").

**Document metadata** (embedded in `Lead.documents[]`, one entry per document
type per lead): `documentType, pages[] (pageNumber, cloudinaryPublicId,
resourceType, mimeType, originalName, fileSize, uploadedAt - one per page),
pdfFile (cloudinaryPublicId, resourceType, fileSize, generatedAt), pdfStatus
(NOT_READY|PROCESSING|READY|FAILED), status, uploadedBy, uploadedAt`. `pageNumber`
is an **explicit, authoritative order index** - page order is never inferred
from array position, filename, or upload timestamp, since pages can be
reordered after upload. See §4 for how `pages`/`pdfFile` relate.

## 4. Document Management & PDF System

Every customer document is stored as **originals + one usable PDF**, grouped
under its document type (Aadhaar, Electricity Bill, Bank Passbook, PAN,
Other) for that lead:

```
Lead SOL-000124
  documents: [
    {
      documentType: "Aadhaar Card",
      pages: [ {pageNumber: 1, ...}, {pageNumber: 2, ...}, ... ],  // any count, no front/back assumption
      pdfFile: { ... },                                            // the one usable PDF for this document
      pdfStatus: "READY" | "PROCESSING" | "FAILED" | "NOT_READY",
    },
    ...
  ]
```

- There is **no front/back assumption** anywhere in the model: a document
  with 1 page, 2 pages, or N pages (up to the configurable max, default 10 -
  `MAX_DOCUMENT_PAGES` env var) is equally valid. Nothing is named `front`/
  `back`.
- **Images (JPG/JPEG/PNG/WEBP)** are auto-oriented (EXIF), capped at 2400px on
  the longest edge, and re-encoded at high quality (85%) via `sharp` before
  storage — then a PDF is generated from them with **pdf-lib**: one page per
  image, each page sized to that image's own pixel dimensions, so portrait
  stays portrait and landscape stays landscape with nothing cropped. Multiple
  images for the same document type (uploaded via "Add Another Photo") become
  **one multi-page PDF**, ordered by each page's explicit `pageNumber` — never
  separate PDFs, and never by upload/array order. The multi-page PDF is
  rebuilt from scratch (re-fetching prior pages) on every append, retake,
  removal, reorder, or retry; this is a deliberate V1 simplification over
  incremental PDF editing, since documents are a handful of already-compressed
  images and this stays fast.
- **PDFs uploaded directly** are never re-converted — the uploaded file *is*
  the usable PDF (`pdfFile` just mirrors the same Cloudinary asset as the
  page, no duplicate storage, no conversion pass).
- **Page management**: an agent can, at any time before/while a document is
  being assembled, **reorder** pages (`PATCH /api/documents/:documentId
  /pages/reorder`, a metadata-only pageNumber reassignment - no assets move),
  **remove** a specific page (`DELETE /api/documents/:documentId
  /pages/:pageId`, which closes the gap by renumbering the remaining pages -
  removing page 2 of 3 leaves 1, 2, never 1, 3; removing the only remaining
  page deletes the whole document group), and **retake/replace** a specific
  page in place (`POST .../documents` with `mode=replace-page` + `pageId`,
  which keeps that page's position and pageNumber while swapping its file).
  The mobile UI (`DocumentUploader.tsx`) shows each page as its own row with
  move-up/move-down, preview, retake, and remove controls - deliberately
  simple move-arrows rather than drag-and-drop, since arrows are equally
  reliable on any mobile browser without a drag library.
- The page file(s) are **always preserved**, even if PDF generation fails.
  A failed generation sets `pdfStatus: "FAILED"`; the document detail view
  shows a "Retry" action (`POST /api/documents/:documentId/regenerate-pdf`)
  that rebuilds the PDF without touching the pages.
- No queues, workers, or async jobs — generation happens inline during the
  triggering request, and only ever runs when the page set or order actually
  changed (never a wasted no-op regeneration). If this becomes a real
  bottleneck at scale, that's the one piece designed to be lifted into a
  background job later without changing the data model.

### Cloudinary storage layout

```
solar-leads/
  <lead-id-slug>/
    <document-type-slug>/
      original/<uuid>[.pdf]     - each uploaded page/file, as-is
      pdf/<uuid>.pdf            - the generated (or mirrored) usable PDF
```

- Uploads go **through the backend only** (`multer` memory storage → `sharp`
  optimization for images → Cloudinary `upload_stream`), never directly from
  the browser to Cloudinary.
- All assets use Cloudinary's **`authenticated` delivery type** — never
  publicly reachable by a guessed or leaked URL.
- **Images** are stored under `resource_type: image`. **PDFs are stored under
  `resource_type: raw`** — see the callout below, this is required, not
  cosmetic.
- Viewing/downloading always goes through `GET /api/documents/:documentId
  /access?variant=pdf|original&index=N&action=view|download`, which verifies
  the JWT, re-checks `canAccessLead` (admin, or the agent who owns the lead)
  server-side every time, mints a short-lived signed Cloudinary URL, and
  records a `DOCUMENT_VIEWED`/`DOCUMENT_DOWNLOADED` audit entry. Download URLs
  use Cloudinary's `fl_attachment:<name>` flag to force a clean, predictable
  filename (`SOL-000124_Rajesh_Patel_Aadhaar_Card.pdf`) instead of exposing
  the random UUID the asset is stored under.
- Replacing a document (or deleting it, or deleting a whole draft lead) cleans
  up every Cloudinary asset it owned (`deleteDocumentGroupAssets`) so
  abandoned files never accumulate.
- **"Download All PDFs"** (`GET /api/leads/:id/documents/download-all`)
  streams a ZIP (via `archiver`) containing only that lead's **ready**
  PDFs as separate files — never one merged PDF, never another lead's files.
  If literally none can be fetched, it fails with a clear error rather than
  silently serving an empty ZIP (see Risks below — this is exactly the
  failure mode the required Cloudinary setting below causes if skipped).

> ### ⚠️ Required one-time Cloudinary account setting
> Cloudinary **disables delivery of PDF and ZIP files by default on every
> account** (a standing mitigation for a historical Ghostscript RCE
> vulnerability) — this is not something this codebase can work around, and
> it is **not** the same thing as `resource_type: raw` (which this project
> already uses for exactly this reason, but it isn't sufficient on its own).
> Without this setting, every PDF *upload* still succeeds, but *viewing or
> downloading* a PDF returns a Cloudinary `401 deny or ACL failure`.
>
> **Fix (one-time, ~30 seconds):** Cloudinary Console → the gear icon
> (**Settings**) → **Security** tab → find **"PDF and ZIP files"** → enable
> **"Allow delivery of PDF and ZIP files"** → **Save**. This was verified
> against a real Cloudinary account during development: image originals
> delivered correctly with this setting off, but every PDF delivery failed
> until it was turned on. **Status on this project's account: enabled** -
> re-verified working end-to-end (document PDFs and the Model Agreement PDF,
> §4a below) as of the latest live test. If you connect a *different*
> Cloudinary account later, re-check this setting first.

### Known limitation: signed URL expiry

Signed URLs from `cloudinary.url({ sign_url: true })` are valid as long as the
signature matches (no built-in expiry) unless your Cloudinary account has
**Strict Transformations + Token-based Authentication** enabled on a paid
plan. If you enable that, add an `auth_token` block to `buildSignedViewUrl`
(see `server/src/services/cloudinary.service.ts`) for a hard expiry window.
Until then, security relies on: (a) the URL only ever being generated after a
fresh permission check, (b) it never being persisted in the browser beyond the
current view, and (c) it not being derivable without the account's API secret.

## 5. Tech Stack

**Frontend**: React 18, TypeScript, Vite, React Router 6, Tailwind CSS,
shadcn-style components (Radix primitives + `class-variance-authority`), React
Hook Form, Zod, Axios, Sonner (toasts), Framer Motion, Hanken Grotesk + JetBrains
Mono (self-hosted). See [DESIGN.md](DESIGN.md) for the full design system —
color tokens sampled from the real brand emblem, typography, component
language, and the mobile/desktop shell decisions.

**Backend**: Node.js, Express, TypeScript, Mongoose, JWT (`jsonwebtoken`),
bcryptjs, Zod, Multer, Sharp, **pdf-lib** (image → PDF assembly), **archiver**
(ZIP streaming for "Download All"), Cloudinary SDK,
Helmet, express-rate-limit, Morgan.

**Dev tooling**: ESLint, Prettier, Vitest + Supertest + mongodb-memory-server
(backend tests), dotenv.

## 6. Installation

### Prerequisites
- Node.js 18+
- A MongoDB instance (local, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- A free [Cloudinary](https://cloudinary.com) account

### Setup

```bash
npm run install:all
```

This installs dependencies for both `client/` and `server/`.

### Environment variables

Copy `server/.env.example` to `server/.env` and fill in real values:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/solar-lead-system
JWT_ACCESS_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<a different random string, same command>
CLOUDINARY_CLOUD_NAME=<from Cloudinary dashboard>
CLOUDINARY_API_KEY=<from Cloudinary dashboard>
CLOUDINARY_API_SECRET=<from Cloudinary dashboard>
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
MAX_DOCUMENT_PAGES=10   # optional - max pages per document; defaults to 10 if unset
```

The client needs no `.env` — in development it proxies `/api` to
`http://localhost:5000` (see `client/vite.config.ts`); in production, point your
hosting config or a reverse proxy at the deployed API.

### MongoDB Atlas setup (2 minutes)
1. Create a free cluster at cloud.mongodb.com.
2. Database Access → add a user with a strong password.
3. Network Access → allow your IP (or `0.0.0.0/0` for early development only).
4. Copy the connection string into `MONGODB_URI`.

### Cloudinary setup (3 minutes)
1. Sign up at cloudinary.com (free tier is enough for development).
2. Dashboard → copy **Cloud Name**, **API Key**, **API Secret** into `.env`.
3. **Settings → Security → "PDF and ZIP files" → enable "Allow delivery of PDF
   and ZIP files" → Save.** Required for the document PDF system — see §4's
   callout. Without this, uploads succeed but PDF preview/download return a
   401 from Cloudinary.
4. No manual folder/preset setup is required — the backend creates folders on
   first upload.

## 7. Local Development

```bash
# Terminal 1
npm run dev:server     # http://localhost:5000

# Terminal 2
npm run dev:client     # http://localhost:5173
```

### Seed data

```bash
npm run seed
```

Creates, in your configured database:
- 1 admin (`admin@solarcoop.dev` / the password in `SEED_ADMIN_PASSWORD`,
  default `ChangeMe123!`)
- 3 field agents (`amit.agent@solarcoop.dev`, `priya.agent@solarcoop.dev`,
  `rohan.agent@solarcoop.dev`, all sharing password `AgentPass123!`)
- 20 fake submitted leads with obviously fake data and **no attached
  documents** (seed data intentionally never includes real or fake Aadhaar
  images, bank details, etc. — only structured business data)

**⚠️ These are development-only credentials. Change the admin password (and
disable/rotate the agent passwords) before using any shared or production
environment.**

### Tests

```bash
cd server && npm test
```

29 tests across authentication, authorization, lead lifecycle, and document
security, run against an ephemeral in-memory MongoDB
(`mongodb-memory-server`) — no real database is touched.

### Build

```bash
npm --prefix client run build     # outputs client/dist
npm --prefix server run build     # outputs server/dist
```

## 8. API Reference

```
AUTH
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/change-password

AGENTS (admin only)
GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PATCH  /api/agents/:id
PATCH  /api/agents/:id/status
POST   /api/agents/:id/reset-credentials
GET    /api/agents/:id/stats

LEADS
GET    /api/leads                    search / filter / sort / paginate
GET    /api/leads/duplicates         ?mobileNumber=
GET    /api/leads/export             admin only, CSV, non-sensitive fields
POST   /api/leads                    create draft
GET    /api/leads/:id
PATCH  /api/leads/:id                save a wizard step (partial update)
DELETE /api/leads/:id                delete a draft only
POST   /api/leads/:id/submit         final submission (re-validated server-side)
PATCH  /api/leads/:id/status         admin only
POST   /api/leads/:id/archive        admin only
POST   /api/leads/:id/restore        admin only

DOCUMENTS
GET    /api/leads/:id/documents
POST   /api/leads/:id/documents            multipart upload; body: documentType, mode ('replace'|'append'|'replace-page'), pageId (for replace-page)
GET    /api/leads/:id/documents/download-all   ZIP of all READY PDFs for this lead
GET    /api/documents/:documentId/access   ?action=view|download&variant=pdf|original&index=N
POST   /api/documents/:documentId/regenerate-pdf   retry a FAILED PDF generation
PATCH  /api/documents/:documentId/pages/reorder    body: { pageIds: string[] } - full permutation of current pages
DELETE /api/documents/:documentId/pages/:pageId    remove one page; renumbers the rest (deletes the whole document if it was the last page)
DELETE /api/documents/:documentId          remove the whole document (all pages + PDF)

DASHBOARD
GET    /api/dashboard/stats          admin
GET    /api/dashboard/agent-stats    agent

AUDIT
GET    /api/audit-logs               admin only
```

## 9. Security Notes

- Passwords hashed with bcrypt (cost factor 12).
- JWT access tokens (15 min) + refresh tokens (7 days) in **httpOnly, SameSite
  cookies** — never exposed to JS, so not readable by an XSS payload. The
  refresh cookie is scoped to `/api/auth` only.
- Every mutating/lead/document/agent route re-verifies the requester's role and
  ownership server-side — frontend role checks are UX only.
- `express-rate-limit` on all routes, with a stricter limit on `/api/auth/login`.
- `helmet` security headers, explicit CORS allow-list (`CLIENT_URL` only, with
  credentials).
- Input validated with Zod on **every** route (body/query/params); MongoDB
  operator-injection is blocked by stripping `$`-prefixed / dotted keys from
  request bodies before they can reach a query.
- File uploads are allow-listed by MIME type and capped at 15MB; images are
  re-compressed server-side.
- CSRF: mutating requests require a custom `Content-Type: application/json` or
  `multipart/form-data` request from the exact CORS-allowed origin with
  credentials — a plain cross-site HTML form post can't replicate this, and the
  refresh/access cookies are `SameSite=Lax` (`Strict` in production). For an
  extra layer in production behind a browser that doesn't fully honor SameSite,
  consider adding a double-submit CSRF token to state-changing requests.
- Audit log never stores document contents, full ID numbers, passwords, or
  tokens.
- CSV export only ever includes the explicitly listed non-sensitive columns —
  documents/Aadhaar/bank data are never exported.

## 10. Known Limitations / Suggested Next Steps

- **Cloudinary's "Allow delivery of PDF and ZIP files" setting must be enabled
  per §4** — without it, PDF uploads succeed but preview/download/download-all
  all fail with a Cloudinary 401. This is the single most important
  operational step before this feature works in any environment.
- Multi-page PDFs are rebuilt from scratch (re-fetching every prior page) on
  each append or retry rather than edited incrementally — a deliberate V1
  simplification (see §4) that would be worth revisiting if documents
  routinely grow beyond a handful of pages.
- Admins set an agent's password directly (on creation and via "Set Password")
  rather than the system generating a random temporary one. The
  `mustChangePassword` field still exists on the `User` model for a future
  forced-password-change flow, but nothing sets it to `true` today, so no
  frontend gate currently reads it.
- Cloudinary signed URLs don't have a hard expiry unless your account has
  token-based authentication enabled (see §4).
- No push/email notifications on status changes — out of scope per the product
  brief.
- The admin dashboard/table/agents/audit-log pages are already code-split into
  their own chunk (`React.lazy` in `App.tsx`) so field agents never download
  that code; the shared vendor bundle (React, Radix, Framer Motion, etc.) is
  still one ~700KB chunk, which is normal for an app this size but could be
  split further if initial load time becomes a concern at scale.

## 11. Deployment

Designed to run on free/low-cost tiers:

- **Frontend**: Vercel (or Netlify) — `client/`, build command `npm run build`,
  output `dist/`.
- **Backend**: Render / Railway / any Node host — `server/`, build `npm run
  build`, start `npm start`. Set all `.env` variables in the host's dashboard.
- **Database**: MongoDB Atlas free tier.
- **Files**: Cloudinary free tier.

Remember to set `CLIENT_URL` / `SERVER_URL` to the real deployed URLs, set
`NODE_ENV=production` (this switches cookies to `Secure` + `SameSite=Strict`
and hides stack traces from error responses), and serve everything over HTTPS.

## 12. Production Checklist

- [ ] HTTPS enabled end-to-end
- [x] Password hashing (bcrypt)
- [x] JWT auth with short-lived access + refresh tokens in httpOnly cookies
- [x] Role-based authorization enforced server-side
- [x] Documents served only via authenticated, permission-checked signed URLs
- [ ] Cloudinary "Allow delivery of PDF and ZIP files" enabled (§4 — required for the document PDF system to work at all)
- [ ] Cloudinary token-based auth enabled for hard-expiring URLs (paid feature)
- [x] Cloudinary/MongoDB credentials only in server-side env vars
- [x] No secrets committed to git (`.env` gitignored, `.env.example` only)
- [x] Rate limiting on all routes, stricter on login
- [x] File type + size validation
- [x] Input validation (Zod) on every route
- [x] Audit logging of sensitive actions
- [ ] Configure MongoDB Atlas automated backups
- [x] Centralized error handling (no raw stack traces in production responses)
- [x] Secure cookies (`Secure` + `SameSite=Strict` in production)
- [x] CORS locked to the configured client origin
- [x] Security headers via Helmet
- [x] Soft-delete via archive/restore; hard delete restricted to draft leads only
- [x] No sensitive data in audit logs
- [x] No sensitive data in CSV exports
- [ ] Change the seeded admin password before go-live
