# AutoAgent Landing Page Build Spec

Use this brief to recreate the Loveable prototype inside the dealer dashboard Next.js app. It consolidates all copy, layout rules, states, and implementation notes discussed with Loveable.

## Assets & References
- **Screenshot**: `docs/design/landing/assets/landing.png` (Loveable prototype reference — capture new screenshots whenever the layout changes)
- **Assets Folder**: `docs/design/landing/assets/` (contains design reference materials)
- **Lucide icons**: `TrendingUp`, `DollarSign`, `Clock`, `Users`, `BarChart`, `Shield`, `Check`, `ArrowRight`
- **Component libraries**: shadcn/ui `Button`, `Card`
- **Live route**: `/` (App Router entry `apps/dealer-dashboard/src/app/page.tsx` re-exports marketing layout from `(marketing)/page.tsx`)

## Page Overview
| Section | Purpose | Key Notes |
|---------|---------|-----------|
| Header | Branding + nav + CTAs | Sticky with backdrop blur, Sign In link + Get Started button |
| Hero | Primary value prop | Badge, gradient heading, two CTAs, four stat cards |
| Features Grid | Six differentiators | Card hover lift, icon pills, responsive 1/2/3 columns |
| Benefits | Persuasion narrative | Copy column + journey card, checklist with check icons |
| Final CTA | Conversion closer | Elevated card with two CTAs and trust text |
| Footer | Brand/legal | Stack on mobile, horizontal on desktop |

## Content Bible
### Hero
- **Badge**: Car Buyers Are Searching ChatGPT Right Now
- **Heading**: Is Your Inventory **Showing Up?** (gradient on “Showing Up?”)
- **Subheading**: The customer journey has changed forever... (copy from Loveable export)
- **Primary CTA**: Sign Up → `/auth`
- **Secondary CTA**: Schedule Demo → `/auth`
- **Stats**: 
  - 73% — Buyers Use ChatGPT
  - Real-Time — Inventory Sync
  - 100% — AI Search Coverage
  - First — To Market

### Features (Heading: “Be Everywhere High-Intent Buyers Are Looking”)
1. Real-Time ChatGPT Integration — “Your entire inventory automatically populates…”
2. Capture High-Intent Buyers — “When someone asks ChatGPT ‘show me used Ford F-150s…”
3. Automated Inventory Sync — “Every vehicle you add is instantly available…”
4. Multi-Store Inventory — “Manage and syndicate inventory across all your dealership locations…”
5. AI Search Analytics — “See exactly which vehicles buyers are searching for…”
6. Be Visible or Be Forgotten — “Traditional car shopping sites are dying…”

### Benefits (Heading: “The New Customer Journey Starts In ChatGPT”)
- Subheading: “Right now, buyers are asking ChatGPT…”
- Checklist items:
  - Appear in ChatGPT searches instantly
  - Capture buyers before they visit competitor sites
  - Sync your inventory to AI platforms automatically
  - Get leads from the highest-intent buyers
  - Stop losing sales to invisible competitors
  - Dominate the new AI-powered car shopping journey
- Journey card (“Today’s Reality – The ChatGPT Car Shopping Journey”):
  - Buyer searches ChatGPT → Now
  - Your inventory appears → Instantly
  - Competitors? → Invisible

### Final CTA
- Heading: Stop Being Invisible To Ready-To-Buy Customers
- Subheading: Every minute your inventory isn’t in ChatGPT…
- CTAs: Sign Up → `/auth`, Talk to Sales → `/auth`
- Trust text: Join dealerships capturing buyers directly from ChatGPT searches

### Footer
- Brand: AutoAgent
- Legal: © 2025 AutoAgent. All rights reserved.

## Design Tokens & Utilities
- **Colors**: leverage Tailwind theme tokens; ensure brand primary aligns with prototype.  
  - Light-mode base tokens (defined in `apps/dealer-dashboard/src/app/globals.css`):  
    ```
    --background: 220 17% 97%;  /* subtle blue-gray */
    --card: 0 0% 100%;          /* pure white surfaces */
    --primary: 142 76% 36%;     /* emerald accent */
    --border: 220 13% 91%;      /* soft divider */
    ```  
  - Landing wrapper gradient: `bg-gradient-to-br from-background via-background to-primary/5` (renders a light gray → mint wash).  
  - Frosted overlays: header `bg-background/80`, benefits `bg-card/50`, footer `bg-card/30`.
- **Typography**: Hero `text-5xl md:text-6xl`, section `text-3xl md:text-4xl`, card titles `text-xl font-semibold`, body copy `text-base md:text-lg`.
- **Spacing**: Container `max-w-6xl mx-auto px-6`, sections `py-20 md:py-24`, card gaps `gap-6`.
- **Shadows & Radii**:
  - Cards: `rounded-lg border border-border/40 shadow-sm` by default.
  - Elevation on hover: create `.hover-lift` utility (`transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg`).
