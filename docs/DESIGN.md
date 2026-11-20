# FindHouse design system

This is how the FindHouse web app looks and moves, and how to build new screens that match it. Tokens live in `apps/web/src/index.css`, motion presets in `src/shared/motion.ts`, and components in `src/shared/components/`.

The workspace aims to feel calm and premium for brokers who work from their phone between site visits. It uses deep brand colours, generous white space, soft tinted tiles and gentle motion. The public listing page is designed as a property brochure rather than a dashboard: a full-bleed photo, a floating summary card, and a contact bar that is always within reach.

---

## 1. Tokens

All colours, radii, shadows and type sizes are CSS custom properties on `:root`. Components never hard-code a colour; they use a token, so every theme works automatically.

### Colour roles

| Role | Tokens | Use |
| --- | --- | --- |
| Surfaces | `--color-bg`, `--color-canvas`, `--color-surface`, `--color-field` | Cards, page background, subtle fills, inputs |
| Lines | `--color-border`, `--color-border-strong` | Dividers, card edges, input borders |
| Text | `--color-fg`, `--color-fg2`, `--color-fg3` | Primary, secondary and tertiary text |
| Brand | `--color-accent`, `--color-accent-hover`, `--color-accent-soft`, `--color-on-accent` | Primary buttons, active nav, focus, links |
| Status | `--color-{green,amber,red,blue,grey}` with `-soft` (fill) and `-line` (border) | Badges, alerts, chart segments |
| Navigation | `--nav-bg`, `--nav-fg`, `--nav-fg-strong`, `--nav-hover`, `--nav-active`, `--nav-border` | Sidebar and tab bar |
| Tinted tiles | `--tint-{mint,green,lavender,peach}` (gradient) and `-fg` (icon colour) | KPI cards, section icons, fact tiles |

Status colours map to listing states in `modules/properties/listingStatus.ts`: **Active** is green, **Draft** amber, **Rented** blue and **Inactive** grey.

### Alpha-friendly triplets

Some colours are stored as `r, g, b` so they can be used at any opacity: `--brand-rgb`, `--shade-rgb`, `--hero-shade-rgb`, `--photo-shade-rgb`, `--scrim-rgb`, `--canvas-rgb`, `--ink-rgb`. Example: `rgba(var(--shade-rgb), 0.35)`.

### Shape and depth

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 8px | Chips, small buttons |
| `--radius-md` | 12px | Inputs, buttons, alerts |
| `--radius-lg` | 20px | Cards |
| `--radius-xl` | 24px | Hero panels, sheets |
| `--shadow-card` / `--shadow-card-hover` | Soft, brand-tinted | Cards at rest and on hover |
| `--shadow-xs` … `--shadow-lg` | Neutral ink | Menus, dialogs, floating bars |

### Typography

- **Font:** DM Sans (Google Fonts, weights 400–700), falling back to the system UI font. `--font-display` is an alias for headings.
- **Scale:** `--text-xs` 12, `--text-sm` 13, `--text-base` 14, `--text-md` 16, `--text-lg` 18, `--text-xl` 24 (px). Page titles in heroes are set larger in their own modules.
- Numbers use Indian digit grouping (`₹1,45,000`). Large amounts get a lakh or crore hint (`shared/format.ts`).

---

## 2. Themes

There are ten colour themes, chosen under **Settings → Colour theme** (`shared/theme.ts`): Midnight navy (default), Forest green, Peacock teal, Ink indigo, Aubergine, Burgundy, Cognac, Espresso, Olive and Charcoal.

- A theme is a `:root[data-theme='…']` block that overrides surfaces, text, brand, nav and triplet tokens. Navy is the base `:root`.
- An inline script in `index.html` applies the saved theme (`localStorage.findhouse_theme`) **before first paint**, so there's no flash.
- While switching, `.theme-switching` is set on `<html>` for 400 ms to cross-fade colours.
- Each theme has a matching hero photo (`src/assets/hero-building-<theme>.jpg`).

When adding a token, give it a value in the base `:root` and in every theme that changes surfaces or brand.

---

## 3. Layout and breakpoints

| Name | Query | What changes |
| --- | --- | --- |
| Phone | `max-width: 760px` (`PHONE_QUERY`) | Bottom tab bar (Overview, Properties, **+**, Performance, Profile); search moves into the page hero; properties always use the grid; full-width sheets |
| Tablet | `761px – 960px` | Sidebar collapses to a drawer; list (table) or grid view for properties |
| Desktop | `min-width: 961px` | Persistent sidebar; multi-column dashboards |

