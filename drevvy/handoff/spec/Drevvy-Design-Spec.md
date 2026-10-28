# Drevvy Design Spec: Halo

Version 1.6.1, Oct 12, 2026. **Changes in 1.6.1** (Dustin's Shop-tab direction, Oct 12): **Shop is the default tab and the app always opens on a fresh blank Ask chat** (§1.1). The Shop header keeps the **hamburger, which opens a chat-history drawer** (left, newest first, search, tap to reopen; deal-scoped Ask Drevvy chats are not listed) and **drops the compose icon** (§6.5a, §6.13). **Personalized starters and memory**: starter cards adapt to the shopper's past searches ("Back to your search", "Price drops on cars like ones you viewed"); the agent references past searches with a tappable "Using your past searches" chip; Profile gets a **Your search profile** section with per-item edit/delete, Clear history and a "Personalize with my history" toggle. With no history, the generic starters show (§6.14, §10.7). Personalization uses only MarketCheck-backed data (§10.7). New data model for profile and memory (§11.1). **Bug fix:** the Shop inventory card CTA ("Add to Agent", shown in the build as "Add to Drevvy") overflowed by 14–24 pt; the CTA now sits full-width on its own row with no fixed card height (§6.7). **Changes in 1.6** (DW decisions of Oct 11): **Accept is available on every current offer or quote in every status** (including Finding your best price and Watching for drops) and always opens a confirm step, "Accept $36,450 out the door? Drevvy will tell Dealer A and request the official written offer." with Confirm / Cancel (§6.8, §10.2). **Price-drop pushes are on by default**: every price drop and every removed add-on, plus offer ready, no longer listed and official offer; "Hide prices on lock screen" still applies and Profile → Notifications lists the categories (§10.4). New state **Watching for drops**: after 2 rounds of "Ask Drevvy to keep going" Drevvy stops asking, watches the listing for drops and sends one check-in near month-end (§2.3, §6.8, §10.4). The shopper can **withdraw an acceptance** ("Changed my mind") before the official offer arrives (§10.2). New state **Changed after you accepted** when the official offer still differs after 2 correction requests, with a line-by-line diff (§10.2). 10 status chips (§2.3, §11). **Changes in 1.5** (MarketCheck data audit; see §10.6): VDP specs drop Cargo and LATCH, horsepower only if the VIN decode returns it, and History shows only "One owner (per dealer listing)" when the listing says so, with no accident data. Ask answers drop Cargo and unsourced claims (car seats, resale). **Sold is renamed No longer listed** (same colors): "No longer listed (likely sold)", never "just sold". Ask Drevvy no longer quotes add-on statistics; doc-fee comparisons come from Drevvy's own state doc-fee table. Shop cards show a cheap "vs. similar listings nearby" badge, while the precise fair-price verdict is VDP-only. New cars get their own VDP market card (MSRP, local listings, incentives), because MarketCheck Price is used/CPO only. Demo numbers are fixed, and fair price, fair OTD and typical OTD have locked definitions. "Days on lot" is now "Days listed". Price-bar Low/High are 5th–95th percentiles. The Shop skeleton shows no listing count. The UI never shows a photo URL or dealer domain. Directions and the pickup geofence use the address from the official offer email. **Changes in 1.4** (DW refined three assumptions): removing a car within 30 minutes of adding it, before Drevvy has contacted the dealer, gives it back to the 10; the Remove sheet says which case applies, and a fresh card shows "Undo window: N min left" (§6.2, §6.8, §10.4). Sold and No response deals offer "Find similar cars", which restarts the flow (§6.2). "Did you buy it?" is now location-based: an opt-in "Always" pickup check, asked in context after the official offer, watches only the revealed dealership until the outcome (§10.5). Profile → Privacy has a Location row. **Changes in 1.3** (DW's answers to the 14 journey-review questions): the plan is 10 cars per billing month with a monthly reset, with no slots (§10.4). Two end states were added, **No response** and **Sold**, and **Best price ready** was removed: every new offer is **Offer received**, and the shopper chooses Accept this offer or Ask Drevvy to keep going (§2.3, §6.8). The old Negotiating status is now **Finding your best price**, and shopper-facing copy never says "negotiate" in any form (§10). Savings are measured from the listed price when the shopper started (§10). A new **Agent voice & dealer messaging** section was added (§10.3). Price comes first: trade-in and financing are raised only after the written OTD (§10.4). Listing photos are shown unprocessed (§10.1), and §8 and §10.2 were updated to match. Other additions: a Profile frame with "Hide prices on lock screen", the cancellation state, and a Deals "Sold" banner frame. Changes in 1.2: the dealer is revealed only on acceptance, with the official written offer (§10.2); Accepted and Official offer received were added; contact channels are not a shopper setting. Changes in 1.1: pushed detail pages hide the tab bar (§1.1). This spec covers the Flutter build for iOS and Android with one shared design. It is based on the Halo mockups in `/workspace/drevvy/halo/`.

**Vibe.** Soft, friendly and modern: a misty canvas, frosted-glass cards and a gentle violet-to-blue gradient. The agent should feel approachable and calm, never pushy. *Information beats aggression*, so the UI leads with numbers and context, not urgency.

**Hard rules.** Never show dealer names, phones or emails in the shopper UI **before the shopper accepts an offer**. Until then, dealers appear only as "Dealer A/B/C…". The one exception is the reveal on acceptance in §10.2, for that deal only. All text must meet WCAG AA contrast, and every tappable control must be at least 44×44 pt. **Shopper-facing copy never uses "negotiate", "negotiating" or "negotiation"** (screens, pushes, emails to the shopper, component labels). Use "find your best price", "work on it" or "keep going". **The shopper decides:** Drevvy never accepts an offer for the shopper and never labels an offer final or best.

---

## 1. Screens

| Screen | File |
|---|---|
| Deals list (light) | `Drevvy-Halo-Deals.png` |
| Deals list (dark) | `Drevvy-Halo-Deals-Dark.png` |
| Deal detail (tall scroll, no tab bar) | `Drevvy-Halo-DealDetail.png` |
| Chat: empty state | `Drevvy-Halo-Chat-Empty.png` |
| Chat: Ask mode | `Drevvy-Halo-Chat-Ask.png` |
| Chat: Shop mode | `Drevvy-Halo-Chat-Shop.png` |
| VDP, free user (tall scroll, no tab bar) | `Drevvy-Halo-VDP.png` |
| VDP, free user (sticky CTA frame, no tab bar) | `Drevvy-Halo-VDP-Free.png` |
| VDP, subscriber (sticky CTA frame, no tab bar) | `Drevvy-Halo-VDP-Subscriber.png` |
| Deals with the in-app "No longer listed" banner (that card first) | `Drevvy-Halo-Deals-Sold.png` |
| Deals with a No response card (Find similar cars) | `Drevvy-Halo-Deals-NoResponse.png` |
| VDP, **new car** market card: MSRP, local listings, incentives (tall) | `Drevvy-Halo-VDP-NewCar.png` |
| States: Shop loading, chat typing, Deals empty, offline, generic error | `Drevvy-Halo-State-*.png` |
| Profile (tall): cancelled Pro, notification categories, privacy (Location), account | `Drevvy-Halo-Profile.png` |
| Remove sheet, within the undo window (car given back) | `Drevvy-Halo-Remove-WithinUndo.png` |
| Remove sheet, car still counts | `Drevvy-Halo-Remove-Counts.png` |
| Status chips, all 10 states, light + dark | `Drevvy-Halo-StatusChips.png` |
| Accept confirm sheet on the first offer, $36,450 (v1.6) | `Drevvy-Halo-AcceptConfirm-FirstOffer.png` |
| Push banner: price drop ("Dealer B dropped $400 on your CX-50") (v1.6) | `Drevvy-Halo-Push-PriceDrop.png` |
| Push banner: add-on removed ("Dealer A removed the $1,295 paint protection") (v1.6) | `Drevvy-Halo-Push-AddonRemoved.png` |
| Deal detail, Watching for drops (CX-50, Dealer B) (v1.6) | `Drevvy-Halo-DealDetail-Watching.png` |
| Withdraw acceptance ("Changed my mind") confirm sheet (v1.6) | `Drevvy-Halo-Withdraw-Acceptance.png` |
| Deal detail, Changed after you accepted, line-by-line diff (v1.6) | `Drevvy-Halo-DealDetail-ChangedAfterAccept.png` |
| Shop home, **personalized starters** (v1.6.1) | `Drevvy-Halo-Shop-Home-Personalized.png` |
| Shop home, **first run** / no history / personalization off (v1.6.1) | `Drevvy-Halo-Shop-Home-FirstRun.png` |
| Ask answer referencing past searches + "Using your past searches" chip (v1.6.1) | `Drevvy-Halo-Chat-Ask-Memory.png` |
| Memory chip sheet: what was used, per-item on/off (v1.6.1) | `Drevvy-Halo-Memory-Sheet.png` |
| Chat history drawer (hamburger) (v1.6.1) | `Drevvy-Halo-History-Drawer.png` |
| Shop results, Pro, fixed card layout (v1.6.1) | `Drevvy-Halo-Chat-Shop-Pro.png` |
| Profile → Your search profile (tall) (v1.6.1) | `Drevvy-Halo-Profile-SearchProfile.png` |
| Journey frames (J1 ×11, J2 ×17) | `../journeys/frames/Drevvy-J1-*.png`, `Drevvy-J2-*.png` |

Frames are 393×852 logical points (iPhone 15/16 class), rendered at 2×.

### 1.1 Navigation rule

- **Default tab (v1.6.1): Shop.** Every cold start and every return from a killed state opens the Shop tab on a **new, empty chat in Ask mode** (`initialLocation: '/shop'`, `mode=ask`, new `chatId` created lazily on the first message, so empty chats are never saved). A push or deep link (deal, offer, VDP) still opens its own route on top. Returning from background within the same session keeps whatever was on screen.

- **The tab bar appears only on the three root tabs:** Shop (chat), Deals and Profile.
- **Pushed detail pages hide it.** This covers the VDP, Deal detail and any later drill-downs (photo viewer, activity history, paywall). They cover the full screen, have a **back button** (44 pt, top-left) in their top bar, and support the iOS edge-swipe back gesture and the Android system back.
- **Sticky CTA panels** on detail pages sit directly on the bottom edge. Their bottom padding is 12 pt + the bottom safe-area inset (34 pt on Face ID iPhones, the gesture-nav inset on Android).
- **Deal detail** keeps its actions inline at the end of the scroll. The exceptions are Offer received (sticky "Accept this offer" + "Ask Drevvy to keep going"), Watching for drops (sticky "Accept this offer") and Changed after you accepted (sticky Accept the new number / Ask Drevvy to try once more / End this deal) (§6.8). Its scroll view ends with 24 pt + the safe-area inset.
- **Flutter.** Build the tabs as a shell, for example go_router's `StatefulShellRoute.indexedStack` with one navigator branch per tab, so each tab keeps its scroll position. Push detail routes on the **root navigator, above the shell**:
  - go_router: declare `/vdp/:id` and `/deal/:id` as top-level `GoRoute`s outside the shell, or set `parentNavigatorKey: rootNavigatorKey`.
  - Plain `Navigator`: `Navigator.of(context, rootNavigator: true).push(...)`.

  The pushed route then covers the tab bar naturally, with no show/hide animation. Returning pops back to the same tab and scroll position.

---

## 2. Color tokens

Token names map 1:1 to the `DrevvyColors` ThemeExtension in §11. Use the semantic tokens; never hard-code hex values in widgets.

### 2.1 Core

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#EEF1F7` | `#0D0F1C` | Scaffold background, under the blobs |
| `blobViolet` | `#D9D3FF` | `#5B4FE9` @ 35% | Top-right ambient blob |
| `blobBlue` | `#CFE2FF` | `#3A6FF0` @ 22% | Left ambient blob |
| `blobLilac` | `#E6DAFF` | `#8B82FF` @ 18% | Lower-right ambient blob |
| `glass` | `#FFFFFF` @ 66% | `#1E2138` @ 72% | Frosted card fill (with blur) |
| `glassSolid` | `#F7F8FC` | `#1C1F35` | The same card **without** blur (fallback; default in lists) |
| `glassBorder` | `#FFFFFF` @ 95% | `#FFFFFF` @ 8% | 1 px card border (the "glass edge") |
| `tile` | `#FFFFFF` @ 80% | `#24283F` | Inner tiles in cards (leverage, comms, spec tiles) |
| `ink` | `#171A2C` | `#F2F3FA` | Primary text and icons |
| `muted` | `#565D73` | `#A3A9C2` | Secondary text, captions, axis labels |
| `placeholder` | `#6A7086` | `#8E94AD` | Input placeholder only |
| `line` | `#E4E8F1` | `#2A2E45` | Dividers, timeline rail, chart grid |
| `track` | `#DFE3EE` | `#2E3350` | Empty progress-bar segments, ring track |

