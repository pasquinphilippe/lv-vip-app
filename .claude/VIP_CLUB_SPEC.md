# Luc Vincent VIP Club - Technical Specification

## Overview

The VIP Club is a **subscription-first** membership program with **integrated loyalty points**. Members subscribe to a tier, receive exclusive benefits, and earn points on all purchases that can be redeemed for freebies.

**Key Principles:**
- Subscription tiers (LITE, CLUB, CLUB+) define your membership level
- Loyalty points are a **benefit within** tiers, not the tier system itself
- Points are shared across both Coloration Pro and Haircare sites
- $1 first box for new CLUB/CLUB+ subscribers
- 4/5/6 week cadence options

---

## Tier Structure

### VIP LITE — $0/month (Freemium)

**Target:** Convert retail shoppers into DTC members

| Benefit | Details |
|---------|---------|
| Academy Access | Basic tutorials, guides, routines |
| Points Multiplier | **1.5×** on all purchases |
| Member Coupons | 10% off select products monthly |
| Early Access | New product drops |
| Community | VIP-only group access |
| Sample Drops | 2× per year (mailed with purchase) |
| Partner Deals | Quebec beauty brands discounts |

**No monthly box** — upgrade path to CLUB

---

### VIP CLUB — $1 first box, then $49/cycle

**Target:** Core recurring subscription product

| Benefit | Details |
|---------|---------|
| Monthly Box | 2-4 full-size products + accessory + samples |
| Cadence | Choose 4, 5, or 6 weeks |
| Routine Choice | 6 personalized routine types |
| Points Multiplier | **2.0×** on all purchases |
| Academy Access | Full access to all content |
| Shipping | Free on boxes over $69 |
| Flexibility | Swap, skip, or pause anytime |
| VIP Events | Access to member-only events |
| Birthday Perk | Free gift during birthday month |

**Pricing:**
- First box: **$1.00** (promotional)
- Regular: **$49.00** per cycle
- Shipping: $9.95 (free if box + add-ons > $69)

---

### VIP CLUB+ — $79/cycle (Premium)

**Target:** Maximize LTV for superfans

| Benefit | Details |
|---------|---------|
| Larger Box | 4-6 items per box |
| Points Multiplier | **3.5×** on all purchases |
| FREE Shipping | Always, on everything |
| VIP-Only Products | Limited editions, exclusive scents |
| Luc's Lab Preview | Quarterly unreleased formulas |
| Premium Accessories | Salon-quality tools |
| Priority Support | VIP hotline, faster response |
| Exclusive Events | Meet Luc, styling workshops |
| Founder's Letter | Personal note in seasonal boxes |

**Pricing:**
- First box: **$1.00** (promotional)
- Regular: **$79.00** per cycle
- Shipping: **Always FREE**

---

## Routine Types (Box Contents)

Members choose their routine when subscribing:

### 1. Color Care Maintenance
*For: Highlighted, blonde, grey, or tinted hair*
- Sans Yellow Shampoo
- Sans Yellow Conditioner
- Repair Mask (Hydration)
- Leave-In Treatment
- Accessory: Sectioning clips or mini brush
- Insert: "How to eliminate brassiness"

### 2. Hydration & Repair
*For: Damaged, dry, brittle hair*
- Hydra Shampoo
- Hydra Conditioner
- Repair Mask
- Heat Protector Spray
- Accessory: Microfiber turban
- Insert: "30-Day Repair Program"

### 3. Volume + Anti-Frizz
*For: Fine hair, frizz, humidity-prone*
- UP! Volume Shampoo
- UP! Conditioner
- Styling Mousse or Texture Spray
- Anti-Frizz Serum
- Accessory: Wide-tooth comb
- Insert: "How to style for volume"

### 4. Scalp Health
*For: Flaky, itchy, irritated scalps*
- Stay Clean Shampoo
- Repair Conditioner
- Scalp Cooling Serum
- Hair & Scalp Oil
- Accessory: Silicone scalp scrubber
- Insert: "Healthy scalp reset"

### 5. Everyday Essentials
*For: Those who don't need specialty care*
- Everyday Shampoo
- Everyday Conditioner
- Leave-In
- Heat Protectant
- Accessory: Micro towel or comb
- Insert: "Your everyday routine"

### 6. Luc's Discovery Box
*Surprise curation that rotates monthly*
- 3-5 curated full-size products
- New formula test sample
- Seasonal accessory
- Partner discount
- Insert: "Why Luc chose this month's items"

---

## Cadence Options

| Option | Days | Best For |
|--------|------|----------|
| 4 weeks | 28 days | Heavy users, color maintenance |
| **5 weeks** | 35 days | Default, optimal balance |
| 6 weeks | 42 days | Light users, best retention |

Members can change cadence anytime from their portal.

---

## Points System

### Earning Points

| Action | Base Points | LITE (1.5×) | CLUB (2×) | CLUB+ (3.5×) |
|--------|-------------|-------------|-----------|--------------|
| $1 spent | 1 pt | 1.5 pts | 2 pts | 3.5 pts |
| Photo review | 25 pts | 37 pts | 50 pts | 87 pts |
| Quiz completion | 15 pts | — | — | — |
| Welcome bonus | 50 pts | — | — | — |
| Referral (referrer) | 100 pts | — | — | — |
| Birthday month | 2× multiplier | 3× total | 4× total | 7× total |

