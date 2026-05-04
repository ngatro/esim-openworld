# Active Context: SimPal eSIM Marketplace

## Current State

**App Status**: ✅ SimPal — eSIM Travel Data Marketplace with i18n, Auth, Cart, Admin & Affiliate + Top-up

A full-featured eSIM marketplace built on Next.js 16 with internationalization, user authentication, shopping cart, admin dashboard, affiliate system, and top-up functionality.

## Recently Completed

- [x] **Compact multi-country display**: Changed country list in EsimDataTypeModal from vertical blocks to compact inline chips (flex-wrap layout), reducing vertical space usage for multi-country plans
- [x] **Fix countries.undefined**: Added safe fallback for country name translations across all components (modal heading, PlansCard, plans page, country page) to prevent displaying "countries.undefined" when countryId is missing or translation not found
- [x] **Fix BigInt issue**: Database schema already uses String for iccid columns (not BigInt) - verified by code review
- [x] **Remove FLEXIBLE_TOPUP placeholder**: Fixed order API to remove the fake FLEXIBLE_TOPUP code and use real DB data
- [x] **PayPal flow fix**: Store topupPackageCode in localStorage before redirect, pass to webhook on payment confirm
- [x] **Day selection for flexible top-up**: Added +/- day selector UI (1-30 days) on /topup page for supportTopUpType=3
- [x] **Comprehensive logging**: Added detailed request/response logging to eSIM Access API for debugging
- [x] **Fix Google OAuth userId null**: Updated PayPal webhook PUT handler to use NextAuth session for user identification, ensuring userId is set for Google OAuth users.
- [x] **Fix pending order selectedDuration**: Added top-level `isTopupMode` and `selectedDuration` to order creation requests to preserve top-up data across cancellations.
- [x] **Preserve top-up info in pending orders**:
  - Refactored POST /api/orders to compute `extraDays` directly from duration difference, independent of frontend flag
  - Ensures `topupPackageCode`, `extraDays`, `basePlanDays` are saved correctly
  - Fixed checkout page topup fetch: numeric ID (modal) vs string code (orders page)
  - Added `topupPackageCode` to `createPendingOrder` and `handleDirectCheckout`
  - Pending orders now store complete top-up metadata for accurate resume and pricing
- [x] **Order Update Flow (Cập nhật vs Tạo mới)**:
  - Checkout now creates a pending order BEFORE redirecting to PayPal and stores the pending orderId
  - PayPal webhook PUT accepts `pendingOrderId` and updates the existing pending order instead of creating duplicate
  - Backend logic: if `pendingOrderId` exists → `prisma.order.update()`, else → `prisma.order.create()` (fallback)
  - Eliminates duplicate orders when payment succeeds
  - Pending order ID stored in component state and localStorage for reliability
- [x] **Header Redesign**:
  - Replaced avatar icon with "Welcome, {firstName}" text for logged-in users (desktop)
  - Moved hamburger menu to left side, next to logo (mobile)
  - Added language selector inside mobile menu as a collapsible dropdown (using `<details>`)
  - Hidden language selector on mobile header (desktop only)
  - Added login button visible on mobile header (outside hamburger menu)
  - Removed duplicate login button from mobile menu
  - Added translation keys: `header.welcome`, `header.language` (EN & VI)