### 2.2 Brand and semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `violet` (primary) | `#5B4FE9` | `#8B82FF` | Accent, chart line, links, focused borders |
| `blue` | `#3A6FF0` | `#6E9BFF` | Gradient end, info |
| `brandGradient` | `#5145DB → #3563E0` (135°) | same | Primary buttons, stat hero, user chat bubble, avatar. White text works on both themes. |
| `onBrand` | `#FFFFFF` | `#FFFFFF` | Text on the gradient |
| `onBrandMuted` | `#E4E6FF` | `#E4E6FF` | Secondary text on the gradient |
| `lilacTint` | `#ECEAFF` | `#2A2656` | Accent-tinted fills (OTD total row, cadence rule, feature chips) |
| `onLilacTint` | `#3C30C4` | `#C9C4FF` | Text on `lilacTint` |
| `mint` (savings) | `#0F7A55` | `#5FE0B0` | Savings amounts, success |
| `mintTint` | `#DDF5EA` | `#12352C` | Savings pill, "below fair market" line |
| `accept` | `#0A6B70` | `#6FD9DE` | Accepted chip text, waiting spinner, accepted timeline dots |
| `acceptTint` | `#D7F2F1` | `#103539` | Accepted chip fill, "dealer revealed with it" step tint |
| `honey` | `#8A5300` | `#F6C177` | Warnings, Finding your best price, "above fair market" line |
| `fair` | `#C98A1B` (line) / `#8A5300` (label) | `#F6C177` | Fair-price dashed line on charts |
| `danger` | `#B42828` | `#FF8A8A` | Remove, destructive text |
| `dangerBorder` | `#F0D0D0` | `#4A2A33` | Outline of destructive button |
| `ended` | `#5E5470` | `#C9C0D8` | No response chip text (fill `endedTint` `#EEEAF3` / `#2D2A3A`) |
| `sold` | `#7A4A3A` | `#E3B9A8` | No longer listed chip text and banner icon (fill `soldTint` `#F4E9E4` / `#3A2A24`) |
| `strike` | `#D14343` | `#FF8A8A` | Strikethrough color on removed add-ons |
| `tabBar` | `#171A2C` @ 94% | `#05060E` @ 94% + 1 px `#FFFFFF` @ 8% border | Floating tab pill |
| `tabActiveFill` | `#FFFFFF` @ 14% | `#8B82FF` @ 22% | Active tab capsule |
| `tabInactive` | `#A6ACC2` | `#A3A9C2` | Inactive tab label/icon |

### 2.3 Status chips (10 states)

| Status | Light text / fill | Dark text / fill | Progress step |
|---|---|---|---|
| Reaching out | `#2257C0` / `#E3EEFF` | `#8DB6FF` / `#182A4D` | 1 of 4 |
| Finding your best price | `#8A5300` / `#FFF0D6` | `#F6C177` / `#3A2C14` | 2 of 4 |
| Offer received | `#4B3FD9` / `#ECEAFF` | `#B3ADFF` / `#2A2656` | 3 of 4 (every new or improved offer; shopper decides) |
| Accepted | `#0A6B70` / `#D7F2F1` | `#6FD9DE` / `#103539` | 4 of 4 (shopper accepted; official written offer requested; dealer still anonymous) |
| Official offer received | `#FFFFFF` / `#0F7A55` (solid) | `#0D0F1C` / `#5FE0B0` (solid) | 4 of 4 (official offer verified and forwarded; **dealer revealed**) |
| Paused | `#4E5568` / `#E7EAF1` | `#B4BACB` / `#2A2E42` | Frozen at last step, segments desaturated |
| No response | `#5E5470` / `#EEEAF3` | `#C9C0D8` / `#2D2A3A` | Ended at step 1; card desaturated, segments 40% |
| No longer listed | `#7A4A3A` / `#F4E9E4` | `#E3B9A8` / `#3A2A24` | Ended at its last step (listing gone, likely sold; token keeps the name `sold`/`soldTint`, enum `noLongerListed`); card desaturated, segments 40% |
| Watching for drops (v1.6) | `#4F5E12` / `#EEF3D6` | `#CFE08F` / `#2B3315` | 3 of 4 (2 keep-going rounds used; Drevvy stopped asking and watches the listing; Accept stays; enum `watchingForDrops`) |
| Changed after you accepted (v1.6) | `#A3243B` / `#FDE8EC` | `#FFA3B3` / `#3E1D26` | 4 of 4 (official offer still differs after 2 correction requests; dealer still anonymous; enum `changedAfterAccepted`) |

Each chip has a leading 6 pt dot in the text color. **The label is always present**, so status never depends on color alone. "Best price ready" no longer exists. Market context can say an offer is below fair market, but no status or label calls an offer final or best.

Lifecycle: Reaching out → Finding your best price ⇄ Offer received → **Accepted** → **Official offer received**. "Ask Drevvy to keep going" on an Offer received deal moves it back to Finding your best price until the next offer arrives, which is again Offer received. **v1.6:** the shopper can accept any current offer or quote from Finding your best price, Offer received, Paused or Watching for drops (always via the confirm step). When the offer from the **2nd** keep-going round arrives, the deal becomes **Watching for drops** instead of Offer received (no third round; a listing price drop updates the quote and pushes). Accepted → **Changed after you accepted** if the official offer still differs after 2 correction requests; from there, accepting the new number → Official offer received, one more try → Accepted, or End this deal. Accepted → (Changed my mind) → back to the latest offer (Offer received, or Watching for drops if the rounds are used up) or ended. Paused can happen at any stage before Accepted. **No response** (no dealer reply in 7 days) and **No longer listed** (the listing disappeared, likely sold) are end states. They give the car back to the monthly count (§10.4) and use muted, neutral hues so they read as "over", not "error". Official offer received is the only solid-filled chip, because it is the one state that shows the dealer's identity.

### 2.4 Measured contrast (WCAG 2.x)

| Pair | Light | Dark |
|---|---|---|
| ink on canvas | 15.2 | 17.2 |
| ink on glassSolid | 16.2 | 14.6 |
| muted on glassSolid / canvas | 6.2 / 5.8 | 7.0 / 8.2 |
| muted on tile (dark) | — | 6.2 |
| violet on glassSolid | 5.3 | 5.2 |
| mint on glassSolid / on mintTint | 5.0 / 4.66 | 9.9 / 8.1 |
| honey on glassSolid | 6.0 | 9.9 |
| danger on glassSolid | 6.0 | 7.1 |
| onLilacTint on lilacTint | 7.4 | 8.5 |
| white on brand gradient (start / end) | 6.5 / 5.2 | 6.5 / 5.2 |
| tab inactive on tab bar | 7.6 | 8.7 |
| chips (lowest of 10) | 5.33 (Accepted) | 6.85 (Offer received) |
| No response chip | 5.94 | 7.99 |
| No longer listed chip | 6.14 | 7.66 |
| Watching for drops chip (v1.6) | 6.26 | 9.27 |
| Changed after you accepted chip (v1.6) | 6.24 | 7.91 |
| honey on "above fair market" fill `#FFF5E3` / mint on `#E9F8F1` | 5.85 / 4.87 | — |
| Accepted chip (text on fill) | 5.3 | 8.0 |
| Official offer received chip (text on solid fill) | 5.3 | 11.6 |
| placeholder on input | 4.9 | 5.4 |
| progress fill vs empty track (non-text, needs 3:1) | 4.4 | 3.9 |

Everything clears AA for normal text (4.5:1). Nothing relies on the 3:1 large-text allowance. Empty progress segments (`track`) are deliberately low-contrast against the card (about 1.2:1). That is acceptable because the filled segments carry the information and clear 3:1 against the track, and the chip label states the status in text.

---

## 3. Typography

One family: **Manrope** (Google Fonts, OFL), weights 400/500/600/700/800. Bundle the font files in the app (`assets/fonts/`); do not fetch them at runtime. All money, mileage, counts and dates use **tabular figures** (`FontFeature.tabularFigures()`) so columns and animated counters don't jitter.

| Token | Size / line height | Weight | Letter spacing | Tabular | Used for |
|---|---|---|---|---|---|
| `display` | 32 / 35 | 800 | −0.8 | — | Tab titles ("Deals") |
| `figureXL` | 42 / 46 | 800 | −1.26 | ✓ | Best OTD on deal detail |
| `figureL` | 40 / 44 | 800 | −1.2 | ✓ | Total savings in stat hero |
| `figureM` | 32 / 36 | 800 | −0.96 | ✓ | VDP listed price |
| `headline` | 24 / 29 | 800 | −0.48 | — | Detail title, empty-state headline (26) |
| `title` | 18 / 24 | 800 | −0.18 | — | Section headers ("Drevvy is on it") |
| `cardTitle` | 17 / 22 | 700 | −0.17 | — | Deal/inventory card title |
| `figureS` | 20 / 24 | 800 | −0.4 | ✓ | Card best price, tile values |
| `body` | 15 / 22.5 | 500 | 0 | — | Chat messages, paragraphs |
| `bodyStrong` | 14 / 20 | 700 | 0 | — | Row labels, breakdown keys |
| `callout` | 13 / 18 | 600 | 0 | opt. | Trim lines, meta, captions |
| `label` | 12 / 16 | 600 | 0 | opt. | Chip text (700), tile captions |
| `micro` | 11 / 14 | 600 | 0.2 | — | Progress step labels, table headers (uppercase) |

Rules:
- Support Dynamic Type / font scaling up to **1.3× without truncation** of prices or CTA labels. Use `MediaQuery.textScalerOf` and let cards grow in height. Above 1.3×, step labels under progress bars may hide (the chip still states the status).
- Never go below 11 pt. 11 pt is only for supplementary labels that repeat information shown elsewhere.
- Numbers in tables are right-aligned.

---

## 4. Spacing

4 pt base grid.

| Token | Value | Typical use |
|---|---|---|
| `s1` | 4 | Icon-to-label gap in chips, progress segment gap |
| `s2` | 8 | Gap between cards in chat results, chip gaps |
| `s3` | 12 | Gap between deal cards, inner tile padding, between detail sections |
| `s4` | 16 | **Screen gutter** (left/right), card content padding (compact) |
| `s5` | 20 | Detail card padding (mockups use 18; build with 20 or 16, pick one) |
| `s6` | 24 | Section spacing, sticky CTA gap |
| `s8` | 32 | Large separation, empty-state spacing |
| `s10` | 40 | Bottom safe padding above home indicator |

Fixed layout values:
- Status bar area: system safe area.
- Chat header row: 56 pt (44 pt icon buttons + segmented control 48 pt).
- Floating tab bar (root tabs only, see §1.1): 64 pt high, inset 20 pt from the sides and 24 pt from the bottom (above the home indicator). Scrollable content on root tabs needs **≥ 120 pt bottom padding** so the last card can scroll clear of the tab bar.
- Detail pages (no tab bar): the sticky CTA panel's bottom padding is `12 + MediaQuery.paddingOf(context).bottom`. Scroll content needs bottom padding equal to the panel height + 16 pt.
- Chat composer: min 56 pt high, sits 12 pt above the tab bar (bottom offset 100 pt), with a 200 pt canvas-colored fade behind it.

---

## 5. Radii, elevation and blur

### 5.1 Radii

| Token | Value | Use |
|---|---|---|
| `rPill` | 999 | Chips, savings pill, segmented control, composer send button |
| `rXs` | 10 | Small icon tiles (prompt card icons) |
| `rSm` | 14 | Icon badge (cadence), small thumbnails (12) |
| `rMd` | 18 | Buttons, inner tiles, photo inside a card, chat table |
| `rLg` | 24 | Glass cards, CTA sheet top corners (26) |
| `rXl` | 28 | Stat hero, hero photos, composer |
| `rTab` | 32 | Floating tab bar |
| Bubble | 22, with a 6 pt "tail" corner | User chat bubble (bottom-right corner 6) |

### 5.2 Elevation (shadows)

| Token | Light | Dark |
|---|---|---|
| `elev1` card | `0 10 30` `#28305A` @ 8% + `0 1 2` @ 5% | `0 10 30` black @ 35% |
| `elev2` floating (tab bar, composer) | `0 12 30` `#171A2C` @ 30% | black @ 50% |
| `elevBrand` hero, primary button | `0 10–14 24–30` `#4650DC` @ 30% | `0 14 30` black @ 45% |
| `elevSheet` sticky CTA | `0 -10 30` `#28305A` @ 10% | black @ 40% |

In Flutter: `BoxShadow(offset: Offset(0, 10), blurRadius: 30, color: …)`. CSS blur ≈ Flutter `blurRadius`.

### 5.3 Blur ("glass")