**Example earnings:**
- VIP LITE spends $100 → 150 points
- VIP CLUB box ($49) → 98 points
- VIP CLUB+ box ($79) → 276 points

### Redeeming Points (Freebies!)

#### Entry Level (All Tiers)
| Reward | Points | Value |
|--------|--------|-------|
| Free Shipping | 50 | ~$10 |
| $5 Off | 75 | $5 |
| Mini Developer (50ml) | 100 | ~$8 |
| Color Gloves (5 pack) | 125 | ~$10 |

#### Mid Level (CLUB+)
| Reward | Points | Value |
|--------|--------|-------|
| $10 Off | 150 | $10 |
| Application Brush Set | 150 | ~$15 |
| Extra Sample in Box | 50 | ~$5 |
| Premium Accessory Upgrade | 100 | ~$12 |

#### Premium Level (CLUB+ Only)
| Reward | Points | Value |
|--------|--------|-------|
| Free Color Tube (any shade) | 300 | ~$25 |
| Color Mixing Bowl Kit | 250 | ~$20 |
| $20 Off | 300 | $20 |
| Developer + Color Combo | 500 | ~$45 |
| Full Application Kit | 600 | ~$60 |
| VIP Consultation | 750 | ~$100 |
| Custom Shade Creation | 1000 | Priceless |

---

## Technical Architecture

### Custom Shopify App (Separate Repository)

The VIP Club system will be a **custom Shopify app** installed on both stores:
- `lucvincentcoloration.com` (Coloration Pro)
- `lucvincent.com` (Haircare)

**Key principle:** All billing stays within Shopify (no Stripe/third-party processors).

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────┐         ┌─────────────────┐          │
│   │ COLORATION PRO  │         │    HAIRCARE     │          │
│   │    Shopify      │◄───────►│    Shopify      │          │
│   │                 │         │                 │          │
│   │  - Payments     │         │  - Payments     │          │
│   │  - Checkout     │         │  - Checkout     │          │
│   │  - Subscriptions│         │  - Subscriptions│          │
│   └────────┬────────┘         └────────┬────────┘          │
│            │                           │                    │
│            └───────────┬───────────────┘                    │
│                        │                                    │
│            ┌───────────┴───────────┐                        │
│            │  LUC VINCENT VIP APP  │                        │
│            │    (Shopify App)      │                        │
│            │                       │                        │
│            │  ┌─────────────────┐  │                        │
│            │  │   App Database  │  │                        │
│            │  │   (PostgreSQL)  │  │                        │
│            │  │                 │  │                        │
│            │  │ - Members       │  │                        │
│            │  │ - Points ledger │  │                        │
│            │  │ - Rewards       │  │                        │
│            │  │ - Redemptions   │  │                        │
│            │  └─────────────────┘  │                        │
│            │                       │                        │
│            │  Features:            │                        │
│            │  - Subscription mgmt  │                        │
│            │  - Points calculation │                        │
│            │  - Reward redemption  │                        │
│            │  - Customer Account   │                        │
│            │    Extension          │                        │
│            │  - Theme App Block    │                        │
│            └───────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Custom Shopify App** (separate repository: `~/clawd/lv-vip-app`)
   - Built with Shopify Remix template
   - PostgreSQL database (via Prisma)
   - Installed on both Coloration + Haircare stores
   - Single source of truth for loyalty data

2. **Shopify Subscriptions API**
   - Native Shopify recurring billing
   - No third-party payment processor
   - Selling plans for $1 first box → regular pricing
   - 4/5/6 week delivery intervals

3. **Customer Account Extension**
   - Native Shopify account integration
   - Members manage subscriptions from their account
   - Points balance, redemption history
   - Referral code sharing

4. **Theme App Extension**
   - App blocks for loyalty page
   - Points widget for storefront
   - Subscription selector component
   - Data fetched via App Proxy or Storefront API

### Cross-Store Sync

Both stores connect to the **same app database**:
- Member identified by email (canonical)
- Shopify customer IDs stored per-store
- Points earned on either store go to same balance
- Rewards redeemable on either store (filtered by `brand` field)

### Shopify APIs Used

**Subscriptions (native billing):**
- Selling Plan Groups API — Define $1 first box + regular price
- Subscription Contracts API — Manage active subscriptions
- Billing Cycles API — Handle 4/5/6 week cadence

**Loyalty/Rewards:**
- Discount Codes API — Generate reward codes
- Customer Metafields — Store points balance cache
- Order Webhooks — Award points on purchase

**Customer Portal:**
- Customer Account UI Extensions — Native account integration
- Account API — Fetch subscription/points data

### Theme Integration

The theme (this repository) includes:
- `sections/lv-vip-subscription-selector.liquid` — Tier/cadence selection
- Loyalty page sections — How it works, rewards catalog, etc.

