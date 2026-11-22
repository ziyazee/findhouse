# FindHouse web app: architecture

This document describes how the broker workspace and the public listing site (`apps/web`) are built. It also records the November 2026 architecture review: what was found, what was changed, and what is still open.

FindHouse turns WhatsApp messages into property listings. A broker sends photos and details to the FindHouse WhatsApp number. Supabase edge functions collect them into a *submission*, and the AI pipeline turns it into a *property* with media. The broker manages properties in the workspace and shares a public page (`/p/:slug`) with guests, who can call or WhatsApp the broker from it.

---

## 1. System overview

| Part | Technology | Where |
| --- | --- | --- |
| Web app (workspace + public site) | React 18, Vite 5, TypeScript (strict), React Router 6 (data router), TanStack Query 5, Zustand, Framer Motion, CSS Modules | `apps/web/src` |
| Media upload/delete API | Cloudflare Pages Function, R2 bucket `MEDIA` | `apps/web/functions/api/upload.ts` |
| Database, RPC, edge functions | Supabase (Postgres, RLS, Deno functions) | `supabase/` |
| Media delivery | R2 public base URL (`VITE_R2_PUBLIC_URL`) | `src/lib/storage.ts` |

Media keys have two owners:

- `submissions/<sessionId>/<messageId>.<ext>`: written by the WhatsApp webhook. The original message and the property's `property_media` row point at the **same object**.
- `properties/<propertyId>/<timestamp>-<random>.<ext>`: written by the dashboard upload API.

Only dashboard uploads may be deleted from storage. Deleting a WhatsApp file would break the original message record.

---

## 2. Audit summary (Phase 1–2)

The review looked at the entire frontend, the upload function, and how the browser talks to Supabase. Findings are listed by severity together with their status after this round of work.

### Critical

