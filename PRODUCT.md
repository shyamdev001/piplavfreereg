# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two confirmed roles, both already implemented in the codebase:

- **Field Agents** — work under an admin, meet potential solar customers in person, and collect customer + document information entirely on a phone while standing in the field. Confirmed operating conditions: often in bright outdoor sunlight, frequently on budget/older Android phones, sometimes on patchy mobile networks. This is the highest-stakes surface: it must work one-handed, be legible in glare, and never lose collected data.
- **Admins** — the cooperative's office/management side. Work from a desktop, review and manage every lead submitted by every agent, control lead status, manage agent accounts, and audit sensitive actions (document views/downloads, status changes).

## Product Purpose

Digitizes and standardizes a solar cooperative's field lead-collection workflow: agent visits customer → collects structured customer/address/solar/electricity data → captures ID and utility documents → submits → admin reviews centrally. Exists to replace paper-based or ad hoc field data collection with one consistent, auditable digital flow.

## Positioning

Deliberately a single-workflow tool, not a generic HRMS/CRM/ERP. Its differentiator versus a general-purpose CRM or field-service platform is narrowness: it does exactly one thing (agent → customer lead → verified documents → admin dashboard) without the configuration overhead, unrelated modules, or generic form-builder feel of a horizontal CRM.

## Operating Context

- Field agents operate face-to-face with customers, in India (seed data and terminology reflect Maharashtra — DISCOM names like MSEDCL, INR currency, Indian PIN codes, Indian names/addresses).
- Confirmed device/environment constraints for agents: bright outdoor sunlight (glare) and budget/older Android hardware (smaller/lower-res screens, less GPU headroom) — both push toward strong contrast, restrained motion cost, and generous touch targets rather than dense/subtle desktop-style UI.
- Patchy connectivity is a known risk; the product already mitigates this with per-step autosave and a local draft cache, which any redesign must preserve.
- Admins work in a normal desktop/office context reviewing already-submitted data.

## Capabilities and Constraints

Already built and functional (29 passing backend tests) — this is a visual/UX/branding pass, not a rebuild:

- JWT-based auth (httpOnly cookies) with strict server-side role separation between AGENT and ADMIN.
- A 7-step field lead wizard (Basic Details → Address → Solar Information → Electricity Details → Documents → Notes → Review & Submit) with per-step autosave, a local draft cache for connectivity drops, and duplicate-customer detection by mobile number.
- Camera-first document capture (Aadhaar, electricity bill, bank passbook, PAN, other) with client-side preview and server-side image optimization, stored via Cloudinary's `authenticated` delivery (never public) and only ever accessed through backend-issued signed URLs.
- Admin dashboard, searchable/filterable/paginated leads table, full lead detail view, agent management (add/disable/reset credentials), audit log, and a non-sensitive CSV export.
- Constraint: business logic, API contracts, and data flow must not change during this design pass.

## Brand Commitments

- Working brand name used throughout the app: **THE SOLAR COOP**.
- The organization's real, existing emblem is provided at `client/logo.png` (320×320 PNG, transparent background): a circular badge — burnt-orange ring with "THE SOLAR COOP" curved along the top and "P.S.S.U.U.S. MANDALI" (the cooperative society's fuller registered name) curved along the bottom, an orange/gold sun burst, a green leaf, a blue solar-panel grid, and a thin deep-violet inner ring, on a warm off-white disc.
- This emblem is the authoritative logo mark. It is not to be redrawn or replaced — the UI is designed to house it correctly (sized for a mobile header/favicon, paired with a clean wordmark where more space is available) and to draw its palette from it.
- Brand palette sampled directly from the emblem (exact values, to be used as the seed for the design system's tokens): burnt/terracotta orange `#D2691E`-family (primary, from the ring), golden sun-orange `#EFA02A`-family (warm accent), leaf green `#4F9A00`-family (success/eco accent, already semantically apt for "success" states), sky/panel blue `#0080D0`-family (secondary/informational accent), deep violet `#701070`-family (rare, premium accent used sparingly). Background warmth should lean off-white rather than clinical pure white, matching the emblem's disc.

## Evidence on Hand

- `client/logo.png` — the real, final brand emblem (see Brand Commitments). No other logo variants exist yet; a wordmark lockup and favicon-scale treatment need to be derived from it during design work.
- Seed/demo data (`server/src/scripts/seed.ts`) confirms the Maharashtra/India operating context referenced above.

## Product Principles

1. One workflow, done exceptionally well — resist any pull toward generic CRM/HRMS breadth.
2. Field-first: every agent-facing screen must work one-handed, in bright sunlight glare, on a modest Android phone, without ever silently losing what was typed.
3. Trust through transparency: admins can always see who did what and when; access to sensitive customer documents must be provably restricted, not just hidden in the UI.
4. The cooperative's identity is not decoration — when an agent shows this app to a customer, it should visibly represent a credible, established organization.

## Accessibility & Inclusion

No formal accessibility standard has been specified. Given the confirmed field conditions (outdoor glare, budget Android hardware), the product should default to strong color contrast, legible type sizes, and generous touch targets on every agent-facing screen rather than treating these as edge-case accommodations.