- [x] **Fix admin API routes missing getSessionFromRequest**: Added missing `getSessionFromRequest` helper function to admin API routes (users, settings, stats, plans, blog, destinations, webhooks, users/search, orders/gift, promotions) that were calling the undefined function, and added missing `request: Request` parameter to GET functions
- [x] **Full Cart System Implementation**:
  - Created RESTful API endpoints: GET/POST /api/cart, PATCH/DELETE /api/cart/[id]
  - Server-side price validation using Plan table to prevent price manipulation
  - CartProvider now uses SWR for data fetching with caching
  - Implemented optimistic UI updates for instant feedback on add/update/remove
  - Added loading states (isProcessing, isSyncing) for better UX
  - Auto-sync localStorage cart to database on user login with smart merge logic
  - CartModal displays loading skeletons and disables buttons during operations
  - Fixed TypeScript errors in countries and plans APIs
  - Removed unused legacy page file causing module error

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] eSIM plan data + types (`src/lib/esim-data.ts`) — 16 plans, 7 regions
- [x] Header + Footer layout components
- [x] Hero section with stats
- [x] HowItWorks section (4-step process)
- [x] PlansSection with interactive region filter + destination search
- [x] PlanCard UI component
- [x] FAQ accordion section
- [x] Plan detail page at `/plans/[id]` with sticky checkout card
- [x] CTA banner on home page
- [x] **i18n support** - English & Vietnamese with next-intl
- [x] **User authentication** - Login/Register with bcrypt password hashing
- [x] **Database** - Drizzle ORM with SQLite (users, orders, cart items)
- [x] **Shopping cart** - Add/remove items, quantity management
- [x] **Checkout** - Order creation flow
- [x] **User orders** - View order history
- [x] **Admin dashboard** - Plan management page
- [x] **Plans Landing Page** - Converted /plans to landing/lobby page:
  - Removed API fetch for plans (optimize RAM and SEO)
  - Search dropdown now navigates to /esim/[slug] using router
  - Region filter bar converted to Link components
  - Display Top Destinations grid (20 countries) as landing content
  - Quick links to regions below destinations
  - Added loading overlay with spinner for navigation feedback
- [x] **Translation files** - Updated all 4 languages (en.json, vi.json, fr.json, de.json) with complete translations and fixed duplicate keys
- [x] **Admin Gift eSIM** - Admin can give free eSIM plans to users via "Give Free Plan" button in orders page (input packageCode)
- [x] **Affiliate System** - Complete affiliate/referral system with:
  - Cookie-based tracking (30 days)
  - Commission rates by rank (Bronze 5%, Silver 8%, Gold 12%, Diamond 15%)
  - Auto-commission on successful orders
  - User affiliate dashboard with referral link, stats, and withdrawal
  - Admin affiliate management (withdrawals, commission rates)
  - Middleware for referral cookie handling
- [x] **SEO-friendly /esim routes** - Removed rewrite rule in next.config.ts, fixed absolute URL fetches:
  - `/esim/[country]/[slug]/page.tsx` - Plan detail with full UI (image, badges, networks, features)
  - `/esim/[country]/page.tsx` - Country listing (client-side fetch with PlanCard)
  - Fixed fetch URLs to use absolute URLs with NEXT_PUBLIC_APP_URL env var
- [x] **Client-side Faceted Filters** - Added filters to `/esim/[country]/page.tsx`:
  - Fetches all data once, filters in-browser (no API calls per filter)
  - Dynamic dropdown options computed from actual data (only shows available durations/data amounts)
  - Combined filtering with useMemo (e.g., select 7 days + 10GB)
  - Clear filter button, results count display
  - **Dependent Faceted Filters**: options auto-update based on selected filter (no empty results)
  - Mobile-optimized: stacked filters, full-width selects on small screens
- [x] **Unsplash Integration** - Added dynamic Unsplash images for destinations and regions:
  - Added Unsplash API integration in `/api/unsplash` route
  - Added `getValidUrl()` function in `src/lib/unsplash.ts` for URL building
  - Updated DEFAULT_DESTINATIONS with photo IDs from Unsplash
  - Updated DEFAULT_REGIONS with landmark photo IDs (Asia: Tokyo, Europe: Paris, Americas: NYC, Middle East: Dubai, Oceania: Sydney)
  - Cards now display high-quality landmark images instead of emoji icons
- [x] **Destination Management System** - Admin can manage top destinations and regions on /plans page:
  - Database models: `Destination` and `DestinationRegion` in prisma schema
  - API `/api/destinations` - Public fetch for visible destinations/regions
  - API `/api/admin/destinations` - Admin CRUD with image upload
  - Image upload converts JPEG/PNG to WebP automatically using sharp
  - Admin page `/admin/destinations` with full UI (show/hide, image, landmark, priority)
  - `/plans` page now fetches from database with fallback to defaults
- [x] **Hot Plans + minPrice** - Added features for /plans page:
  - **minPrice column in Country table** - Auto-calculated during plan sync (lowest retailPriceUsd)
  - **isHot filter in /api/plans** - Added `?isHot=true` parameter to filter hot plans
  - **Hot Plans section on /plans** - Displays plans where isHot=true from database
  - **Price display** - Uses minPrice from Country table for "From $X.XX" display on destination cards