- **Gradient Heading**: `.gradient-text` utility using `bg-clip-text text-transparent`.

## Responsive Behavior
- Header buttons stack on mobile (`flex-col gap-2 sm:flex-row`).
- Hero stats: 2×2 grid on mobile (`grid-cols-2`), single row on desktop (`md:grid-cols-4`).
- Feature cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Benefits section: `grid-cols-1 md:grid-cols-2`.
- Footer: `flex-col gap-4 md:flex-row md:items-center md:justify-between`.

## Interaction Notes
- Buttons: use shadcn `Button` with `variant="default"` for primary, `variant="outline"` for secondary; add icon shift on hover (`group` + `translate-x-1`).
- Cards: apply `.hover-lift` class; include `transition` utilities for smooth elevation.
- Sticky header: `sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b`.
- Header CTAs: Sign In stays a text link (`text-sm font-medium text-muted-foreground`), Get Started uses a pill button (`rounded-full h-10 px-5 py-2 text-sm font-semibold shadow-md` with hover lift).

## Implementation Notes

### CSS Variables & Colors
- **Emerald Palette**: Updated primary color variants with proper HSL values matching emerald theme:
  - `--primary-50: 152 81% 96%` (lightest emerald background)
  - `--primary-100: 152 76% 90%` (light emerald)
  - `--primary-200: 152 69% 80%` (emerald border)
  - `--primary-600: 152 69% 45%` (main emerald accent)
  - `--primary-700: 152 75% 35%` (dark emerald)
- Updated Tailwind config to include primary color variants for proper brand accent colors
- All brand colors now render correctly: `bg-primary-50`, `text-primary-600`, `border-primary-200`, etc.

### Configuration Fixes
- Removed `outputFileTracingRoot` from `next.config.js` to avoid workspace root warnings
- Re-enabled unused-var linting in `.eslintrc.js` for proper code quality
- **Package Management**: Aligned with pnpm workspace standards:
  - Removed stray `node_modules` directories
  - Confirmed no `package-lock.json` files are created
  - All dependencies managed through pnpm workspace

- Sticky header: `sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b`.

### Tailwind Toolchain & Troubleshooting
- Standardize on **Tailwind CSS v3.4.x** + classic PostCSS plugin (`postcss.config.js` uses `{ tailwindcss: {}, autoprefixer: {} }`).
- If the landing page renders unstyled, run the recovery sequence from the repo root:
  ```bash
  pkill -f "next dev"               # stop old servers
  pnpm install                      # ensure workspace deps are restored
  pnpm --filter dealer-dashboard clean
  rm -rf apps/dealer-dashboard/.next
  pnpm --filter dealer-dashboard build
  pnpm --filter dealer-dashboard dev
  ```
- Verify the dev server serves `/_next/static/css/app/layout.css` and that the bundle contains utilities like `.gradient-text`, `.bg-primary-50`, `.hover-lift`, and the gradient helpers (`from-background`, `via-background`, `to-primary/5`).
- Tailwind 4.x or mixed plugin versions will break styling; keep the workspace lockfile pinned to 3.4.x.

### UI Alignment Updates
- Changed final feature icon from `Eye` to `Shield` to match design specification
- Fixed header CTA container to use `flex-col sm:flex-row` for proper mobile stacking
- Header primary CTA now renders as pill button (text link + button pairing matches Loveable header)
- Root route (`apps/dealer-dashboard/src/app/page.tsx`) now renders the marketing layout and gradient wrapper so `/` matches Loveable preview.
- Verified all sections match the design spec copy and structure

### Build & Validation
- ✅ **Linting**: No ESLint warnings or errors
- ✅ **Build**: Successful compilation with optimized bundle (3.1s)
- ✅ **TypeScript**: All type checks passed
- ✅ **Responsive**: Mobile-first design with proper breakpoints
- ✅ **Package Management**: Clean pnpm workspace with no stray lockfiles

## Implementation Checklist
1. Ensure Tailwind config exposes gradient/hover utilities (update `apps/dealer-dashboard/tailwind.config.ts` and `src/app/globals.css` / `index.css` as needed).
2. Build page at `apps/dealer-dashboard/app/(marketing)/page.tsx` (adjust path if routing differs).
3. Compose sections as separate components under `apps/dealer-dashboard/components/marketing/`.
4. Route both CTAs to `/auth`, leave TODO comments for future integrations.
5. Run `pnpm --filter dealer-dashboard lint` and `pnpm --filter dealer-dashboard build`.
6. Document verification steps in PR description.

Keep this spec updated if Loveable delivers revisions.***
