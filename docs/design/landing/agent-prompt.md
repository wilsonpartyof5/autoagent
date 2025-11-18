# Cursor Agent Prompt — AutoAgent Landing Page Build

## Goal
Implement the marketing landing page shown in the Loveable design under the dealer dashboard Next.js app. Use the design spec and screenshot for precise layout, copy, and interactions.

## Files & References
- High-res screenshot: `docs/design/landing/assets/landing.png`
- Engineering spec (copy, layout, tokens): `docs/design/landing/spec.md`
- Project root: `/Users/mac/AutoAgent`
- Target app: `apps/dealer-dashboard` (Next.js + Tailwind + shadcn/ui)
- Production entry point: `apps/dealer-dashboard/src/app/page.tsx` (re-exports the marketing layout from `(marketing)/page.tsx`)

## Requirements
1. Create the landing page in the marketing/unauthenticated area (App Router suggested path: `apps/dealer-dashboard/app/(marketing)/page.tsx`).
2. Break the page into reusable components (Header, Hero, StatsStrip, FeatureGrid, Benefits, FinalCTA, Footer) under a marketing components folder. Header CTAs should match Loveable (Sign In text link, Get Started pill button with hover lift).
3. Apply all copy verbatim from the spec; no placeholder text.
4. Match layout/responsive behavior:
   - Sticky header with backdrop blur and CTA buttons that stack on mobile.
   - Hero section with badge, gradient heading (`"Showing Up?"`), dual CTAs, and stats grid (2×2 mobile, 1×4 desktop).
   - Features grid with six cards (1/2/3 column responsive breakpoints, hover lift).
   - Benefits section: checklist + journey card.
   - Final CTA band with elevated card and trust caption.
   - Footer with branding/legal.
5. Implement Tailwind utilities:
   - `gradient-text`, `hover-lift`, `card-elevated` (defined in Tailwind config / CSS).
   - Use existing shadcn `Button`/`Card`; import Lucide icons listed in the spec.
6. Wire CTA links (`Sign Up`, `Schedule Demo`, `Talk to Sales`) to `/auth`. Add TODO comments for future integrations.
7. Ensure mobile-first responsiveness and interactions (button hover icon shift, card elevation).
8. Update Tailwind config or global CSS if new utilities or colors are needed per spec (light-mode tokens: `--background: 220 17% 97%`, `--card: 0 0% 100%`, `--primary: 142 76% 36%`, `--border: 220 13% 91%`).
9. After implementation run:
  ```bash
  pnpm --filter dealer-dashboard lint
  pnpm --filter dealer-dashboard build
  ```
   Capture and report results.
10. Provide manual test notes (viewport checks, hover states, CTA links).

## Deliverables
- Updated Tailwind/util styles if required.
- New marketing page components and route.
- Summary of changes + command outputs + follow-up TODOs.

Start by reading `docs/design/landing/spec.md`, referencing the screenshot, and then scaffold the page accordingly. Ensure `/` renders the marketing layout with the gradient wrapper (`bg-gradient-to-br from-background via-background to-primary/5`).***