- [x] **Retail Price for TopupPackages** - Updated pricing system:
  - Added `retailPriceRaw` and `retailPriceUsd` columns to TopupPackage in schema
  - Updated sync logic to save retailPrice from Esimaccess API
- [x] **Top-up Order Handling** - Backend now handles "Cumulative" orders with top-up:
  - Added schema fields: `isTopupMode`, `selectedDuration`, `basePlanDays`, `extraDays`, `topupPackageCode` on Order and OrderItem
  - Order API now calculates price server-side: `FinalPrice = BasePlan.Price + (extraDays * TopupRetailPrice)`
  - Post-payment processing: Base eSIM order → Top-up API call with periodNum → Email confirmation
  - Added retry logic with admin alerts on failed top-ups
  - Checkout UI displays base package + extension days breakdown
  - PayPal integration passes top-up metadata through custom_id
  - **Updated price formula**: Price = BasePlan + (SelectedDays - BaseDays) × TopupRetailPrice
  - Updated frontend (EsimDataTypeModal.tsx) and checkout with new formula
  - Updated order API to calculate correct price on server-side

  - [x] **Sync Topup Packages** - Admin can sync top-up packages from eSIM Access:
    - Button "Sync Topup Packages" in admin dashboard with loading state
    - POST /api/admin/plans handler with action 'sync_topup'
    - Deletes all existing TopupPackage records before sync
    - Filters plans with supportTopUpType === 3 (flexible day-based top-up)
    - Fetches topup packages in batches of 7 with 1s delay (safe for 8 req/s API limit)
    - Uses Promise.allSettled for concurrent processing within each batch
    - Individual try-catch per plan ensures one failure doesn't stop entire sync
    - Error messages collected and displayed in admin UI (up to 5 shown)
    - Saves each topup package with planId reference and updates Plan.topupPackageId
    - Returns synced count, total plans, elapsed time, and any errors
