# AutoAgent Onboarding Flow — Loveable Specification

> **Updates (2025-09 → 2025-10):**
> - Onboarding now lives inside the signed-in dashboard (`/app/setup`). The current implementation focuses solely on a MarketCheck integration—dealers provide their MarketCheck dealer ID, radius, and condition filters to import vehicles. CSV and other DMS providers are deferred.
> - Future Loveable revisions should reflect the dashboard chrome and the streamlined MarketCheck-first flow. Keep the deeper step specs below as a reference for upcoming providers/billing milestones.

Authoritative transcription of the onboarding experience generated in the Lovable preview (`https://preview--autoagent-spark.lovable.app/onboarding`). Treat this document as the single source of truth when implementing or reviewing the onboarding journey.

---

## 1. Flow Outline

| Step | Title                    | Route Fragment | Primary Goal                         | Completion Action                  |
|------|--------------------------|----------------|--------------------------------------|------------------------------------|
| 1    | Connect Your Inventory   | `/onboarding`  | Select DMS provider / upload CSV     | `Continue` → Step&nbsp;2           |
| 2    | Add Team Members         | same           | Collect teammate invites             | `Continue` → Step&nbsp;3           |
| 3    | Set Up Billing           | same           | Capture payment details              | `Continue` → Step&nbsp;4           |
| 4    | Activation Confirmation  | same           | Display success, summarize setup     | `Activate Account` → redirect `/` |

- **Entry points**: direct navigation to `/onboarding`, CTA `Get Started` → `/auth` → `/onboarding`, or floating `OnboardingButton`.
- **Exit**: 2s success toast then redirect to `/` (production should redirect to authenticated dashboard `/app`).
- **Suggested guards**: require authenticated session with `onboarding_completed === false`; otherwise forward to `/app`.

---

## 2. Global Layout

| Property            | Value / Notes                                                                 |
|---------------------|-------------------------------------------------------------------------------|
| Background          | `bg-gradient-dark` (dark blue gradient)                                       |
| Min height          | `min-h-screen`                                                                |
| Wrapper             | `flex items-center justify-center p-6`                                        |
| Content max width   | `max-w-3xl` (48rem)                                                           |
| Header spacing      | `mb-8` for logo/title, progress, and step indicators                          |
| Animations          | `animate-fade-in` staggered by section, `animate-slide-up` on step content    |

All typography uses **Inter** (weights 400, 500, 600, 700).

---

## 3. Header Section (Hero)

| Element     | Content                              | Classes / Spec                                              |
|-------------|--------------------------------------|-------------------------------------------------------------|
| Icon        | `Shield` (Lucide)                    | `h-12 w-12 text-primary mx-auto mb-4`                       |
| Title       | `AutoAgent`                          | `text-4xl font-bold text-white text-center`                 |
| Subtitle    | `Smarter leads. Lower costs.`        | `text-xl text-muted-foreground text-center`                 |

---

## 4. Progress Bar

| Element            | Details                                                                 |
|--------------------|-------------------------------------------------------------------------|
| Step counter       | `Step {current} of 4`, `text-sm text-muted-foreground`                  |
| Progress percent   | `{percent}%`, `text-sm font-medium text-primary`                        |
| Progress component | Radix `<Progress value={percent}>` with `h-2 bg-secondary` track        |
| Indicator          | `bg-primary transition-all` width matches percentage                    |

---

## 5. Step Indicators

### Layout
- `flex justify-between mb-8 animate-fade-in delay-200`
- Four equal columns: Connect DMS, Add Team, Set Billing, Activate.

### Indicator Anatomy
| State      | Circle Classes                                                               | Icon       | Label classes                          |
|------------|-------------------------------------------------------------------------------|------------|----------------------------------------|
| Active     | `h-12 w-12 rounded-full border-2 border-primary bg-primary text-primary-foreground flex items-center justify-center` | Lucide icon `h-5 w-5` | `text-xs font-medium text-foreground`  |
| Inactive   | `h-12 w-12 rounded-full border-2 border-muted bg-background text-muted-foreground` | same       | `text-xs font-medium text-muted-foreground` |

---

## 6. Content Card

- Component: `card-elevated animate-slide-up`.
- Default spacing per step: `space-y-6`.
- Common footer: `div.flex.gap-3.mt-8.pt-6.border-t`.
  - **Back** button: outline variant, `flex-1`, hidden on Step&nbsp;1.
  - **Primary** button: `flex-1`, label `Continue` (Steps 1-3) or `Activate Account` (Step 4); uses primary button spec (hover lift, `ring` focus).

---

## 7. Step Specifications

### Step 1 – Connect Your Inventory

| Element                     | Spec                                                                                  |
|----------------------------|---------------------------------------------------------------------------------------|
| Heading                    | `Connect Your Inventory` `text-2xl font-bold`                                         |
| Subtitle                   | `Choose how you'd like to manage your vehicle listings` `text-base text-muted-foreground` |
| DMS Provider Select        | shadcn `<Select>` with placeholder `Select your DMS provider`; helper text `text-xs text-muted-foreground mt-2` |
| Options                    | `CDK Global`, `Dealertrack DMS`, `Reynolds & Reynolds`, `Automate`, `CSV Upload`, `I'll add vehicles manually` |
| CSV Upload zone (conditional) | `rounded-lg border-2 border-dashed border-border p-8 text-center space-y-4` plus `Database` icon (`h-12 w-12 text-muted-foreground`) and outline button |
| Integration info (conditional) | `rounded-lg bg-secondary/10 border border-secondary/20 p-4 text-sm` dynamic provider name |
| Privacy notice             | `rounded-lg bg-muted/30 border p-4 text-sm`                                         |