Data is populated by:
1. **App Proxy** — `/apps/vip/*` routes to app backend
2. **Metafields** — Cached data on customer record
3. **Theme App Blocks** — Rendered by the app extension

---

## Subscription Selector Component

The existing `lv-subscription-selector.liquid` needs updating for the new tier structure:

### States

1. **Guest (not logged in)**
   - Show tier comparison
   - CTA: "Join VIP LITE (Free)" / "Subscribe to VIP CLUB"

2. **VIP LITE member**
   - Show current benefits
   - Upgrade CTA: "Upgrade to VIP CLUB — $1 first box!"

3. **VIP CLUB member**
   - Show subscription status
   - Cadence selector (4/5/6 weeks)
   - Routine selector
   - Next box preview
   - Upgrade CTA: "Upgrade to CLUB+"

4. **VIP CLUB+ member**
   - Full status dashboard
   - All controls
   - Exclusive content access

### Cadence Selector UI

```
┌─────────────────────────────────────────────────────┐
│  Delivery Frequency                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ 4 weeks │  │ 5 weeks │  │ 6 weeks │            │
│  │  $49    │  │  $49 ✓  │  │  $49    │            │
│  │ Popular │  │ Default │  │ Best    │            │
│  │         │  │         │  │ Value   │            │
│  └─────────┘  └─────────┘  └─────────┘            │
│                                                     │
│  Next delivery: February 28, 2026                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Loyalty Page Structure

The loyalty page should clearly explain:

1. **Hero Section**
   - "The Inner Circle" branding
   - Current tier + points balance (if logged in)
   - Join CTA (if not member)

2. **How It Works**
   - Earn points on every purchase
   - Multipliers by tier
   - Visual earning examples

3. **Tier Comparison**
   - Side-by-side LITE / CLUB / CLUB+ benefits
   - Clear upgrade path
   - $1 first box highlight

4. **Rewards Catalog**
   - Filterable by points/category
   - "Redeem" buttons
   - Stock indicators for limited items

5. **Referral Section**
   - Personal referral code
   - "Give $10, Get 100 points"
   - Share buttons

6. **FAQ**
   - How do points work across sites?
   - Can I pause my subscription?
   - When do points expire?

---

## Implementation Phases

### Phase 1: App Foundation (Week 1-2)
- [ ] Create app repository (`~/clawd/lv-vip-app`)
- [ ] Scaffold with Shopify Remix template
- [ ] Set up PostgreSQL database (Prisma)
- [ ] Basic app installation flow for both stores
- [ ] Webhook subscriptions (orders, customers)

### Phase 2: Subscriptions via Shopify (Week 3-4)
- [ ] Create Selling Plan Groups ($1 first box → regular)
- [ ] Selling plan for 4/5/6 week intervals
- [ ] Subscription contract management
- [ ] Skip/pause/cancel functionality
- [ ] Sync subscription status to app database

### Phase 3: Loyalty System (Week 5-6)
- [ ] Points ledger in app database
- [ ] Points earning on order webhooks
- [ ] Tier multiplier calculation
- [ ] Reward catalog management
- [ ] Discount code generation via Shopify API
- [ ] Referral tracking

### Phase 4: Customer Account Extension (Week 7-8)
- [ ] Build Customer Account UI Extension
- [ ] Subscription management UI
- [ ] Points balance & history
- [ ] Reward redemption interface
- [ ] Referral code sharing

### Phase 5: Theme Integration (Week 9-10)
- [ ] Theme App Extension (app blocks)
- [ ] Loyalty page data via App Proxy
- [ ] Points widget component
- [ ] Update `lv-vip-subscription-selector` section
- [ ] Sync across both stores

### Phase 6: Polish (Week 11-12)
- [ ] Klaviyo integration (email flows)
- [ ] Admin dashboard in app
- [ ] Analytics & reporting
- [ ] QA & testing
- [ ] Documentation

---

## Questions to Resolve

1. **Points expiration?** — Do points expire? If so, after how long?
2. **Cross-brand redemption?** — Can Haircare points be spent on Coloration rewards?
3. **Tier downgrade?** — What happens to CLUB benefits if someone cancels?
4. **Pharmacy integration?** — How do retail customers earn points? (Receipt upload? QR code?)
5. **Academy content?** — Is there existing content, or does it need to be created?
6. **App hosting?** — Where will the Shopify app be hosted? (Vercel, Fly.io, Railway?)
7. **Database hosting?** — Managed PostgreSQL provider? (PlanetScale, Neon, Railway?)

---

## Repository Structure

```
~/clawd/
├── coloration-pro/          # This repo - Coloration Shopify theme
│   ├── sections/
│   │   └── lv-vip-subscription-selector.liquid
│   └── VIP_CLUB_SPEC.md     # This document
│
└── lv-vip-app/              # NEW - Shopify app (to be created)
    ├── app/                 # Remix app
    ├── prisma/              # Database schema
    ├── extensions/
    │   ├── customer-account/  # Customer Account UI Extension
    │   └── theme-app/         # Theme App Extension
    └── README.md
```

---

*Last updated: January 27, 2026*
