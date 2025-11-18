# Loveable Hero Section — Full Specification

Complete transcription of the Loveable.dev handoff for the AutoAgent landing-page hero. Use this as the single source of truth when verifying or updating the implementation.

---

## 1. Color Tokens

| Element | Property | Value | Notes |
|---------|----------|-------|-------|
| Gradient Text (“Showing”) | Start | `#23C552` @ 0% | Bright emerald start |
| Gradient Text (“Showing”) | End | `#16A34A` @ 100% | Emerald end |
| Gradient Text (“Up?”) | Start | `#38BDF8` @ 0% | Cyan start |
| Gradient Text (“Up?”) | End | `#2563EB` @ 100% | Royal blue end |
| Badge | Background | `bg-primary/10` | 10% primary tint |
| Badge | Border | `border-primary/20` | 20% primary tint |
| Badge | Text | `#16A34A` (`text-primary`) | Emerald text |
| Headline | Default text | `#1F2937` (`text-foreground`) | Almost black |
| Subheading | Text | `#6B7280` (`text-muted-foreground`) | Gray |
| Primary CTA | Background | Variant default (`bg-primary`) | Uses design-system token |
| Primary CTA | Text | `#FFFFFF` (`text-primary-foreground`) | White |
| Primary CTA | Shadow | `shadow-lg` → `hover:shadow-xl` | Tailwind presets |
| Secondary CTA | Background | `bg-background` (hover `bg-accent`) | Neutral surface |
| Secondary CTA | Border | `border border-input` | Design-system border |
| Secondary CTA | Text | `text-foreground` (hover `text-accent-foreground`) | Dark gray |
| Stat Card | Background | `bg-card` | White card token |
| Stat Card | Border | `border border-border` | Subtle border |
| Stat Card | Shadow | `shadow-sm` (hover `shadow-md`) | Tailwind preset |
| Stat Percentage | Text | Gradient (`#22C55E → #0EA5E9`) | Emerald / aqua |
| Stat Card Accent (“Real-Time”) | Background | `bg-gradient-to-r from-green-500/10 to-emerald-500/10` | Soft green tint |
| Stat Card Accent (“First”) | Background | `bg-gradient-to-r from-cyan-500/10 to-blue-500/10` | Soft cyan tint |
| Stat Label | Text | `#6B7280` | Gray |

---

## 2. Typography

| Element | Font | Weight | Size (Desktop) | Line Height | Letter Spacing | Color |
|---------|------|--------|----------------|-------------|----------------|-------|
| Badge | Inter | 500 | `text-sm` (14px) | normal | -0.01em | `text-primary` |
| Headline | Inter | 700 | `text-6xl` (≈60px) | `tracking-tight` (~1.1) | -0.02em | `text-foreground` + gradients |
| Subheading | Inter | 400 | `text-xl` (20px) | 1.75 | -0.01em | `text-muted-foreground` |
| Primary CTA | Inter | 600 | `text-lg` (18px) | normal | -0.01em | `text-primary-foreground` |
| Secondary CTA | Inter | 600 | `text-lg` (18px) | normal | -0.01em | `text-foreground` |
| Stat Percentage | Inter | 700 | `text-3xl` (30px) | `leading-tight` (~1.2) | -0.02em | Gradient text |
| Stat Label | Inter | 400 | `text-sm` (14px) | 1.5 | 0 | `text-muted-foreground` |

### Responsive adjustments (< 768px)

| Element | Size | Line Height |
|---------|------|-------------|
| Badge | `text-sm` (14px) | normal |
| Headline | `text-5xl` (≈48px) | `leading-tight` |
| Subheading | `text-lg` (18px) | 1.7 |
| CTA Buttons | `text-base` (16px) | normal |
| Stat Percentage | `text-2xl` (24px) | 1.2 |
| Stat Label | `text-xs` (12px) | 1.5 |

---

## 3. Spacing & Layout

