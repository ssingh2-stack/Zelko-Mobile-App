# Clipd — Product Bible

*Last updated: April 5, 2026*

---

## Table of Contents
1. [Product Overview](#product-overview)
2. [Architecture](#architecture)
3. [Feature Log](#feature-log)
4. [Changelog](#changelog)
5. [Roadmap](#roadmap)
6. [Tech Stack](#tech-stack)
7. [Infrastructure & Costs](#infrastructure--costs)
8. [Competitor Landscape](#competitor-landscape)
9. [Key Decisions](#key-decisions)

---

## Product Overview

**What is Clipd?**
The booking and management platform built specifically for barbershops. Barbers get a mobile app + web dashboard to run their business. Their clients get a simple booking link — no app download required.

**Target market:** Independent barbershops in Canada (Toronto-first), 1-10 chairs.

**Pricing:**
- Essentials: $29/mo (up to 3 barbers)
- Pro: $49/mo (unlimited barbers)
- 14-day free trial, no credit card required
- Payment processing: 2.7% + $0.05 per transaction (Stripe)

**Key differentiators:**
1. Built for barbershops, not salons or spas
2. No client app required — customers book via web link
3. $29/mo starting price (vs $50-100+ competitors)
4. Mobile app for barbers (iOS, submitted to App Store)
5. Commission/rent tracking built in

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Marketing Site  │     │   Flask Backend   │     │   Mobile App    │
│  getclipd.ca     │     │  app.getclipd.ca  │     │  iOS (Expo)     │
│  Cloudflare      │     │  Railway          │     │  App Store      │
│  Workers         │     │  SQLite           │     │  React Native   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
              ┌─────┴──┐ ┌───┴───┐ ┌───┴────┐
              │SendGrid│ │Stripe │ │Cloudflare│
              │Email   │ │Pay    │ │R2 Media │
              └────────┘ └───────┘ └─────────┘
```

**Repos:**
- `clipd` — Flask backend + web admin + booking flow (GitHub → Railway)
- `clipd-app` — React Native iOS app (GitHub → EAS Build → App Store)
- `clipd-site` — Marketing website (GitHub → Cloudflare Workers)

---

## Feature Log

### Customer-Facing Booking

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | Online booking page | Live | 4-step wizard at app.getclipd.ca/book/[slug] |
| 2 | Per-barber booking | Live | Choose specific barber or "Any Available" |
| 3 | Per-barber service menus | Live | Each barber shows only their assigned services |
| 4 | Real-time slot availability | Live | Checks existing bookings, blocks, availability, duration |
| 5 | Working day awareness | Live | Calendar grays out barber's off days |
| 6 | Waitlist | Live | Join waitlist when no slots available, email notification |
| 7 | Customer prefill | Live | Returning clients auto-fill from localStorage |
| 8 | Google Calendar add | Live | One-tap add from confirmation page |
| 9 | Booking confirmation page | Live | Shows confirmation code + details |
| 10 | Deposit/payment at booking | Live | Stripe Checkout for deposit or full prepay |
| 11 | Reschedule link | Live | Self-service reschedule from email |
| 12 | Cancel link | Live | Self-service cancel from email |
| 13 | QR code | Live | SVG QR code for booking link |
| 14 | Per-barber booking links | Live | Each barber gets their own shareable URL |
| 15 | Loading skeleton | Live | Placeholder cards while barbers load |
| 16 | Address autocomplete | Live | Google Places API on shop address |

### Email Communications

| # | Email | Trigger | Recipient |
|---|-------|---------|-----------|
| 1 | Booking confirmation | Immediately after booking | Client |
| 2 | New booking alert | Immediately after booking | Shop owner + barber |
| 3 | 24-hour reminder | 24h before appointment | Client |
| 4 | Cancellation notice | When booking cancelled | Client |
| 5 | Cancellation alert | When booking cancelled | Barber |
| 6 | Review request | After appointment (once per customer per shop) | Client |
| 7 | Staff invite | When owner sends invite | Barber |
| 8 | Waitlist notification | When spot opens | Waitlisted client |
| 9 | Welcome email | After shop signup | Shop owner |

### Admin Dashboard — Today

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Day calendar view | Live | App + Web |
| 2 | Service color-coding | Live | App + Web |
| 3 | Service color legend | Live | App + Web |
| 4 | List view with swipeable cards | Live | App |
| 5 | Stats strip (bookings, revenue, no-shows) | Live | App + Web |
| 6 | Occupancy bar | Live | App |
| 7 | Payment breakdown (cash/card/unpaid) | Live | App + Web |
| 8 | Next Up card | Live | App |
| 9 | End-of-day summary | Live | App |
| 10 | Client notes on booking cards | Live | App |
| 11 | Client tags on booking cards | Live | App |
| 12 | Barber filter | Live | App + Web |
| 13 | Setup nudge | Live | App |
| 14 | Block time (15m–4h with reason) | Live | App + Web |
| 15 | New booking modal | Live | App + Web |
| 16 | Walk-in toggle | Live | App + Web |
| 17 | Recurring bookings | Live | App + Web |
| 18 | Client search in new booking | Live | App + Web |

### Admin Dashboard — Schedule

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Day navigation (arrows + swipe) | Live | App + Web |
| 2 | Week-at-a-glance view | Live | App |
| 3 | Search bookings by name/phone | Live | App |
| 4 | Closed day card | Live | App |
| 5 | Before/after hours bands | Live | App |
| 6 | Drag-and-drop reschedule | Live | Web + App (long-press) |

### Admin Dashboard — Booking Detail

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Full booking details | Live | App + Web |
| 2 | Payment status badge | Live | App + Web |
| 3 | Edit booking (service/time) | Live | App + Web |
| 4 | Reschedule | Live | App + Web |
| 5 | Reconfirm cancelled bookings | Live | App + Web |
| 6 | Mark as Paid (cash/card + tip) | Live | App + Web |
| 7 | No-show | Live | App + Web |
| 8 | Cancel | Live | App + Web |
| 9 | Client history + lifetime spend | Live | App + Web |
| 10 | Private notes | Live | App + Web |

### Admin Dashboard — Clients

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Client list with search | Live | App + Web |
| 2 | Tag filters (VIP/New/Regular/Lapsed) | Live | App + Web |
| 3 | Sort (A-Z/Recent/Visits/Spent) | Live | App |
| 4 | Client profile modal | Live | App + Web |
| 5 | VIP toggle | Live | App + Web |
| 6 | New booking from profile | Live | App |
| 7 | Call/text actions | Live | App |

### Admin Dashboard — Insights

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Period selector (week/month/last month/year/all) | Live | App + Web |
| 2 | KPI cards (revenue, bookings, avg value, cancel rate) | Live | App + Web |
| 3 | Period-over-period trend arrows | Live | App + Web |
| 4 | Revenue bar chart (daily/weekly) | Live | App + Web |
| 5 | Barber performance dashboard | Live | App + Web |
| 6 | Service breakdown | Live | App + Web |
| 7 | Period clients list | Live | App |
| 8 | Upcoming 7 days | Live | App + Web |

### Admin Dashboard — Services

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Add service (name/duration/price/description) | Live | App + Web |
| 2 | Inline edit | Live | App + Web |
| 3 | Delete service | Live | App + Web |
| 4 | Reorder (up/down arrows + drag) | Live | App + Web |

### Admin Dashboard — Team

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Add barber (name + email) | Live | App + Web |
| 2 | Remove barber | Live | App + Web |
| 3 | Photo upload | Live | App + Web |
| 4 | Bio/years/Instagram editing | Live | App + Web |
| 5 | Email/phone editing | Live | App |
| 6 | Per-barber working hours | Live | App + Web |
| 7 | Per-barber service toggles | Live | App + Web |
| 8 | Staff invite | Live | App + Web |
| 9 | Stripe Connect status | Live | App |

### Admin Dashboard — Compensation

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Earnings summary with period selector | Live | App + Web |
| 2 | Commission split plans | Live | App + Web |
| 3 | Tiered split plans | Live | App + Web |
| 4 | Chair rent plans | Live | App + Web |
| 5 | Assign plans to barbers (inline) | Live | App + Web |
| 6 | Pay period config (weekly/biweekly/monthly) | Live | App + Web |
| 7 | Tips tracking in earnings | Live | App |
| 8 | Cash/card breakdown in earnings | Live | App |

### Admin Dashboard — Settings

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Shop info (name/address/phone/email/Google Review) | Live | App + Web |
| 2 | Address autocomplete (Google Places) | Live | App |
| 3 | Logo upload | Live | App + Web |
| 4 | Business hours (per-day toggle + times) | Live | App + Web |
| 5 | Change password | Live | App + Web |
| 6 | Logout | Live | App + Web |

### Admin Dashboard — Share

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Booking URL display + share | Live | App + Web |
| 2 | QR code (SVG, offline) | Live | App + Web |
| 3 | Ready-to-send message | Live | App + Web |
| 4 | Per-barber links | Live | App + Web |

### Admin Dashboard — Payments

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Connect/disconnect Stripe | Live | App + Web |
| 2 | Payment toggle (enable/disable) | Live | App + Web |
| 3 | Payment type (deposit/full) | Live | App + Web |
| 4 | Deposit amount config | Live | App + Web |

### Staff Portal

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Staff login | Live | App + Web |
| 2 | Personal day calendar | Live | App + Web |
| 3 | 7-day strip navigation | Live | App |
| 4 | List view with swipeable cards | Live | App |
| 5 | Daily stats (bookings + revenue) | Live | App + Web |
| 6 | Block time | Live | App + Web |
| 7 | No-show/cancel actions | Live | App + Web |

### Onboarding & Auth

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Admin login (slug + password) | Live | App + Web |
| 2 | Staff login (email + password) | Live | App + Web |
| 3 | Sign up (create shop from app) | Live | App |
| 4 | Onboarding wizard (6 steps) | Live | App |
| 5 | Multiple barbers in onboarding | Live | App |
| 6 | Multiple services in onboarding | Live | App |
| 7 | Trial expiry screen (directs to web) | Live | App |
| 8 | Setup nudges for incomplete config | Live | App |

### Security & Infrastructure

| # | Feature | Status |
|---|---------|--------|
| 1 | Bcrypt password hashing (with SHA256 migration) | Live |
| 2 | Rate limiting (10/15min login, 5/15min signup, 200/min global) | Live |
| 3 | CSRF protection on all web forms | Live |
| 4 | Security headers (HSTS, nosniff, X-Frame, XSS, Referrer) | Live |
| 5 | Session security (Secure + HttpOnly + SameSite + 7-day TTL) | Live |
| 6 | Input validation middleware (size limits + JSON check) | Live |
| 7 | Audit logging (logins, failures, booking changes, passwords) | Live |
| 8 | API timeout (15s with clear error message) | Live |
| 9 | Offline caching (stale-while-revalidate) | Live |
| 10 | Error states with retry button | Live |
| 11 | Booking overlap prevention (3 layers) | Live |
| 12 | Trial system (14-day, time-limited) | Live |

### UI/UX Polish

| # | Feature | Status | Platform |
|---|---------|--------|----------|
| 1 | Loading skeletons (replaces all spinners) | Live | App |
| 2 | Haptic feedback (cancel, no-show, confirm) | Live | App |
| 3 | Toast notifications | Live | App |
| 4 | Pull-to-refresh on all screens | Live | App |
| 5 | Ionicons throughout (zero emoji in UI) | Live | App |
| 6 | Service color system (8 warm muted colors) | Live | App + Web |
| 7 | Block gap (6px visual separation) | Live | App + Web |
| 8 | Booking tap fix (detail vs slot menu) | Live | App |
| 9 | Swipeable booking cards | Live | App |
| 10 | KeyboardAvoidingView on all modals | Live | App |
| 11 | Branded splash screen | Live | App |
| 12 | White app icon with Clipd wordmark | Live | App |
| 13 | Barber name on booking blocks (when "All" view) | Live | App |
| 14 | Content centering on taller booking blocks | Live | App |
| 15 | Progressive content based on block height | Live | App |

### Marketing Site (getclipd.ca)

| # | Feature | Status |
|---|---------|--------|
| 1 | Hero with live mockup (Crown & Blade) | Live |
| 2 | "Try a live booking" card | Live |
| 3 | Interactive preview (type shop name) | Live |
| 4 | Client journey (4 steps) | Live |
| 5 | How it works (4 steps) | Live |
| 6 | Barber viral flywheel section | Live |
| 7 | Persona selector (Solo/Owner/Growing Team) | Live |
| 8 | Pricing (Essentials + Pro) | Live |
| 9 | FAQ (6 questions) | Live |
| 10 | Signup form | Live |
| 11 | Final CTA | Live |
| 12 | Privacy policy (with mobile app section) | Live |
| 13 | Terms of service | Live |
| 14 | Animated booking demo | Live |
| 15 | Exit-intent popup | Live |
| 16 | Mobile CTA bar | Live |

---

## Changelog

### April 2026
- Submitted to Apple App Store (pending review)
- Payment system: mark as paid, tips, payment status badges
- Compensation system: commission splits, tiered plans, chair rent
- Marketing site overhaul: removed salon positioning, honest features, Essentials/Pro pricing
- Email polish: shop logos, warmer cancellation, one review per customer
- Booking flow polish: loading skeleton, initials avatars, no hardcoded data
- Full demo seed with 60 clients, 90 days past data, notes, VIPs, lapsed clients
- Security hardening v2: CSRF, input validation, audit logging

### March 2026
- iOS app built from scratch (React Native / Expo)
- Full admin dashboard: Today, Schedule, Clients, Insights
- Onboarding wizard with sign-up flow
- DayCalendarView component with service colors, barber columns
- Booking CRUD: create, edit, cancel, no-show, reschedule, recurring
- Client management with profiles, notes, VIP tagging
- Team management with availability, services, photos, invites
- Insights with KPIs, trends, revenue chart, barber performance
- Offline caching, error states, loading skeletons
- Security hardening v1: bcrypt, rate limiting, security headers
- EAS Build configured, TestFlight working
- Branded splash screen and app icon

---

## Roadmap

### Now (Shipped / In Review)
- [x] iOS App Store submission
- [x] Payment tracking (cash/card/tips)
- [x] Compensation plans
- [x] Email polish
- [x] Booking flow polish
- [x] Marketing site overhaul

### Next (Post-Launch)
- [ ] **First paying customer** — outreach to Toronto barbershops
- [ ] **Stripe in-person payments** — M2 reader integration for tap-to-pay at the chair
- [ ] **Automated commission payouts** — Stripe Transfer to barber bank accounts
- [ ] **Walk-in queue** — dedicated walk-in flow with estimated wait times
- [ ] **Service add-ons** — "add beard trim to this haircut" at booking
- [ ] **Real testimonials** — add customer quotes to marketing site
- [ ] **App Store screenshots** — update after Apple approval

### Later (Growth Features)
- [ ] **SMS reminders** — Twilio integration for text message reminders
- [ ] **Push notifications** — new booking alerts on the mobile app
- [ ] **Staff shift management** — work schedules with breaks and time-off
- [ ] **Multi-location support** — switch between shops
- [ ] **Google Calendar sync** — two-way sync for barbers
- [ ] **Intake forms** — custom questions for new clients
- [ ] **Android app** — same codebase, EAS Build for Android
- [ ] **Referral program** — shop-to-shop referral credits

### Future (Scale)
- [ ] **White-label** — remove Clipd branding for enterprise
- [ ] **API access** — let shops integrate with their own tools
- [ ] **Franchise management** — multi-location dashboard for chains
- [ ] **Product/inventory tracking** — pomade, oil, shampoo sales
- [ ] **Membership/packages** — unlimited cuts monthly, buy 5 get 1 free

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend** | Python / Flask | Single app.py (~3000 lines) |
| **Database** | SQLite | On Railway, file-based |
| **Mobile app** | React Native / Expo SDK 54 | Managed workflow, EAS Build |
| **Web admin** | Jinja2 templates + vanilla JS | Single admin.html (~4500 lines) |
| **Marketing site** | Static HTML/CSS/JS | Cloudflare Workers |
| **Email** | SendGrid | Transactional via API |
| **Payments** | Stripe Connect | Deposits, platform splits |
| **Media storage** | Cloudflare R2 | Barber photos, shop logos |
| **Hosting** | Railway | Auto-deploy from GitHub |
| **CDN/DNS** | Cloudflare | getclipd.ca + Workers |
| **Monitoring** | UptimeRobot | Uptime alerts |
| **App builds** | EAS Build (Expo) | iOS preview + production |
| **App distribution** | TestFlight / App Store | Apple Developer Program |

---

## Infrastructure & Costs

| Service | What | Cost (CAD/mo) |
|---------|------|---------------|
| Anthropic (Claude Code) | AI development | ~$140-280 |
| Railway | Backend hosting | ~$7-21 |
| GitHub | Code repos (3) | $0 |
| SendGrid | Transactional email | $0 (free tier) |
| Cloudflare R2 | Image storage | $0 (free tier) |
| UptimeRobot | Uptime monitoring | $0 (free tier) |
| Google Cloud | Places API | $0 ($280/mo credit) |
| Expo / EAS | iOS builds | $0 (free tier) |
| Apple Developer | App Store | ~$12/mo ($139/yr) |
| Domain (getclipd.ca) | Domain name | ~$1.50/mo (~$18/yr) |
| **Total** | | **~$160-315/mo** |

---

## Competitor Landscape

| Feature | Clipd | Booksy | Square | Fresha |
|---------|-------|--------|--------|--------|
| Monthly price | $29-49 | $30-50 | $0-65 | Free (takes %) |
| Client app required | No | Yes | No | Yes |
| Built for barbers | Yes | Yes | No (generic) | No (generic) |
| Commission tracking | Yes | No | No | Yes |
| Mobile app (barber) | Yes | Yes | Yes | Yes |
| Walk-in queue | Not yet | Yes | No | Yes |
| Service add-ons | Not yet | Yes | Yes | Yes |
| In-person payments | Not yet | Yes | Yes | Yes |

---

## Key Decisions

| Decision | What We Chose | Why |
|----------|---------------|-----|
| No customer app | Web-only booking link | Don't force clients to download an app (unlike Booksy) |
| No in-app purchases | Subscriptions via web only | Avoid Apple's 30% cut |
| No salon positioning | Barbershops only | Focus beats breadth at our stage |
| No free forever plan | 14-day trial → paid | Every user should be a paying customer |
| SQLite over Postgres | Single-file database on Railway | Simplicity, zero config, fast enough for v1 |
| Expo managed workflow | No native modules needed | Faster development, EAS Build handles signing |
| Stripe over alternatives | Connect for splits, familiar API | Best platform support, barbers can receive payouts |
| Bcrypt over SHA256 | Industry standard, salted | SHA256 was the original, migrated for security |
| Service colors over barber colors | Color = service type | Barber identity is the column, service is the color — one system not two |

---

*This document is the single source of truth for Clipd's product. Update it when features ship, decisions change, or priorities shift.*