The public listing page has its own steps: **≤ 760px** puts the contact bar full width at the bottom, **761px and up** makes it a floating pill, and from 761px the property details sit in two columns. The page itself is a single column at every width. Smaller tweaks at 600, 480 and 380px keep phones from overflowing; the interaction suite checks for horizontal overflow on every screen.

### Workspace shell

`AppShell` stays mounted across workspace pages. Only the page inside it changes, and that page enters with `PageEntrance`. Pages start with a `PageHero`: a photo panel with a title, a subtitle and optional actions or search. Content below either overlaps the hero (`overlap`) or sits under it (`heroBody`).

On phones, the tab pages share one banner: `AppShell` keeps a `PhoneBanner` (photo, theme colour, logo and name) mounted, and each page's `PageHero` draws only its own title, subtitle and controls on top of it. Pages with a hero search (Overview, My properties) are `--phone-hero-height` tall with the search pinned to the bottom, so it sits at the same spot on both; pages without one fit their own header so content starts higher. Each hero reports its height through `PhoneBannerContext`, and the banner glides to it while its photo stays fixed, so the logo and title never move. On a revisit the content below the banner settles in (fade and 6px rise, 260ms). Full-screen task pages (property detail, Add property) keep their own banner.

---

## 4. Components

| Component | Variants and props | Notes |
| --- | --- | --- |
| `Button` | `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg`; `loading`, `fullWidth`; `as={Link}` | Shows a spinner when loading and keeps its width |
| `Badge` | `green`, `red`, `amber`, `blue`, `grey`, `tag`; `sm`/`md`; `dot` | Listing status uses `ListingStatusBadge` |
| `Card`, `CardHeader` | `padded` | The default container, `--radius-lg`, `--shadow-card` |
| `EmptyState` | `icon`, `title`, `description`, `action`, `compact` | Used for empty, error and not-found states; always say what to do next |
| `Skeleton` | `width`, `height`, `radius` | Loading placeholders in the shape of the final content |
| `Input` | `label`, `hint`, `error` | Labels are always visible; hints sit below the field |
| `Menu` | Items with `icon`, `to`/`href`/`onSelect`, `danger`, `separatorBefore` | Row actions and the account menu |
| `ConfirmDialog` | `tone="danger"`, `loading` | Native `<dialog>`; focus is trapped; the title is linked with `useId` |
| `Toast` | `toast.success()`, `toast.error()` | Success closes after 3.5 s, errors after 6 s |
| `PageHero`, `HeroSearch` | `overlap`, `back`, `actions` | Page header with a theme photo |
| `PageSpinner` | none | Full-screen spinner while a page's code loads |
| `RouteError` | `inShell` | Crash and stale-build screen with a Reload button |

### Writing in the UI

- Use plain, friendly sentences: "Couldn't load your properties. Check your connection and try again."
- Use "Active / Draft / Rented / Inactive" for statuses, never the database values.
- Errors say what happened and what to do next. Destructive confirmations say what will be kept ("The original WhatsApp messages are kept.").
- Use curly apostrophes (’) in copy.

---

## 5. Motion

Framer Motion presets live in `shared/motion.ts`. All of them respect `prefers-reduced-motion` through `<MotionConfig reducedMotion="user">` and the CSS media queries.

| Preset | Effect | Use |
| --- | --- | --- |
| `easeOut` | `[0.22, 1, 0.36, 1]` | The default curve for entrances |
| `rise` / `riseAfter(delay)` | Fade in and move up 18px over 0.55 s | Sections, hero text |
| `stagger(gap, delay)` | Reveals children one after another | Hero text, KPI rows, form sections |
| `pop` | Spring scale from 0.97 and move up 26px | KPI and summary cards |
| `listItem` (custom index) | Fade and move up, 60 ms per item, capped at 12 | Property grids and lists |
| `spring` | Stiffness 520, damping 40 | Nav indicator, small UI movement |
| CSS `--ease`, `--dur-fast` (120 ms), `--dur` (180 ms) | | Hovers, colour changes |

Rules:

- **Entrances play once per page load.** `useEntranceInitial()` returns `false` on later visits, so going back to a page doesn't replay its animation.
- On the public page, sections reveal **on scroll** (`whileInView`, once), and the contact bar **springs up after 160px of scroll**, or straight away if the page is too short to scroll that far.
- Animate only `opacity` and `transform`.