- [x] **Fixed Google OAuth userId issue** - Updated order API to properly extract userId from Google OAuth session
   - Enhanced userId extraction logic in POST /api/orders route
   - Prioritizes session user ID (Google OAuth) > token (legacy) > email lookup
   - Fixes null userId issue when logging in with Google OAuth
   - Fixed variable naming error (customerEmail -> bodyCustomerEmail)

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/[lang]/page.tsx` | Home page (all sections) | ✅ Ready |
| `src/app/[lang]/login/page.tsx` | Login page | ✅ Ready |
| `src/app/[lang]/register/page.tsx` | Registration page | ✅ Ready |
| `src/app/[lang]/cart/page.tsx` | Shopping cart page | ✅ Ready |
| `src/app/[lang]/checkout/page.tsx` | Checkout page | ✅ Ready |
| `src/app/[lang]/orders/page.tsx` | User orders page | ✅ Ready |
| `src/app/[lang]/admin/page.tsx` | Admin dashboard | ✅ Ready |
| `src/app/[lang]/admin/plans/page.tsx` | Admin plan management | ✅ Ready |
| `src/app/plans/page.tsx` | Plans browse page with country search & dynamic filters | ✅ Ready |
| `src/app/affiliate/page.tsx` | User affiliate dashboard | ✅ Ready |
| `src/app/admin/affiliate/page.tsx` | Admin affiliate management | ✅ Ready |
| `src/app/api/auth/` | Auth API routes | ✅ Ready |
| `src/app/api/orders/route.ts` | Orders API | ✅ Ready |
| `src/app/api/affiliate/stats/route.ts` | Affiliate stats API | ✅ Ready |
| `src/app/api/affiliate/withdraw/route.ts` | Withdrawal request API | ✅ Ready |
| `src/app/api/admin/affiliate/route.ts` | Admin affiliate API | ✅ Ready |
| `src/app/api/cart/route.ts` | Cart API (GET, POST) | ✅ Ready |
| `src/app/api/cart/[id]/route.ts` | Cart item API (PATCH, DELETE) | ✅ Ready |
| `src/app/api/countries/search/route.ts` | Country autocomplete search (max 20) | ✅ Ready |
| `src/app/api/countries/[id]/filters/route.ts` | Country dynamic filters API | ✅ Ready |
| `src/db/schema.ts` | Database schema | ✅ Ready |
| `src/lib/auth.ts` | Auth utilities | ✅ Ready |
| `src/lib/affiliate.ts` | Affiliate logic (commission rates, tracking) | ✅ Ready |
| `src/lib/referral-tracking.ts` | Referral cookie handling | ✅ Ready |
| `src/middleware.ts` | Referral cookie middleware | ✅ Ready |
| `src/components/providers/AuthProvider.tsx` | Auth context | ✅ Ready |
| `src/components/providers/CartProvider.tsx` | Cart context with SWR, optimistic UI | ✅ Ready |
| `src/components/ui/LanguageSwitcher.tsx` | Language switcher | ✅ Ready |
| `messages/` | Translation files | ✅ Ready |

## Database Schema

- **users**: id, name, email, password, role, createdAt, affiliateCode, affiliateBalance, rank, referredById
- **orders**: id, userId, totalAmount, status, createdAt, isTopupMode, selectedDuration, basePlanDays, extraDays, topupPackageCode
- **orderItems**: id, orderId, planId, planName, price, quantity, extraDays, topupPackageCode, basePlanDays
- **cartItems**: id, userId, planId, planName, price, quantity, createdAt
- **commissions**: id, referrerId, buyerId, orderId, amount, percentage, rank, status, createdAt
- **withdrawals**: id, userId, amount, paymentMethod, paymentDetails, status, createdAt
- **topupPackages**: id, planId, packageCode, name, priceUsd, retailPriceUsd, isFlexible, isActive
- **destinations**: id, name, slug, emoji, landmark, imageUrl, isVisible, priority
- **destinationRegions**: id, name, emoji, imageUrl, isVisible, priority

## Affiliate Commission Rates

| Rank | Commission Rate | Threshold |
|------|-----------------|------------|
| Bronze | 5% | Default |
| Silver | 8% | $50+ earnings |
| Gold | 12% | $200+ earnings |
| Diamond | 15% | $500+ earnings |

## Current Focus

- Add real payment integration (Stripe)
- Add email notifications

## Security Fixes Applied (2026-04-10)

- Added admin role verification in `/api/admin/affiliate` route
- Commission creation wrapped in try-catch to not fail order
- Disabled wallet top-up (return 501 - requires payment gateway)
- Added paymentDetails validation in withdrawal API
- Replaced alert() with state-based UI feedback in affiliate page

## Changes (2026-04-11)

- Removed wallet top-up functionality completely
- Wallet balance can only be increased via affiliate commissions
- Updated wallet page to show only affiliate earnings
- Kept withdrawal functionality (PayPal Payouts API pending)

## Changes (2026-04-19)

- **Optimized Sync Process** - Implemented 3 solutions:
  1. **Background Task**: Backend returns immediately with `{status: "started"}` and runs sync in background fire-and-forget pattern
  2. **Promise.all**: Used for parallel DB operations (regions + countries upsert in single Promise.all call)
  3. **Reduced Polling**: Changed from 200ms to 1000ms polling interval in admin dashboard to decrease server load

## Changes (2026-05-02)

- **Fixed Next.js 16 async params type errors** in `src/app/[lang]/layout.tsx` - Updated `generateMetadata` to use `Promise<{ lang: string }>` with `await` for resolving `lang`, ensuring TypeScript compatibility with Next.js 16's async server component params.

## Quick Start Guide

### Routes use locale:
- `/en/` - English
- `/vi/` - Vietnamese

### To add a new page:
Create a file at `src/app/[locale]/[route]/page.tsx`

### To add API routes:
Create `src/app/api/[route]/route.ts`

### Referral Link Format:
`?ref=AFFILIATE_CODE` - Cookie tracks for 30 days

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Session History
  
| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-03-22 | Built SimPal eSIM travel marketplace |
| 2026-03-22 | Added i18n (English/Vietnamese), auth, cart, admin dashboard |
| 2026-04-05 | Enhanced plans page with search dropdown, dynamic filters, display limit |
| 2026-04-05 | Added country search with autocomplete + dynamic data/duration filters |
| 2026-04-10 | Added complete Affiliate system with cookie tracking, commission by rank, dashboard, withdrawals, admin management |
| 2026-04-13 | Added client-side dependent faceted filters to /esim/[country] + converted /plans to landing page + Unsplash images for destinations and regions |
| 2026-04-21 | Added Sync Topup Packages feature - Admin can sync top-up packages with batching and rate limiting |
| 2026-04-22 | Fixed top-up issues: removed FLEXIBLE_OP placeholder, added day selection UI, comprehensive eSIM API logging, PayPal flow topupPackageCode tracking |
| 2026-04-23 | Refactored PlansCard & EsimDataTypeModal: 
  - Moved all calculation logic from EsimDataTypeModal to PlansCard
  - Page.tsx now manages state with activeConfig to store calculation results from PlansCard
  - EsimDataTypeModal receives config from PlansCard via page state, allows data/duration selection with interactive buttons
  - Added detailed plan information display (speed, network type, coverage, IP export, SMS status, activation type, validity period, top-up support, badges, popular/best-seller/hot flags) |
| 2026-04-28 | Fixed Google OAuth userId issue in order API - Enhanced userId extraction logic to prioritize session user ID (Google OAuth) > token (legacy) > email lookup, fixing null userId when logging in with Google OAuth |
| 2026-04-29 | Fixed pending order top-up preservation: order API now computes extraDays directly, saves topupPackageCode, basePlanDays, extraDays; checkout fetch handles both ID and code; ensures correct pricing on resume |
| 2026-04-29 | Implemented order update flow: Checkout creates pending order before PayPal redirect, stores pendingOrderId; PayPal webhook updates existing pending order instead of creating duplicate, eliminating duplicate orders |
| 2026-04-29 | Header redesign: replaced avatar with Welcome text, moved hamburger to left, added mobile language dropdown, mobile login button, removed duplicate login from mobile menu |
| 2026-04-30 | Full cart system: API routes with validation, SWR integration, optimistic UI, localStorage sync on login, loading states in CartModal |
| 2026-05-01 | Fixed language switching URL updates: Updated Header.tsx to use usePathname() hook instead of router.pathname for proper Next.js 16 App Router compatibility. LanguageSwitcher.tsx and middleware.ts already correctly handle language prefix updates. Verified with comprehensive tests. |
| 2026-05-03 | Multi-country plan display + operator info in EsimDataTypeModal + admin link locale prefix |
   - Fixed admin link in Header.tsx to include locale prefix (`/${locale}/admin` instead of `/admin`) so admin dashboard is accessible with proper i18n routing
   - Added country coverage and operator display to EsimDataTypeModal.tsx:
     - Parses `locationNetworkList` JSON to extract country codes, names, and operator details (operatorName, networkType)
     - Shows all countries covered by multi-country plans (coverageCount >= 2) with their supported operators
     - Shows all operators for single-country plans (coverageCount === 1)
     - Uses i18n translation for country names (falls back to country code if not found)
   - Added `networkList` and `locationsList` state to track parsed location/operator data
   - Added `useEffect` to parse locationNetworkList and locations whenever `basePlan` changes
| 2026-05-03 | Compact multi-country display: Changed country list from vertical blocks to inline flex-wrap chips in EsimDataTypeModal (src/app/[lang]/esim/[country]/EsimDataTypeModal.tsx:275-300), reducing vertical space for multi-country plans showing 10+ countries |
| 2026-05-03 | Fixed countries.undefined bug: Added safe fallback for country name translations in 4 files:
   - EsimDataTypeModal.tsx (heading and network list)
   - PlansCard.tsx (card title)
   - src/app/[lang]/esim/[country]/page.tsx (page heading)
   - src/app/[lang]/plans/page.tsx (destination card title)
  Now when countryId is undefined or translation missing, displays fallback (countryId, destination name, or "Unknown") instead of raw key "countries.undefined".
| 2026-05-04 | Added locale parameter to API routes for proper internationalization in return URLs:
    - PayPal route: Added locale to success/cancel URLs (required from client)
    - Forgot Password route: Added locale to reset URL (required from client)
    - LemonSqueezy route: Added locale to success URL (required from client)
    - Reset Password route: Added locale to response (required from client)
    - Topup page: Added locale parameter to PayPal call
    - Checkout page: Added locale parameter to PayPal call