### Step 2 – Add Team Members

| Element                 | Spec                                                                                 |
|------------------------|--------------------------------------------------------------------------------------|
| Heading                | `Add Team Members` `text-2xl font-bold`                                              |
| Subtitle               | `Invite your sales team to manage leads together`                                    |
| Team card              | `grid gap-4 p-4 rounded-lg border bg-muted/20`                                       |
| Fields                 | Name, Email (`md:grid-cols-2`), Role select (`Sales Rep`, `Sales Manager`, `Owner`, `Finance Manager`) |
| Add button             | Outline button `w-full`, label `Add Another Team Member`, icon `Users`               |
| Success note           | `rounded-lg bg-success/10 border border-success/20 p-4 text-sm text-success flex items-center gap-2` |

### Step 3 – Set Up Billing

| Element                    | Spec                                                                                       |
|---------------------------|----------------------------------------------------------------------------------------------|
| Heading / Subtitle        | `Set Up Billing`, `Add your payment method to activate your account`                         |
| Pricing card              | `rounded-lg bg-muted/30 border p-6 space-y-4` with two rows (Vehicle Hosting, Qualified Leads) |
| Price layout              | Title left (`font-semibold`), description `text-sm text-muted-foreground`, price right `text-2xl font-bold`, unit `text-xs text-muted-foreground` |
| Form fields               | Card number (full width), Expiry (2/3), CVC (1/3) using `grid md:grid-cols-3 gap-4`                                              |
| Value prop callout        | `rounded-lg bg-secondary/10 border border-secondary/20 p-4 text-sm` with lightbulb emoji     |

### Step 4 – Activation Confirmation

| Element                     | Spec                                                                                       |
|----------------------------|---------------------------------------------------------------------------------------------|
| Success icon               | `flex justify-center` with `div h-20 w-20 rounded-full bg-success/20` and `CheckCircle2` icon |
| Heading / Subtitle         | `You're All Set!` `text-2xl font-bold`, supporting copy `text-base text-muted-foreground`   |
| Checklist cards (x3)       | `flex items-start gap-3 p-4 rounded-lg bg-muted/20` with `CheckCircle2` icons (`text-success`), title + description |
| What happens next card     | `rounded-lg bg-gradient-primary p-6 text-white` with heading `font-semibold` + body `text-sm text-white/90` |
| Primary button label       | `Activate Account`                                                                         |

---

## 8. Buttons & Interactions

| Button           | Variant / Classes                                                                                            |
|------------------|--------------------------------------------------------------------------------------------------------------|
| Primary (Continue/Activate) | `className="w-full sm:w-auto flex-1"` + default variant; hover lift via `hover:-translate-y-0.5` and `hover:shadow-lg` |
| Outline (Back)   | `variant="outline" className="flex-1"`                                                                       |
| Secondary (browse / add) | `variant="outline"` or `variant="ghost"` per context                                                 |
| Toast events     | Step advance → `"Progress saved"`; Completion → `"Welcome to AutoAgent! 🎉"` + redirect after 2 s            |

All interactive elements use Tailwind transitions: `transition-all duration-200 ease-out`.

---

## 9. Data Model & API Notes

| Step | Suggested Persistence                                         |
|------|----------------------------------------------------------------|
| 1    | `user_preferences` table: `dms_provider`, `onboarding_completed` flag. CSV upload should push to storage bucket, create import job. |
| 2    | `user_invitations` table: `{ email, name, role, store_id, invited_by, status }`. Send invites via messaging service after onboarding. |
| 3    | Payment method integration via Stripe (create customer, attach payment method, store `stripe_customer_id`). |
| 4    | Set `onboarding_completed = true`, trigger welcome email, redirect to `/app`. |

Current Lovable implementation uses local React state (no persistence). Production build should wire above APIs.

---

## 10. Animations & Responsive Behavior

- **Animations**: `animate-fade-in` for header/progress/steps with incremental delays (0s, 0.1s, 0.2s). Content card uses `animate-slide-up`.
- **Responsive**:
  - Step cards stack nicely on mobile; team member fields collapse to single column.
  - Billing expiry + CVC stack vertically under 768px.
  - Buttons keep equal width via `flex-1`.

---

## 11. Assets & Utilities

| Item              | Location / Class                            |
|-------------------|---------------------------------------------|
| Icons             | `lucide-react`: Shield, Database, Users, CreditCard, CheckCircle2 |
| Utilities         | `.card-elevated`, `.hover-lift`, `.animate-fade-in`, `.animate-slide-up`, `.bg-gradient-dark`, `.bg-gradient-primary`, `.gradient-text` |
| Background tokens | Dark mode: `--background: 220 17% 10%`, `--card: 220 17% 13%`. Light mode tokens listed in landing spec. |

---

## 12. Implementation Checklist

1. Ensure `/onboarding` route exists in App Router (`apps/dealer-dashboard/src/app/onboarding/page.tsx` or equivalent).  
2. Guard route so only authenticated users without `onboarding_completed` can access.  
3. Stage 1: Build the shared layout (background, header, progress, step indicators).  
4. Stage 2: Implement step components with local state mirroring Lovable behavior.  
5. Stage 3: Wire API persistence (Supabase/Stripe) and update redirects for production.  
6. Verify animations, responsive behavior, and toast messaging.  
7. Update documentation as specs evolve.

---