| Element | Property | Value |
|---------|----------|-------|
| Hero container | Max width | `max-w-4xl` (896px) centered |
| Hero container | Horizontal padding | `px-6` (≈24px) both breakpoints |
| Hero container | Vertical padding | `py-20` desktop (80px) / `py-16` mobile (64px) |
| Badge | Padding | `px-4` × `py-2` (~16px × 8px) |
| Badge | Border radius | `rounded-full` |
| Badge → Headline | Spacing | `mb-4` (16px) |
| Headline → Subheading | Spacing | `space-y-6` block gap (24px) |
| Subheading → Buttons | Spacing | `pt-4` (16px) |
| Buttons → Stats | Spacing | `mt-16` desktop (64px) / `mt-12` mobile (48px) |
| Button group | Gap | `gap-4` (16px) |
| Primary CTA | Padding | `px-8 py-2.5` (`h-11`) |
| Secondary CTA | Padding | `px-8 py-2.5` + `border` |
| Stat Grid | Columns | `grid-cols-2 md:grid-cols-4` |
| Stat Grid | Gap | `gap-6` (24px) desktop / `gap-4` mobile |
| Stat Card | Padding | `p-6` (24px all sides) |
| Stat Card | Border radius | `rounded-lg` (8px) |
| Stat Percentage → Label | Spacing | `mt-2` (8px) |

---

## 4. Effects & Shadows

| Element | Shadow (default) | Shadow (hover) | Transform (hover) |
|---------|------------------|----------------|-------------------|
| Primary CTA | `shadow-lg` | `hover:shadow-xl` | `hover:-translate-y-0.5` |
| Secondary CTA | `shadow-sm` (component default) | `hover:shadow-md` | `hover:-translate-y-0.5` |
| Stat Card | `shadow-sm` | `hover:shadow-md` | `hover:-translate-y-1` |

### Transitions

| Element | Duration | Easing |
|---------|----------|--------|
| Interactive elements | 200ms | `ease-out` (`transition-all duration-200`) |
| Stat cards | 300ms | `transition-all duration-300` |

---

## 5. CTA State Table

### Primary CTA

| State | Background | Shadow | Transform / Focus |
|-------|------------|--------|-------------------|
| Default | `bg-primary` | `shadow-lg` | none |
| Hover | `bg-primary/90` | `shadow-xl` | `-translate-y-0.5` |
| Active | `bg-primary/80` | `shadow-lg` | none |
| Focus | `bg-primary/90` | Focus ring via component | none |

### Secondary CTA

| State | Background | Border | Shadow |
|-------|------------|--------|--------|
| Default | `bg-background` | `border-input` | `shadow-sm` |
| Hover | `bg-accent` | `border-input` | `shadow-md` |
| Active | `bg-accent/90` | `border-input` | `shadow-sm` |
| Focus | `bg-background` | Focus ring via component | `shadow-sm` |

---

## 6. Gradient Implementation

```css
/* "Showing" */
.gradient-showing {
  background: linear-gradient(90deg, #23C552 0%, #16A34A 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* "Up?" */
.gradient-up {
  background: linear-gradient(90deg, #38BDF8 0%, #2563EB 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Stat card teal gradient */
.stat-gradient-text {
  background: linear-gradient(90deg, #22C55E 0%, #0EA5E9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 7. Change Checklist (from Loveable)

- Badge uses design tokens (`bg-primary/10`, `border-primary/20`, `text-primary`) with pill radius.
- Headline gradients updated to bright emerald (`#23C552 → #16A34A`) and cyan/blue (`#38BDF8 → #2563EB`).
- Typography follows Tailwind sizing (`text-6xl` desktop hero, `text-3xl` stat values, etc.).
- Primary CTA relies on component `shadow-lg → hover:shadow-xl` and hover lift.
- Secondary CTA uses `bg-background`, `border-input`, and hover shadow via `shadow-md`.
- Stat cards are `p-6`, `rounded-lg`, `shadow-sm` with optional tint on “Real-Time”/“First”.
- Stat percentages use updated emerald→aqua gradient (`#22C55E → #0EA5E9`).
- Spacing matches production (`py-20/py-16`, `px-6`, `mt-16`, etc.).
- Page wrapper renders gradient background (`bg-gradient-to-br from-background via-background to-primary/5`) with frosted overlays on header, benefits, and footer.