---

## 6. Public listing page

`/p/:slug` (and legacy `/:id`) is the page guests see. Its pieces live in `modules/property-site/`.

Two layout rules hold everywhere on this page:

- **The banner has a fixed size.** Its height comes from CSS only (74svh, clamped to 500–680px on phones and 560–780px from 761px up) and it is always full width. The photo and video fill it with `object-fit: cover`, so a taller or differently shaped upload is cropped and never makes the banner bigger.
- **One card, then one continuous page.** Only the summary card (price and key facts) is a rounded, raised container. Every section after it sits directly on the page background with a heading and a hairline divider between sections. Don't put sections in their own boxes, and don't wrap them in extra containers or padding.

The page is made up of:

1. **Hero:** a full-bleed cover photo (or the theme building). When the listing has a video, the first one plays over it muted, looped and without controls, fading in once it starts. It pauses off screen and behind the lightbox, and is skipped for reduced motion, Data Saver, or a video the browser can't decode. The hero also has a brand mark, a Share button, an eyebrow ("For rent" and the property type), the title, the place and a "N photos · N videos" button that opens the full-screen gallery.
2. **Summary card:** price (or "Price on request") with a lakh or crore hint, and chips for whichever terms the listing has: price per sq ft (sales only), maintenance, deposit and availability ("Available immediately", "Move-in: 1st January", or on a sale "Ready to move in" / "Possession: …"), plus a strip of up to four facts (bedrooms, bathrooms, built-up area, furnishing), each an outline icon with a bold value and a grey label, separated by thin vertical lines. The strip sits under the price up to 1023px (two by two on phones when there are four facts) and beside it from 1024px.
3. **Sections:** Gallery first, directly below the summary card (when there's more than one room, a row of room chips such as "All 9", "Kitchen 2" and "Videos 1" filters the grid, scrolling sideways edge to edge on phones; the grid shows up to 5 whole, uncropped photos in justified rows (see item 7) with 10px corners and "+N more" and a room tag in each tile's top-left corner, which is hidden once a room is chosen; the first video always gets a tile, showing its first frame and a play badge), then Property details, About this property (the broker's text, or one written from the details), Amenities, and Location.
4. **Property details:** the complete list, including what the summary card already shows. In order: type; rent ("/month") or asking price; price per sq ft (sales only); maintenance; security deposit; "Available from" (or "Possession" on a sale); bedrooms; bathrooms; built-up and carpet area; furnishing; floor; parking; balconies. After those come the rental terms (preferred tenants, pets allowed, non-veg allowed, lock-in period, notice period, brokerage), then any other extra details the extractor found (facing, water supply…), and the listing date last. Rows without a value are left out. The extractor saves the rental terms in `other` under fixed keys, and only when the broker mentions them.
5. **Location:** the place with an "Open in Maps" link. When the broker shared a Google Maps link (in the extra details, the location or the description), an embedded map is shown above it and "Open in Maps" opens that link. The map is centred on the link's coordinates, otherwise on the place it names, otherwise on the listing's address; shortened `maps.app.goo.gl` links can't be read in the browser, so they use the address. The link itself is left out of Property details.
6. **Contact bar:** Call (`tel:`) and WhatsApp (`wa.me` with a prefilled message that includes the page link). It only appears when there is a phone number: from `get_listing_contact`, or the owner's own number when the owner is viewing.
7. **Gallery (full screen):** a white full-screen page, opened by the hero's "N photos" button and the "+N more" tile. It has a sticky bar (back arrow, "Gallery", Share), a sideways strip of rooms (an 88px-tall thumbnail of each room's first photo at its own width, with its name; tapping one scrolls to that room), then one section per room with a heading and its photos. No photo is cropped, here or in the page's gallery: photos sit in justified rows (`justifiedRows`), each row one height and filled edge to edge, each photo as wide as its shape needs, with 10px corners. A last row under half full joins the row above instead of standing alone as a sliver (so a landscape and a portrait share one line); otherwise a short last row fills the width when it's landscape-shaped overall, and keeps the usual height when it isn't. Rows aim for a sum of aspect ratios of 2 on phones and 3 from 761px. Shapes are read as the photos load (`useMediaRatios`, guessing 4:3, or 16:9 for videos, until then). Tapping a photo opens the lightbox over the gallery, and a floating green "Contact agent" button opens WhatsApp when there's a phone number. The tour lives in `?tour=1`, so Back closes it, and Back from a photo returns to the tour.
8. **Lightbox:** photos are grouped by room in a fixed order (Living room, Bedroom, Bathroom, Kitchen, Balcony, Exterior, any other named room such as Parking, then Others), with the cover leading its room, followed by a "Videos" group. The gallery's room chips use the same order. Opening a photo from a tile grows it out of that tile to full screen (it starts cropped to the tile and expands, 360ms) while the white fades in; opened from a link, it just fades in. Closing mirrors it: the photo shrinks back into the tile showing it (in the tour when that's open) while the white fades out, or fades out when that tile isn't on screen. This plays however it was closed, including the browser's Back, because the page keeps the lightbox mounted until the animation ends. It shows only the photo on white, with 10px corners and a 12px margin on phones (64px from 761px): no bar, counter, room chips or thumbnails, just a round close button in the top-right corner (it fades with the photo when pulled down, and as it closes). Swipe sideways or use the arrow keys to move. Every gesture is handled in script on one strip moved by a transform, not by the browser's own sideways scrolling, because iOS Safari keeps the first tap after a native swipe to itself (it took two taps to close). Dragging the photo down pulls it with the finger while the white fades; letting go past 110px, or flicking, closes it, otherwise it springs back. A tap outside the photo or Escape also closes it. Double-tap or double-click, pinch or Ctrl+wheel zooms up to 4×, and a zoomed photo pans with one finger; Escape resets zoom first. Videos load only on or next to the screen, play when tapped, pause when the guest moves on, and can't be zoomed; if the browser can't decode one (WhatsApp `.3gp`, iPhone HEVC `.mov`) it offers "Open the video" instead. The open photo lives in `?photo=N`, so Back closes the lightbox and a shared link opens on that photo.
9. **States:** a skeleton while loading, "This home is no longer listed" when missing, and "We couldn't load this home" on a network error.
10. **Visibility:** a private listing opens from its link like any other, but the page adds `<meta name="robots" content="noindex">` so search engines leave it out. A public listing's agent row adds a "More homes" button to the broker's page.