- Mockup value: 20 px backdrop blur → `ImageFilter.blur(sigmaX: 20, sigmaY: 20)`. In the app, **sigma 16** looks the same at phone density and costs less.
- **Cost:** every `BackdropFilter` reads back and blurs everything behind it. On Impeller, especially on mid-range Android, a dozen blurred cards in a scrolling `ListView` will drop frames.
- **Where to use real blur:** only fixed chrome, meaning the floating **tab bar**, the **chat composer**, the **sticky VDP CTA sheet** and modal sheets. That is 1–3 per screen.
- **Cards in scrolling lists:** use `glassSolid` + `glassBorder` + `elev1` **without** `BackdropFilter`. The canvas behind them is soft gradient blobs, so a real blur is visually almost identical to a solid fill.
- If several blurred surfaces are on screen together, wrap the screen in `BackdropGroup` and use `BackdropFilter.grouped` with **identical** filter settings, so the engine can share one backdrop pass. Grouping helps most with unbounded blurs. Always clip with `ClipRRect` at the surface radius.
- **Fallback switch:** a `DrevvyColors.useBlur` flag (or app setting) disables all `BackdropFilter`s and swaps in `glassSolid` fills. Turn it off when:
  - The OS asks for less transparency or higher contrast. Flutter exposes `MediaQuery.highContrastOf` (iOS "Increase Contrast"). There is no direct "Reduce Transparency" flag, so read it via a small platform channel if needed.
  - Raster time is poor on the device, judged by a startup benchmark or a device-tier allowlist.
- Wrap blurred chrome in a `RepaintBoundary`.

---

## 6. Components

All tap targets are ≥ 44×44 pt; primary CTAs are 52 pt tall.