---

## 8. Implementation Notes Recap

- Tailwind v3.4.x + classic PostCSS plugin (`tailwindcss`, `autoprefixer`).
- Recovery sequence if styles disappear:  
  `pkill -f "next dev" && pnpm install && pnpm --filter dealer-dashboard clean && rm -rf apps/dealer-dashboard/.next && pnpm --filter dealer-dashboard build && pnpm --filter dealer-dashboard dev`
- Verify CSS bundle `/_next/static/css/app/layout.css` contains hero classes (`hero-primary-button`, `hero-stat-card`, `stat-gradient-text`, etc.).
- Keep the workspace lockfile pinned to Tailwind 3.x (no 4.x alpha).

---

## 9. Reference Files

- Screenshot (expected UI): `docs/design/landing/assets/landing.png`
- Current hero capture (update as needed): `docs/design/landing/assets/hero-current.png`
- Implementation source: `apps/dealer-dashboard/src/components/marketing/hero.tsx`
- Global styles: `apps/dealer-dashboard/src/app/globals.css`

Keep this document synced whenever Loveable or the design team provides new specs.***

---

# Global Background Surface

Applied on `apps/dealer-dashboard/src/app/(marketing)/page.tsx` root wrapper.

| Property | Value |
|----------|-------|
| Wrapper class | `min-h-screen bg-gradient-to-br from-background via-background to-primary/5` |
| Gradient direction | Top-left → bottom-right (`bg-gradient-to-br`) |
| Stops | `from-background` → `via-background` → `to-primary/5` |
| Notes | Produces a subtle tint; sections without overrides inherit this surface. |

Light-mode token values (from `apps/dealer-dashboard/src/app/globals.css`):
- `--background: 220 17% 97%`
- `--card: 0 0% 100%`
- `--primary: 142 76% 36%`
- `--border: 220 13% 91%`

### Section-specific surfaces

| Section | Background class | Extras |
|---------|------------------|--------|
| Header | `bg-background/80 backdrop-blur-sm` | Sticky with `border-b border-border/40` |
| Hero | Inherits wrapper gradient | — |
| Features | Inherits wrapper gradient | — |
| Benefits | `bg-card/50 backdrop-blur-sm border-y border-border/40` | Frosted panel |
| Final CTA | Inherits wrapper gradient | Card inside uses `card-elevated` |
| Footer | `bg-card/30 backdrop-blur-sm` | `border-t border-border/40` |

Opacity suffixes (`/80`, `/50`, `/30`, `/5`) follow Tailwind’s percentage semantics.

---

# Section 2 — Features Grid Specification

Reference the `Features` component in `apps/dealer-dashboard/src/components/marketing/features.tsx`.

## Layout & Spacing

| Element | Desktop | Mobile |
|---------|---------|--------|
| Container width | `container` utility (≈1280px) | Full width |
| Horizontal padding | `px-6` (24px) | `px-6` |
| Vertical padding | `py-20` (80px top/bottom) | `py-20` |
| Section background | Transparent (inherits page gradient) | Same |
| Heading → body spacing | `mb-4` (16px) | Same |
| Body → grid spacing | `mb-12` (48px) | Same |
| Grid layout | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | Single column |
| Grid gap | `gap-6` (24px) | `gap-6` |
| Card padding | `p-6` (24px all sides) | Same |

## Typography & Copy