| # | Finding | Status |
| --- | --- | --- |
| C1 | **Sign-in is phone-number only and every query runs with the public (anon) key.** Anyone who knows a broker's number can sign in. Count-only probes against the live project confirmed the anon role can read `brokers`, `properties`, `whatsapp_submissions`, `whatsapp_submission_messages` and `property_media`. The UI's broker filter is the only isolation. | **Open, needs a backend change.** See [§7 Auth and RLS migration plan](#7-auth-and-rls-migration-plan). It can't be fixed in the frontend alone without breaking sign-in. |
| C2 | **The upload API accepted any key, type or size**, so anyone could overwrite or delete any object in the bucket, including WhatsApp originals. | **Mitigated.** Keys must match `properties/<uuid>/<safe-name>` (no `..`). Only `image/*` and `video/*` are accepted, up to 50 MB. `DELETE` uses the same key rule, so `submissions/` objects can't be touched. Unit tested. It is still unauthenticated; see C1. |
| C3 | **Deleting a WhatsApp-sourced photo deleted the original message's media.** | **Fixed** on both sides: the client only deletes objects for dashboard uploads (`isDashboardUpload`), and the server rejects any other key. |

### High

| # | Finding | Status |
| --- | --- | --- |
| H1 | `/test/pipeline` was public in production and lists **every broker's** submissions and messages. | **Fixed.** The route and its code exist only in development builds; production falls through to the login page. |
| H2 | A saved session was trusted forever, so a broker who had been **blocked or made inactive stayed signed in**. | **Fixed.** On startup `App` re-checks the broker. If they are missing, blocked or inactive they are signed out, the cache is cleared and a toast explains why. Offline starts keep the session. |
| H3 | Media bugs: every file in a batch became the cover, all shared one `display_order`, insert failures were ignored (leaving orphan files), the spinner could stick, and only the detail page was refreshed. | **Fixed** in `MediaService`: files get sequential order, only the first photo becomes the cover and only when none exists, uploads that fail are cleaned up, failures are reported per file, and every property view is refreshed. |
| H4 | **Editing couldn't clear a field.** The form left empty values out of the payload, so they kept their old value. | **Fixed.** `toPropertyInput` sends `null` for empty fields. Every affected column is nullable with no default, so creates behave the same. |
| H5 | **No error boundary.** A render error or a stale chunk after a deploy showed React Router's developer error screen. | **Fixed.** `RouteError` handles both. Inside the workspace the navigation stays visible; for a stale build it offers a reload. |
| H6 | `npm run lint` was broken (ESLint 9 dropped `--ext`) and there were **no tests**. | **Fixed.** Lint passes with zero warnings allowed; 75 Vitest tests across 12 files. |

### Medium

| # | Finding | Status |
| --- | --- | --- |
| M1 | Data access was spread across components (`MediaGallery`, `useIntake`), and row mappers were typed `any`. | **Fixed.** All reads and writes go through services (`propertyService`, `mediaService`, `submissionService`, `authService`), with typed mappers. |
| M2 | Any error, including network failures, showed as "Property not found" or "This home is no longer listed". | **Fixed.** Services throw on real errors and return `null` only for "not found". Pages show a separate "Couldn't load" state. |
| M3 | Every `useAuth()` caller re-read the session in its own effect, about 10 effects per screen. | **Fixed.** The store loads the session synchronously once; `useAuth` is a plain selector. |
| M4 | Business rules were buried in hooks and pages (portfolio summary, performance metrics, filters, form payload). | **Fixed.** They now live in pure, tested modules. |
| M5 | Duplicated helpers: property types listed twice, view preference read in two places, initials and sign-out written three times. | **Fixed.** Shared modules; `useSignOut` also clears the query cache, so the next broker on the device starts clean. |
| M6 | `ConfirmDialog` used a hard-coded `id`, which would collide if two dialogs were mounted. | **Fixed** with `useId`. |
| M7 | One 679 KB JavaScript bundle, re-downloaded on every deploy. | **Improved.** Libraries are split into long-cached chunks; app code is 41 KB (13.7 KB gzip). |
| M8 | Environment variables were read ad hoc and without types. | **Fixed.** `lib/env.ts` validates the required public values; `vite-env.d.ts` types them. |

### Low

| # | Finding | Status |
| --- | --- | --- |
| L1 | Dead `modules/admin` page. | Removed. |
| L2 | The `*` route showed the login page even to signed-in brokers. | Wrapped in `GuestRoute` (redirects to the dashboard). |
| L3 | Very large files (`PropertySitePage` at 550 lines). | Split into components and a tested content module. |
| L4 | Full-size images used as thumbnails. | Open (needs an image resizing service). |
| L5 | `database.types.ts` is maintained by hand. | Open (generate it with `supabase gen types`). |
| L6 | Login rejected `+91 …` input. | Fixed: `+91`, spaces, dashes and a leading `0` are accepted. |

---

## 3. Target architecture (Phase 3)

The structure is feature-first, with three layers inside each feature and a thin app layer on top. No new libraries were added; Vitest is a dev dependency only.

```
Pages (route components)        compose UI, own page-level state
  └─ Components                 presentational, feature-scoped
       └─ Hooks                 React Query + store wiring (useProperties, useUploadMedia, useSignOut…)
            └─ Services         the only code that talks to Supabase or /api/upload
                 └─ Mappers / models   pure functions: rows ⇄ domain types, form state ⇄ input, metrics
```

Rules:

1. **Only services touch the network.** Components and hooks never import `supabase`. The exceptions are the internal pipeline page (development only) and `shareProperty`, which uses the Web Share API.
2. **Services throw on failure and return `null` only for "not found".** Hooks never swallow errors, so pages can tell "missing" from "broken".
3. **Business rules are pure functions** next to their feature (`portfolioSummary.ts`, `metrics.ts`, `propertyFilters.ts`, `propertyFormModel.ts`, `listingContent.ts`) and each has a test.
4. **React Query keys come from factories** (`propertyKeys`), so a single invalidation of `propertyKeys.all` refreshes lists, details and public pages. Deleting a property invalidates only the lists, so its own page doesn't flash "not found" before it closes.
5. **Client state is small and explicit.** Zustand holds the auth session and toasts. `useSyncExternalStore` stores hold the theme and the properties view, so every screen sees changes immediately.
6. **Only public values reach the browser.** `lib/env.ts` holds the Supabase URL, the publishable key and the media base URL, nothing else.

### Data flow: editing a property

```
PropertyForm (form state) ── toPropertyInput ──► useUpdateProperty ──► propertyService.updateProperty
                                                         │                     └─ toPropertyRow → supabase
                                                         └─ onSuccess: seed detail cache, invalidate propertyKeys.all
```

### Data flow: adding photos

```
MediaGallery ─► useUploadMedia ─► mediaService.upload(propertyId, files, existing)
                                    for each file: validate type/size → newMediaKey → POST /api/upload
                                                   → insert property_media (order, cover) → on insert error delete object
                                  ◄─ { uploaded, failures[] }  → inline error per failed file
```

---

## 4. Folder structure

### Before

```
src/
  brokerPages.ts  router.tsx  main.tsx  vite-env.d.ts  index.css
  lib/            database.types, queryClient, storage, supabase
  modules/
    account/      ProfilePage, SettingsPage
    admin/        AdminDashboardPage (dead)
    auth/         AuthService (+ normalizePhone), AuthStore, guards (+ inline spinner), useAuth (+ effect), LoginPage
    dashboard/    useDashboardData (+ Supabase query + summary maths), DashboardPage
    performance/  PerformancePage (+ metrics maths)
    properties/   PropertyService (any-typed mappers), hooks, listingStatus,
                  components/ (MediaGallery calls Supabase + R2 directly, PropertyForm holds payload logic, …)
    property-site/PropertySitePage (550 lines: page, gallery, lightbox, contact bar, helpers)
    submissions/  SubmissionService, SubmissionMessageService
    test-pipeline/PipelineTestPage (shipped to production)
  shared/         components/, hooks/, motion, theme
```

### After

```
src/
  main.tsx                     mounts <App/>
  app/                         app wiring: App (providers + session check), router, brokerPages, queryClient, RouteError
  lib/                         env (validated public config), supabase client, storage (keys, upload/delete), database.types
  test/fixtures.ts             makeProperty / makeMedia for tests
  modules/
    account/                   ProfilePage, SettingsPage
    auth/                      AuthService (+ brokerAccessError, revalidate), AuthStore, phone, guards, useAuth (+ useSignOut), LoginPage
    dashboard/                 portfolioSummary (pure), hooks/useDashboardData, DashboardPage
    performance/               metrics (pure), PerformancePage
    properties/
      PropertyService          typed property CRUD
      MediaService             upload / cover / delete rules
      propertyMappers          rows ⇄ domain, PROPERTY_SELECT, slug
      propertyFormModel        form state ⇄ input, suggested title, price hint
      propertyFilters          filter state, filtering, status counts
      propertyOptions          type, room, furnishing, parking and amenity choices
      queryKeys                React Query key factory
      viewPreference           list/grid preference store
      listingStatus            derived status (active / draft / rented / inactive)
      hooks/ components/ pages/
    property-site/
      PropertySitePage         route + listing composition
      listingContent           alt text, gallery order, price line, phone, maps & WhatsApp links, fallback description
      components/              Section, PhotoGrid, Lightbox, ContactBar, useScrolledPast, SiteStates
    submissions/               SubmissionService (+ listForBroker), SubmissionMessageService, types (+ IntakeItem)
    test-pipeline/             PipelineTestPage (development builds only)
    enquiries/ help/
  shared/
    format                     capitalize, initials, inr, rupeesInWords
    components/                AppShell, Button, Card, ConfirmDialog, Input, Menu, Motion, PageHero, PageSpinner, Toast
    hooks/ motion theme
functions/api/upload.ts        validated keys, types and sizes (+ upload.test.ts)
```

`modules/` was kept instead of renaming it to `features/`. The rename would touch every import for no functional gain.

---

## 5. Roadmap (Phase 4) and what was done (Phase 5)

| Step | Work | Status |
| --- | --- | --- |
| 1 | Tooling: fix lint, add Vitest, typecheck and test scripts at the app and repo root, characterization tests for `listingStatus` | Done |
| 2 | Security: harden the upload function, protect WhatsApp media, development-only pipeline page, session revalidation | Done |
| 3 | Data layer: typed mappers, `.maybeSingle()` with throw-on-error, `MediaService`, query-key factory, `submissionService.listForBroker` | Done |
| 4 | Bugs: media order and cover, clearing fields, error versus not-found states, error boundary | Done |
| 5 | Logic out of UI: portfolio summary, metrics, filters, form model, shared options and formatting, view preference store | Done |
| 6 | Auth tidy-up: one session load, `useSignOut`, phone normalization, accept `+91` | Done |
| 7 | Structure: `src/app/`, split `PropertySitePage`, remove dead code, move inline styles to CSS where the result is pixel-identical | Done |
| 8 | Performance: vendor chunks | Done |
| 9 | Backend auth and RLS (C1) | Planned, §7 |
| 10 | Thumbnails, generated database types, R2 cleanup on property delete | Backlog, §9 |

---

## 6. Key decisions

- **No visual changes.** Every step was checked with a Playwright screenshot suite: 43 screens covering phone, tablet and desktop, empty states and the public page at four widths, compared pixel by pixel against a baseline. All remaining differences are entrance-animation timing (≤ 0.38% of pixels). An interaction script also checks menus, dialogs, status changes, deletion, horizontal overflow and console errors.
- **New UI exists only where there was none before:** the route error screen, and the "Couldn't load" variants of the property page and the public page. They reuse the existing `Card`/`EmptyState` patterns.
- **Different WhatsApp icon paths were kept.** The login page and the public page use slightly different glyph versions; merging them would change pixels.
- **Only photos become the cover.** A video uploaded first no longer becomes the cover, which the UI never supported.
- **R2 objects are not deleted when a whole property is deleted.** The database cascades the media rows. Removing objects safely needs a server-side job that knows which keys are dashboard uploads; it is listed as debt rather than done in the browser.
- **The session loads synchronously from storage**, so guards no longer flash a spinner. The server check runs in the background and signs the broker out if needed.
- **Login accepts any 10-digit number after `+91`**, not just numbers starting 6–9. That matches the old rule and keeps any existing test accounts working.
- **Vendor chunks rather than lazy-loading the shell.** Guests on the public page need React, the router, Supabase and Framer Motion anyway, so splitting by library gives better caching than splitting by route.

---

## 7. Auth and RLS migration plan

This is the fix for C1. It needs coordinated backend and frontend work, so it was not done as part of a no-behaviour-change refactor.

1. **Real authentication.** Use Supabase Auth phone OTP, or a WhatsApp OTP sent by an edge function that then signs the broker in. Add `brokers.auth_user_id uuid unique references auth.users`.
2. **RLS by owner.** Use `brokers.auth_user_id = auth.uid()`, and through `broker_id` for `properties`, `property_media`, `whatsapp_submissions` and `whatsapp_submission_messages`. Remove every anon `SELECT`/`INSERT`/`UPDATE`/`DELETE` policy on these tables.
3. **Public listing access through definer functions only.** Add `get_public_listing(slug)`, which returns available listings with media and no broker data. Keep `get_listing_contact(listing_id)` from migration 009, which returns the phone only for available listings of `ACTIVE` brokers. Grant both to `anon`.
4. **Upload API.** Require the Supabase JWT, verify it, and check that the broker owns `<propertyId>` before writing or deleting.
5. **Frontend.** `AuthService.login` becomes "send code" and "verify code". `revalidate` becomes `supabase.auth.getSession()` plus the broker status check. `brokerAccessError` stays as it is. Services and pages don't change, because they already go through `propertyService` and `mediaService`.
6. **Rollout.** Ship the new policies alongside the OTP login, and keep the old anon policies for one release behind a flag so existing sessions can move over.

> **Action needed now:** migration `supabase/migrations/009_listing_contact.sql` must be run in the Supabase SQL editor. Until it is, the public page shows the Call and WhatsApp bar only to the broker who owns the listing (owner fallback), because the RPC returns "not found" (PGRST202).
>
> Migration `011_listing_visibility.sql` adds `properties.is_public` (default private) and `get_broker_page(page_broker_id)`, the definer function behind the broker page `/b/:brokerId`. Until it runs, every listing reads as private, the broker page shows "We couldn't load this page", and switching a listing to public fails. Private is about being found, not access: a private listing still opens from its link, and while C1 is open the anon key can read it like any other row.

### Broker sites on subdomains

Each broker's public site is a subdomain of `findhouse.in`: `ravi-homes.findhouse.in` is their page and `ravi-homes.findhouse.in/p/<slug>` each listing. The main domain keeps the workspace, login, and the older `/b/:id` and `/p/:slug` links.

- **Data (migration `012_broker_subdomain.sql`, run after 011):** `brokers.subdomain` is unique, 3 to 32 lowercase letters, digits and hyphens. A trigger fills it from the broker's name (`ravi-kumar-realty`, then `-2`, `-3` … when taken), existing brokers are backfilled oldest first, and renaming a broker doesn't change it. Reserved names (`www`, `app`, `api`, `admin` …) are listed in `is_reserved_subdomain()` and in `RESERVED_SUBDOMAINS` (`lib/siteUrls.ts`); keep the two in step. `get_broker_page(page_broker_id, page_subdomain)` looks a broker up either way; `set_broker_subdomain` changes it (Settings → Public site) and reports invalid, reserved or taken names. Like everything else under C1, it takes the broker id from the client.
- **App:** `lib/site.ts` reads the subdomain from the address once. On a subdomain the router serves only `/` (the broker page) and `/p/:slug`, and sends any other path to the main site. Links are built by `brokerSiteUrl` and `listingSiteUrl`; the workspace gets them from `useMySite()`. With `VITE_SITE_DOMAIN` empty every link stays on the current site, so nothing changes until the domain is set up. With it set:
  - `/b/:id` moves to the broker's subdomain;
  - a main-site listing link moves to its broker's subdomain;
  - a listing opened on another broker's subdomain moves to the main site, so listing links survive a rename. Links to the old broker page don't.
- **Notification:** `process-submission` sends the listing link as a text message with a link preview. The link is on the broker's subdomain when its `SITE_DOMAIN` secret is set and the broker has one (otherwise `APP_URL/p/<slug>`). `send-notification` is no longer called.
- **Link previews:** listing pages are drawn in the browser, so `apps/web/functions/p/[slug].ts` (a Pages Function) adds the listing's name, price ("₹47,000 a month") and cover photo to the HTML as Open Graph tags, which WhatsApp turns into the card. It reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) and `VITE_R2_PUBLIC_URL`, which must be set as environment variables on the Pages project (not only in a local `.env`), and falls back to the plain page when they're missing or the listing isn't found.

> **To switch subdomains on** (after migrations 011 and 012):
> 1. Cloudflare DNS for `findhouse.in`: keep the apex on the Pages project as a custom domain, and add a proxied `CNAME` record `*` pointing to the Pages project's `*.pages.dev` address.
> 2. Deploy the Worker in `infra/broker-sites/` (`npx wrangler deploy` from that folder) after setting `PAGES_ORIGIN` in its `wrangler.toml` to the Pages production address. It serves every `*.findhouse.in` request from the Pages build and sends `www` to the apex.
> 3. In the Pages project's environment variables, set `VITE_SITE_DOMAIN=findhouse.in` and redeploy. In Supabase, set the `SITE_DOMAIN=findhouse.in` secret (and `APP_URL` if the main site isn't `https://findhouse.in`) for `process-submission`.
>
> To try it locally, put `VITE_SITE_DOMAIN=localhost` in `.env.local` and open `http://<subdomain>.localhost:5173` (Chrome and Firefox resolve `*.localhost`; Safari doesn't). The workspace session is stored per address, so a broker is signed out on subdomains.

### WhatsApp free trial

A new number gets one free listing; after that its messages are ignored. `whatsapp-webhook` never replies: the only messages to the broker come from `process-submission`. The rules are in `supabase/functions/_shared/conversation.ts` (`decide`, plus the ready text, tested in `conversation.test.ts` with `npm run test:functions`); the two dashboard bundles carry a copy, so change all three together.

- **Data (migrations `013_broker_trial.sql` and `014_submission_updated_at.sql`, run before deploying the bundles):** `brokers.plan` is `'trial'` or `'paid'`. Brokers who existed when it ran are `paid`; new numbers start as `trial`. `trial_used_at` marks that the free listing is built (a failed build doesn't count). `welcomed_at`, `trial_over_replies`, `last_inbound_message_id`, `last_reply_message_id` and `claim_auto_reply()` are no longer used.
- ***done* always builds:** each WhatsApp message arrives as its own webhook call and photos take longer to save, so *done* can arrive before the messages sent just before it. `waitForSettledSession` waits until the open submission has had no new message for 3 seconds (20 at most), then the submission is closed and `process-submission` is called. If no submission was opened at all, nothing is built. `finalizeSession` only succeeds once, so a repeated *done* can't build the same submission twice.
- **Trial:** every message is kept, including a new number's first one, and *done* builds the listing. While it builds, messages are ignored. `process-submission` marks the trial used, then sends the listing link. If the build fails, nothing is sent and the free listing is not used up.
- **Trial over:** every message is ignored. There is no payment or plan switch yet: to move a broker to paid, set `plan = 'paid'` on their row.
- **Paid:** unchanged.
- **Sign-in:** trial brokers stay `ACTIVE`, so they can sign in to the dashboard with their number like everyone else.

---

## 8. Verification

Run from `apps/web` (or the repo root, which delegates):

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` (`tsc -b`) | Pass, 0 errors |
| Lint | `npm run lint` (zero warnings allowed) | Pass, 0 problems |
| Unit tests | `npm test` | 12 files, 75 tests, all passing |
| Build | `npm run build` | Pass |
| Visual regression | Playwright: 43 screens against the baseline | 0 layout differences; ≤ 0.38% animation-timing noise |
| Interaction | Playwright: menus, dialogs, status changes, delete, overflow, console | Pass, no errors (dev and production builds) |
| Production routing | `/test/pipeline` falls back to login; public page and contact bar render; an offline public page shows "We couldn't load this home" | Pass |

Production bundle (`vite build`):

| Chunk | Size | Gzip |
| --- | --- | --- |
| `index` (app code) | 41.0 KB | 13.7 KB |
| `react` (React, DOM, router) | 207.8 KB | 67.6 KB |
| `supabase` | 228.7 KB | 59.5 KB |
| `motion` (Framer Motion) | 171.9 KB | 58.5 KB |
| `query` (TanStack Query) | 41.0 KB | 12.2 KB |
| Largest page (`PropertySitePage`) | 21.9 KB | 7.6 KB |

Before: one 678.9 KB (206 KB gzip) entry file that changed on every deploy. The total download is about the same; returning visitors now re-download only the 14 KB app chunk and the pages that changed.

What the tests cover:

- Listing status and price formatting.
- Row mappers, including clearing fields and unknown enum values.
- Upload key, type and size rules.
- `MediaService`: order, cover, rejected files, cleanup after a failed insert, the cover-switch order, and protection of WhatsApp media.
- Auth: login lookup, inactive and blocked brokers, revalidation, offline starts and invalid ids.
- Phone normalization.
- Portfolio summary, performance metrics, filters, the form model, listing content and shared formatting.

---

## 9. Remaining technical debt

| Item | Why it matters | Suggested fix |
| --- | --- | --- |
| C1: phone-only login, anon database access | Data from every broker can be read with the public key | §7 |
| Upload API is unauthenticated | Anyone can add files under `properties/` | JWT and ownership check (§7, step 4) |
| R2 objects remain after a property is deleted | Storage cost; files stay reachable by URL | Edge function or database trigger that deletes `properties/<id>/` |
| Full-size images as thumbnails | Slow grids on mobile data | Cloudflare Image Resizing or pre-generated sizes |
| Hand-written `database.types.ts` | Can drift from the schema | `supabase gen types typescript` in CI |
| `PipelineTestPage` (850 lines) still calls Supabase directly and uses inline styles | Development-only, but hard to maintain | Rebuild on the services when it's needed again |
| `PropertyPage.tsx` and `PropertyForm.tsx` are still large (about 250 lines each) | Harder to review | Split the detail sections and form sections into components |
| `tsconfig.*.tsbuildinfo` files are committed | Noise in every diff | Add them to `.gitignore` and remove them from the index |
| No component or end-to-end tests in CI | The Playwright suite lives outside the repo | Move the harness into `apps/web/e2e` with mocked Supabase routes |