### Visibility

Every listing is public or private (`properties.is_public`); new listings start private. Both open from their link for anyone the broker sends it to. Only public listings appear on the broker's page, and only while they're live: on the market, with a price and a photo (`onBrokerPage`). In the workspace a "Public" or "Private" badge sits next to the status on cards, rows and the property page; the property page has a Private / Public switch that explains what each means (and, for a public listing that isn't live, why it isn't showing yet), and each listing's menu has "Make public" or "Make private".

### Broker page (`<subdomain>.findhouse.in`, or `/b/:brokerId`)

Each broker's page lives on their own subdomain, made from their name and changeable in Settings → Public site. That card has a field ending in ".findhouse.in" that tidies what's typed (lowercase, spaces become hyphens) and explains a problem as you type (too short, a character that isn't allowed, reserved, or already taken). Before saving, it warns that links to the old site name stop working while listing links keep working; once saved, it has "Open" and "Copy link". Profile's "Your public page" row shows the address. See `docs/ARCHITECTURE.md` for how the subdomains reach the app.

A band in the theme's hero colour with the brand and a Share button, the broker's initials (or a house), their name, "N homes available", and Call (showing the number) and WhatsApp buttons. Below it, the broker's public, live listings newest first: "All / For rent / For sale" chips when there are both kinds, then cards with the cover (4:3), a "For rent" or "For sale" tag, the price, title, place and up to three facts. One column on phones, two from 640px, three from 1024px. The broker sees "No public listings yet" with a link to their properties when there are none; guests see "No homes listed right now". A missing or inactive broker gets "This agent's page isn't available". Brokers reach their own page from "Your public page" on Profile, or "View your public page" on a public listing.

---

## 7. Accessibility

- Every icon-only button has an `aria-label`; decorative icons are `aria-hidden`.
- Toggle groups use `role="group"` and `aria-pressed`; nav links set `aria-current="page"`.
- Dialogs and the lightbox move focus inside and close on Escape.
- Status changes announce through toasts; result counts use `aria-live="polite"`.
- Keep touch targets at least 40px; focus rings use `--color-ring`.
- When adding a theme, check that text colours meet WCAG AA on their surfaces, especially `--color-fg3` on `--color-surface`.