| Element | Font | Weight | Size | Line Height | Color |
|---------|------|--------|------|-------------|-------|
| Heading | Inter | 700 | `text-3xl md:text-4xl` | default | `text-foreground` |
| Subheading | Inter | 400 | `text-lg` | `leading-7` (~28px) | `text-muted-foreground` (`max-w-2xl mx-auto`) |
| Card title | Inter | 600 | `text-xl` | default | `text-foreground` |
| Card body | Inter | 400 | `text-base` (16px) | `leading-6` (24px) | `text-muted-foreground` |

Copy:
- Heading: “Be Everywhere High-Intent Buyers Are Looking”
- Subheading: “ChatGPT is the new Autotrader…”
- Card titles/descriptions: keep existing six items (lines 5-36 in component).

## Colors, Surfaces & Interaction

| Element | Background | Border | Shadow | Hover |
|---------|------------|--------|--------|-------|
| Card | `hsl(var(--card))` | `1px solid hsl(var(--border))` | `shadow-sm` default | `translateY(-4px)` + `shadow-xl` (`0 12px 24px -4px rgba(0,0,0,0.15)`) |
| Icon wrapper | `hsl(var(--primary) / 0.1)` rounded-lg (8px) | none | none | none |
| Icon | `text-primary` | — | — | — |

Responsive notes:
- Heading scales `text-3xl` → `text-4xl`.
- Subheading constrained to `max-w-2xl`.
- Icon square 48×48 (`w-12 h-12`) with `rounded-lg`.

Implementation reminders:
- Replace `max-w-6xl` with `container`.
- Remove section gradient background (`bg-gradient-to-br …`).
- Ensure hover effect is applied via utility classes without altering tokenized colors.

---

# Section 3 — Benefits / AI Journey Specification

Reference `apps/dealer-dashboard/src/components/marketing/benefits.tsx`.

## Layout & Spacing

| Element | Desktop | Mobile |
|---------|---------|--------|
| Container width | `container` | Full width |
| Horizontal padding | `px-6` | `px-6` |
| Vertical padding | `py-20` | `py-20` |
| Section surface | `hsla(var(--card), 0.5)` + `backdrop-blur-sm` | Same |
| Section border | `border-y border-border/40` | Same |
| Grid | `md:grid-cols-2` (`gap-12`) | Stacked |
| Heading → body | `mb-6` (24px) | Same |
| Body → list | `mb-8` (32px) | Same |
| List spacing | `space-y-4` (16px) | Same |

## Typography & Copy

| Element | Font | Weight | Size | Line Height | Color |
|---------|------|--------|------|-------------|-------|
| Section heading | Inter | 700 | `text-3xl md:text-4xl` | default | `text-foreground` |
| Body copy | Inter | 400 | `text-lg` | `leading-7` | `text-muted-foreground` |
| Benefit text | Inter | 400 | `text-lg` | `leading-7` | `text-foreground` |
| Card heading | Inter | 700 | `text-5xl` (48px) | default | `gradient-text` |
| Card subheading | Inter | 400 | `text-base` | `leading-6` | `text-muted-foreground` |
| Journey rows | Inter | 400/600 | `text-base` | default | muted/foreground |

Copy:
- Heading: “The New Customer Journey Starts In ChatGPT”
- Body: existing paragraph.
- Benefits: six checklist items (keep text).
- Card heading: “Today's Reality” (with `gradient-text`).
- Card subhead: “The ChatGPT Car Shopping Journey”.
- Journey rows: Buyer searches ChatGPT (Now), Your inventory appears (Instantly), Competitors? (Invisible).

## Colors & Interaction

| Element | Background | Border | Shadow |
|---------|------------|--------|--------|
| Section | `bg-card/50` | `border-y border-border/40` | none |
| Benefit bullet | `bg-primary/10` circle `w-6 h-6 rounded-full` | none | none |
| Card (`card-elevated`) | `hsl(var(--card))` | `border border-border` | card-elevated shadow |
| Journey divider | `border-border` top lines | — | — |

Responsive notes:
- Grid collapses to single column on <768px.
- Card padding `p-8`.
- Ensure benefit text uses `text-foreground` (not muted).

