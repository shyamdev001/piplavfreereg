# Design

<!-- impeccable:design-schema 1 -->

## World

**Mode:** Operate, across every surface (auth, agent mobile flows, admin desktop flows). This is a field-operations tool, not a marketing site — expression never outranks task, state, or familiar affordance.

**Identity anchor:** the cooperative's own existing emblem (`client/src/assets/logo.png`) — a circular badge (burnt-orange ring, gold sun, green leaf, blue solar-panel grid, thin violet inner ring, warm off-white disc), reading "THE SOLAR COOP" / "P.S.S.U.U.S. MANDALI". This is real, pre-existing brand authority, not an invented mark: it is never redrawn, and the entire visual system is built to complement it rather than replace or compete with it.

**Color strategy:** Full palette (five named semantic roles), sampled directly from the emblem's own pixels rather than invented — see Tokens. This is deliberately richer than Operate's usual "neutrals + one accent" default because the palette itself *is* a brand asset here, not decoration.

**Type:** Hanken Grotesk (variable, self-hosted) for all UI text and display, JetBrains Mono for structured/measurement data (lead IDs, mobile numbers, monetary and count figures). One humanist grotesk system-wide keeps a single warm, legible voice at every size; the mono face is reserved for genuinely code-or-measurement-like values (per craft-floor's rule against monospace as a "technical" costume), which a lead ID (`SOL-000001`) and a phone number both are.

**Ground:** warm off-white (`hsl(32 38% 97%)`), never clinical pure white or dark mode — this is a daylight, outdoor, in-hand tool (bright sunlight + budget Android hardware per confirmed operating context), and a warm ground with strong dark-text contrast reads better in glare than a cool gray or a dark theme would.

## Tokens

All colors are CSS custom properties in `client/src/index.css`, consumed through Tailwind's `theme.extend.colors` in `client/tailwind.config.ts`. Every value below was sampled from the real logo asset (see the sampling method in git history / PRODUCT.md), not invented independently of it.

| Role | HSL | Source in emblem | Used for |
|---|---|---|---|
| `--primary` | `22 76% 45%` (terracotta) | outer ring | Primary actions, brand chrome, FOLLOW-UP status |
| `--accent` | `36 89% 54%` (gold) | sun | Warm highlights, QUOTATION status, progress-bar lead color |
| `--success` | `97 46% 28%` (leaf green) | leaf | Success states, CONVERTED status, "Saved" indicator |
| `--info` | `203 82% 40%` (panel blue) | solar panel | Informational accents, NEW status, admin secondary actions |
| `--premium` | `300 46% 31%` (violet) | inner ring | Rare/special accents, QUALIFIED status, agent-created audit entries |
| `--destructive` | `6 76% 48%` | — (not sourced from logo; standard error red, warmed to harmonize) | Errors, LOST status, destructive actions |
| `--background` | `32 38% 97%` | disc | Page ground |
| `--foreground` | `20 32% 11%` | — | Body text (warm near-black, not pure black) |

Radius: `--radius: 1rem` (16px) base, scaled via `rounded-xl/lg/md/sm` — generous, soft, native-app-like rather than sharp/corporate.

Shadows: warm-tinted only (`--shadow-color: 22 45% 18%`), never neutral gray — utilities `.shadow-warm-sm/md/lg/glow` in `index.css`. A zero-blur/zero-offset shadow is never used (craft-floor ban on neobrutalist block shadows; this world never opted into that language).

Browser surfaces are themed, not left to UA defaults: `::selection`, caret color, focus rings, and the scrollbar thumb all pull from `--primary`.

## Components

Shadcn-style primitives in `client/src/components/ui/` (button, input, card, badge, select, dialog, dropdown-menu, tabs, table, progress, skeleton, stat-card, form-field, empty-state). Each carries the shared language:

- **Buttons** (`button.tsx`): solid primary has an inset top highlight + warm drop shadow for tactile depth; `active:scale-[0.97]` on every variant for press feedback; `asChild` (Link-wrapping) buttons render through Radix `Slot` directly, bypassing the loading-spinner branch entirely (Slot requires exactly one child element — see the code comment for the bug this fixes).
- **Cards**: `rounded-2xl`, warm shadow, no colored left-border accents (craft-floor ban) — status/tone is carried by icon-chip color and dot color instead.
- **Status color**: `LeadStatusBadge` and its exported `STATUS_DOT` map are the single source of truth for lead-status color everywhere (badges, dashboard bars, table rows) — never redefine status colors locally.
- **Skeletons**: shimmer sweep is a `transform: translateX` animation on a `::before` overlay, not a `background-position` animation (the two are easy to mismatch; only the transform approach actually moves visibly against a solid-color skeleton).

## Brand component

`client/src/components/brand/Logo.tsx` is the only place the emblem image is referenced. Three variants:

- `mark` — emblem only (auth screens, 404, favicons pre-generated in `client/public/favicon-{16,32,48,180,512}.png`).
- `lockup` — emblem + short "Solar Coop" wordmark (mobile header, tight spaces).
- `full` — emblem + "THE SOLAR COOP" + "Field Lead Network" sub-line (used where more space exists).

Never hardcode the wordmark text elsewhere; extend `Logo` if a new lockup shape is needed.

## Signature interactions

- **Wizard step transitions** (`LeadWizardPage.tsx`): horizontal slide + fade via Framer Motion `AnimatePresence`, direction-aware (forward steps slide from the right, back navigation from the left) — one authored motion grammar for the whole 7-step flow, not per-field animation.
- **Submission celebration**: `canvas-confetti` burst in the brand's four sampled hues on successful lead submission, `disableForReducedMotion: true`.
- **Dashboard status bars**: animate their width in on mount (staggered per row), colored per the shared status-dot map.
- **Sticky step actions**: Back/Next (and Review/Submit) sit in a `sticky bottom-0` bar within each wizard step and the review screen, so the primary action is always one thumb-reach away on a phone — this was a deliberate field-conditions decision (one-handed outdoor use), not a generic pattern.

## Mobile vs. desktop shells

- **`AgentLayout`**: sticky header with the `lockup` logo + avatar menu; a floating (not edge-pinned) bottom nav bar with a raised circular "add lead" FAB, sized and positioned for one-handed thumb reach, respecting `env(safe-area-inset-bottom)`.
- **`AdminLayout`**: fixed left sidebar (desktop) with the `lockup` logo, filled-pill active nav state, user/logout footer; collapses to a hamburger-triggered drawer with a blurred scrim below `md`.
- Admin pages/layout are code-split (`React.lazy` in `App.tsx`) away from the agent bundle, since field agents — the bandwidth- and device-constrained audience — never load that code.

## What must be preserved

- The logo asset itself and its transparency — never redrawn, never recolored.
- The sampled palette values in the token table above — if the brand ever supplies an official style guide, reconcile against it rather than re-sampling casually.
- Hanken Grotesk + JetBrains Mono as the only two type families. Do not introduce a third face or fall back to system fonts as a "quick" choice — self-host, per craft-floor.
- Warm-tinted shadows and warm off-white ground — reintroducing neutral gray shadows or a pure-white/dark ground would break the single most identity-carrying decision in this system.