### 6.1 Status chip
Pill (`rPill`), padding 5×10, `label` style at 700 weight, with a 6 pt leading dot. Colors are listed in §2.3. When a chip sits on a photo, keep the tinted fill (it's opaque) and add a `0 2 8` black @ 12% shadow. A chip is not a button. If it ever becomes interactive, give it a 44 pt hit area.

### 6.2 Deal card (Deals list)
- `glassSolid` card, `rLg`, 8 pt outer padding.
- Photo inset: full width, 118 pt high, `rMd`, `BoxFit.cover` aligned slightly below center (0, 0.15). Status chip is overlaid at the top-left (10, 10).
- Body (padding 12/8/6):
  - `cardTitle` "2024 Toyota RAV4".
  - `callout` muted line: "XLE Hybrid AWD · 18,420 mi · 12 mi".
- Price row:
  - With an offer: the offer's OTD in `figureS` + "OTD offer" (Finding your best price and Watching for drops: "latest quote"), and a savings pill on the right ("$2,295 under listed", `mintTint`/`mint`, 800).
  - Under it, `callout` muted: "Listed price when you started **$32,995**".
  - No offer yet (Reaching out): the listed price with "listed when you started". While the undo window is open (§10.4), a muted pill underneath: clock icon + "Undo window: 24 min left" (`label`, `muted` on ink @ 5%). It disappears when the window closes or Drevvy first contacts the dealer.
  - Watching for drops (v1.6): the latest quote as above, then a muted pill with a clock icon: "Drevvy is watching for price changes and will check back near month-end."
  - No response / No longer listed: no price; an end note instead ("No longer listed (likely sold) before an offer came in. The conversation key comes back." / "No dealer response after 7 days. The conversation key comes back."). Photo at 35% saturation. Under the note, a compact primary pill **"Find similar cars"** (44 pt, shop icon) that opens Shop with the same model, budget and radius; adding one starts the whole flow again.
- Progress bar (§6.3), then a meta row: email count and text count (with call count if any) on the left, "Dealer A · 2h ago" on the right.
- **After acceptance:** Accepted and Changed after you accepted keep "Dealer A" in the meta row ("Official offer requested" / "Official offer differs"). Official offer received replaces "Dealer A" with the revealed dealer name (e.g. "Lakeside Toyota · 12 mi"); this is the only list state that shows a dealer name.
- The whole card is one tap target and opens Deal detail. Semantics label example: "2024 Toyota RAV4, Offer received, 33,415 dollars out the door, 2,295 dollars under the listed price".

### 6.3 Progress bar (deal stage)
- 4 equal segments, 6 pt tall, 4 pt gaps, radius 3.
- Filled segments use `brandGradient` (dark mode: `#8B82FF → #6E9BFF`); empty segments use `track`.
- Labels below in `micro` muted: Reach out · Finding price · Offer · Accepted.
- Paused, No response and No longer listed: keep the filled count, but drop fill opacity to 40%.
- Watching for drops: 3 segments (it holds a current quote). Accepted, Changed after you accepted and Official offer received: all 4 segments filled. The chip carries the post-acceptance state; the bar doesn't grow new steps.
- Animate fill changes (§9).

### 6.4 Stat hero (Deals header)
- `brandGradient`, `rXl`, padding 18, `elevBrand`. Decorative circle at the top-right is white @ 10%.
- Left side: "Under listed prices, across offers" (`onBrandMuted`, 13/600), then `figureL` amount (sum of listed-when-started minus offer vehicle price over deals with an offer; $1,140 + $900 + $2,295 = $4,335 in the mockup).
- Right side: ring of 76 pt, 7 pt stroke, track white @ 22%, progress white, showing "4/10" with "used" underneath: cars added this billing month (ended No response / No longer listed cars are given back).
- Bottom: two info pills (white @ 16% fill, white @ 22% border), "2 offers to review" (deals in Offer received) and "Resets Oct 20" (next billing date). These are not buttons. If tappable, they must be 44 pt tall.

### 6.5 Segmented toggle (Ask | Shop)
- Container: `rPill`, 4 pt padding, fill `ink` @ 6% (dark: white @ 6%), border white @ 70% (dark @ 8%).
- Segments: 84 pt min width, 40 pt tall. With the 4 pt container padding the hit area is 48 pt.
- Selected segment: white fill (dark: `#2A2E45`), `ink` text, small shadow. Unselected: `muted` text.
- Leading 16 pt icons: sparkle for Ask, chat bubble for Shop.
- Implement as a `Semantics(inMutuallyExclusiveGroup)` pair.

### 6.5a Shop header (v1.6.1)
- Left: **hamburger** `iconbtn` (44 pt), label "Chat history", opens the history drawer (§6.13).
- Center: Ask | Shop toggle (§6.5).
- Right: **no icon.** The compose (pencil-in-square) icon is removed because the app always opens on a new chat; "New chat" lives at the top of the drawer. Keep a 44 pt empty spacer on the right so the toggle stays centered (`SizedBox(width: 44)`).

### 6.6 Chat bubbles
- **User bubble:** right-aligned, max width ~75% (290 pt), `brandGradient`, white `body` text at 600, padding 11×15, radii 22/22/6/22 (tail at bottom-right), `elevBrand` at half strength.
- **Agent message:** no bubble (ChatGPT style). A 30 pt avatar tile (`brandGradient`, `rXs`, sparkle icon) followed by `body` text in `ink`. Rich content inside the message (comparison table, inventory cards) uses glass cards.
- **Shop handoff card:** under an Ask answer that names models, a `tile` card with a chat icon, "Shop RAV4 Hybrids" / "12 listings under $35k nearby" and a compact "Show" pill (44 pt) that switches to Shop with the filters applied.
- **Source row:** sits under data-backed answers. Small `tile` strip (`rSm`) with a database icon in violet, the text "Market data · 214 listings nearby" in `label` muted, and a trailing "Sources" link (violet 700) that opens a sheet. Required on any answer quoting prices or market stats.
- **Suggested prompt chips:** pill, 44 pt min height, `tile` fill.
- **Empty state:** gradient orb (92 pt), headline "Hi Dana, what are you shopping for?" (first name from the account), a 2×2 grid of prompt cards (min 104 pt tall, `rLg`, each with a tinted icon tile), and the trust line "Dealers never see your contact info."

### 6.7 Inventory card (Shop results)
- `glassSolid`, `rLg`, 8 pt padding. **No fixed height anywhere in the card** (v1.6.1 overflow fix).
- Row 1 (top): photo 96×70 (`rSm`); then an `Expanded` text column: title in `cardTitle` at 15.5 (max 2 lines, ellipsis); trim in `callout` (1 line, ellipsis); price in `figureS` at 18; "18,420 mi · 12 mi away" in `label` muted (1 line, ellipsis).
- Row 2: the market badge, left-aligned, sized to its text, may wrap to 2 lines. The badge is the **cheap segment badge** from one search-stats call per results page (§10.6): `mintTint` "Below similar listings nearby" with gauge icon, or neutral "In line with similar listings" (no badge and no row when stats are unavailable). It never shows a precise dollar delta; the precise fair-price verdict lives on the VDP only.
- Row 3: **the CTA, full width on its own row**, min height 44 pt, 8 pt above it. Label centered, 1 line, scales down (`FittedBox(fit: BoxFit.scaleDown)`) rather than clip at large text sizes.
- CTA by entitlement:
  - **Free user:** "Get Best Price" (brand gradient, 44 pt) opens the Superwall/RevenueCat paywall.
  - **Subscriber:** "Add to Agent" (same style, `+` icon). The current build labels it "Add to Drevvy"; either is allowed, pick one and use it everywhere.
  - **Already in agent:** a status chip replaces the CTA (left-aligned on row 3).
- **Why it overflowed (v1.6):** badge (max 150) + `flex:none` CTA + gaps in a single `Row` on a ~345 pt card exceeded the width by 14–24 pt, and/or a fixed card height clipped the second line. **Flutter:**
```dart
GlassCard(padding: EdgeInsets.all(8), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    ClipRRect(borderRadius: r.sm, child: SizedBox(width: 96, height: 70, child: photo)),
    const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, maxLines: 2, overflow: TextOverflow.ellipsis), Text(trim, maxLines: 1, overflow: TextOverflow.ellipsis),
      Text(price), Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis)])),
  ]),
  if (badge != null) ...[const SizedBox(height: 8), Align(alignment: Alignment.centerLeft, child: MarketBadge(badge)) // badge Text softWrap, maxLines: 2],
  const SizedBox(height: 8),
  ConstrainedBox(constraints: const BoxConstraints(minHeight: 44),
    child: SizedBox(width: double.infinity, child: cta)), // label wrapped in FittedBox(fit: BoxFit.scaleDown)
]));
```
  Don't wrap the card in `SizedBox(height:)` or give the list a fixed `itemExtent`; use `ListView.separated` with intrinsic heights. Minimum card height is whatever the content needs (≈ 176 pt with badge, 150 pt without). Verify at text scale 1.0 and 1.3 on a 320 pt-wide device with no overflow stripes.

### 6.8 CTA buttons
| Variant | Fill | Text | Border | Height |
|---|---|---|---|---|
| Primary | `brandGradient` + `elevBrand` | white 800 / 16 | — | 52 |
| Secondary | `tile` (white @ 80%) | `ink` 800 | 1 px white (dark: `glassBorder`) | 52 |
| Tertiary | white @ 50% | `ink` | 1 px `#D6DBE7` (dark: `line`) | 48 |
| Destructive | white @ 50% | `danger` | 1 px `dangerBorder` | 48 |
| Compact pill (cards) | `brandGradient` | white 800 / 14 | — | 44 |

- Radius is `rMd`. Use a 20 pt leading icon with an 8 pt gap.
- Pressed state: scale to 0.97 and add a black @ 6% overlay. Disabled state: 40% opacity and no shadow.

**Sticky VDP CTA sheet:**
- White @ 97% with blur (dark: `glass`), top radius 26, padding 12/16. It sits flush with the bottom edge, and its bottom padding is 12 pt + the safe-area inset, so the fill runs under the home indicator. Use `SafeArea(top: false)` inside a full-bleed `DecoratedBox`. There is no tab bar on detail pages (§1.1).
- Contents: listed price on the left (`figureS`), then the primary button, then a note line underneath.
- Free user: "Unlock my price", with the note "From $3.50/key · Key packs 1 · 5 · 10 · 25 ($4.99, $19.99, $34.99, $74.99). One-time. Never expire."
- Subscriber: a `lilacTint` banner reading "Pro · 3 of 10 cars used this month · resets Oct 20", then "Add to Agent", with the note "Drevvy contacts Dealer A during business hours".
- At 10 of 10 this month, the button becomes "10 of 10 used · resets Oct 20" (secondary style, opens Deals). After cancellation it becomes "Resubscribe to add cars".

**Deal detail actions by status:**
- **Accept everywhere (v1.6).** "Accept this offer" is available on every offer or quote in every status whenever there is a current offer: Offer received, Finding your best price (latest quote), Paused (latest quote) and Watching for drops. Tapping it **always** opens the confirm sheet first and nothing goes to the dealer before Confirm: title "Accept $36,450 out the door?", body "Drevvy will tell Dealer A and request the official written offer.", the itemized acc-card, the three what-happens steps, primary **Confirm**, ghost **Cancel**, footnote "Nothing goes to Dealer A until you confirm. Accepting isn't a contract: you sign and pay only at the dealership." (`Drevvy-Halo-AcceptConfirm-FirstOffer.png`, J2-10).
- **Offer received:** a sticky bottom panel (price · "OTD · good through Oct 15" · primary **"Accept this offer"**), then a full-width secondary **"Ask Drevvy to keep going"**, and the note "Your call. Drevvy never accepts for you." Both buttons also stay inline at the end of the scroll. Keep going returns the deal to Finding your best price (at most 2 rounds; the offer from round 2 lands in Watching for drops).
- **Finding your best price, Paused:** with a current quote, an inline primary "Accept this offer" (no sticky panel, no keep going); always Ask Drevvy (top-bar "Ask" pill), Pause/Resume and Remove. Reaching out: no primary.
- **Watching for drops (v1.6):** a status card with the clock tile and "Drevvy is watching for price changes and will check back near month-end.", sub line "Dealer B answered 2 rounds of asking. Drevvy has stopped asking and checks the listing every day. If the price drops, you'll get a notification.", rows Rounds asked 2 of 2 · Price drops so far · Month-end check-in. Then the offer card. Sticky panel: latest quote + primary "Accept this offer" (no keep going), note "Accept stays available while Drevvy watches. Drevvy never accepts for you." Pause/Resume and Remove stay inline (`Drevvy-Halo-DealDetail-Watching.png`).
- **Accepted:** Ask Drevvy and secondary **"Changed my mind"** side by side (J2-11). Changed my mind opens the withdraw sheet (§10.2): "Changed your mind?", "The official offer hasn't arrived yet, so you can still withdraw your $33,415 acceptance.", steps (Drevvy tells Dealer A politely · you choose what happens next · this car still counts toward your 10), secondary "Withdraw, go back to the offer", destructive "Withdraw and end this deal", ghost "Keep my acceptance" (`Drevvy-Halo-Withdraw-Acceptance.png`).
- **Changed after you accepted (v1.6):** a status card ("The official offer doesn't match what you accepted" + "Drevvy asked Dealer A to correct it twice…"), then **What changed**: a 3-column table (line · Accepted · Official) with every line of the offer; changed lines get a `#FDE8EC` row fill, the official value in `#A3243B` and a delta caption ("+$300", "+$695 · added back"); the total row shows the OTD delta. Sticky: primary **"Accept $34,410 OTD"** (opens the confirm sheet), secondary **"Ask Drevvy to try once more"** with a "1 try left" pill (hidden once used or when the offer has expired), ghost destructive **"End this deal"**, note "Accepting opens a confirm step. Ending tells Dealer A politely; the car still counts." (`Drevvy-Halo-DealDetail-ChangedAfterAccept.png`). Official offer received: Call / Email / Directions (44 pt each) and Done, then the optional trade-in/financing card (§10.4).
- No response / No longer listed: "Find similar cars" (primary, opens Shop with the same model, budget and radius; restarts the flow) and Remove from list.
- **Remove** (any status before Accepted, including Watching for drops) opens a confirmation sheet: car row, then one status box. Within the undo window: mint box, "Drevvy hasn't reached out yet, so this car won't count toward your 10." with "4 of 10 used → 3 of 10 · undo window: 24 min left". Otherwise: neutral box, "This car still counts toward your 10 this month." with "Drevvy has already contacted Dealer B. It will let them know politely that you've decided not to go ahead." (If the window has passed but no contact happened yet, the sub line says "Added more than 30 minutes ago.") Then "Removing ends this deal and its conversation. Offers so far stay in your history.", a destructive "Remove from Drevvy" and "Keep it".
- The footer note on Deal detail reads "Your call: Drevvy never accepts for you. The dealer stays \"Dealer A\" until you accept."

**Other sheets and banners (journey frames):**
- **Add to Drevvy sheet** (J2-03): car row, "What Drevvy will do", read-only contact line, optional max OTD, primary "Find my best price", caption "Uses 1 of your 10 cars this month · resets Oct 20".
- **Notification pre-prompt** (J2-04): shown once, after the first Add to Agent, before the OS dialog. Says Drevvy notifies about every offer, price drop and removed add-on. "Turn on notifications" / "Not now". Discloses that prices show on the lock screen and can be hidden in Profile → Notifications.
- **Price-drop and add-on pushes** (v1.6, same banner as J2-06): "Dealer B dropped $400 on your CX-50" / "Vehicle price now $34,850. New quote: $37,824 out the door (was $38,249). Tap to review or accept." and "Dealer A removed the $1,295 paint protection" / "2024 Toyota RAV4 · Paint & fabric protection is off your offer. Tap to see the updated price." With "Hide prices on lock screen" on: "Dealer B dropped the price on your CX-50" / "Tap to see the new quote." and "Dealer A removed an add-on from your RAV4". Tapping opens Deal detail.
- **Offer card states:** "Latest offer · out the door", Listed vs. Offer bars (vehicle price), "Under listed price $2,295 · 7.0%", and a market line: mint "… below the fair-market OTD estimate" or honey "… above the fair-market OTD estimate".
- **No longer listed banner** (Deals, in-app): white card, `soldTint` icon tile, "**This Outback is no longer listed (likely sold).** You got your car back, so add another and keep going." + "Shop" pill. Push: title "Your Outback is no longer listed", body "It's likely sold. You got your car back, so add another and keep going." Never say "just sold".
- **Pickup-check pre-prompt** (J2-13): see §10.5.
- **Outcome check** (J2-16 push → J2-17 sheet): "Did you buy the RAV4?" with Yes, for $33,415 / Yes, at a different price / Not yet / No. Triggered by leaving the dealership (§10.5), or the day after pickup without location.

### 6.9 Tab bar
- Floating pill: `tabBar` fill, `rTab`, 64 pt high, 8 pt inner padding, `elev2`, blur allowed.
- Three equal tabs: **Shop** (chat-sparkle icon), **Deals** (tag), **Profile** (person). Icon 22 pt with a 7 pt gap to the 13/700 label.
- The active tab gets a `tabActiveFill` capsule (radius 24, ≥ 48 pt tall) and white text. Inactive tabs use `tabInactive`.
- The home indicator sits below the pill.
- **The tab bar appears only on root tabs (Shop, Deals, Profile).** Pushed detail pages (VDP, Deal detail, photo viewer, paywall) hide it by being pushed on the root navigator above the shell (§1.1).

### 6.10 Timeline item (Deal detail → Activity)
- Rail: 2 pt `line`, at x = 5.
- Dot: 12 pt circle, white fill with a 2 pt `#A9B0C4` border. Latest or win events get a filled violet dot with a 4 pt `lilacTint` halo. Accepted events get a violet border.
- Text column at 26 pt from the left:
  - Time "Oct 8 · 4:12 PM" in `label` muted.
  - Heading in `bodyStrong`.
  - Detail in `callout` muted.
- 16 pt between items. Show the newest 5, then a "Show all activity" link.
- Copy rules: name the channel (email, text, call), never the dealer. Speak as Drevvy ("Drevvy reached out to Dealer A").
- **Contact channels are not a setting.** Drevvy never asks the shopper for permission to email, text or call a dealer, and there are no channel toggles in onboarding, the Add to Agent sheet or Profile. The exact email/text/call sequence is backend behavior and still TBD, so the UI stays vague. The Add to Agent sheet states it as one read-only line (`lilacTint` fill, clock icon): "Drevvy reaches out during business hours by email or text. If Dealer A doesn't reply in 7 days, the deal ends and the conversation key comes back." Its only input is the optional max OTD ("Drevvy will tell you if Dealer A won't go below this").

### 6.11 OTD breakdown row
- Row: key in `bodyStrong`, with an optional sub line in `callout` muted ("Down from $899"). Value is right-aligned in 15/700 tabular.
- 10 pt vertical padding and a 1 pt `line` divider.
- **Removed add-on row:**
  - Mint check icon (16 pt), then the key in muted 600.
  - Value struck through: the line uses `strike` at 2 pt, the digits stay `muted`.
  - Semantics: "Removed: Paint and fabric protection, 1,295 dollars".
- **Total row:** `lilacTint` block (`rMd`, padding 12×14), "Out-the-door total" in `onLilacTint` 700, amount in `figureS`/22 in `ink`.
- Order: Vehicle price → Doc fee → Title & registration → Taxes → (Add-ons removed) → Total.

### 6.12 Other detail blocks (reference)
- **Price trend chart:**
  - Smooth line in `violet`, 2.5 pt, with an area gradient from violet @ 25% to 0.
  - Plots each offer's OTD (Oct 2 $36,450 → Oct 5 $35,120 → Oct 8 $33,415). Dashed `fair` line at the fair OTD estimate (§10.6) with the label "Fair OTD $37.1k". In the demo all three offers sit below it.
  - Points are 3 pt white dots with a violet stroke. The latest point is 5 pt filled.
  - Use `fl_chart` or a `CustomPainter`.
- **Market leverage:** 2×2 grid of `tile`s (`rMd`), each with a label, a `figureS` value and a muted sub line.
- **Communication:** 3 tiles (Emails, Texts, Calls), plus "A call is only used if a dealer doesn't reply by email or text."
- **Contact cadence:**
  - Gradient icon tile, with "Next touch" over the next step (e.g. "Waiting on your decision") over the reason ("Dealer A says this offer is good through Thu, Oct 15").
  - Underneath, a `lilacTint` rule: "Drevvy follows up on a regular schedule · no reply in 7 days ends the deal".
  - Times display in the shopper's local zone, with the zone abbreviation shown.
- **Market price context (VDP):**
  - Gradient bar running mint → `#5FC79A` → `#E9C46A` → `#E07A5F`, with a dark pin labelled with this car's price.
  - Low, Fair price and High values underneath. **Low/High are the 5th and 95th percentiles** of the comparable listings (never raw min/max). The middle value is the fair price (MarketCheck Price) and must fall between them.
  - A caption naming the comps scope, e.g. "Low and High: 5th–95th percentile of 14 similar listings within 50 mi". Say "within N mi" only when the comps search was radius-limited.
  - A one-sentence verdict against the fair price (demo: "Listed $1,205 below the fair price for this car and its miles ($34,200). With tax and typical fees, a fair out-the-door price is about $37.1k…"), plus Days listed / Price drops / Comparables tiles.
  - **Used and CPO only.** New cars use the new-car variant (§10.6, `Drevvy-Halo-VDP-NewCar.png`).
- **VDP Key specs:** Powertrain, Drivetrain, Fuel economy (city / hwy, plus combined only if returned), Seats (count only), Transmission, History. Horsepower is appended to Powertrain only when the VIN decode returns it. **No Cargo and no LATCH/car-seat data** (MarketCheck has neither). History shows "One owner (per dealer listing)" only when the listing's one-owner flag is set; otherwise hide the row. Never show accident or clean-history claims.
  - The color bar is decorative. The verdict text carries the meaning.

---

### 6.13 Chat history drawer (v1.6.1)
- Opened by the hamburger or an edge swipe from the left on the Shop tab. Width 318 pt (≤ 85% of screen), `bg` fill, radius 28 on the right corners, `scrim` ink @ 38%. Tap scrim or swipe left to close.
- Top: "Chats" title, a search field (44 pt, filters titles and message text locally, debounce 200 ms), then a primary **New chat** row (closes the drawer on a blank Ask chat).
- List: past **Ask and Shop chats only**, newest activity first, grouped Today / Yesterday / Last 7 days / Last 30 days / Month. Each row (≥ 52 pt): mode icon (sparkle Ask, chat Shop), title (1 line, ellipsis), subline "Ask · 9:41 AM" or "Shop · 38 results". The open chat is highlighted `lilacTint`.
- Tap reopens that chat with its mode and filters. Long-press (Android) / swipe left (iOS): Rename, Delete.
- **Deal-scoped Ask Drevvy chats are never listed here**; they live in their deal (§6.12). Footer note: "Chats about a car you added live in that deal, under Deals."
- Titles: auto-generated from the first user message (≤ 40 chars), e.g. "RAV4 Hybrid under $35k near 30301". No dealer names ever (they can't be in Ask/Shop anyway).
- Empty: "No chats yet. Your conversations will show up here."
- Flutter: `Scaffold.drawer` on the Shop branch's scaffold (not the root), so the tab bar stays under the scrim.

### 6.14 Personalization and memory UI (v1.6.1)
- **Starter cards (empty chat).** 2×2 grid, same `pc` card as before plus an uppercase kicker. Order of preference, filled from the profile (§10.7), max 4, falling back to generic starters to fill:
  1. **Back to your search** — the last saved search: "RAV4 Hybrid · under $35k · 30 mi of 30301". Tap runs it in Shop mode.
  2. **Price drops** — "3 price drops on cars like ones you viewed" (count of drops on viewed VINs or on listings matching a recent search since last visit). Tap opens Shop with those listings.
  3. **New listings** — "5 new CR-V Hybrids within 30 mi" (new since last visit, from a saved search).
  4. **Fair price** — "Is $32,995 fair for the RAV4 you viewed?" (used/CPO VIN only, since MarketCheck Price is used/CPO only). For a new car use "Compare MSRP and local listings for the …".
  - Under the grid: link row "Based on your past searches · Manage" → Profile → Your search profile.
  - Header changes to "Welcome back, Dana" / "Pick up where you left off, or ask anything."
  - A card whose count is 0 is not shown. Counts come from live queries at app open; if they fail, show non-count cards ("Back to your search") or generic ones. Never show a stale count.
- **First run / no history / toggle off:** the generic starters (unchanged from 1.6): "Which hybrid SUV fits a family of four?", "Is $33k fair for a 2024 RAV4 Hybrid?", "Which dealer fees should I never pay?", "Find EVs under $35k near me", greeting "Hi Dana, what are you shopping for?". If onboarding preferences exist, starters may be seeded from them (no "Welcome back").
- **Agent referencing memory.** When an answer uses remembered context, the agent says so in plain words ("Last week you searched RAV4 Hybrids under $35k within 30 mi of 30301. Since then: …") and a **"Using your past searches" chip** (`lilacTint`, history icon, 32 pt visual / 44 pt hit) sits above that answer. Answers built only from the current chat get no chip. Suggestions under the answer may be personalized ("Widen to 50 mi").
- **Memory sheet** (tap the chip): modal sheet "Using your past searches", "Drevvy used these to answer. Turn any off for this chat, or edit them in Profile." Lists the items used, each with a switch (off = excluded for this chat only and the answer regenerates). Buttons: "Edit in Profile" (secondary), "Done".
- **Profile → Your search profile** (top of Profile, above Subscription):
  - "Personalize with my history" switch (default on). Off: generic starters, no chip, nothing new is written to memory; existing items are kept until cleared.
  - Remembered items, one row each with a label and value, plus **edit** (pencil, opens a picker for that field) and **delete** (×, immediate with a 5 s Undo snackbar): Budget, Body types, Makes, Fuel, Location (ZIP · radius), Must-haves. Items the shopper set themselves show no "learned" tag; inferred ones show a muted "Learned from your searches" subline (optional).
  - "Recent searches" row → list of saved searches (run or delete each).
  - **Clear history** (destructive, confirm sheet: "Clear your chat history and search profile? Deals and offers are not affected."). Deletes chats, saved searches, viewed listings and inferred items.

## 7. Dark mode

Dark Halo keeps the same structure and swaps the tokens in §2. The rationale:
- **Canvas `#0D0F1C`:** a deep indigo-black rather than neutral black, so the violet blobs (35/22/18% opacity) read as glow, not stains.
- **Glass:** `#1E2138` @ 72%, which composites to about `#191C30` on canvas, with a white @ 8% hairline border. The solid fallback is `#1C1F35`. Shadows become black @ 35–50%, because colored shadows disappear on dark backgrounds.
- **Accents get lighter:** violet `#5B4FE9 → #8B82FF` and blue `#3A6FF0 → #6E9BFF` keep ≥ 5:1 on dark surfaces. Savings mint becomes `#5FE0B0`.
- **The brand gradient stays the same** in both themes. White text on it is 5.2–6.5:1.
- **Chips swap to light text on deep tinted fills** (all ≥ 6.8:1).
- **Tab bar:** `#05060E` @ 94% with a white @ 8% border, so it separates from the canvas. The active capsule is violet @ 22%.
- **Photos** are shown as delivered (§10.1). If a photo looks too bright next to dark cards, apply a 6% black overlay. The broken-image placeholder uses `glassSolid` with a `muted` icon.

Proof frame: `Drevvy-Halo-Deals-Dark.png`. Follow the system setting (`ThemeMode.system`), with an override in Profile → Appearance.

---

## 8. Accessibility rules

1. **Contrast.** Text must be ≥ 4.5:1, and icons and essential graphics (chart line, progress fill, chip dots) ≥ 3:1. Check any new token pair before shipping. Text on photos only appears inside opaque chips.
2. **Targets.** Everything tappable is ≥ 44×44 pt (Android: 48×48 dp is preferred, and the tab capsules and segmented control already meet it). Leave ≥ 8 pt between adjacent targets.
3. **Color is never the only signal.** Chips carry text, savings carry an "under listed" suffix, removed add-ons carry a check icon plus strikethrough, and the price chart has a text legend and a summary sentence.
4. **Screen readers.**
   - Every card gets one merged `Semantics` node with a full sentence.
   - Prices are read as "33,415 dollars", not "$33,415" letter by letter; use `Semantics(label:)`.
   - Charts expose a text summary: "Offers fell from 36,450 to 33,415 dollars out the door between Oct 2 and Oct 8; the latest is 3,719 dollars below the fair-market out-the-door estimate."
   - Live updates (new offer) are announced politely via `SemanticsService.announce`.
5. **Text scaling.** Support up to 1.3× with no clipped prices or CTA labels. Test at 1.0, 1.15 and 1.3.
6. **Motion.** Respect `MediaQuery.disableAnimationsOf(context)` and reduce-motion settings: replace slides, counters and shimmer with simple fades (§9).
7. **Transparency.** Honor the blur fallback (§5.3). With high contrast on, use the solid surfaces and a 1 pt `line`-colored border.
8. **Privacy.** Location is "While using" for search and taxes; background location is opt-in, limited to one dealership geofence per accepted deal, and removed after the outcome (§10.5). No dealer names, phones, emails, addresses or websites in app text before acceptance: UI copy, listing titles and descriptions, pushes and Ask answers. Listing text is scrubbed (§10.1); listing photos are shown as delivered by MarketCheck. The only exception is the reveal in §10.2. The shopper's phone and email are never given to dealers; dealers see only the first name. Use "Dealer A/B/C" consistently within a deal and across the app.
9. **Focus order** (keyboard and switch control) follows the visual reading order. On root tabs the tab bar comes last. On detail pages the back button comes first and the sticky CTA comes last.

---

## 9. Motion

Halo motion is calm: short, eased, no bounces on money.

| Interaction | Duration | Curve (Flutter `Curves.*`) | Notes |
|---|---|---|---|
| Button press scale (0.97) | 100 ms in / 160 ms out | `easeOut` / `easeOutBack` (out only) | No haptic on press; light haptic on success |
| Ask ↔ Shop segment thumb slide | 220 ms | `easeOutCubic` | Composer placeholder cross-fades over 150 ms |
| Chat: user bubble send | 200 ms | `easeOutCubic` | Slide up 12 pt + fade |
| Chat: agent "thinking" | loop 1200 ms | `easeInOut` | 3-dot pulse or soft shimmer on the avatar tile |
| Chat: agent text stream | per token, ~30 ms | linear | Respect reduce-motion: show text at once |
| Chat: inventory cards appear | 260 ms, 60 ms stagger | `easeOutCubic` | Slide 16 pt + fade |
| Card tap → Deal detail / VDP | 350 ms | `fastOutSlowIn` | Hero animation on the photo (`Hero(tag: dealId)`) |
| Progress segment fill | 400 ms | `easeInOutCubic` | When status advances |
| Savings / price counter tick | 600 ms | `easeOutCubic` | Tabular figures keep width stable; only animate on new data, not on every visit |
| Chart line draw-in | 700 ms | `easeOutQuart` | First view only |
| Status chip change | 200 ms | `easeOut` | Cross-fade color + label |
| Push detail page (VDP, Deal detail) | 350 ms | `fastOutSlowIn` | Platform page transition on the root navigator; it covers the tab bar, with no separate hide animation |
| Sticky CTA sheet in | 300 ms | `easeOutCubic` | Slides up from the bottom edge as the detail page settles |
| Bottom sheets / paywall | 320 ms in / 240 ms out | `easeOutCubic` / `easeInCubic` | |
| Tab switch | 200 ms | `easeOut` | Fade-through, no horizontal slide |
| Dealer reveal | 300 ms | `easeOutCubic` | "Dealer A" cross-fades to the dealer name once, on first view of Official offer received. No confetti |
| New offer moment (Offer received) | 900 ms once | `easeOutCubic` | Gentle glow on the card border + light haptic. No confetti, and no "best" language |
| Price drop / add-on removed (v1.6) | 600 ms once | `easeOutCubic` | Counter ticks to the new quote; the changed breakdown row gets a 900 ms mint highlight. No confetti |
| Ended card (No response / No longer listed) | 300 ms | `easeOut` | Photo desaturates and segments fade to 40% once |

With reduce-motion on, all of the above become 150 ms opacity fades or are skipped. Counters jump straight to the final value.

---

## 10. Content rules (UI copy)

- **Money.** Whole dollars, comma-separated, "$33,415". Use the short form "$34.2k" only in dense tables or charts. Savings are always measured from the **listed price when the shopper started** (frozen at Add to Agent; label "Listed price when you started") to the offer's **vehicle price**, pre-tax and fees: "$2,295 under listed" ($32,995 − $30,700). The OTD ($33,415) is shown separately because it includes doc, title and tax. Market context may say "$3,719 below the fair-market OTD estimate" (definitions in §10.6). Never call an offer "final" or "best".
- **OTD.** Always say "out-the-door" or "OTD", and itemize it. Never show a single number without the breakdown one tap away.
- **Tone.** Calm and factual: "Listed $1,205 below the fair price", not "HOT DEAL!". No countdown timers or urgency banners.
- **Banned words.** Never "negotiate", "negotiating" or "negotiation" in shopper-facing copy. Status: "Finding your best price". CTA: "Find my best price". Paywall: "Let Drevvy find your best price on this RAV4".
- **Plan language.** One-time key packs (1 / 5 / 10 / 25). Never "car packs", monthly conversation plans, or "10 conversations a month".
- **Timing.** "During business hours", never "within the hour" or exact follow-up times for dealer contact.
- **Dealer references.** "Dealer A" and "Listed by Dealer A" are fine. Never use a business name, even partially, before acceptance (§10.2).

### 10.1 Listing photos and text (final rule, revised in 1.3)

**Photos are not processed.** Listing photos load straight from MarketCheck, with no blurring, cropping or cleaning. When a listing has several photos, prefer a plain exterior shot as the cover over one dominated by dealership signage. If an image fails to load, show the generic **broken-image placeholder**: a `glassSolid` fill with a `muted` broken-image icon and "Image didn't load". There is no "Photo unavailable" rule and no server-side photo pipeline: DW decided on no processing, caching or blurring, for speed. **The UI never shows a photo's source URL or the dealer-hosted domain** anywhere (no captions, share sheets, "open image" links, alt text, error messages or debug overlays); sharing a car shares a Drevvy link, never the image URL. Known, accepted risk: dealer signage or watermarks in a photo can reveal the dealer before acceptance (open questions, §12).

**Text is still scrubbed before acceptance.** Listing titles, descriptions and notes shown in the app are stripped of dealer names (including partial or "brand + city" names), phone numbers, emails, URLs, street addresses and dealer-prefixed stock numbers. A reference becomes "Dealer A", or the sentence is dropped. If a description can't be scrubbed confidently, show only the structured specs.

**Mockups** use the original photos (`assets/rav4b.jpg`, `rav4rear.jpg`, `crv.jpg`, `civic.jpg`, `cx50.jpg`, `model3.jpg`, `tucson.jpg`). The 2021 Subaru Outback card shows the broken-image placeholder.

---

### 10.2 Dealer reveal on acceptance (final rule)

The dealer stays anonymous on every screen until the shopper accepts an offer. Identity is revealed **together with the official written offer**, never on its own.

**Flow.**
1. **Offer received.** The Deal detail shows the itemized OTD offer with market context and the sticky "Accept this offer" / "Ask Drevvy to keep going". Nothing is labelled final or best.
2. **Accept confirm (v1.6).** Available from any current offer or quote, in any status. Title "Accept $33,415 out the door?", body "Drevvy will tell Dealer A and request the official written offer.", then "You're accepting $33,415 out the door" with the itemization and three plain steps: Drevvy tells Dealer A and asks for the official itemized OTD offer by email to Drevvy; Drevvy checks that every line matches and forwards it to you; the dealer's name is revealed with it. Buttons: **Confirm** (primary) and **Cancel**. Nothing goes to the dealer before Confirm. Footnote: nothing goes to Dealer A until you confirm; accepting isn't a contract, and signing and payment happen only at the dealership.
3. **Accepted.** Drevvy uses its existing channel with the dealer (email, or text when the dealer allows it) to ask them to send the official offer **as a formal email to Drevvy's own address** (a per-deal Drevvy mailbox, never the shopper's). The deal shows the Accepted chip, "Requesting official offer", and a timeline (offer accepted → dealer asked for the official written offer → waiting, with the next follow-up time). The dealer is still "Dealer A".
4. **Verification.** The server parses the official email and compares every line (vehicle price, fees, tax, add-ons, total, VIN) with the accepted offer. If they match, it moves on. If anything differs, the email is **not** forwarded and nothing is revealed: Drevvy politely asks the dealer to correct it (up to **2 correction requests**, logged in the activity). If the official offer still differs after the 2nd request, the deal becomes **Changed after you accepted** (v1.6): the shopper sees what changed line by line (e.g. doc fee $399 → $699, +$300; dealer prep package $0 → $695, added back; total $33,415 → $34,410) and chooses **Accept $34,410 OTD** (confirm sheet; then that official offer is forwarded and the dealer revealed), **Ask Drevvy to try once more** (one extra request per deal, while the offer is valid; back to Accepted), or **End this deal** (Drevvy tells the dealer politely; the car still counts, since the dealer was contacted). Push: "Dealer A's official offer doesn't match" / "2 lines changed. Tap to review." (no amounts when prices are hidden).
5. **Official offer received.** Drevvy forwards the dealer's original email to the shopper's email address and shows it in the app as a document card. That is the moment the dealer is revealed: business name, the **pickup address taken from the official offer email** (geocoded by Drevvy; not the dealer HQ or group address), distance, and the salesperson's name, role, phone and email, with Call / Email / Directions actions (44 pt). Directions open the platform maps app at that official-offer address; the reveal card notes "Pickup address from the official offer". The document card shows the **full VIN** (masked before acceptance). A "Forwarded to dana.w@example.com" note confirms the forward, followed by next steps: Review · Payment · Pick up. Then the optional trade-in/financing card (§10.4).
**Withdraw (v1.6, "Changed my mind").** While the deal is Accepted (official offer not yet received or not yet matched), the shopper can withdraw. The confirm sheet explains what happens: Drevvy tells the dealer politely ("Dana has decided not to go ahead with $33,415 for now. Thanks for your help."), then the deal goes back to the latest offer (Offer received, or Watching for drops if both keep-going rounds are used) or ends, at the shopper's choice. The car still counts toward the 10, because Drevvy has already contacted the dealer (the existing rule in §10.4); withdrawing never uses another car. No dealer identity is revealed. If the official offer arrives while the sheet is open, Drevvy holds it unforwarded until the shopper decides. Withdrawing is not available after Official offer received.
6. **Done.** A summary with the OTD, "$2,295 under listed · 7.0%", the listed price when started, how long the offer is valid, and the pickup contact. Drevvy stays on call until pickup.
7. **Outcome check.** The day after pickup: "Did you buy the RAV4?" (Yes, for $33,415 / Yes, at a different price / Not yet / No).

**Rules.**
- The reveal is per deal. Other deals keep their letters, and letters are never reused within an account.
- Before Official offer received, no dealer identity may appear anywhere: push text, Deals cards, activity, Ask Drevvy answers, the accept confirm, the waiting state, the withdraw sheet, or Changed after you accepted. Push copy at reveal: "Official offer from Lakeside Toyota is in your inbox".
- The shopper's phone and email are never given to the dealer by Drevvy; dealers know only the first name. The shopper decides when to call or email the salesperson.
- If no official email arrives, Drevvy follows up on its normal schedule (sequence TBD; no reply in 7 days ends the deal as No response). The accepted price is held for the dealer's stated validity window (7 days in the mockups).
- Dealer data that is shown after the reveal comes from the official email and the dealer record, not from listing text, so §10.1 text scrubbing stays in force for listings.
- Mockup data (Lakeside Toyota, 2150 Shoreline Ave, Springfield, Jordan Ellis, (555) 014-2290, `*.example` email addresses) is fictional.

---

### 10.3 Agent voice & dealer messaging

Drevvy is a **transparency layer** that uses market data. With dealers it is a polite, informed partner, not an adversary.

**Identity.** Drevvy opens short and friendly: "Hi, this is Drevvy, working for Martha." It does not lead with "I'm an AI". If a dealer sincerely asks whether this is a bot or AI, the answer is "I'm Drevvy's AI, working for Martha." Drevvy never denies being an AI and never claims to be human. It never shares the shopper's phone, email, or last name, and never pretends to be the shopper. Dealer-facing messages never use "negotiate".

**Asking for the price.** Lead with the shopper's intent and a clear request for an itemized out-the-door price in writing:
- "Martha is a real buyer interested in your RAV4 and wants your best out-the-door price in writing. We're not asking you to lose money on the deal, just the best number that works for you and for her."
- "Could you send an itemized out-the-door quote (vehicle price, doc fee, title and registration, tax and any add-ons)? She's comparing it with market data for this trim."

**Using data.** Cite numbers, not pressure:
- "Comparable 2024 RAV4 Hybrid XLEs within 50 miles are listed around $34,600, and this one has been listed for 67 days. Is there room on the vehicle price?"
- "Nitrogen fill is an optional add-on. Would you be open to removing that and the paint and fabric protection?" (No made-up statistics about what other dealers charge.)
- It's fine to say she's looking at other cars nearby, but only as context: "She's also looking at a couple of similar cars nearby, and she'd like to make a decision this week." **Never threaten.** No "we'll go elsewhere", no ultimatums, no fake competing offers.

**When the dealer wants a call, a visit or a credit app first.** Push back politely, with data, and keep the door open:
- "Totally understand. Martha prefers to start with a written out-the-door number so she can compare it fairly. Once she's happy with the price, she'll come in to see the car and sign."
- "She'll handle financing and any trade-in separately once the price is settled, so we don't need a credit application yet."
- "If a quick call helps on your side, I can pass on any questions, but she'd still like the final numbers in writing."

**Price first.** Drevvy does not raise trade-in or financing with the dealer before the written OTD is in, even if the shopper said yes to both in onboarding. If the dealer raises them, Drevvy defers politely (line above).

**Tone checklist:** courteous, short, specific; thank the dealer for each reply; one ask per message; no all-caps, no urgency language, no "negotiate" in shopper-facing summaries of these messages. Openings stay "Hi, this is Drevvy, working for {first}." The AI sentence is only the answer to a direct question, and it never denies being an AI.

### 10.4 Plan, limits and end states

- **Plan.** One-time key packs that never expire: 1 key $4.99, 5 keys $19.99, 10 keys $34.99 (Recommended), 25 keys $74.99. Two spends from the same balance: (1) market-intelligence unlock + save on a VDP, (2) a separate dealer-conversation key when the VDP URL matches an onboarded rooftop. Off-network out-the-door requests are free (analytics only, no in-app chat). There is no monthly conversation plan and no subscription.
- **Pack picker.** Four compact full-width rows in order 1, 5, 10, 25. The 10-key pack is preselected and carries the Recommended badge. The 1-key row’s second line is “One-time · never expires.” The same picker is on the paywall, the Out of keys sheet, and Account → Buy keys. The sheet does not scroll the rows. Store products `drevvy_keys_1/5/10/25`, RevenueCat packages `keys_1/5/10/25`. The analytics pack-mix dimension is 1, 5, 10, 25.
- **Giving cars back.** A deal that ends as **No response** (no dealer reply in 7 days) or **No longer listed** (the listing disappeared, likely sold) gives that car back to the month's count. Trigger: the dealer confirms it sold, or the listing is missing from MarketCheck for 2+ daily refreshes (MarketCheck only infers "sold" after 7+ days, so the UI says "likely sold"). It sends a push and an in-app banner: "This RAV4 is no longer listed (likely sold). You got your car back, so add another and keep going." with a Shop CTA. **Removing a deal:** if the shopper removes it within **30 minutes of adding it and** before Drevvy has contacted the dealer, the car goes back to the 10. Otherwise it still counts. Both conditions are required: a deal Drevvy contacted 5 minutes after adding counts, and so does an uncontacted deal removed after 30 minutes. The Remove sheet states which case applies (§6.8); a fresh card shows the remaining undo time (§6.2). When a contacted deal is removed, Drevvy sends the dealer one short, polite close-out message.
- **Silence.** Drevvy follows up on its own schedule (email/text/call sequence TBD; the UI only says "business hours" and "email or text"). Seven days with no reply is a dead end: the deal ends as No response. The conversation-key refund clock is 7 days from confirmed delivery.
- **Cancellation.** Deals already started run to completion, even past the billing date, but no new cars can be added. Profile shows the banner "Drevvy is finishing your active deals" with Resubscribe. Add to Agent becomes "Resubscribe to add cars".
- **Trade-in and financing.** Asked in onboarding (Trading in? Yes/No/Not sure; Paying? Cash/Finance/Not sure) but never raised with the dealer before the written final OTD. After the official offer is forwarded, an optional card: "Want Drevvy to keep going on your trade-in or financing?" (Yes, keep going / No thanks). The price doesn't change either way.
- **Free tier.** Ask and Shop are unlimited for free users. A hidden fair-use limit exists on the backend only and is never shown as a counter.
- **Notifications (v1.6).** Price-drop pushes are **on by default**. Drevvy pushes on: **every price drop** ("Dealer A dropped $400 on your RAV4"), **every add-on removal** ("Dealer A removed the $1,295 paint protection"), **offer ready** (new offer or quote), **no longer listed** and **official offer**, plus the official-offer mismatch and the month-end check-in for watched deals. Profile → Notifications lists the categories as toggles, all on by default: Price drops & removed add-ons · Offers and quotes · Official offer · No longer listed · Month-end check-ins, then **"Hide prices on lock screen"** (off by default), which drops amounts from push text ("Dealer A dropped the price on your RAV4"). Lock-screen pushes show prices by default ("$36,450 out the door"). The notification pre-prompt (J2-04) mentions both. Within one dealer reply, a drop and a removal are combined into one push (the larger change leads).
- **Watch mode (v1.6).** After **2 rounds** of "Ask Drevvy to keep going", the next offer puts the deal in **Watching for drops**: Drevvy stops asking the dealer, checks the listing price on every daily refresh, and pushes on any drop (updating the quote with the same fees and tax). It sends **one** friendly check-in to the dealer near month-end (e.g. 2–3 business days before the last day: "Hi, it's Drevvy again for Dana. If anything has changed on the RAV4 before month-end, she's still interested."). Accept stays available throughout. A listing that disappears ends the deal as No longer listed as usual; the 7-day No response rule does not apply while watching. The car keeps counting toward the 10.
- **Two shoppers, same car.** Each shopper gets a separate dealer conversation, a separate letter and separate offers. Nothing is shared between accounts.
- **Account.** Created before purchase: first name (the only thing dealers see) and email (where official offers are forwarded; never shared with dealers), confirmed with a 6-digit code. Apple and Google sign-in are alternatives.
- **Outcome.** One "Did you buy it?" check, triggered by leaving the dealership when the pickup check is on, otherwise the day after pickup (§10.5). The answer improves price estimates and is never shared with the dealer.

### 10.5 Location and the pickup check

**Two separate asks, at two different moments.**
1. **Onboarding (J1-03): "While using" only.** Purpose: nearby listings, search radius and local tax/fee estimates. Pre-prompt first, then the OS dialog (iOS `requestWhenInUseAuthorization`; Android `ACCESS_FINE`/`COARSE_LOCATION`). ZIP code fallback. Never ask for background location here.
2. **After the official offer (J2-13): "Always", opt-in.** Shown once, as a sheet right after the official offer and the dealer reveal, and only if the shopper hasn't already granted it. Title "Let Drevvy know when you've picked up your car"; body "Drevvy can notice your visit to Lakeside Toyota and check in right after you leave, so you don't have to remember."; three promises: "Only for the pickup address on your official offer: Lakeside Toyota, 2150 Shoreline Ave", "Only until you tell us how it went, then it stops", "No route tracking, never shared with the dealer"; note: "Your phone will ask to allow location 'Always'. Turn it off anytime in Profile → Privacy. Without it, Drevvy asks the day after pickup." Buttons "Allow always" / "Not now". "Not now" is final for this deal (no re-ask).

**Platform notes.** iOS: if the shopper already has When In Use, call `requestAlwaysAuthorization` (the system shows the upgrade prompt); otherwise iOS grants provisional Always first and confirms later. Use region monitoring (`CLCircularRegion`), not continuous updates. Android 10+: request `ACCESS_BACKGROUND_LOCATION` separately after foreground location; on Android 11+ this opens Settings ("Allow all the time"), so the sheet's CTA says "Allow always" and a one-line hint explains the Settings step. Use the Geofencing API. Info.plist / Play Console disclosure strings must match the sheet copy.

**Geofence rule.**
- One geofence: **only the pickup address from the official offer email** (geocoded by Drevvy; never the dealer HQ, group or website address, and not MarketCheck coordinates), about 150 m radius, for **this deal only**. Directions use the same address.
- **Active only between** Official offer received and the outcome answer. It is removed when the shopper answers, removes or ends the deal, turns the check off in Profile → Privacy, or the official offer's validity plus 7 days passes, whichever comes first.
- Drevvy records only enter and exit events for that one region; no routes, no other places and no location history. Nothing is shared with the dealer.
- **Trigger:** on exit after a visit of at least 20 minutes, send the push within about 5 minutes: title "Did you drive home in the RAV4?", body "Looks like you just left Lakeside Toyota. Tap to let Drevvy know how it went." (calm, no surprise data beyond the dealer the shopper already knows). Tapping opens the outcome sheet (J2-17), which notes "Location checks for this deal have now stopped."
- **"Not yet"** removes the geofence and schedules one time-based reminder. **Fallback** without Always (denied, "Not now" or turned off): one push the day after the pickup date, or the day after the offer expires if no pickup date is known.

**Profile → Privacy → Location.** The row shows the current OS permission ("While using", "Always", "Off") and the pickup-check state ("Pickup check off" or "Pickup check on · Lakeside Toyota"). Tapping it opens a detail page with what each use is for, a switch for the pickup check, and a link to the OS settings.

### 10.6 Market data rules (MarketCheck, v1.5)

These rules make every market number in the UI traceable to a source. Background: `Drevvy-MarketCheck-Data-Audit.md` in the handoff.

**Locked definitions** (use these names in code, copy and analytics):

| Term | Definition | Demo value (2024 RAV4 Hybrid XLE) |
|---|---|---|
| `fairPrice` (vehicle) | MarketCheck Price for this VIN, miles and ZIP (used/CPO only), priced once at Add to Agent and again only if the listing price changes | $34,200 (listed $32,995 is **$1,205 below**) |
| `fairOtd` | `fairPrice` + estimated doc fee + estimated title & registration + estimated sales tax (buyer's state/ZIP) | $34,200 + $399 + $397 + $2,138 (6.25%) = **$37,134** |
| `typicalOtd` | median price of radius-limited comparable listings + the same fee and tax estimates | $34,600 + $399 + $397 + $2,163 = **$37,559** ("$37.6k") |
| Comps | similar listings (same year/make/model/trim, similar miles) from a radius-limited inventory search | 14 within 50 mi, median $34,600 |
| Low / High | 5th / 95th percentile of the comps' prices | $31,400 / $37,000 (fair price $34,200 falls between) |
| Days listed | days the listing has been active online (`dom_active`); compare only with the same metric for comps | 67 vs. median 38 |
| Savings | listed price frozen at Add to Agent − offer vehicle price (§10) | $2,295 |

Fee and tax estimates are **not MarketCheck data**. They need Drevvy's own tables: sales tax by the buyer's ZIP/state, title/registration by state, and a **state doc-fee table** (some states cap doc fees). Any "typical doc fee in your state" copy must come from that table or from Drevvy's own collected offers, never from MarketCheck.

**Where each number may appear.**
- **Shop result cards:** only the cheap segment badge from one `stats=price` search call per results page ("Below similar listings nearby" / "In line with similar listings"). No dollar delta, and no per-card MarketCheck Price calls.
- **VDP:** the precise verdict against `fairPrice`, the percentile bar, typical/fair OTD, Days listed, Price drops (from VIN history), Comparables.
- **Deal detail:** `fairOtd` as the market line and chart line, with the comps tiles.
- **New cars** (`inventory_type = new`): MarketCheck Price doesn't cover them. The VDP uses the **new-car market card** (`Drevvy-Halo-VDP-NewCar.png`): MSRP, this car's price and its delta vs. MSRP (amount and %); a percentile bar of local new listings of the same trim with the count and radius; a verdict ("Listed $1,250 below MSRP and $525 below the median for the same new trim nearby…"); and **automaker incentives where available** (APR offers, bonus cash, loyalty, with eligibility and end date). With no incentives: "No current automaker incentives found for your ZIP." There is no fair-price verdict for new cars, and the deal market line compares the offer with MSRP + estimated tax and fees.

**Content that must not appear** (no MarketCheck source): cargo volume, LATCH/car-seat fit, accident history or "no accidents", owner counts beyond the dealer-claimed one-owner flag, resale projections, statistics about other dealers' add-ons or fees, dealer ratings.

**Loading.** The Shop skeleton says "Searching listings near you…" with no count until results return (or until a separate count query has returned).

**Sold detection.** See §10.4 (No longer listed).

---

### 10.7 Memory and personalization rules (v1.6.1)
- **Only MarketCheck-backed signals.** Remember and suggest only what Drevvy can re-query: listings search filters (make, model, trim, year, price, mileage, radius, ZIP, body type, fuel, drivetrain where the listing has it), VIN history and price drops, MarketCheck Price / comparables for **used/CPO**, days listed, and new-car MSRP/local listings (§10.6). Never invent counts, predictions, "deal scores", reliability, resale or "cars like you'd love" claims.
- **What counts as history:** the shopper's Ask/Shop messages, searches run (filters), listings opened (VIN), Shop handoffs tapped, and cars added to the agent. Deal-scoped Ask Drevvy chats and dealer messages are **not** used for personalization.
- **Inference:** a preference is learned when it appears in ≥ 2 searches in the last 60 days (e.g. budget = the most common max price; makes = top 3). Explicit edits always win and are never overwritten by inference.
- **Retention:** chats and search history kept until deleted; inferred items decay after 90 days without use. Clear history is immediate and server-side.
- **Privacy:** memory is per user, never shared with dealers, and never sent in dealer messages. Same two-users-same-car rule as §10.3 (separate conversations).
- **Copy:** "Using your past searches", "Back to your search", "Based on your past searches". No "We know you…" phrasing.

## 11. Flutter theme mapping

```dart
// lib/theme/drevvy_theme.dart
import 'dart:ui' show FontFeature, ImageFilter;
import 'package:flutter/material.dart';

// Enum identifiers are code, not copy. UI label for findingBestPrice: "Finding your best price".
enum DealStatus { reachingOut, findingBestPrice, offerReceived, accepted, officialOfferReceived, paused, noResponse, noLongerListed, watchingForDrops, changedAfterAccepted }

@immutable
class ChipColors {
  const ChipColors(this.fg, this.bg);
  final Color fg;
  final Color bg;
  static ChipColors lerp(ChipColors a, ChipColors b, double t) =>
      ChipColors(Color.lerp(a.fg, b.fg, t)!, Color.lerp(a.bg, b.bg, t)!);
}

@immutable
class DrevvyColors extends ThemeExtension<DrevvyColors> {
  const DrevvyColors({
    required this.canvas, required this.blobs, required this.glass, required this.glassSolid,
    required this.glassBorder, required this.tile, required this.ink, required this.muted,
    required this.placeholder, required this.line, required this.track, required this.violet,
    required this.blue, required this.lilacTint, required this.onLilacTint, required this.mint,
    required this.mintTint, required this.honey, required this.fair, required this.danger,
    required this.dangerBorder, required this.strike, required this.tabBar, required this.tabActiveFill,
    required this.tabInactive, required this.progressGradient, required this.chips,
    required this.cardShadow, this.useBlur = true,
  });

  final Color canvas, glass, glassSolid, glassBorder, tile, ink, muted, placeholder, line, track;
  final Color violet, blue, lilacTint, onLilacTint, mint, mintTint, honey, fair;
  final Color danger, dangerBorder, strike, tabBar, tabActiveFill, tabInactive;
  final List<Color> blobs; // violet, blue, lilac ambient blobs
  final LinearGradient progressGradient;
  final Map<DealStatus, ChipColors> chips;
  final List<BoxShadow> cardShadow;
  final bool useBlur; // false => solid surfaces, no BackdropFilter

  // Shared in both themes (white text passes AA on it).
  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft, end: Alignment.bottomRight,
    colors: [Color(0xFF5145DB), Color(0xFF3563E0)],
  );
  static const onBrand = Color(0xFFFFFFFF);
  static const onBrandMuted = Color(0xFFE4E6FF);
  static const glassBlur = 16.0; // sigma; mockups used 20

  static const light = DrevvyColors(
    canvas: Color(0xFFEEF1F7),
    blobs: [Color(0xFFD9D3FF), Color(0xFFCFE2FF), Color(0xFFE6DAFF)],
    glass: Color(0xA8FFFFFF), glassSolid: Color(0xFFF7F8FC), glassBorder: Color(0xF2FFFFFF),
    tile: Color(0xCCFFFFFF), ink: Color(0xFF171A2C), muted: Color(0xFF565D73),
    placeholder: Color(0xFF6A7086), line: Color(0xFFE4E8F1), track: Color(0xFFDFE3EE),
    violet: Color(0xFF5B4FE9), blue: Color(0xFF3A6FF0),
    lilacTint: Color(0xFFECEAFF), onLilacTint: Color(0xFF3C30C4),
    mint: Color(0xFF0F7A55), mintTint: Color(0xFFDDF5EA), honey: Color(0xFF8A5300),
    fair: Color(0xFFC98A1B), danger: Color(0xFFB42828), dangerBorder: Color(0xFFF0D0D0),
    strike: Color(0xFFD14343), tabBar: Color(0xF0171A2C), tabActiveFill: Color(0x24FFFFFF),
    tabInactive: Color(0xFFA6ACC2),
    progressGradient: LinearGradient(colors: [Color(0xFF5B4FE9), Color(0xFF3A6FF0)]),
    chips: {
      DealStatus.reachingOut: ChipColors(Color(0xFF2257C0), Color(0xFFE3EEFF)),
      DealStatus.findingBestPrice: ChipColors(Color(0xFF8A5300), Color(0xFFFFF0D6)),
      DealStatus.offerReceived: ChipColors(Color(0xFF4B3FD9), Color(0xFFECEAFF)),
      DealStatus.accepted: ChipColors(Color(0xFF0A6B70), Color(0xFFD7F2F1)),
      DealStatus.officialOfferReceived: ChipColors(Color(0xFFFFFFFF), Color(0xFF0F7A55)),
      DealStatus.paused: ChipColors(Color(0xFF4E5568), Color(0xFFE7EAF1)),
      DealStatus.noResponse: ChipColors(Color(0xFF5E5470), Color(0xFFEEEAF3)),
      DealStatus.noLongerListed: ChipColors(Color(0xFF7A4A3A), Color(0xFFF4E9E4)),
      DealStatus.watchingForDrops: ChipColors(Color(0xFF4F5E12), Color(0xFFEEF3D6)),
      DealStatus.changedAfterAccepted: ChipColors(Color(0xFFA3243B), Color(0xFFFDE8EC)),
    },
    cardShadow: [
      BoxShadow(offset: Offset(0, 10), blurRadius: 30, color: Color(0x1428305A)),
      BoxShadow(offset: Offset(0, 1), blurRadius: 2, color: Color(0x0D28305A)),
    ],
  );

  static const dark = DrevvyColors(
    canvas: Color(0xFF0D0F1C),
    blobs: [Color(0x595B4FE9), Color(0x383A6FF0), Color(0x2E8B82FF)],
    glass: Color(0xB81E2138), glassSolid: Color(0xFF1C1F35), glassBorder: Color(0x14FFFFFF),
    tile: Color(0xFF24283F), ink: Color(0xFFF2F3FA), muted: Color(0xFFA3A9C2),
    placeholder: Color(0xFF8E94AD), line: Color(0xFF2A2E45), track: Color(0xFF2E3350),
    violet: Color(0xFF8B82FF), blue: Color(0xFF6E9BFF),
    lilacTint: Color(0xFF2A2656), onLilacTint: Color(0xFFC9C4FF),
    mint: Color(0xFF5FE0B0), mintTint: Color(0xFF12352C), honey: Color(0xFFF6C177),
    fair: Color(0xFFF6C177), danger: Color(0xFFFF8A8A), dangerBorder: Color(0xFF4A2A33),
    strike: Color(0xFFFF8A8A), tabBar: Color(0xF005060E), tabActiveFill: Color(0x388B82FF),
    tabInactive: Color(0xFFA3A9C2),
    progressGradient: LinearGradient(colors: [Color(0xFF8B82FF), Color(0xFF6E9BFF)]),
    chips: {
      DealStatus.reachingOut: ChipColors(Color(0xFF8DB6FF), Color(0xFF182A4D)),
      DealStatus.findingBestPrice: ChipColors(Color(0xFFF6C177), Color(0xFF3A2C14)),
      DealStatus.offerReceived: ChipColors(Color(0xFFB3ADFF), Color(0xFF2A2656)),
      DealStatus.accepted: ChipColors(Color(0xFF6FD9DE), Color(0xFF103539)),
      DealStatus.officialOfferReceived: ChipColors(Color(0xFF0D0F1C), Color(0xFF5FE0B0)),
      DealStatus.paused: ChipColors(Color(0xFFB4BACB), Color(0xFF2A2E42)),
      DealStatus.noResponse: ChipColors(Color(0xFFC9C0D8), Color(0xFF2D2A3A)),
      DealStatus.noLongerListed: ChipColors(Color(0xFFE3B9A8), Color(0xFF3A2A24)),
      DealStatus.watchingForDrops: ChipColors(Color(0xFFCFE08F), Color(0xFF2B3315)),
      DealStatus.changedAfterAccepted: ChipColors(Color(0xFFFFA3B3), Color(0xFF3E1D26)),
    },
    cardShadow: [BoxShadow(offset: Offset(0, 10), blurRadius: 30, color: Color(0x59000000))],
  );

  @override
  DrevvyColors copyWith({bool? useBlur}) => DrevvyColors(
        canvas: canvas, blobs: blobs, glass: glass, glassSolid: glassSolid, glassBorder: glassBorder,
        tile: tile, ink: ink, muted: muted, placeholder: placeholder, line: line, track: track,
        violet: violet, blue: blue, lilacTint: lilacTint, onLilacTint: onLilacTint, mint: mint,
        mintTint: mintTint, honey: honey, fair: fair, danger: danger, dangerBorder: dangerBorder,
        strike: strike, tabBar: tabBar, tabActiveFill: tabActiveFill, tabInactive: tabInactive,
        progressGradient: progressGradient, chips: chips, cardShadow: cardShadow,
        useBlur: useBlur ?? this.useBlur,
      );

  @override
  DrevvyColors lerp(ThemeExtension<DrevvyColors>? other, double t) {
    if (other is! DrevvyColors) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return DrevvyColors(
      canvas: c(canvas, other.canvas),
      blobs: [for (var i = 0; i < blobs.length; i++) c(blobs[i], other.blobs[i])],
      glass: c(glass, other.glass), glassSolid: c(glassSolid, other.glassSolid),
      glassBorder: c(glassBorder, other.glassBorder), tile: c(tile, other.tile),
      ink: c(ink, other.ink), muted: c(muted, other.muted), placeholder: c(placeholder, other.placeholder),
      line: c(line, other.line), track: c(track, other.track), violet: c(violet, other.violet),
      blue: c(blue, other.blue), lilacTint: c(lilacTint, other.lilacTint),
      onLilacTint: c(onLilacTint, other.onLilacTint), mint: c(mint, other.mint),
      mintTint: c(mintTint, other.mintTint), honey: c(honey, other.honey), fair: c(fair, other.fair),
      danger: c(danger, other.danger), dangerBorder: c(dangerBorder, other.dangerBorder),
      strike: c(strike, other.strike), tabBar: c(tabBar, other.tabBar),
      tabActiveFill: c(tabActiveFill, other.tabActiveFill), tabInactive: c(tabInactive, other.tabInactive),
      progressGradient: LinearGradient.lerp(progressGradient, other.progressGradient, t)!,
      chips: {for (final s in DealStatus.values) s: ChipColors.lerp(chips[s]!, other.chips[s]!, t)},
      cardShadow: BoxShadow.lerpList(cardShadow, other.cardShadow, t)!,
      useBlur: t < .5 ? useBlur : other.useBlur,
    );
  }
}

/// Spacing, radii and type tokens (theme-independent).
abstract final class DS {
  static const s1 = 4.0, s2 = 8.0, s3 = 12.0, s4 = 16.0, s5 = 20.0, s6 = 24.0, s8 = 32.0, s10 = 40.0;
  static const gutter = s4;
  static const rXs = 10.0, rSm = 14.0, rMd = 18.0, rLg = 24.0, rXl = 28.0, rTab = 32.0, rPill = 999.0;
  static const minTap = 44.0, ctaHeight = 52.0, tabBarHeight = 64.0;
  static const tnum = [FontFeature.tabularFigures()];
}

TextTheme drevvyTextTheme(Color ink) {
  TextStyle m(double size, double height, FontWeight w, [double ls = 0, bool tab = false]) => TextStyle(
        fontFamily: 'Manrope', fontSize: size, height: height / size, fontWeight: w,
        letterSpacing: ls, color: ink, fontFeatures: tab ? DS.tnum : null,
      );
  return TextTheme(
    displayLarge: m(42, 46, FontWeight.w800, -1.26, true),   // figureXL
    displayMedium: m(40, 44, FontWeight.w800, -1.2, true),   // figureL
    displaySmall: m(32, 35, FontWeight.w800, -0.8),          // display
    headlineMedium: m(24, 29, FontWeight.w800, -0.48),       // headline
    titleLarge: m(18, 24, FontWeight.w800, -0.18),           // title
    titleMedium: m(17, 22, FontWeight.w700, -0.17),          // cardTitle
    titleSmall: m(20, 24, FontWeight.w800, -0.4, true),      // figureS
    bodyLarge: m(15, 22.5, FontWeight.w500),                 // body
    bodyMedium: m(14, 20, FontWeight.w700),                  // bodyStrong
    bodySmall: m(13, 18, FontWeight.w600),                   // callout
    labelMedium: m(12, 16, FontWeight.w600),                 // label
    labelSmall: m(11, 14, FontWeight.w600, 0.2),             // micro
  );
}

ThemeData drevvyTheme(Brightness b) {
  final x = b == Brightness.light ? DrevvyColors.light : DrevvyColors.dark;
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF5B4FE9), brightness: b).copyWith(
    primary: x.violet, onPrimary: b == Brightness.light ? Colors.white : const Color(0xFF0D0F1C),
    secondary: x.blue, surface: x.glassSolid, onSurface: x.ink, onSurfaceVariant: x.muted,
    outline: x.line, error: x.danger,
  );
  return ThemeData(
    useMaterial3: true, brightness: b, colorScheme: scheme, fontFamily: 'Manrope',
    scaffoldBackgroundColor: x.canvas, textTheme: drevvyTextTheme(x.ink),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    dividerTheme: DividerThemeData(color: x.line, thickness: 1, space: 1),
    splashFactory: InkSparkle.splashFactory,
    extensions: [x],
  );
}

/// Glass surface: real blur only when allowed, solid fallback otherwise.
class GlassCard extends StatelessWidget {
  const GlassCard({super.key, required this.child, this.radius = DS.rLg, this.blur = false,
      this.padding = const EdgeInsets.all(DS.s2)});
  final Widget child; final double radius; final bool blur; final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final x = Theme.of(context).extension<DrevvyColors>()!;
    final useBlur = blur && x.useBlur && !MediaQuery.highContrastOf(context);
    final box = DecoratedBox(
      decoration: BoxDecoration(
        color: useBlur ? x.glass : x.glassSolid,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: x.glassBorder),
      ),
      child: Padding(padding: padding, child: child),
    );
    final surface = useBlur
        ? ClipRRect(
            borderRadius: BorderRadius.circular(radius),
            child: BackdropFilter.grouped( // needs a BackdropGroup ancestor (wrap each screen)
              filter: ImageFilter.blur(sigmaX: DrevvyColors.glassBlur, sigmaY: DrevvyColors.glassBlur),
              child: box,
            ),
          )
        : box;
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius), boxShadow: x.cardShadow),
      child: surface,
    );
  }
}

// Usage: MaterialApp(theme: drevvyTheme(Brightness.light), darkTheme: drevvyTheme(Brightness.dark),
//                    themeMode: ThemeMode.system)
// final x = Theme.of(context).extension<DrevvyColors>()!; x.chips[DealStatus.findingBestPrice]!.fg
```

Notes on the snippet:
- `BackdropGroup` / `BackdropFilter.grouped` require a recent Flutter stable. On older SDKs use the plain `BackdropFilter(filter: …)`.
- `Color(0xA8FFFFFF)` is white at 66%. Alpha hex: 66% ≈ `A8`, 72% ≈ `B8`, 94% ≈ `F0`, 8% ≈ `14`.
- Lists use `GlassCard(blur: false)` (the default). Only the tab bar, composer, CTA sheet and modal sheets pass `blur: true`.

### 11.1 Data model: chats, profile and memory (v1.6.1)

```dart
enum ChatMode { ask, shop }
class ChatThread { String id; String userId; String title; ChatMode mode; DateTime createdAt, updatedAt;
  SearchFilters? lastFilters; bool usedMemory; /* never dealId: deal chats live in DealThread */ }
class ChatMessage { String id, chatId; String role; String text; List<String> memoryItemIds; DateTime at; }

class SearchFilters { List<String> makes, models, trims; int? yearMin, yearMax, priceMax, milesMax;
  String zip; int radiusMi; List<String> bodyTypes, fuel, drivetrain; String condition; /* new | used | cpo */ }
class SavedSearch { String id; SearchFilters filters; DateTime lastRunAt; int runCount; Set<String> seenListingIds; }
class ViewedListing { String vin; String listingId; int priceAtView; DateTime viewedAt; }

enum MemoryKind { budget, bodyTypes, makes, fuel, location, mustHaves }
enum MemorySource { explicit, inferred, onboarding }
class MemoryItem { String id; MemoryKind kind; Object value; MemorySource source; DateTime updatedAt, lastUsedAt; }

class SearchProfile { String userId; bool personalize; /* default true */ List<MemoryItem> items;
  List<SavedSearch> searches; List<ViewedListing> viewed; }
```
- API: `GET/PATCH /me/search-profile`, `DELETE /me/search-profile/items/:id`, `POST /me/history:clear`, `GET /chats?q=&cursor=`, `GET/PATCH/DELETE /chats/:id`, `GET /me/starters` (returns up to 4 starter cards with live counts, or the generic set).
- Starter card payload: `{kind: backToSearch|priceDrops|newListings|fairPrice|generic, title, kicker, action: {mode, filters?|vin?|prompt?}}`.

---

## 12. Open questions

- **Resolved in 1.6 (DW, Oct 11):** Accept on every current offer with a confirm step; price-drop and add-on pushes on by default (categories in Profile); watch mode after 2 keep-going rounds; a shopper **can** withdraw an acceptance before the official offer arrives; Changed after you accepted after 2 correction requests (§2.3, §6.8, §10.2, §10.4).
- **Resolved in 1.4 (DW):** remove/undo rule (30 min and no contact yet), Find similar cars on ended deals, location-based outcome check (§10.4, §10.5).
- **Resolved in 1.5 (MarketCheck data audit, DW):** the market-data rules in §10.6 (locked fair price / fair OTD / typical OTD, cheap Shop badge, new-car card, percentiles, Days listed, no unsourced specs or history), No longer listed replacing Sold, the official-offer address for Directions and the geofence, and no photo processing (signage risk accepted).
- **Resolved in 1.3 (DW):** tabs; the 10-cars-a-month plan; No response / Sold (now No longer listed) end states; cancellation; agent identity and the banned-word rule; dealer pushback; price first; the 7-day dead end; the shopper decides (no Best price ready); the savings baseline; free fair use; the lock-screen price toggle; separate conversations per shopper; unprocessed photos. See §10.1, §10.3 and §10.4.
- **Resolved in 1.6.1 (Dustin, Oct 12):** Shop is the default tab and opens on a fresh Ask chat; hamburger opens chat history; compose icon removed; personalized starters and memory with a Profile search profile.
- **Assumed in 1.6.1 (confirm):** inference threshold (≥ 2 searches in 60 days) and 90-day decay; chip-sheet switches apply to the current chat only; "Personalize" default on; empty chats are not saved; the drawer lives on the Shop tab only; subscriber CTA label ("Add to Agent" in spec vs "Add to Drevvy" in the build) needs one final pick.
- **Still open:** the exact follow-up sequence (email/text/call timing) before the 7-day cutoff; the per-deal Drevvy mailbox address format; how strictly to match the official offer (exact cents vs. tax rounding); iOS/Android disclosure strings for the pickup check; **from v1.6:** the exact month-end check-in day and wording, whether a watched deal should leave watch mode if the dealer replies on their own, and the validity window that limits "Ask Drevvy to try once more"; the geofence radius and minimum-visit time (150 m / 20 min proposed). **From the v1.5 data audit:** whether MarketCheck allows storing per-deal listing snapshots (frozen listed price, fair price, photo/trim/miles) and quoting its figures to dealers (licensing questions in `Drevvy-MarketCheck-Data-Audit.md`); whether the NeoVIN decode returns horsepower and combined MPG; the comps radius (50 mi proposed); the source for tax and title/registration estimates and the state doc-fee table.
- **Dealer signage in photos (accepted risk, DW).** Photos load unprocessed from MarketCheck (§10.1), so signage, plate frames or watermarks can reveal the dealer before acceptance. DW accepted this for speed. Revisit only if dealers or shoppers report it.
- **Hero animation across navigators.** Detail pages are pushed on the root navigator (§1.1). Check that the card-to-VDP photo `Hero` still flies from the shell branch. If it doesn't, use a fade-through (300 ms, `easeOutCubic`) instead.
- **Reduce Transparency** has no first-party Flutter flag. Read it through a platform channel, or offer an in-app "Reduce transparency" toggle.
- **The mockups use 18 pt card padding and 14 pt section gaps.** This spec rounds them onto the 4 pt grid (16/20 and 12).
- **Specs in the Ask answer** (MPG, typical OTD) are illustrative example data, not verified figures. Ask answers may only state facts with a source (MarketCheck fields, VIN decode, search stats, our own offer data); no cargo, car-seat, resale or reliability claims (§10.6).