Implementation reminders:
- Remove extra subheading (“What You Get…”).
- Apply section background + blur using utility classes.
- Set card title to use `gradient-text` class.

---

# Section 4 — Final CTA Specification

Reference `apps/dealer-dashboard/src/components/marketing/final-cta.tsx`.

## Layout & Spacing

| Element | Desktop | Mobile |
|---------|---------|--------|
| Container width | `container` | Full width |
| Horizontal padding | `px-6` | `px-6` |
| Vertical padding | `py-20` | `py-20` |
| Card width | `max-w-3xl mx-auto` | Same |
| Card padding | `p-12` (`md:p-12`, `p-8` base) | `p-8` |
| Heading → body | `mb-4` | Same |
| Body → buttons | `mb-8` | Same |
| Buttons → fine print | `mt-6` | Same |

## Typography & Copy

| Element | Font | Weight | Size | Line Height | Color |
|---------|------|--------|------|-------------|-------|
| Heading | Inter | 700 | `text-3xl md:text-4xl` | default | `text-foreground` |
| Body | Inter | 400 | `text-lg` | `leading-7` | `text-muted-foreground` |
| Buttons | Inter | 600 | `text-lg` | default | per button |
| Fine print | Inter | 400 | `text-sm` | `leading-5` | `text-muted-foreground` |

Copy (unchanged): heading, body, primary CTA “Sign Up”, secondary “Talk to Sales”, fine print sentence.

## Colors & Interaction

| Element | Background | Border | Shadow |
|---------|------------|--------|--------|
| Card | `hsl(var(--card))` | `border border-border` | `card-elevated` |
| Primary button | Use hero primary spec (`bg-primary`, `shadow-lg`, hover translate) | — | per hero |
| Secondary button | `bg-background`, `border-input`, `shadow-sm` hover `shadow-md` | per hero | per hero |

Responsive notes:
- Buttons stack on mobile (`flex-col sm:flex-row`).
- Gap between buttons `gap-4`.
- Text centered (`text-center`).

Implementation reminders:
- Remove gradient background from card.
- Apply explicit button classes (reuse hero style).

---

# Section 5 — Footer Specification

Reference `apps/dealer-dashboard/src/components/marketing/footer.tsx`.

## Layout & Spacing

| Element | Desktop | Mobile |
|---------|---------|--------|
| Container width | `container` | Full width |
| Horizontal padding | `px-6` | `px-6` |
| Vertical padding | `py-8` (32px) | `py-8` |
| Background | `bg-card/30 backdrop-blur-sm` | Same |
| Border | `border-t border-border/40` | Same |
| Layout | `flex-row justify-between items-center` | `flex-col items-center gap-4` |

## Typography & Copy

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| Logo | Inter | 700 | `text-2xl` | `gradient-text` |
| Copyright | Inter | 400 | `text-sm` | `text-muted-foreground` |

Copy remains: “AutoAgent” logo text, “© 2025 AutoAgent. All rights reserved.”

Implementation reminders:
- Apply `gradient-text` to logo.
- Update container to use `container` utility and apply blur background.

---

# Global Header Spec (Sticky Nav)

Reference `apps/dealer-dashboard/src/components/marketing/header.tsx`.

| Property | Value |
|----------|-------|
| Background | `bg-background/80 backdrop-blur-sm` |
| Border | `border-b border-border/40` |
| Padding | `px-6 py-4` inside `container` |
| Height | `h-16` (unchanged) |
| Layout | `flex items-center justify-between` |
| Logo | `gradient-text`, `text-2xl`, `font-bold` |
| Buttons | `Sign In` plain text link (`text-sm font-medium text-muted-foreground hover:text-foreground`), `Get Started` pill button (`rounded-full h-10 px-5 text-sm font-semibold shadow-md hover:-translate-y-0.5`) |
| Gap | `gap-4` between nav items |

Ensure all marketing sections consume these shared tokens for consistent look & feel.
